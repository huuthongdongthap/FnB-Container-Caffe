      /**
 * Orders — Update order handler with state machine, loyalty, referrals, ERPNext triggers
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { parseJSON } from '../model/helpers';
import { isTerminal } from '../model/order-state-machine';
import { transitionOrderStatus, changedRows } from '../policies/order-status-transition';
import type { ErpnextEnv } from 'worker/src/clients/erpnext-client';
import type { WorkerEnv } from 'worker/src/clients/erpnext-accounting-client';

const log = createLogger({ route: 'orders' });
const ORDER_FIELD_STAFF_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'cashier', 'waiter', 'staff'];

export async function updateOrder(
  request: Request,
  env: Record<string, unknown>,
  id: string,
  actorRole?: string,
  tenantId: string = 'default'
) {
  try {
    const body = await parseJSON(request);
    if (body.payment_status !== undefined) {
      return errorResponse('Payment status can only be changed by a verified PayOS webhook or authorized COD collection', 400);
    }
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const rawTenantId = (tenantId || '').trim() || 'default';
    const normalizedRole = (actorRole || '').trim().toLowerCase();
    if (rawTenantId === '*' || rawTenantId.toLowerCase() === 'hq') {
      if (normalizedRole !== 'owner' && normalizedRole !== 'admin') {
        return errorResponse('Forbidden wildcard tenant scope for non-HQ role', 403);
      }
      tenantId = '*';
    } else {
      tenantId = rawTenantId;
    }

    const tenantClause = tenantId === '*'
      ? ''
      : tenantId === 'default'
        ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')"
        : ' AND tenant_id = ?';
    const tenantBinds = tenantId === '*' ? [] : [tenantId];

    // Fetch full row — needed for DO broadcast payload below
    let results: Record<string, unknown>[];
    try {
      const q = await db.prepare(
        `SELECT id, status, items, total, payment_status, customer_name, customer_phone, table_id, created_at, tenant_id FROM orders WHERE id = ?${tenantClause}`
      ).bind(id, ...tenantBinds).all<Record<string, unknown>>();
      results = q.results ?? [];
    } catch (selectErr) {
      if (!/no such column:\s*tenant_id/i.test(String(selectErr)) || (tenantId !== 'default' && tenantId !== '*')) {
        throw selectErr;
      }
      const q = await db.prepare(
        `SELECT id, status, items, total, payment_status, customer_name, customer_phone, table_id, created_at FROM orders WHERE id = ?`
      ).bind(id).all<Record<string, unknown>>();
      results = q.results ?? [];
    }

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    const currentStatus = String(results[0].status ?? '');
    if ((body.notes !== undefined || body.delivery_time !== undefined) && isTerminal(currentStatus)) {
      return errorResponse('Cannot modify a completed or cancelled order', 400);
    }
    if (
      (body.notes !== undefined || body.delivery_time !== undefined) &&
      actorRole &&
      !ORDER_FIELD_STAFF_ROLES.includes(actorRole)
    ) {
      return errorResponse('Insufficient permissions to update order fields', 403);
    }

    if (body.status !== undefined) {
      const transition = await transitionOrderStatus(db, id, String(body.status), actorRole, {
        tenantId,
        currentOrder: results[0] as { id: string; status: string },
        fields: { notes: body.notes, delivery_time: body.delivery_time },
      });
      if (!transition.success) return errorResponse(transition.error!, transition.statusCode || 400);
      if (transition.idempotent) return jsonResponse({ success: true, idempotent: true });
    } else {
      const fields = ['notes', 'delivery_time'].filter(field => body[field] !== undefined);
      if (!fields.length) return errorResponse('No valid fields to update', 400);
      const rawLoadedTenant = (results[0] as Record<string, unknown> | undefined)?.tenant_id;
      const loadedOrderTenant =
        typeof rawLoadedTenant === 'string' && rawLoadedTenant.trim() && rawLoadedTenant.trim() !== '*' && rawLoadedTenant.trim() !== 'hq'
          ? rawLoadedTenant.trim()
          : (tenantId !== '*' ? tenantId : (rawLoadedTenant !== undefined ? 'default' : '*'));
      const updateTenantClause = loadedOrderTenant === '*'
        ? ''
        : loadedOrderTenant === 'default'
          ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')"
          : ' AND tenant_id = ?';
      const updateTenantBinds = loadedOrderTenant === '*' ? [] : [loadedOrderTenant];
      const result = await db.prepare(
        `UPDATE orders SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?${updateTenantClause}`,
      ).bind(...fields.map(field => body[field]), id, results[0].status, ...updateTenantBinds).run();
      if (changedRows(result) < 1) return errorResponse('Order changed concurrently; refresh and retry', 409);
    }

    // Broadcast order status change via KV for SSE subscribers
    if (body.status !== undefined && env.AUTH_KV) {
      const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      kv.put(`order_event:${id}`, JSON.stringify({
        orderId: id,
        status: body.status,
        timestamp: new Date().toISOString()
      }), { expirationTtl: 60 }).catch(() => {});
    }

    // ── DO Broadcast (KDS + realtime clients) ──────────────────────
    // Mirror create-order.ts: publish post-update state so KDS dashboards
    // and any DO WebSocket subscribers see status changes live.
    if (body.status !== undefined && (env as Record<string, unknown>).ORDER_BROADCASTER) {
      const ns = (env as Record<string, unknown>).ORDER_BROADCASTER as import('@cloudflare/workers-types').DurableObjectNamespace;
      const stub = ns.get(ns.idFromName(id));
      const row = results[0];
      const items = typeof row.items === 'string' ? JSON.parse(row.items as string) : (row.items ?? []);
      ;(async () => {
        try {
          await (stub as unknown as { broadcast(msg: unknown): Promise<void> }).broadcast({
            orderId: id,
            status: body.status as string,
            payment_status: String(row.payment_status ?? 'unpaid'),
            items,
            total: Number(row.total ?? 0),
            customer_name: String(row.customer_name ?? ''),
            customer_phone: String(row.customer_phone ?? ''),
            table_id: row.table_id ? String(row.table_id) : null,
            createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
            updatedAt: Date.now(),
          });
        } catch (e) {
          log.warn('DO broadcast error (non-blocking):', { message: (e as Error).message, orderId: id });
        }
      })();
    }

    if (body.status === 'cancelled') {
      const rawOrderTenantForCancel = (results[0] as Record<string, unknown> | undefined)?.tenant_id;
      const orderTenantForCancel =
        typeof rawOrderTenantForCancel === 'string' && rawOrderTenantForCancel.trim()
          ? rawOrderTenantForCancel.trim()
          : (tenantId && tenantId !== '*' ? tenantId : undefined);

      // Restore inventory (idempotent — no-op if no reserves exist)
      try {
        const { restoreInventoryForOrder } = await import('@aura/domain-inventory');
        await restoreInventoryForOrder(env as any, id, orderTenantForCancel);
      } catch (invErr) {
        log.error('Inventory restore error (non-blocking):', { message: (invErr as Error).message, orderId: id });
      }

      const effectiveCancelTenant = orderTenantForCancel || 'default';

      // Reverse loyalty accrual if order had already earned points/cashback
      try {
        let earnRow = await db.prepare(
          "SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, effectiveCancelTenant).first<{ customer_id: string; amount?: number }>().catch(() => null);
        if (!earnRow && effectiveCancelTenant === 'default') {
          const fallbackEarn = await db.prepare(
            "SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1"
          ).bind(id).first<{ customer_id: string; amount?: number; tenant_id?: string | null }>().catch(() => null);
          if (
            fallbackEarn &&
            (!('tenant_id' in fallbackEarn) ||
              fallbackEarn.tenant_id === undefined ||
              (String(fallbackEarn.tenant_id ?? '').trim() || 'default') === effectiveCancelTenant)
          ) {
            earnRow = fallbackEarn;
          }
        }
        if (earnRow?.customer_id) {
          const { loadPolicy, reverseAccrual } = await import('@aura/domain-crm');
          const policy = await loadPolicy(
            db,
            env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined,
            new Date(),
            orderTenantForCancel
          ).catch(() => null);
          if (policy) {
            await reverseAccrual(db, policy, {
              orderId: id,
              customerId: earnRow.customer_id,
              refundAmountVnd: Number(results[0]?.total ?? 0),
              reason: 'order_cancelled',
              ...(orderTenantForCancel ? { tenantId: orderTenantForCancel } : {}),
            });
          }
        }
        const cancelPaymentStatus = String(results[0]?.payment_status ?? '')
          .trim()
          .toLowerCase();
        let cancelCustomerId =
          (results[0]?.customer_id ? String(results[0].customer_id).trim() : '') ||
          (earnRow?.customer_id ? String(earnRow.customer_id).trim() : '');
        if (!cancelCustomerId) {
          const ordCustRow = await db
            .prepare('SELECT customer_id FROM orders WHERE id = ? LIMIT 1')
            .bind(id)
            .first<{ customer_id?: string | null }>()
            .catch(() => null);
          if (ordCustRow?.customer_id) {
            cancelCustomerId = String(ordCustRow.customer_id).trim();
          }
        }
        const cancelTotalVnd = Number(results[0]?.total ?? results[0]?.total_amount ?? 0);
        if (
          cancelCustomerId &&
          cancelTotalVnd > 0 &&
          (cancelPaymentStatus === 'paid' || cancelPaymentStatus === 'completed' || Boolean(earnRow?.customer_id))
        ) {
          await db
            .prepare(
              "UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(cancelTotalVnd, cancelCustomerId, effectiveCancelTenant)
            .run()
            .catch(() => {
              if (effectiveCancelTenant === 'default') {
                return db
                  .prepare('UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ?')
                  .bind(cancelTotalVnd, cancelCustomerId)
                  .run()
                  .catch(() => {});
              }
            });
        }
      } catch (revAccErr) {
        log.warn('Loyalty accrual reversal error (non-blocking):', { message: (revAccErr as Error).message, orderId: id });
      }

      // Refund spent cashback on cancellation if not already refunded
      try {
        const existingRefund = await db.prepare(
          "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, effectiveCancelTenant).first<{ id?: string }>().catch(() =>
          effectiveCancelTenant === 'default'
            ? db.prepare(
                "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' LIMIT 1"
              ).bind(id).first<{ id?: string }>().catch(() => null)
            : null
        );
        if (!existingRefund?.id) {
          const spendRow = await db.prepare(
            "SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type IN ('spend', 'redeem') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
          ).bind(id, effectiveCancelTenant).first<{ id?: string; customer_id?: string; amount?: number }>().catch(() =>
            effectiveCancelTenant === 'default'
              ? db.prepare(
                  "SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type = 'spend' LIMIT 1"
                ).bind(id).first<{ id?: string; customer_id?: string; amount?: number }>().catch(() => null)
              : null
          );
          let refundCustomerId = spendRow?.customer_id ? String(spendRow.customer_id).trim() : '';
          let refundAmount = Number(spendRow?.amount ?? 0);
          if (!refundCustomerId || !(refundAmount > 0)) {
            const ordSpend = await db.prepare(
              "SELECT customer_id, cashback_used FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(id, effectiveCancelTenant).first<{ customer_id?: string | null; cashback_used?: number | null }>().catch(() =>
              effectiveCancelTenant === 'default'
                ? db.prepare(
                    'SELECT customer_id, cashback_used FROM orders WHERE id = ?'
                  ).bind(id).first<{ customer_id?: string | null; cashback_used?: number | null }>().catch(() => null)
                : null
            );
            if (!refundCustomerId && ordSpend?.customer_id) {
              refundCustomerId = String(ordSpend.customer_id).trim();
            }
            if (!(refundAmount > 0) && Number(ordSpend?.cashback_used ?? 0) > 0) {
              refundAmount = Number(ordSpend?.cashback_used ?? 0);
            }
          }
          if (refundCustomerId && refundAmount > 0) {
            const wRow = await db.prepare(
              "SELECT id FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
            ).bind(refundCustomerId, effectiveCancelTenant).first<{ id?: string }>().catch(() =>
              effectiveCancelTenant === 'default'
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
              ).bind(refundTxId, walletId, refundCustomerId, id, refundAmount, effectiveCancelTenant, id, effectiveCancelTenant).run();
              const changes = (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
                ?? (insRes as unknown as { changes?: number })?.changes;
              if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
            } catch {
              if (effectiveCancelTenant === 'default') {
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
              ).bind(refundAmount, refundAmount, refundCustomerId, effectiveCancelTenant).run().catch(() =>
                db.prepare(
                  "UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
                ).bind(refundAmount, refundCustomerId, effectiveCancelTenant).run()
              ).catch(() => {
                if (effectiveCancelTenant === 'default') {
                  return db.prepare(
                    "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = datetime('now') WHERE customer_id = ?"
                  ).bind(refundAmount, refundAmount, refundCustomerId).run().catch(() =>
                    db.prepare(
                      "UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ?"
                    ).bind(refundAmount, refundCustomerId).run().catch(() => {})
                  );
                }
              });
              await db.prepare(
                "UPDATE orders SET cashback_used = 0 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(id, effectiveCancelTenant).run().catch(() => {
                if (effectiveCancelTenant === 'default') {
                  return db.prepare(
                    'UPDATE orders SET cashback_used = 0 WHERE id = ?'
                  ).bind(id).run().catch(() => {});
                }
              });
            }
          }
        }
      } catch (refSpendErr) {
        log.warn('Cashback spend refund error (non-blocking):', { message: (refSpendErr as Error).message, orderId: id });
      }

      // Release promotion redemption usage count if redeemed on this order
      const decrementedPromoIds = new Set<string>();
      try {
        const redRow = await db.prepare(
          "SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, effectiveCancelTenant).first<{ promotion_id?: string; code?: string }>().catch(() =>
          effectiveCancelTenant === 'default'
            ? db.prepare(
                'SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? LIMIT 1'
              ).bind(id).first<{ promotion_id?: string; code?: string }>().catch(() => null)
            : null
        );
        if (redRow && (redRow.promotion_id || redRow.code)) {
          if (redRow.promotion_id) decrementedPromoIds.add(String(redRow.promotion_id).trim());
          const promoTenantForCancel = effectiveCancelTenant;
          try {
            await db.prepare(
              `UPDATE promotions
               SET current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END,
                   used_count = CASE WHEN COALESCE(used_count, 0) > 0 THEN used_count - 1 ELSE 0 END,
                   usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END
               WHERE (id = ? OR UPPER(code) = UPPER(?)) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(redRow.promotion_id ?? '', redRow.code ?? '', promoTenantForCancel).run();
          } catch {
            try {
              await db.prepare(
                "UPDATE promotions SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END WHERE (id = ? OR code = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              ).bind(redRow.promotion_id ?? '', redRow.code ?? '', promoTenantForCancel).run();
            } catch {
              if (promoTenantForCancel === 'default') {
                await db.prepare(
                  'UPDATE promotions SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ? OR code = ?'
                ).bind(redRow.promotion_id ?? '', redRow.code ?? '').run().catch(() => {});
              }
            }
          }
          await db.prepare(
            "DELETE FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, effectiveCancelTenant).run().catch(() => {
            if (effectiveCancelTenant === 'default') {
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
        ).bind(id, effectiveCancelTenant).all<{ id?: string; promotion_id?: string }>().catch(async () => {
          if (effectiveCancelTenant !== 'default') {
            const singleTenant = await db.prepare(
              "SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
            ).bind(id, effectiveCancelTenant).first<{ id?: string; promotion_id?: string }>().catch(() => null);
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
            ).bind(promoId, effectiveCancelTenant).run().catch(async () => {
              try {
                await db.prepare(
                  "UPDATE promotions SET usage_count = MAX(0, COALESCE(usage_count, 0) - 1) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
                ).bind(promoId, effectiveCancelTenant).run();
              } catch {
                if (effectiveCancelTenant === 'default') {
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
          ).bind(id, effectiveCancelTenant).run().catch(() => {
            if (effectiveCancelTenant === 'default') {
              return db.prepare('DELETE FROM promotion_usages WHERE order_id = ?').bind(id).run().catch(() => {});
            }
          });
        }
      } catch {
        // Optional promotion_usages table in partial schemas
      }

      let refRow: { id: string } | null = null;
      try {
        refRow = await db.prepare(
          "SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(id, effectiveCancelTenant).first<{ id: string }>().catch(() =>
          effectiveCancelTenant === 'default'
            ? db.prepare(
                "SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed'"
              ).bind(id).first<{ id: string }>().catch(() => null)
            : null
        );
      } catch {
        // Ignore if referrals table does not include first_order_id column
      }
      if (refRow) {
        try {
          const { reverseReferralCashback } = await import('@aura/domain-crm');
          await reverseReferralCashback(db, refRow.id, orderTenantForCancel);
        } catch (revErr) {
          log.error('Reverse cashback error (non-blocking):', { message: (revErr as Error).message });
        }
      }
      try {
        const cancelPayNow = new Date().toISOString();
        await db.prepare(
          "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND status = 'pending'"
        ).bind(cancelPayNow, id, effectiveCancelTenant).run().catch(() => {
          if (effectiveCancelTenant === 'default') {
            return db.prepare(
              "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending'"
            ).bind(cancelPayNow, id).run().catch(() => {});
          }
        });
      } catch {
        // Optional payments table in partial schemas
      }
    }

    if (env.AUTH_KV) {
      const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      const nowIso = new Date().toISOString();
      await kv.put('latest_order_ts', nowIso);
      await kv.put('orders:latest_updated_at', nowIso).catch(() => {});
    }

    // Loyalty credit — single call, idempotent (skips if earn already exists or order is terminal non-earning/refunded)
    const effectivePostUpdateStatus = String(body.status ?? currentStatus).trim().toLowerCase();
    const effectivePaymentStatus = String(results[0]?.payment_status ?? '').trim().toLowerCase();
    if (
      !['cancelled', 'rejected', 'failed', 'expired', 'refunded'].includes(effectivePostUpdateStatus) &&
      effectivePaymentStatus !== 'refunded'
    ) {
      try {
        const { creditLoyaltyIfEligible } = await import('../policies/loyalty-trigger');
        await creditLoyaltyIfEligible(db, env, id);
      } catch (loyaltyErr) {
        log.error('Loyalty credit error (non-blocking):', { message: (loyaltyErr as Error).message, orderId: id });
      }
    }

    if (['served', 'completed'].includes(body.status as string)) {

      // Customer-domain visit capture (additive — never blocks completion):
      // one visit row + VisitRecorded event per completed order.
      try {
        const order = await db.prepare(
          `SELECT total, order_type, table_id, customer_email, customer_phone, tenant_id FROM orders WHERE id = ?${tenantClause}`
        ).bind(id, ...tenantBinds).first<{ total: number; order_type: string | null; table_id: string | null; customer_email: string | null; customer_phone: string | null; tenant_id?: string | null }>().catch(() =>
          (tenantId === 'default' || tenantId === '*')
            ? db.prepare(
                'SELECT total, order_type, table_id, customer_email, customer_phone FROM orders WHERE id = ?'
              ).bind(id).first<{ total: number; order_type: string | null; table_id: string | null; customer_email: string | null; customer_phone: string | null; tenant_id?: string | null }>()
            : null
        );

        if (order) {
          const { sanitizeCustomerIdentity } = await import('../policies/loyalty-trigger');
          const { normalizedPhone, email: sanitizedEmail } = sanitizeCustomerIdentity(
            order.customer_phone,
            order.customer_email,
          );
          const orderTenant = typeof order.tenant_id === 'string' && order.tenant_id.trim()
            ? order.tenant_id.trim()
            : (tenantId && tenantId !== '*' ? tenantId : 'default');
          let visitCustomer: { id: string } | null = null;
          if (normalizedPhone || sanitizedEmail) {
            try {
              visitCustomer = await db.prepare(
                "SELECT id FROM customers WHERE ((email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)) AND (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?4) LIMIT 1"
              ).bind(sanitizedEmail, normalizedPhone, orderTenant, orderTenant).first<{ id: string }>();
            } catch {
              if (orderTenant === 'default' || orderTenant === '*') {
                visitCustomer = await db.prepare(
                  'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
                ).bind(sanitizedEmail, normalizedPhone).first<{ id: string }>().catch(() => null);
              }
            }
          }

          if (visitCustomer) {
            const { recordVisit } = await import('@aura/domain-customer');
            // dine_in + table_id = QR-table order; dine_in without = walk-in.
            const visitChannel: 'in_store' | 'qr_table' | 'online_pickup' | 'online_delivery' =
              order.order_type === 'delivery' ? 'online_delivery'
              : order.order_type === 'takeaway' ? 'online_pickup'
              : order.table_id ? 'qr_table'
              : 'in_store';
            const visitResult = await recordVisit({
              db, customerId: visitCustomer.id, orderId: id,
              spent: order.total, channel: visitChannel,
              tenantId: orderTenant
            });
            if (visitResult.created) {
              log.info('Visit recorded', { customer_id: visitCustomer.id, order_id: id, channel: visitChannel });
            }
          }
        }
      } catch (visitErr) {
        log.warn('Visit capture error (non-blocking):', { message: (visitErr as Error).message, orderId: id });
      }

      try {
        const order = await db.prepare(
          `SELECT total, payment_status, customer_id, customer_email, customer_phone, tenant_id FROM orders WHERE id = ?${tenantClause}`
        ).bind(id, ...tenantBinds).first<{ total: number; payment_status?: string | null; customer_id?: string | null; customer_email: string | null; customer_phone: string | null; tenant_id?: string | null }>().catch(() =>
          (tenantId === 'default' || tenantId === '*')
            ? db.prepare(
                'SELECT total, payment_status, customer_id, customer_email, customer_phone FROM orders WHERE id = ?'
              ).bind(id).first<{ total: number; payment_status?: string | null; customer_id?: string | null; customer_email: string | null; customer_phone: string | null; tenant_id?: string | null }>()
            : null
        );

        const hasPaymentStatusCol = Boolean(order && (order as Record<string, unknown>).payment_status !== undefined);
        const normalizedOrderPayStatus = String(order?.payment_status ?? '').trim().toLowerCase();
        if (order && order.total >= 20000 && (!hasPaymentStatusCol || normalizedOrderPayStatus === 'paid')) {
          let customerId = order.customer_id || null;
          if (!customerId) {
            const { sanitizeCustomerIdentity } = await import('../policies/loyalty-trigger');
            const { normalizedPhone, email: sanitizedEmail } = sanitizeCustomerIdentity(
              order.customer_phone,
              order.customer_email,
            );
            const orderTenant = typeof order.tenant_id === 'string' && order.tenant_id.trim()
              ? order.tenant_id.trim()
              : (tenantId && tenantId !== '*' ? tenantId : 'default');
            let customer: { id: string } | null = null;
            if (normalizedPhone || sanitizedEmail) {
              try {
                customer = await db.prepare(
                  "SELECT id FROM customers WHERE ((email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)) AND (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?4) LIMIT 1"
                ).bind(sanitizedEmail, normalizedPhone, orderTenant, orderTenant).first<{ id: string }>();
              } catch {
                if (orderTenant === 'default' || orderTenant === '*') {
                  customer = await db.prepare(
                    'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
                  ).bind(sanitizedEmail, normalizedPhone).first<{ id: string }>().catch(() => null);
                }
              }
            }
            customerId = customer?.id || null;
          }

          if (customerId) {
            const { rewardReferralOnFirstOrder, resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('@aura/domain-crm');
            const orderTenantForRef =
              typeof order.tenant_id === 'string' && order.tenant_id.trim()
                ? order.tenant_id.trim()
                : (tenantId && tenantId !== '*' ? tenantId : undefined);
            const refPolicy = await resolveReferralPolicy(env.AUTH_KV as any, orderTenantForRef).catch(() => DEFAULT_REFERRAL_POLICY);
            const result = await rewardReferralOnFirstOrder(
              db, customerId, id, order.total, refPolicy, orderTenantForRef
            );
            if (result.success) {
              log.info('Refer v3: +10k cashback granted', { customer_id: customerId });
            }
          }
        }
      } catch (referErr) {
        log.warn('Refer v3 error (non-blocking):', { message: (referErr as Error).message });
      }

      // ERPNext e-invoice trigger (fire-and-forget, non-blocking)
      if (env.AUTH_KV) {
        const rawErpTenant = (results[0] as Record<string, unknown> | undefined)?.tenant_id;
        const erpOrderTenant =
          typeof rawErpTenant === 'string' && rawErpTenant.trim()
            ? rawErpTenant.trim()
            : (tenantId && tenantId !== '*' ? tenantId : 'default');
        const erpTask = (async () => {
          try {
            const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
            const erpPrefix = erpOrderTenant === 'default' ? 'erpnext' : `erpnext:${erpOrderTenant}`;
            // Never fall back to the default tenant's ERPNext URL for a
            // non-default store, as that would push another store's orders into
            // HQ's accounting ledger.
            const erpnextUrl = await kv.get(`${erpPrefix}:api_url`);
            if (!erpnextUrl) {
              log.info('ERPNext not configured via KV, skipping e-invoice');
              return;
            }

            const orderRow = await db.prepare(
              'SELECT id, items, customer_phone, customer_email, customer_name, customer_address, total, shipping_fee, discount, created_at, notes FROM orders WHERE id = ?'
            ).bind(id).first<Record<string, unknown>>();

            if (!orderRow) {
              log.warn('Order not found for ERPNext invoice', { order_id: id });
              return;
            }

            const { createErpnextClientWithKv } = await import('worker/src/clients/erpnext-client');
            const { ErpnextAccountingClient } = await import('worker/src/clients/erpnext-accounting-client');

            const erpnextClient = await createErpnextClientWithKv(
              env as unknown as ErpnextEnv & { AUTH_KV?: import('@cloudflare/workers-types').KVNamespace },
              erpOrderTenant
            );
            if (!erpnextClient) {
              log.error('Failed to create ERPNext client despite KV config', { order_id: id });
              return;
            }

            const accountingClient = new ErpnextAccountingClient(erpnextClient, db);

            await accountingClient.processOrderToInvoice({
              id: orderRow.id as string,
              items: orderRow.items as string | Array<Record<string, unknown>> | undefined,
              customer_phone: orderRow.customer_phone as string | undefined,
              customer_email: orderRow.customer_email as string | undefined,
              customer_name: orderRow.customer_name as string | undefined,
              customer_address: orderRow.customer_address as string | undefined
            }, env as unknown as WorkerEnv, erpOrderTenant);

            log.info('ERPNext e-invoice created', { order_id: id });
          } catch (erpErr) {
            log.error('ERPNext e-invoice error (non-blocking):', { message: (erpErr as Error).message, order_id: id });
          }
        })();
        const execCtx = env.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
        try {
          execCtx?.waitUntil?.(erpTask);
        } catch {
          // waitUntil unavailable in unit test context
        }
      }
    }

    return jsonResponse({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    log.error('UpdateOrder error:', { message: (error as Error).message });
    return errorResponse('Failed to update order', 500);
  }
}
