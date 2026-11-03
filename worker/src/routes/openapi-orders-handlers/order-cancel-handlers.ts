import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { executeKdsStatusTransition } from '@aura/domain-kitchen';
import { restoreInventoryForOrder } from '@aura/domain-inventory';
import { getTenantId } from '../../middleware/tenant';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { fetchOrderItemsAndPayments, formatCustomerOrder, formatOrder } from './helpers';

export async function handleCancelOrder(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json().catch(() => ({})));
  const user = c.get('user');
  const now = new Date().toISOString();

  const tenantId = getTenantId(c).trim() || 'default';
  const customer = user?.role === 'customer';
  const tenantParamIdx = customer ? 3 : 2;
  const tenantClause = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ` AND (tenant_id = ? OR TRIM(tenant_id) = ?${tenantParamIdx})`;
  const clause = customer ? ` AND customer_id = ?${tenantClause}` : tenantClause;
  const scope = customer
    ? (tenantId === '*' ? [user.id] : [user.id, tenantId])
    : (tenantId === '*' ? [] : [tenantId]);
  let existing = (await db.prepare(`SELECT * FROM orders WHERE id = ?${clause}`).bind(id, ...scope).first().catch(async () => {
    if (tenantId === 'default') {
      const fallbackClause = customer ? ' AND customer_id = ?' : '';
      const fallbackScope = customer ? [user.id] : [];
      return db.prepare(`SELECT * FROM orders WHERE id = ?${fallbackClause}`).bind(id, ...fallbackScope).first();
    }
    return null;
  })) as {
    id: string; status: string; customer_id?: string | null; tenant_id?: string;
  } | null;
  if (existing && tenantId !== '*' && 'tenant_id' in existing && existing.tenant_id !== undefined) {
    if (!matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) existing = null;
  }
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  // Idempotent cancellation
  if (existing.status === 'cancelled') {
    const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
    return c.json({
      success: true,
      message: 'Already cancelled',
      data: customer ? formatCustomerOrder(existing, orderItems) : formatOrder(existing, orderItems, payments),
    });
  }

  const rawExistingTenant = existing.tenant_id && String(existing.tenant_id).trim() ? String(existing.tenant_id).trim() : undefined;
  const cancelTenant = customer
    ? (rawExistingTenant || 'default')
    : (tenantId === '*' ? (rawExistingTenant || 'default') : (rawExistingTenant || tenantId || 'default'));

  // All aliases share tenant confinement, role/state validation and compare-and-set.
  const transition = await executeKdsStatusTransition(db, id, 'cancelled', user?.role, {
    tenantId: customer ? (rawExistingTenant || 'default') : (tenantId === '*' ? (rawExistingTenant || 'default') : tenantId),
    kv: c.env.AUTH_KV,
    env: c.env as unknown as Record<string, unknown>,
    skipCancelSideEffects: true,
  });
  if (!transition.success) return c.json({ success: false, error: transition.error }, (transition.statusCode || 400) as any);

  await restoreInventoryForOrder({ AURA_DB: db as any }, id, cancelTenant).catch(() => {});

  try {
    await db.prepare(
      "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending'"
    ).bind(now, id).run();
  } catch {
    // Optional payments table in partial schemas
  }

  try {
    await db.prepare(
      'UPDATE order_items SET status = \'cancelled\', updated_at = ? WHERE order_id = ?'
    ).bind(now, id).run();
  } catch {
    // Column status/updated_at absent in canonical order_items schema
  }

  // Reverse loyalty accrual, referral reward, and promotion redemption usage on cancellation
  try {
    const earnRow = await db.prepare(
      "SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1"
    ).bind(id).first<{ customer_id?: string }>();
    if (earnRow?.customer_id) {
      const { loadPolicy, reverseAccrual } = await import('@aura/domain-crm');
      const policy = await loadPolicy(db, c.env?.AUTH_KV, new Date(), cancelTenant).catch(() => null);
      if (policy) {
        const totalVnd = Number((existing as Record<string, unknown>).total ?? (existing as Record<string, unknown>).total_amount ?? 0);
        await reverseAccrual(db, policy, {
          orderId: id,
          customerId: earnRow.customer_id,
          refundAmountVnd: totalVnd,
          tenantId: cancelTenant,
          reason: body.reason || 'order_cancelled',
        }).catch(() => {});
      }
    }
  } catch {
    // Optional loyalty tables in partial schemas
  }

  try {
    const existingRefund = await db.prepare(
      "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(id, cancelTenant).first<{ id?: string }>().catch(() =>
      db.prepare(
        "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' LIMIT 1"
      ).bind(id).first<{ id?: string }>().catch(() => null)
    );
    if (!existingRefund?.id) {
      const spendRow = await db.prepare(
        "SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type IN ('spend', 'redeem') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(id, cancelTenant).first<{ id?: string; customer_id?: string; amount?: number }>().catch(() =>
        db.prepare(
          "SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type = 'spend' LIMIT 1"
        ).bind(id).first<{ id?: string; customer_id?: string; amount?: number }>().catch(() => null)
      );
      let refundCustomerId = spendRow?.customer_id ? String(spendRow.customer_id).trim() : '';
      let refundAmount = Number(spendRow?.amount ?? 0);
      if (!refundCustomerId && existing.customer_id) {
        refundCustomerId = String(existing.customer_id).trim();
      }
      if (!(refundAmount > 0)) {
        const orderCashbackUsed = Number((existing as Record<string, unknown>).cashback_used ?? 0);
        if (orderCashbackUsed > 0) refundAmount = orderCashbackUsed;
      }
      if (refundCustomerId && refundAmount > 0) {
        const wRow = await db.prepare(
          "SELECT id FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(refundCustomerId, cancelTenant).first<{ id?: string }>().catch(() =>
          db.prepare(
            'SELECT id FROM cashback_wallets WHERE customer_id = ? LIMIT 1'
          ).bind(refundCustomerId).first<{ id?: string }>().catch(() => null)
        );
        const walletId = wRow?.id || `wal_${refundCustomerId}`;
        const refundTxId = `cb_ref_${id}`;
        let insertedRefund = true;
        try {
          const insRes = await db.prepare(
            `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, tenant_id, created_at)
             SELECT ?, ?, ?, ?, 'refund', ?, ?, datetime('now')
             WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund')`
          ).bind(refundTxId, walletId, refundCustomerId, id, refundAmount, cancelTenant, id).run();
          const changes = (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
            ?? (insRes as unknown as { changes?: number })?.changes;
          if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
        } catch {
          try {
            const insRes = await db.prepare(
              `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, created_at)
               SELECT ?, ?, ?, ?, 'refund', ?, datetime('now')
               WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund')`
            ).bind(refundTxId, walletId, refundCustomerId, id, refundAmount, id).run();
            const changes = (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
              ?? (insRes as unknown as { changes?: number })?.changes;
            if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
          } catch {
            try {
              await db.prepare(
                "INSERT INTO cashback_transactions (id, customer_id, order_id, type, amount, created_at) VALUES (?, ?, ?, 'refund', ?, datetime('now'))"
              ).bind(refundTxId, refundCustomerId, id, refundAmount).run();
            } catch {
              // Optional cashback_transactions schema differences
            }
          }
        }
        if (insertedRefund) {
          await db.prepare(
            "UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(refundAmount, refundCustomerId, cancelTenant).run().catch(() =>
            db.prepare(
              "UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ?"
            ).bind(refundAmount, refundCustomerId).run().catch(() => {})
          );
          await db.prepare(
            "UPDATE orders SET cashback_used = 0 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, cancelTenant).run().catch(() =>
            db.prepare(
              'UPDATE orders SET cashback_used = 0 WHERE id = ?'
            ).bind(id).run().catch(() => {})
          );
        }
      }
    }
  } catch {
    // Optional cashback tables in partial schemas
  }

  try {
    const refRow = await db.prepare(
      "SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' LIMIT 1"
    ).bind(id).first<{ id?: string }>();
    if (refRow?.id) {
      const { reverseReferralCashback } = await import('@aura/domain-crm');
      await reverseReferralCashback(db, refRow.id, cancelTenant).catch(() => {});
    }
  } catch {
    // Optional referrals table in partial schemas
  }

  const decrementedPromoIds = new Set<string>();
  try {
    const redRow = await db.prepare(
      'SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? LIMIT 1'
    ).bind(id).first<{ promotion_id?: string; code?: string }>();
    if (redRow && (redRow.promotion_id || redRow.code)) {
      const promoTenant = cancelTenant;
      if (redRow.promotion_id) {
        decrementedPromoIds.add(String(redRow.promotion_id).trim());
        await db.prepare(
          `UPDATE promotions
           SET current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END,
               used_count = CASE WHEN COALESCE(used_count, 0) > 0 THEN used_count - 1 ELSE 0 END,
               usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(redRow.promotion_id, promoTenant).run().catch(async () => {
          try {
            await db.prepare(
              "UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(redRow.promotion_id, promoTenant).run();
          } catch {
            if (promoTenant === 'default') {
              await db.prepare(
                'UPDATE promotions SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ?'
              ).bind(redRow.promotion_id).run().catch(() => {});
            }
          }
        });
      } else if (redRow.code) {
        await db.prepare(
          `UPDATE promotions
           SET current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END,
               used_count = CASE WHEN COALESCE(used_count, 0) > 0 THEN used_count - 1 ELSE 0 END,
               usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END
           WHERE UPPER(code) = UPPER(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(redRow.code, promoTenant).run().catch(async () => {
          try {
            await db.prepare(
              "UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE UPPER(code) = UPPER(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(redRow.code, promoTenant).run();
          } catch {
            if (promoTenant === 'default') {
              await db.prepare(
                'UPDATE promotions SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END WHERE UPPER(code) = UPPER(?)'
              ).bind(redRow.code).run().catch(() => {});
            }
          }
        });
      }
      await db.prepare('DELETE FROM promotion_redemptions WHERE order_id = ?').bind(id).run().catch(() => {});
    }
  } catch {
    // Optional promotion_redemptions table in partial schemas
  }

  try {
    const usageRes = await db.prepare(
      'SELECT id, promotion_id FROM promotion_usages WHERE order_id = ?'
    ).bind(id).all<{ id?: string; promotion_id?: string }>().catch(async () => {
      const single = await db.prepare(
        'SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? LIMIT 1'
      ).bind(id).first<{ id?: string; promotion_id?: string }>().catch(() => null);
      return { results: single ? [single] : [] };
    });
    const usageRows = usageRes?.results ?? [];
    for (const usageRow of usageRows) {
      const promoId = usageRow.promotion_id ? String(usageRow.promotion_id).trim() : '';
      if (promoId && !decrementedPromoIds.has(promoId)) {
        decrementedPromoIds.add(promoId);
        await db.prepare(
          `UPDATE promotions
           SET current_uses = MAX(0, COALESCE(current_uses, 0) - 1),
               used_count = MAX(0, COALESCE(used_count, 0) - 1),
               usage_count = MAX(0, COALESCE(usage_count, 0) - 1)
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(promoId, cancelTenant).run().catch(async () => {
          try {
            await db.prepare(
              "UPDATE promotions SET usage_count = MAX(0, COALESCE(usage_count, 0) - 1) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(promoId, cancelTenant).run();
          } catch {
            if (cancelTenant === 'default') {
              await db.prepare(
                'UPDATE promotions SET usage_count = MAX(0, COALESCE(usage_count, 0) - 1) WHERE id = ?'
              ).bind(promoId).run().catch(() => {});
            }
          }
        });
      }
    }
    if (usageRows.length > 0) {
      await db.prepare('DELETE FROM promotion_usages WHERE order_id = ?').bind(id).run().catch(() => {});
    }
  } catch {
    // Optional promotion_usages table in partial schemas
  }

  const actor = user?.id || 'system';
  const metaStr = JSON.stringify({ reason: body.reason || 'User cancelled' });
  try {
    await db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(`audit_${crypto.randomUUID()}`, actor, 'order_cancel', 'order', id, metaStr, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(actor, actor, actor, 'order_cancel', 'order', id, 'order', id, metaStr, metaStr, now).run();
    } catch {
      await db.prepare(`INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(actor, actor, 'order_cancel', 'order', id, metaStr, now).run().catch(() => {});
    }
  }

  const updated = await db.prepare(`SELECT o.*, COALESCE(t.table_number, t.id) as table_name FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE o.id = ?`).bind(id).first();
  if (!updated) return c.json({ success: false, error: 'Order not found after cancellation' }, 404);

  const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id);
  return c.json({
    success: true,
    data: customer ? formatCustomerOrder(updated, orderItems) : formatOrder(updated, orderItems, payments),
  });
}