/**
 * Canonical KDS Status Transition Coordinator
 * Single server-authoritative status transition executor for all KDS channels.
 */

import { transitionOrderStatus, type OrderStatusDb, type OrderStatusResult } from '../../order/policies/order-status-transition';

export type TransitionKdsResult = OrderStatusResult;
export type KdsTransitionDb = OrderStatusDb;

export interface KdsTransitionOptions {
  tenantId?: string;
  kv?: { put(key: string, val: string, opts?: { expirationTtl?: number }): Promise<void> } | null;
  waitUntil?: (promise: Promise<unknown>) => void;
  env?: Record<string, unknown>;
  skipCancelSideEffects?: boolean;
}

/**
 * Executes a canonical order state machine transition for KDS.
 * Enforces:
 * - Order existence
 * - Idempotency (same state returns success: true, idempotent: true)
 * - Terminal state immutability (completed, cancelled, failed, expired)
 * - Structural transition validity (canTransition)
 * - Actor role permissions (canActorTransition)
 */
export async function executeKdsStatusTransition(
  db: KdsTransitionDb,
  orderId: string,
  targetStatus: string,
  userRole?: string,
  options?: KdsTransitionOptions,
): Promise<TransitionKdsResult> {
  const result = await transitionOrderStatus(db, orderId, targetStatus, userRole, { tenantId: options?.tenantId });
  if (!result.success || result.idempotent) return result;
  const order = result.order!;
  const now = new Date().toISOString();

  if (targetStatus === 'cancelled' && !options?.skipCancelSideEffects) {
    const rawDb = db as unknown as import('@cloudflare/workers-types').D1Database;
    const rawRequestedCancelTenant = options?.tenantId && options.tenantId.trim() ? options.tenantId.trim() : undefined;
    const requestedCancelTenant =
      rawRequestedCancelTenant && (rawRequestedCancelTenant === '*' || rawRequestedCancelTenant.toLowerCase() === 'hq')
        ? '*'
        : rawRequestedCancelTenant;
    const ordRow = await (requestedCancelTenant && requestedCancelTenant !== '*'
      ? rawDb
          .prepare(
            "SELECT total, total_amount, tenant_id, customer_id, cashback_used FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
          )
          .bind(orderId, requestedCancelTenant)
          .first<{ total?: number; total_amount?: number; payment_status?: string | null; tenant_id?: string | null; customer_id?: string | null; cashback_used?: number | null }>()
          .catch(() =>
            requestedCancelTenant === 'default'
              ? rawDb
                  .prepare('SELECT total, total_amount, tenant_id, customer_id, cashback_used FROM orders WHERE id = ?')
                  .bind(orderId)
                  .first<{ total?: number; total_amount?: number; payment_status?: string | null; tenant_id?: string | null; customer_id?: string | null; cashback_used?: number | null }>()
                  .catch(() => null)
              : null,
          )
      : rawDb
          .prepare('SELECT total, total_amount, tenant_id, customer_id, cashback_used FROM orders WHERE id = ?')
          .bind(orderId)
          .first<{ total?: number; total_amount?: number; payment_status?: string | null; tenant_id?: string | null; customer_id?: string | null; cashback_used?: number | null }>()
          .catch(() => null));
    const ordTenantAttr =
      ordRow?.tenant_id &&
      String(ordRow.tenant_id).trim() &&
      String(ordRow.tenant_id).trim() !== '*' &&
      String(ordRow.tenant_id).trim().toLowerCase() !== 'hq'
        ? String(ordRow.tenant_id).trim()
        : undefined;
    const resolvedTenant =
      ordTenantAttr ||
      (requestedCancelTenant && requestedCancelTenant !== '*' ? requestedCancelTenant : undefined);
    const effectiveCancelTenant = resolvedTenant || 'default';
    try {
      const { restoreInventoryForOrder } = await import('@aura/domain-inventory');
      await restoreInventoryForOrder({ AURA_DB: rawDb }, orderId, effectiveCancelTenant);
    } catch {
      // Non-blocking when inventory tables are absent in minimal test schemas
    }
    try {
      let earnRow = await rawDb
        .prepare("SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
        .bind(orderId, effectiveCancelTenant)
        .first<{ customer_id?: string }>()
        .catch(() => null);
      if (!earnRow && effectiveCancelTenant === 'default') {
        const fallbackEarn = await rawDb
          .prepare("SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1")
          .bind(orderId)
          .first<{ customer_id?: string; tenant_id?: string | null }>()
          .catch(() => null);
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
        const totalVnd = Number(ordRow?.total ?? ordRow?.total_amount ?? 0);
        const ordTenant = effectiveCancelTenant;
        const policy = await loadPolicy(rawDb, options?.kv as any, new Date(), ordTenant).catch(() => null);
        if (policy) {
          await reverseAccrual(rawDb, policy, {
            orderId,
            customerId: earnRow.customer_id,
            refundAmountVnd: totalVnd,
            reason: 'order_cancelled',
            tenantId: ordTenant,
          }).catch(() => {});
        }
      }
      const cancelPaymentStatus = String(
        ordRow?.payment_status ?? (order as Record<string, unknown>).payment_status ?? '',
      )
        .trim()
        .toLowerCase();
      const cancelCustomerId =
        (ordRow?.customer_id ? String(ordRow.customer_id).trim() : '') ||
        (earnRow?.customer_id ? String(earnRow.customer_id).trim() : '');
      const cancelTotalVnd = Number(ordRow?.total ?? ordRow?.total_amount ?? 0);
      if (
        cancelCustomerId &&
        cancelTotalVnd > 0 &&
        (cancelPaymentStatus === 'paid' || cancelPaymentStatus === 'completed' || Boolean(earnRow?.customer_id))
      ) {
        await rawDb
          .prepare(
            "UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
          )
          .bind(cancelTotalVnd, cancelCustomerId, effectiveCancelTenant)
          .run()
          .catch(() => {
            if (effectiveCancelTenant === 'default') {
              return rawDb
                .prepare('UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ?')
                .bind(cancelTotalVnd, cancelCustomerId)
                .run()
                .catch(() => {});
            }
          });
      }
      const existingRefund = await rawDb
        .prepare("SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
        .bind(orderId, effectiveCancelTenant)
        .first<{ id?: string }>()
        .catch(() =>
          effectiveCancelTenant === 'default'
            ? rawDb
                .prepare("SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' LIMIT 1")
                .bind(orderId)
                .first<{ id?: string }>()
                .catch(() => null)
            : null
        );
      if (!existingRefund?.id) {
        const spendRow = await rawDb
          .prepare("SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type IN ('spend', 'redeem') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
          .bind(orderId, effectiveCancelTenant)
          .first<{ id?: string; customer_id?: string; amount?: number }>()
          .catch(() =>
            effectiveCancelTenant === 'default'
              ? rawDb
                  .prepare("SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type = 'spend' LIMIT 1")
                  .bind(orderId)
                  .first<{ id?: string; customer_id?: string; amount?: number }>()
                  .catch(() => null)
              : null
          );
        let refundCustomerId = spendRow?.customer_id ? String(spendRow.customer_id).trim() : '';
        let refundAmount = Number(spendRow?.amount ?? 0);
        if (!refundCustomerId || !(refundAmount > 0)) {
          const ordSpend = ordRow ?? await rawDb
            .prepare("SELECT customer_id, cashback_used FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(orderId, effectiveCancelTenant)
            .first<{ customer_id?: string | null; cashback_used?: number | null }>()
            .catch(() =>
              effectiveCancelTenant === 'default'
                ? rawDb
                    .prepare('SELECT customer_id, cashback_used FROM orders WHERE id = ?')
                    .bind(orderId)
                    .first<{ customer_id?: string | null; cashback_used?: number | null }>()
                    .catch(() => null)
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
          const wRow = await rawDb
            .prepare("SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
            .bind(refundCustomerId, effectiveCancelTenant)
            .first<{ id?: string; balance?: number }>()
            .catch(() =>
              effectiveCancelTenant === 'default'
                ? rawDb
                    .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ? LIMIT 1')
                    .bind(refundCustomerId)
                    .first<{ id?: string; balance?: number }>()
                    .catch(() => null)
                : null
            );
          const walletId = wRow?.id || `wal_${refundCustomerId}`;
          const balanceAfter = Number(wRow?.balance ?? 0) + refundAmount;
          const refundTxId = `cb_ref_${orderId}`;
          let insertedRefund = true;
          try {
            const insRes = await rawDb
              .prepare(
                `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, tenant_id, created_at)
                 SELECT ?, ?, ?, ?, 'refund', ?, ?, ?, datetime('now')
                 WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
              )
              .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, balanceAfter, effectiveCancelTenant, orderId, effectiveCancelTenant)
              .run()
              .catch(() =>
                rawDb
                  .prepare(
                    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, tenant_id, created_at)
                     SELECT ?, ?, ?, ?, 'refund', ?, ?, datetime('now')
                     WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
                  )
                  .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, effectiveCancelTenant, orderId, effectiveCancelTenant)
                  .run(),
              );
            const changes = (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
              ?? (insRes as unknown as { changes?: number })?.changes;
            if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
          } catch {
            if (effectiveCancelTenant === 'default') {
              try {
                const insRes = await rawDb
                  .prepare(
                    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, created_at)
                     SELECT ?, ?, ?, ?, 'refund', ?, ?, datetime('now')
                     WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund')`,
                  )
                  .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, balanceAfter, orderId)
                  .run()
                  .catch(() =>
                    rawDb
                      .prepare(
                        `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, created_at)
                         SELECT ?, ?, ?, ?, 'refund', ?, datetime('now')
                         WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund')`,
                      )
                      .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, orderId)
                      .run(),
                  );
                const changes = (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
                  ?? (insRes as unknown as { changes?: number })?.changes;
                if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
              } catch {
                try {
                  await rawDb
                    .prepare(
                      "INSERT INTO cashback_transactions (id, customer_id, order_id, type, amount, created_at) VALUES (?, ?, ?, 'refund', ?, datetime('now'))",
                    )
                    .bind(refundTxId, refundCustomerId, orderId, refundAmount)
                    .run();
                } catch {
                  // Optional cashback_transactions schema differences
                }
              }
            } else {
              insertedRefund = false;
            }
          }
          if (insertedRefund) {
            await rawDb
              .prepare(
                "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
              )
              .bind(refundAmount, refundAmount, refundCustomerId, effectiveCancelTenant)
              .run()
              .catch(() =>
                rawDb
                  .prepare("UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
                  .bind(refundAmount, refundCustomerId, effectiveCancelTenant)
                  .run(),
              )
              .catch(() => {
                if (effectiveCancelTenant === 'default') {
                  return rawDb
                    .prepare(
                      "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = datetime('now') WHERE customer_id = ?",
                    )
                    .bind(refundAmount, refundAmount, refundCustomerId)
                    .run()
                    .catch(() =>
                      rawDb
                        .prepare("UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ?")
                        .bind(refundAmount, refundCustomerId)
                        .run()
                        .catch(() => {}),
                    );
                }
              });
            await rawDb
              .prepare("UPDATE orders SET cashback_used = 0 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(orderId, effectiveCancelTenant)
              .run()
              .catch(() => {
                if (effectiveCancelTenant === 'default') {
                  return rawDb
                    .prepare('UPDATE orders SET cashback_used = 0 WHERE id = ?')
                    .bind(orderId)
                    .run()
                    .catch(() => {});
                }
              });
          }
        }
      }
      const refRow = await rawDb
        .prepare("SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
        .bind(orderId, effectiveCancelTenant)
        .first<{ id?: string }>()
        .catch(() =>
          effectiveCancelTenant === 'default'
            ? rawDb
                .prepare("SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' LIMIT 1")
                .bind(orderId)
                .first<{ id?: string }>()
                .catch(() => null)
            : null
        );
      if (refRow?.id) {
        const { reverseReferralCashback } = await import('@aura/domain-crm');
        await reverseReferralCashback(rawDb, refRow.id, effectiveCancelTenant).catch(() => {});
      }
      const decrementedPromoIds = new Set<string>();
      const redRow = await rawDb
        .prepare("SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
        .bind(orderId, effectiveCancelTenant)
        .first<{ promotion_id?: string; code?: string }>()
        .catch(() =>
          effectiveCancelTenant === 'default'
            ? rawDb
                .prepare('SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? LIMIT 1')
                .bind(orderId)
                .first<{ promotion_id?: string; code?: string }>()
                .catch(() => null)
            : null
        );
      if (redRow && (redRow.promotion_id || redRow.code)) {
        const promoTenant = effectiveCancelTenant;
        if (redRow.promotion_id) {
          decrementedPromoIds.add(String(redRow.promotion_id).trim());
          await rawDb
            .prepare(
              `UPDATE promotions
               SET current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END,
                   used_count = CASE WHEN COALESCE(used_count, 0) > 0 THEN used_count - 1 ELSE 0 END,
                   usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
            )
            .bind(redRow.promotion_id, promoTenant)
            .run()
            .catch(async () => {
              try {
                await rawDb
                  .prepare(
                    "UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
                  )
                  .bind(redRow.promotion_id, promoTenant)
                  .run();
              } catch {
                if (promoTenant === 'default') {
                  await rawDb
                    .prepare('UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ?')
                    .bind(redRow.promotion_id)
                    .run()
                    .catch(() => {});
                }
              }
            });
        } else if (redRow.code) {
          await rawDb
            .prepare(
              `UPDATE promotions
               SET current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END,
                   used_count = CASE WHEN COALESCE(used_count, 0) > 0 THEN used_count - 1 ELSE 0 END,
                   usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END
               WHERE UPPER(code) = UPPER(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
            )
            .bind(redRow.code, promoTenant)
            .run()
            .catch(async () => {
              try {
                await rawDb
                  .prepare(
                    "UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE UPPER(code) = UPPER(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
                  )
                  .bind(redRow.code, promoTenant)
                  .run();
              } catch {
                if (promoTenant === 'default') {
                  await rawDb
                    .prepare('UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE UPPER(code) = UPPER(?)')
                    .bind(redRow.code)
                    .run()
                    .catch(() => {});
                }
              }
            });
        }
        await rawDb
          .prepare("DELETE FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(orderId, effectiveCancelTenant)
          .run()
          .catch(() => {
            if (effectiveCancelTenant === 'default') {
              return rawDb.prepare('DELETE FROM promotion_redemptions WHERE order_id = ?').bind(orderId).run().catch(() => {});
            }
          });
      }
      try {
        const usageRes = await rawDb
          .prepare("SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(orderId, effectiveCancelTenant)
          .all<{ id?: string; promotion_id?: string }>()
          .catch(async () => {
            if (effectiveCancelTenant !== 'default') {
              const singleTenant = await rawDb
                .prepare("SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
                .bind(orderId, effectiveCancelTenant)
                .first<{ id?: string; promotion_id?: string }>()
                .catch(() => null);
              return { results: singleTenant ? [singleTenant] : [] };
            }
            const fallbackAll = await rawDb
              .prepare('SELECT id, promotion_id FROM promotion_usages WHERE order_id = ?')
              .bind(orderId)
              .all<{ id?: string; promotion_id?: string }>()
              .catch(() => null);
            if (fallbackAll?.results) return fallbackAll;
            const single = await rawDb
              .prepare('SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? LIMIT 1')
              .bind(orderId)
              .first<{ id?: string; promotion_id?: string }>()
              .catch(() => null);
            return { results: single ? [single] : [] };
          });
        const usageRows = usageRes?.results ?? [];
        for (const usageRow of usageRows) {
          const promoId = usageRow.promotion_id ? String(usageRow.promotion_id).trim() : '';
          if (promoId && !decrementedPromoIds.has(promoId)) {
            decrementedPromoIds.add(promoId);
            await rawDb
              .prepare(
                `UPDATE promotions
                 SET current_uses = MAX(0, COALESCE(current_uses, 0) - 1),
                     used_count = MAX(0, COALESCE(used_count, 0) - 1),
                     usage_count = MAX(0, COALESCE(usage_count, 0) - 1)
                 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
              )
              .bind(promoId, effectiveCancelTenant)
              .run()
              .catch(async () => {
                try {
                  await rawDb
                    .prepare(
                      "UPDATE promotions SET usage_count = MAX(0, COALESCE(usage_count, 0) - 1) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
                    )
                    .bind(promoId, effectiveCancelTenant)
                    .run();
                } catch {
                  if (effectiveCancelTenant === 'default') {
                    await rawDb
                      .prepare('UPDATE promotions SET usage_count = MAX(0, COALESCE(usage_count, 0) - 1) WHERE id = ?')
                      .bind(promoId)
                      .run()
                      .catch(() => {});
                  }
                }
              });
          }
        }
        if (usageRows.length > 0) {
          await rawDb
            .prepare("DELETE FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(orderId, effectiveCancelTenant)
            .run()
            .catch(() => {
              if (effectiveCancelTenant === 'default') {
                return rawDb.prepare('DELETE FROM promotion_usages WHERE order_id = ?').bind(orderId).run().catch(() => {});
              }
            });
        }
      } catch {
        // Optional promotion_usages table in partial schemas
      }
      try {
        await rawDb
          .prepare(
            "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND status = 'pending'",
          )
          .bind(now, orderId, effectiveCancelTenant)
          .run()
          .catch(() => {
            if (effectiveCancelTenant === 'default') {
              return rawDb
                .prepare("UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending'")
                .bind(now, orderId)
                .run()
                .catch(() => {});
            }
          });
      } catch {
        // Optional payments table in partial schemas
      }
    } catch {
      // Optional CRM/promotion tables in partial schemas
    }
  }

  if (targetStatus === 'completed') {
    try {
      const rawDb = db as unknown as import('@cloudflare/workers-types').D1Database;
      const { creditLoyaltyIfEligible, sanitizeCustomerIdentity } = await import('../../order/policies/loyalty-trigger');
      const envForLoyalty = options?.env ?? (options?.kv ? { AUTH_KV: options.kv } : {});
      await creditLoyaltyIfEligible(rawDb, envForLoyalty, orderId).catch(() => {});

      const rawRequestedCompleteTenant = options?.tenantId && options.tenantId.trim() ? options.tenantId.trim() : undefined;
      const requestedCompleteTenant =
        rawRequestedCompleteTenant &&
        (rawRequestedCompleteTenant === '*' || rawRequestedCompleteTenant.toLowerCase() === 'hq')
          ? '*'
          : rawRequestedCompleteTenant;
      type CompletedOrdRow = {
        total?: number | null;
        total_amount?: number | null;
        payment_status?: string | null;
        order_type?: string | null;
        table_id?: string | null;
        customer_id?: string | null;
        customer_email?: string | null;
        customer_phone?: string | null;
        tenant_id?: string | null;
      };
      const ordRow = await (requestedCompleteTenant && requestedCompleteTenant !== '*'
        ? rawDb
            .prepare(
              "SELECT total, total_amount, payment_status, order_type, table_id, customer_id, customer_email, customer_phone, tenant_id FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
            )
            .bind(orderId, requestedCompleteTenant)
            .first<CompletedOrdRow>()
            .catch(() =>
              requestedCompleteTenant === 'default'
                ? rawDb
                    .prepare(
                      'SELECT total, total_amount, payment_status, order_type, table_id, customer_id, customer_email, customer_phone, tenant_id FROM orders WHERE id = ?',
                    )
                    .bind(orderId)
                    .first<CompletedOrdRow>()
                    .catch(() => null)
                : null,
            )
        : rawDb
            .prepare(
              'SELECT total, total_amount, payment_status, order_type, table_id, customer_id, customer_email, customer_phone, tenant_id FROM orders WHERE id = ?',
            )
            .bind(orderId)
            .first<CompletedOrdRow>()
            .catch(() => null));
      if (ordRow) {
        const { normalizedPhone, email: sanitizedEmail } = sanitizeCustomerIdentity(
          ordRow.customer_phone,
          ordRow.customer_email,
        );
        const ordTenant =
          (typeof ordRow.tenant_id === 'string' &&
            ordRow.tenant_id.trim() &&
            ordRow.tenant_id.trim() !== '*' &&
            ordRow.tenant_id.trim().toLowerCase() !== 'hq' &&
            ordRow.tenant_id.trim()) ||
          (requestedCompleteTenant && requestedCompleteTenant !== '*' ? requestedCompleteTenant : 'default');
        let resolvedCustId = ordRow.customer_id ? String(ordRow.customer_id).trim() || null : null;
        if (!resolvedCustId && (normalizedPhone || sanitizedEmail)) {
          let cust: { id: string } | null = null;
          try {
            cust = await rawDb
              .prepare(
                "SELECT id FROM customers WHERE ((email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)) AND (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?4) LIMIT 1",
              )
              .bind(sanitizedEmail, normalizedPhone, ordTenant, ordTenant)
              .first<{ id: string }>();
          } catch {
            if (ordTenant === 'default' || ordTenant === '*') {
              cust = await rawDb
                .prepare('SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1')
                .bind(sanitizedEmail, normalizedPhone)
                .first<{ id: string }>()
                .catch(() => null);
            }
          }
          resolvedCustId = cust?.id ?? null;
        }
        const totalVnd = Number(ordRow.total ?? ordRow.total_amount ?? 0);
        const rawPaymentStatus = String(
          ordRow.payment_status ?? (order as Record<string, unknown>).payment_status ?? '',
        )
          .trim()
          .toLowerCase();
        const isEligibleForVisit =
          !rawPaymentStatus ||
          !['pending', 'unpaid', 'failed', 'cancelled', 'canceled', 'refunded'].includes(rawPaymentStatus);
        if (resolvedCustId) {
          if (isEligibleForVisit) {
            try {
              const { recordVisit } = await import('@aura/domain-customer');
              const visitChannel: 'in_store' | 'qr_table' | 'online_pickup' | 'online_delivery' =
                ordRow.order_type === 'delivery'
                  ? 'online_delivery'
                  : ordRow.order_type === 'takeaway'
                    ? 'online_pickup'
                    : ordRow.table_id
                      ? 'qr_table'
                      : 'in_store';
              await recordVisit({
                db: rawDb,
                customerId: resolvedCustId,
                orderId,
                spent: totalVnd,
                channel: visitChannel,
                tenantId: ordTenant,
              }).catch(() => {});
            } catch {
              // Optional customer visit table in minimal test schemas
            }
          }
          if (totalVnd >= 20000 && (!ordRow.payment_status || ordRow.payment_status === 'paid')) {
            try {
              const { rewardReferralOnFirstOrder, resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('@aura/domain-crm');
              const refTenant = ordTenant !== '*' ? ordTenant : undefined;
              const refPolicy = await resolveReferralPolicy(options?.kv as any, refTenant).catch(() => DEFAULT_REFERRAL_POLICY);
              await rewardReferralOnFirstOrder(rawDb, resolvedCustId, orderId, totalVnd, refPolicy, refTenant).catch(() => {});
            } catch {
              // Optional referral tables in minimal test schemas
            }
          }
        }
      }
    } catch {
      // Optional loyalty/customer/referral tables in partial schemas
    }
  }

  if (options?.kv) {
    let kvTenant = options?.tenantId?.trim() || 'default';
    if (kvTenant === '*' || kvTenant.toLowerCase() === 'hq') {
      const ordTenantFromRow =
        typeof (order as Record<string, unknown>).tenant_id === 'string' &&
        String((order as Record<string, unknown>).tenant_id).trim()
          ? String((order as Record<string, unknown>).tenant_id).trim()
          : '';
      if (ordTenantFromRow && ordTenantFromRow !== '*' && ordTenantFromRow.toLowerCase() !== 'hq') {
        kvTenant = ordTenantFromRow;
      } else {
        const ordTenantLookup = await db
          .prepare('SELECT tenant_id FROM orders WHERE id = ?')
          .bind(orderId)
          .first<{ tenant_id?: string | null }>()
          .catch(() => null);
        const lookedUp = typeof ordTenantLookup?.tenant_id === 'string' ? ordTenantLookup.tenant_id.trim() : '';
        kvTenant = lookedUp && lookedUp !== '*' && lookedUp.toLowerCase() !== 'hq' ? lookedUp : 'default';
      }
    }
    const eventPayload = JSON.stringify({
      orderId,
      status: targetStatus,
      previous_status: order.previous_status,
      tenant_id: kvTenant,
      timestamp: now,
    });
    const putPromise = Promise.all([
      options.kv.put(`order_event:${orderId}`, eventPayload, { expirationTtl: 60 }),
      options.kv.put(`order_event:${kvTenant}:${orderId}`, eventPayload, { expirationTtl: 60 }),
      options.kv.put('latest_order_ts', now),
      options.kv.put(`latest_order_ts:${kvTenant}`, now),
      options.kv.put('orders:latest_updated_at', now),
      options.kv.put(`orders:latest_updated_at:${kvTenant}`, now),
    ]);
    if (options.waitUntil) {
      options.waitUntil(putPromise);
    } else {
      await putPromise.catch(() => {});
    }
  }

  if (options?.env) {
    const sideEffects = (async () => {
      try {
        const broadcaster = options.env?.ORDER_BROADCASTER as {
          idFromName?: (name: string) => unknown;
          get?: (id: unknown) => { fetch: (req: Request) => Promise<unknown> };
        } | undefined;
        if (broadcaster?.idFromName && broadcaster?.get) {
          let tenantId = options?.tenantId ?? 'default';
          if (tenantId === '*') {
            const ordTenantRow = await db
              .prepare('SELECT tenant_id FROM orders WHERE id = ?')
              .bind(orderId)
              .first<{ tenant_id?: string | null }>()
              .catch(() => null);
            if (ordTenantRow && 'tenant_id' in ordTenantRow && ordTenantRow.tenant_id !== undefined) {
              tenantId =
                typeof ordTenantRow.tenant_id === 'string' && ordTenantRow.tenant_id.trim() && ordTenantRow.tenant_id.trim() !== '*'
                  ? ordTenantRow.tenant_id.trim()
                  : 'default';
            }
          }
          const tenantClause = tenantId === '*'
            ? ''
            : tenantId === 'default'
              ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')"
              : ' AND tenant_id = ?';
          const row = await db.prepare(`SELECT id, items, total, payment_status, customer_name, customer_phone, table_id, created_at
            FROM orders WHERE id = ?${tenantClause}`)
            .bind(orderId, ...(tenantId === '*' ? [] : [tenantId])).first<{
              items: string | unknown[]; total: number; payment_status: string;
              customer_name: string; customer_phone: string; table_id?: string | null; created_at: string;
            }>();
          if (!row) return;
          const items = Array.isArray(row.items) ? row.items : JSON.parse(row.items);
          if (!Array.isArray(items)) return;
          const createdAt = Date.parse(row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`);
          const doId = broadcaster.idFromName(orderId);
          const stub = broadcaster.get(doId);
          await stub.fetch(
            new Request('https://do/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId,
                status: targetStatus,
                payment_status: row.payment_status,
                items, total: row.total, customer_name: row.customer_name, customer_phone: row.customer_phone,
                table_id: row.table_id, createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(), updatedAt: Date.now(),
              }),
            })
          );
        }
      } catch {
        // Non-blocking broadcaster notification
      }
    })();

    if (options.waitUntil) {
      options.waitUntil(sideEffects);
    } else {
      await sideEffects;
    }
  }

  return {
    success: true,
    order: { id: order.id, status: targetStatus, previous_status: order.previous_status },
  };
}
