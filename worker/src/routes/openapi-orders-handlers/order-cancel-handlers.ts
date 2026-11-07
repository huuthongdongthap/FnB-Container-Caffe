import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { executeKdsStatusTransition } from '@aura/domain-kitchen';
import { restoreInventoryForOrder } from '@aura/domain-inventory';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { fetchOrderItemsAndPayments, formatCustomerOrder, formatOrder, resolveOpenApiOrdersTenant } from './helpers';
import { fetchOrderForRead } from './order-read-handlers';

export async function runOrderCancellationRollback(params: {
  db: D1Database;
  env?: Env;
  id: string;
  existing: Record<string, unknown>;
  cancelTenant: string;
  now: string;
  reason?: string;
}): Promise<void> {
  const { db, env, id, existing, cancelTenant, now, reason } = params;

  await restoreInventoryForOrder({ AURA_DB: db as any, ...(env || {}) }, id, cancelTenant).catch(() => {});

  try {
    await db.prepare(
      "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(now, id, cancelTenant).run().catch(async () => {
      try {
        await db.prepare(
          "UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, cancelTenant).run();
      } catch {
        if (cancelTenant === 'default') {
          await db.prepare(
            "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending'"
          ).bind(now, id).run().catch(() =>
            db.prepare("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'").bind(id).run().catch(() => {})
          );
        }
      }
    });
  } catch {
    // Optional payments table in partial schemas
  }

  try {
    await db.prepare(
      "UPDATE order_items SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(now, id, cancelTenant).run().catch(() => {
      if (cancelTenant === 'default') {
        return db.prepare(
          "UPDATE order_items SET status = 'cancelled', updated_at = ? WHERE order_id = ?"
        ).bind(now, id).run();
      }
    });
  } catch {
    // Column status/updated_at absent in canonical order_items schema
  }

  let accruedCustomerDecremented = false;
  try {
    let earnRow = await db.prepare(
      "SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(id, cancelTenant).first<{ customer_id?: string }>().catch(() => null);
    if (!earnRow && cancelTenant === 'default') {
      const fallbackEarn = await db.prepare(
        "SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1"
      ).bind(id).first<{ customer_id?: string; tenant_id?: string | null }>().catch(() => null);
      if (
        fallbackEarn &&
        (!('tenant_id' in fallbackEarn) ||
          fallbackEarn.tenant_id === undefined ||
          matchesTenantRow(fallbackEarn as Record<string, unknown>, cancelTenant))
      ) {
        earnRow = fallbackEarn;
      }
    }
    if (!earnRow) {
      let ptRow = await db.prepare(
        "SELECT customer_id FROM loyalty_point_logs WHERE order_id = ? AND points_change > 0 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(id, cancelTenant).first<{ customer_id?: string }>().catch(() => null);
      if (!ptRow && cancelTenant === 'default') {
        const fallbackPt = await db.prepare(
          'SELECT customer_id FROM loyalty_point_logs WHERE order_id = ? AND points_change > 0 LIMIT 1'
        ).bind(id).first<{ customer_id?: string; tenant_id?: string | null }>().catch(() => null);
        if (
          fallbackPt &&
          (!('tenant_id' in fallbackPt) ||
            fallbackPt.tenant_id === undefined ||
            matchesTenantRow(fallbackPt as Record<string, unknown>, cancelTenant))
        ) {
          ptRow = fallbackPt;
        }
      }
      if (ptRow?.customer_id) {
        earnRow = ptRow;
      }
    }
    if (earnRow?.customer_id) {
      const totalVnd = Number(existing.total ?? existing.total_amount ?? 0);
      const { loadPolicy, reverseAccrual } = await import('@aura/domain-crm');
      const policy = await loadPolicy(db, env?.AUTH_KV, new Date(), cancelTenant).catch(() => null);
      if (policy) {
        await reverseAccrual(db, policy, {
          orderId: id,
          customerId: earnRow.customer_id,
          refundAmountVnd: totalVnd,
          tenantId: cancelTenant,
          reason: reason || 'order_cancelled',
        }).catch(() => {});
      }
      if (totalVnd > 0) {
        accruedCustomerDecremented = true;
        await db.prepare(
          "UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(totalVnd, earnRow.customer_id, cancelTenant).run().catch(() => {
          if (cancelTenant === 'default') {
            return db.prepare(
              'UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ?'
            ).bind(totalVnd, earnRow!.customer_id).run().catch(() => {});
          }
        });
      }
    }
  } catch {
    // Optional loyalty tables in partial schemas
  }

  try {
    const existingRefund = await db.prepare(
      "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(id, cancelTenant).first<{ id?: string }>().catch(() =>
      cancelTenant === 'default'
        ? db.prepare(
            "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' LIMIT 1"
          ).bind(id).first<{ id?: string }>().catch(() => null)
        : null
    );
    if (!existingRefund?.id) {
      const spendRow = await db.prepare(
        "SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type IN ('spend', 'redeem') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(id, cancelTenant).first<{ id?: string; customer_id?: string; amount?: number }>().catch(() =>
        cancelTenant === 'default'
          ? db.prepare(
              "SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type = 'spend' LIMIT 1"
            ).bind(id).first<{ id?: string; customer_id?: string; amount?: number }>().catch(() => null)
          : null
      );
      let refundCustomerId = spendRow?.customer_id ? String(spendRow.customer_id).trim() : '';
      let refundAmount = Number(spendRow?.amount ?? 0);
      if (!refundCustomerId && existing.customer_id) {
        refundCustomerId = String(existing.customer_id).trim();
      }
      if (!(refundAmount > 0)) {
        const orderCashbackUsed = Number(existing.cashback_used ?? 0);
        if (orderCashbackUsed > 0) refundAmount = orderCashbackUsed;
      }
      if (refundCustomerId && refundAmount > 0) {
        const wRow = await db.prepare(
          "SELECT id FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(refundCustomerId, cancelTenant).first<{ id?: string }>().catch(() =>
          cancelTenant === 'default'
            ? db.prepare(
                'SELECT id FROM cashback_wallets WHERE customer_id = ? LIMIT 1'
              ).bind(refundCustomerId).first<{ id?: string }>().catch(() => null)
            : null
        );
        const walletId = wRow?.id || `wal_${refundCustomerId}`;
        const refundTxId = `cb_ref_${id}`;
        let insertedRefund = true;
        try {
          const insRes = await db.prepare(
            `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, tenant_id, created_at)
             SELECT ?, ?, ?, ?, 'refund', ?, ?, datetime('now')
             WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
          ).bind(refundTxId, walletId, refundCustomerId, id, refundAmount, cancelTenant, id, cancelTenant).run();
          const changes = (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
            ?? (insRes as unknown as { changes?: number })?.changes;
          if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
        } catch {
          if (cancelTenant === 'default') {
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
          } else {
            insertedRefund = false;
          }
        }
        if (insertedRefund) {
          await db.prepare(
            "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(refundAmount, refundAmount, refundCustomerId, cancelTenant).run().catch(async () => {
            try {
              await db.prepare(
                "UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(refundAmount, refundCustomerId, cancelTenant).run();
            } catch {
              if (cancelTenant === 'default') {
                await db.prepare(
                  "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = datetime('now') WHERE customer_id = ?"
                ).bind(refundAmount, refundAmount, refundCustomerId).run().catch(() =>
                  db.prepare(
                    "UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ?"
                  ).bind(refundAmount, refundCustomerId).run().catch(() => {})
                );
              }
            }
          });
          if (!accruedCustomerDecremented) {
            await db.prepare(
              "UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(refundAmount, refundCustomerId, cancelTenant).run().catch(() => {
              if (cancelTenant === 'default') {
                return db.prepare(
                  'UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ?'
                ).bind(refundAmount, refundCustomerId).run().catch(() => {});
              }
            });
          }
          await db.prepare(
            "UPDATE orders SET cashback_used = 0 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, cancelTenant).run().catch(() => {
            if (cancelTenant === 'default') {
              return db.prepare(
                'UPDATE orders SET cashback_used = 0 WHERE id = ?'
              ).bind(id).run().catch(() => {});
            }
          });
        }
      }
    }
  } catch {
    // Optional cashback tables in partial schemas
  }

  try {
    const refRow = await db.prepare(
      "SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(id, cancelTenant).first<{ id?: string }>().catch(() =>
      cancelTenant === 'default'
        ? db.prepare(
            "SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' LIMIT 1"
          ).bind(id).first<{ id?: string }>().catch(() => null)
        : null
    );
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
      "SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(id, cancelTenant).first<{ promotion_id?: string; code?: string }>().catch(() =>
      cancelTenant === 'default'
        ? db.prepare(
            'SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? LIMIT 1'
          ).bind(id).first<{ promotion_id?: string; code?: string }>().catch(() => null)
        : null
    );
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
      await db.prepare(
        "DELETE FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, cancelTenant).run().catch(() => {
        if (cancelTenant === 'default') {
          return db.prepare('DELETE FROM promotion_redemptions WHERE order_id = ?').bind(id).run().catch(() => {});
        }
      });
    }
  } catch {
    // Optional promotion_redemptions table in partial schemas
  }

  try {
    const usageRes = await db.prepare(
      "SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, cancelTenant).all<{ id?: string; promotion_id?: string }>().catch(async () => {
      if (cancelTenant !== 'default') {
        const singleTenant = await db.prepare(
          "SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, cancelTenant).first<{ id?: string; promotion_id?: string }>().catch(() => null);
        return { results: singleTenant ? [singleTenant] : [] };
      }
      const fallbackAll = await db.prepare(
        'SELECT id, promotion_id FROM promotion_usages WHERE order_id = ?'
      ).bind(id).all<{ id?: string; promotion_id?: string }>().catch(() => null);
      if (fallbackAll?.results) return fallbackAll;
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
      await db.prepare(
        "DELETE FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, cancelTenant).run().catch(() => {
        if (cancelTenant === 'default') {
          return db.prepare('DELETE FROM promotion_usages WHERE order_id = ?').bind(id).run().catch(() => {});
        }
      });
    }
  } catch {
    // Optional promotion_usages table in partial schemas
  }
}

export async function resolveCustomerOwnerIdsForMutation(
  db: ReturnType<typeof getDatabase>,
  user: Record<string, any> | undefined,
  tenantId: string,
): Promise<string[]> {
  if (!user || user.role !== 'customer') return [];
  const ids = new Set<string>();
  for (const candidate of [user.id, user.sub, user.customerId, user.customer_id]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      ids.add(candidate.trim());
    }
  }
  const userId =
    typeof user.id === 'string' && user.id.trim()
      ? user.id.trim()
      : typeof user.sub === 'string' && user.sub.trim()
        ? user.sub.trim()
        : '';
  if (userId) {
    try {
      const res: { results?: Array<{ id?: string }> } =
        tenantId !== '*'
          ? await db
              .prepare(
                "SELECT id FROM customers WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(userId, tenantId)
              .all<{ id?: string }>()
              .catch(async (): Promise<{ results?: Array<{ id?: string }> }> =>
                tenantId === 'default'
                  ? await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all<{ id?: string }>()
                  : { results: [] }
              )
          : await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all<{ id?: string }>();
      for (const row of res?.results || []) {
        if (row?.id && String(row.id).trim()) {
          ids.add(String(row.id).trim());
        }
      }
      if (!res?.results?.length) {
        const single =
          tenantId !== '*'
            ? await db
                .prepare(
                  "SELECT id FROM customers WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
                )
                .bind(userId, tenantId)
                .first<{ id?: string }>()
                .catch(async () =>
                  tenantId === 'default'
                    ? await db.prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1').bind(userId).first<{ id?: string }>()
                    : null
                )
            : await db.prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1').bind(userId).first<{ id?: string }>();
        if (single?.id && String(single.id).trim()) {
          ids.add(String(single.id).trim());
        }
      }
    } catch {
      // Optional user_id column in minimal test schemas
    }
  }
  return Array.from(ids);
}

export async function handleCancelOrder(c: Context<{ Bindings: Env }>) {
  const tenantCheck = resolveOpenApiOrdersTenant(c, 'write');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json().catch(() => ({})));
  const user = c.get('user');
  const now = new Date().toISOString();

  const rawTenantId = (tenantCheck.tenantId || 'default').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const customer = user?.role === 'customer';
  const ownerIds = customer ? await resolveCustomerOwnerIdsForMutation(db, user as Record<string, any> | undefined, tenantId) : [];
  if (customer && ownerIds.length === 0) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  const customerClause = customer
    ? (ownerIds.length === 1 ? ' AND customer_id = ?' : ` AND customer_id IN (${ownerIds.map(() => '?').join(', ')})`)
    : '';
  const tenantParamIdx = customer ? ownerIds.length + 2 : 2;
  const tenantClause = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ` AND (tenant_id = ? OR TRIM(tenant_id) = ?${tenantParamIdx})`;
  const clause = `${customerClause}${tenantClause}`;
  const scope = customer
    ? (tenantId === '*' ? [...ownerIds] : [...ownerIds, tenantId])
    : (tenantId === '*' ? [] : [tenantId]);
  let existing = (await db.prepare(`SELECT * FROM orders WHERE id = ?${clause}`).bind(id, ...scope).first().catch(async () => {
    if (tenantId === 'default') {
      const fallbackScope = customer ? [...ownerIds] : [];
      return db.prepare(`SELECT * FROM orders WHERE id = ?${customerClause}`).bind(id, ...fallbackScope).first();
    }
    return null;
  })) as {
    id: string; status: string; payment_status?: string | null; customer_id?: string | null; tenant_id?: string;
  } | null;
  if (existing && customer) {
    const ordCustId = existing.customer_id ? String(existing.customer_id).trim() : '';
    if (!ordCustId || !ownerIds.includes(ordCustId)) {
      existing = null;
    }
  }
  if (existing && tenantId !== '*' && 'tenant_id' in existing && existing.tenant_id !== undefined) {
    if (!matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) existing = null;
  }
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const rawExistingTenant =
    existing.tenant_id &&
    String(existing.tenant_id).trim() &&
    String(existing.tenant_id).trim() !== '*' &&
    String(existing.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(existing.tenant_id).trim()
      : undefined;
  const cancelTenant = customer
    ? (rawExistingTenant || 'default')
    : (tenantId === '*' ? (rawExistingTenant || 'default') : (rawExistingTenant || tenantId || 'default'));

  // Idempotent cancellation
  if (existing.status === 'cancelled') {
    const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id, cancelTenant);
    return c.json({
      success: true,
      message: 'Already cancelled',
      data: customer ? formatCustomerOrder(existing, orderItems) : formatOrder(existing, orderItems, payments),
    });
  }

  if (customer && String(existing.payment_status || '').trim().toLowerCase() === 'paid') {
    return c.json({ success: false, error: 'Paid orders cannot be cancelled by customer' }, 409);
  }

  // All aliases share tenant confinement, role/state validation and compare-and-set.
  const transition = await executeKdsStatusTransition(db, id, 'cancelled', user?.role, {
    tenantId: customer ? (rawExistingTenant || 'default') : (tenantId === '*' ? (rawExistingTenant || 'default') : tenantId),
    kv: c.env?.AUTH_KV,
    env: c.env as unknown as Record<string, unknown>,
    skipCancelSideEffects: true,
  });
  if (!transition.success) return c.json({ success: false, error: transition.error }, (transition.statusCode || 400) as any);

  await runOrderCancellationRollback({
    db,
    env: c.env,
    id,
    existing: existing as unknown as Record<string, unknown>,
    cancelTenant,
    now,
    reason: body.reason || 'order_cancelled',
  });

  const actor = user?.id || 'system';
  const auditTenant = cancelTenant === '*' ? 'default' : (cancelTenant || 'default');
  const metaStr = JSON.stringify({ reason: body.reason || 'User cancelled', tenant_id: auditTenant });
  try {
    await db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(`audit_${crypto.randomUUID()}`, actor, 'order_cancel', 'order', id, metaStr, auditTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(actor, actor, actor, 'order_cancel', 'order', id, 'order', id, metaStr, metaStr, auditTenant, now).run();
    } catch {
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
      await db.prepare(
        "UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = 'order_cancel' AND created_at = ?"
      ).bind(auditTenant, id, id, now).run().catch(() => {});
    }
  }

  let updated = await fetchOrderForRead(db, id, cancelTenant).catch(() => null);
  if (!updated && cancelTenant === 'default') {
    updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first().catch(() => null);
  }
  if (!updated) return c.json({ success: false, error: 'Order not found after cancellation' }, 404);

  const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id, cancelTenant);
  return c.json({
    success: true,
    data: customer ? formatCustomerOrder(updated, orderItems) : formatOrder(updated, orderItems, payments),
  });
}