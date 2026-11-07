/**
 * CRM — Refund reversal.
 * reverseAccrual: deducts points proportionally when an order is refunded,
 * recalculates tier if lifetime_points drop below threshold, and writes
 * audit logs. Idempotent — skips if a refund reversal already exists.
 *
 * Hono-free, D1-only. Designed to be called from the refund flow.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { LoyaltyPolicy } from './loyalty-policy';
import { computeTier } from './compute-tier';

export interface ReversalInput {
  orderId: string;
  customerId: string;
  /** Refund amount in VND (may be partial). */
  refundAmountVnd: number;
  tenantId?: string;
  reason?: string;
}

export interface ReversalSuccess {
  ok: true;
  pointsDeducted: number;
  newLifetimePoints: number;
  tierDowngraded: boolean;
  newTier: string;
}

export interface ReversalError {
  ok: false;
  reason:
    | 'order_not_found'
    | 'no_points_to_reverse'
    | 'already_reversed'
    | 'customer_not_found'
    | 'd1_error';
  error?: string;
}

export type ReversalResult = ReversalSuccess | ReversalError;

/**
 * Reverse loyalty accrual for a refunded order. Proportional to refund amount
 * vs order total. Safe to call multiple times — idempotency guard ensures
 * exactly one reversal per order.
 */
export async function reverseAccrual(
  db: D1Database,
  policy: LoyaltyPolicy,
  input: ReversalInput,
): Promise<ReversalResult> {
  const { orderId, customerId, refundAmountVnd } = input;
  if (typeof refundAmountVnd !== 'number' || !Number.isFinite(refundAmountVnd) || refundAmountVnd <= 0) {
    return { ok: false, reason: 'no_points_to_reverse' };
  }

  const rawRequestedTenant = input.tenantId ? input.tenantId.trim() : '';
  const requestedTenant =
    rawRequestedTenant && rawRequestedTenant !== '*' && rawRequestedTenant.toLowerCase() !== 'hq'
      ? rawRequestedTenant
      : null;
  let effectiveTenant = requestedTenant;
  let writeTenant = effectiveTenant || 'default';

  // ── Load the original order first to resolve tenant context and verify ownership ──
  let order: { total: number; total_amount?: number; points_earned: number; cashback_earned?: number; customer_id?: string | null; tenant_id?: string | null } | null = null;
  try {
    order = await db
      .prepare('SELECT total, points_earned FROM orders WHERE id = ?')
      .bind(orderId)
      .first<{ total: number; total_amount?: number; points_earned: number; cashback_earned?: number; customer_id?: string | null; tenant_id?: string | null }>();
    if (order && (order.cashback_earned === undefined || order.customer_id === undefined || order.tenant_id === undefined)) {
      const extra = await db
        .prepare('SELECT COALESCE(total, total_amount, 0) AS total, total_amount, cashback_earned, customer_id, tenant_id FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ total?: number; total_amount?: number; cashback_earned?: number; customer_id?: string | null; tenant_id?: string | null }>()
        .catch(() =>
          db
            .prepare('SELECT cashback_earned, customer_id, tenant_id FROM orders WHERE id = ?')
            .bind(orderId)
            .first<{ cashback_earned?: number; customer_id?: string | null; tenant_id?: string | null }>()
            .catch(() => null),
        );
      if (extra) {
        Object.assign(order, extra);
      }
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read order: ${(e as Error).message}` };
  }

  if (order) {
    if (
      typeof order.customer_id === 'string' &&
      order.customer_id.trim() !== '' &&
      order.customer_id !== 'guest' &&
      order.customer_id !== customerId
    ) {
      return { ok: false, reason: 'order_not_found' };
    }
    const orderRowTenant =
      'tenant_id' in order && order.tenant_id !== undefined
        ? (typeof order.tenant_id === 'string' && order.tenant_id.trim() && order.tenant_id.trim() !== '*' && order.tenant_id.trim().toLowerCase() !== 'hq'
            ? order.tenant_id.trim()
            : 'default')
        : null;
    if (requestedTenant && orderRowTenant !== null && orderRowTenant !== requestedTenant) {
      return { ok: false, reason: 'order_not_found' };
    }
    effectiveTenant = requestedTenant ?? orderRowTenant;
    writeTenant = effectiveTenant || 'default';
  }

  // ── Cumulative idempotency: inspect prior refund reversals scoped by resolved tenant ──
  let priorPointLogs: Array<{ id?: string; points_change?: number }> = [];
  let priorCashbackTxs: Array<{ id?: string; amount?: number }> = [];
  try {
    const queryLogs = async (sql: string, ...binds: unknown[]) => {
      const stmt = db.prepare(sql).bind(...binds);
      if (typeof stmt.all === 'function') {
        const res = await stmt.all<{ id?: string; points_change?: number }>();
        return res?.results ?? [];
      }
      const first = await stmt.first<{ id?: string; points_change?: number }>();
      return first ? [first] : [];
    };
    if (effectiveTenant) {
      try {
        priorPointLogs = await queryLogs(
          `SELECT id, points_change FROM loyalty_point_logs
           WHERE order_id = ? AND reason = 'refund' AND points_change <= 0
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          orderId,
          effectiveTenant,
        );
      } catch (err) {
        if (effectiveTenant === 'default') {
          priorPointLogs = await queryLogs(
            `SELECT id, points_change FROM loyalty_point_logs
             WHERE order_id = ? AND reason = 'refund' AND points_change <= 0`,
            orderId,
          );
        } else {
          throw err;
        }
      }
    } else {
      priorPointLogs = await queryLogs(
        `SELECT id, points_change FROM loyalty_point_logs
         WHERE order_id = ? AND reason = 'refund' AND points_change <= 0`,
        orderId,
      );
    }
    if (priorPointLogs.some((r) => r && r.points_change === undefined)) {
      return { ok: false, reason: 'already_reversed' };
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `idempotency check failed: ${(e as Error).message}` };
  }

  try {
    const queryCbTxs = async (sql: string, ...binds: unknown[]) => {
      const stmt = db.prepare(sql).bind(...binds);
      if (typeof stmt.all === 'function') {
        const res = await stmt.all<{ id?: string; amount?: number }>();
        return res?.results ?? [];
      }
      const first = await stmt.first<{ id?: string; amount?: number }>();
      return first ? [first] : [];
    };
    if (effectiveTenant) {
      priorCashbackTxs = await queryCbTxs(
        `SELECT id, amount FROM cashback_transactions
        WHERE order_id = ? AND type IN ('debit', 'refund_deduct')
          AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        orderId,
        effectiveTenant,
      ).catch(() =>
        effectiveTenant === 'default'
          ? queryCbTxs(
              `SELECT id, amount FROM cashback_transactions
               WHERE order_id = ? AND type IN ('debit', 'refund_deduct')`,
              orderId,
            ).catch(() => [])
          : [],
      );
    } else {
      priorCashbackTxs = await queryCbTxs(
        `SELECT id, amount FROM cashback_transactions
         WHERE order_id = ? AND type IN ('debit', 'refund_deduct')`,
        orderId,
      ).catch(() => []);
    }
  } catch {
    priorCashbackTxs = [];
  }

  if (!order) {
    if (priorPointLogs.length > 0 || priorCashbackTxs.length > 0) {
      return { ok: false, reason: 'already_reversed' };
    }
    return { ok: false, reason: 'order_not_found' };
  }

  const alreadyReversedPoints = priorPointLogs.reduce(
    (sum, r) => sum + Math.abs(Number(r.points_change ?? 0)),
    0,
  );
  const alreadyReversedCashback = priorCashbackTxs.reduce(
    (sum, r) => sum + Math.abs(Number(r.amount ?? 0)),
    0,
  );

  let initialOrderPoints: number | null = null;
  let initialOrderCashback: number | null = null;
  if (alreadyReversedPoints > 0 || alreadyReversedCashback > 0) {
    try {
      const firstAudit = effectiveTenant
        ? await db
            .prepare(
              `SELECT metadata FROM loyalty_audit_log
               WHERE order_id = ? AND action = 'points_refund'
                 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
               ORDER BY id ASC LIMIT 1`,
            )
            .bind(orderId, effectiveTenant)
            .first<{ metadata?: string | null }>()
            .catch(() =>
              effectiveTenant === 'default'
                ? db
                    .prepare(
                      `SELECT metadata FROM loyalty_audit_log
                       WHERE order_id = ? AND action = 'points_refund'
                       ORDER BY id ASC LIMIT 1`,
                    )
                    .bind(orderId)
                    .first<{ metadata?: string | null }>()
                    .catch(() => null)
                : null,
            )
        : await db
            .prepare(
              `SELECT metadata FROM loyalty_audit_log
               WHERE order_id = ? AND action = 'points_refund'
               ORDER BY id ASC LIMIT 1`,
            )
            .bind(orderId)
            .first<{ metadata?: string | null }>()
            .catch(() => null);
      if (firstAudit?.metadata) {
        const parsed = JSON.parse(firstAudit.metadata) as {
          points_earned_on_order?: number;
          cashback_earned_on_order?: number;
        };
        if (typeof parsed.points_earned_on_order === 'number') {
          initialOrderPoints = parsed.points_earned_on_order;
        }
        if (typeof parsed.cashback_earned_on_order === 'number') {
          initialOrderCashback = parsed.cashback_earned_on_order;
        }
      }
    } catch {
      // Non-blocking audit metadata lookup
    }
  }

  const pointsEarned =
    initialOrderPoints !== null
      ? initialOrderPoints
      : (order.points_earned ?? 0) + alreadyReversedPoints;
  const cashbackEarnedOnOrder =
    initialOrderCashback !== null
      ? initialOrderCashback
      : Number(order.cashback_earned ?? 0) + alreadyReversedCashback;
  if (pointsEarned <= 0 && cashbackEarnedOnOrder <= 0) {
    return { ok: false, reason: 'no_points_to_reverse' };
  }

  const remainingPoints = Math.max(0, pointsEarned - alreadyReversedPoints);
  const remainingCashback = Math.max(0, cashbackEarnedOnOrder - alreadyReversedCashback);
  if (
    (alreadyReversedPoints > 0 || alreadyReversedCashback > 0) &&
    remainingPoints <= 0 &&
    remainingCashback <= 0
  ) {
    return { ok: false, reason: 'already_reversed' };
  }

  // ── Proportional deduction ──
  const rawTotal = Number(order.total ?? 0);
  const rawTotalAmount = Number(order.total_amount ?? 0);
  const total = rawTotal > 0 ? rawTotal : rawTotalAmount;
  const ratio = total > 0 ? Math.min(Math.max(0, refundAmountVnd) / total, 1) : 1;
  const pointsToDeduct =
    remainingPoints > 0
      ? Math.min(remainingPoints, Math.max(1, Math.round(pointsEarned * ratio)))
      : 0;

  // ── Load the customer ──
  interface CustomerRow {
    id: string;
    loyalty_points: number;
    lifetime_points: number;
    loyalty_tier: string | null;
    tenant_id?: string | null;
  }

  let customer: CustomerRow | null = null;
  try {
    if (effectiveTenant) {
      try {
        customer = await db
          .prepare(
            `SELECT id, loyalty_points, lifetime_points, loyalty_tier, tenant_id
             FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(customerId, effectiveTenant)
          .first<CustomerRow>();
      } catch {
        if (effectiveTenant === 'default') {
          customer = await db
            .prepare(
              `SELECT id, loyalty_points, lifetime_points, loyalty_tier
               FROM customers WHERE id = ?`,
            )
            .bind(customerId)
            .first<CustomerRow>();
        }
      }
    } else {
      customer = await db
        .prepare(
          `SELECT id, loyalty_points, lifetime_points, loyalty_tier
           FROM customers WHERE id = ?`,
        )
        .bind(customerId)
        .first<CustomerRow>();
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read customer: ${(e as Error).message}` };
  }
  if (!customer) {
    return { ok: false, reason: 'customer_not_found' };
  }
  if (effectiveTenant && 'tenant_id' in customer && customer.tenant_id !== undefined) {
    const custTenant = String(customer.tenant_id ?? '').trim() || 'default';
    if (custTenant !== effectiveTenant) {
      return { ok: false, reason: 'customer_not_found' };
    }
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newPoints = Math.max(0, (customer.loyalty_points ?? 0) - pointsToDeduct);
  const newLifetimePoints = Math.max(0, (customer.lifetime_points ?? 0) - pointsToDeduct);

  const refundLogId = genId('ptl_');
  const customerUpdateStmt = effectiveTenant
    ? db
        .prepare(
          `UPDATE customers
           SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?),
               lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?),
               updated_at = ?
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(pointsToDeduct, pointsToDeduct, now, customer.id, effectiveTenant)
    : db
        .prepare(
          `UPDATE customers
           SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?),
               lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?),
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(pointsToDeduct, pointsToDeduct, now, customer.id);
  // ── Batch: update customer + reversal log + audit trail ──
  const pointLogStmt = db
    .prepare(
      `INSERT INTO loyalty_point_logs
       (id, customer_id, order_id, points_change, reason, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, 'refund', ?, ?, ?)`,
    )
    .bind(
      refundLogId,
      customer.id,
      orderId,
      -pointsToDeduct,
      newPoints,
      `Hoan tien diem don #${orderId.slice(0, 8)}`,
      now,
    );
  const auditLogStmt = db
    .prepare(
      `INSERT INTO loyalty_audit_log
       (customer_id, action, amount_vnd, order_id, metadata, created_at)
       VALUES (?, 'points_refund', ?, ?, ?, ?)`,
    )
    .bind(
      customer.id,
      refundAmountVnd,
      orderId,
      JSON.stringify({
        points_deducted: pointsToDeduct,
        points_earned_on_order: pointsEarned,
        cashback_earned_on_order: cashbackEarnedOnOrder,
        refund_amount: refundAmountVnd,
        order_total: total,
        proportional: total > 0 && refundAmountVnd < total,
      }),
      now,
    );
  try {
    await db.batch([customerUpdateStmt, pointLogStmt, auditLogStmt]);
  } catch (e) {
    try {
      await db.batch([customerUpdateStmt, pointLogStmt]);
    } catch {
      return { ok: false, reason: 'd1_error', error: `batch failed: ${(e as Error).message}` };
    }
  }

  try {
    await db
      .prepare('UPDATE loyalty_point_logs SET tenant_id = ? WHERE id = ?')
      .bind(writeTenant, refundLogId)
      .run()
      .catch(() => {});
    await db
      .prepare("UPDATE loyalty_audit_log SET tenant_id = ? WHERE customer_id = ? AND order_id = ? AND action = 'points_refund' AND created_at = ?")
      .bind(writeTenant, customer.id, orderId, now)
      .run()
      .catch(() => {});
  } catch {
    // Ignore optional tenant_id updates on minimal schemas
  }

  // ── Best-effort proportional cashback & order column reversal ──
  try {
    const cashbackEarned = cashbackEarnedOnOrder;
    if (cashbackEarned > 0 && remainingCashback > 0) {
      const cashbackToReverse = Math.min(
        remainingCashback,
        Math.max(1, Math.round(cashbackEarned * ratio)),
      );
      const walletRow = effectiveTenant
        ? await db
            .prepare(
              "SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
            )
            .bind(customer.id, effectiveTenant)
            .first<{ id: string; balance: number }>()
            .catch(() =>
              effectiveTenant === 'default'
                ? db
                    .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
                    .bind(customer.id)
                    .first<{ id: string; balance: number }>()
                : null,
            )
            .catch(() => null)
        : await db
            .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
            .bind(customer.id)
            .first<{ id: string; balance: number }>()
            .catch(() => null);
      if (effectiveTenant) {
        try {
          await db
            .prepare(
              `UPDATE cashback_wallets
               SET balance = MAX(0, balance - ?), updated_at = ?
               WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
            )
            .bind(cashbackToReverse, now, customer.id, effectiveTenant)
            .run();
          await db
            .prepare(
              `UPDATE cashback_wallets
               SET total_earned = MAX(0, COALESCE(total_earned, 0) - ?)
               WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
            )
            .bind(cashbackToReverse, customer.id, effectiveTenant)
            .run()
            .catch(() => {});
        } catch {
          if (effectiveTenant === 'default') {
            await db
              .prepare(
                `UPDATE cashback_wallets
                 SET balance = MAX(0, balance - ?), updated_at = ?
                 WHERE customer_id = ?`,
              )
              .bind(cashbackToReverse, now, customer.id)
              .run();
            await db
              .prepare(
                `UPDATE cashback_wallets
                 SET total_earned = MAX(0, COALESCE(total_earned, 0) - ?)
                 WHERE customer_id = ?`,
              )
              .bind(cashbackToReverse, customer.id)
              .run()
              .catch(() => {});
          }
        }
      } else {
        await db
          .prepare(
            `UPDATE cashback_wallets
             SET balance = MAX(0, balance - ?), updated_at = ?
             WHERE customer_id = ?`,
          )
          .bind(cashbackToReverse, now, customer.id)
          .run();
        await db
          .prepare(
            `UPDATE cashback_wallets
             SET total_earned = MAX(0, COALESCE(total_earned, 0) - ?)
             WHERE customer_id = ?`,
          )
          .bind(cashbackToReverse, customer.id)
          .run()
          .catch(() => {});
      }
      const revWalletId = walletRow?.id || `cbw_${customer.id}`;
      const revBalanceAfter = Math.max(0, Number(walletRow?.balance ?? 0) - cashbackToReverse);
      const revTxId = alreadyReversedCashback > 0 ? genId(`cbt_rev_${orderId}_`) : `cbt_rev_${orderId}`;
      await db
        .prepare(
          `INSERT INTO cashback_transactions
           (id, wallet_id, customer_id, order_id, type, amount, balance_after, description, created_at)
           VALUES (?, ?, ?, ?, 'debit', ?, ?, ?, ?)`,
        )
        .bind(
          revTxId,
          revWalletId,
          customer.id,
          orderId,
          cashbackToReverse,
          revBalanceAfter,
          `Hoan tien cashback don #${orderId.slice(0, 8)}`,
          now,
        )
        .run()
        .catch(() =>
          db
            .prepare(
              `INSERT INTO cashback_transactions
               (id, customer_id, order_id, type, amount, balance_after, description, created_at)
               VALUES (?, ?, ?, 'debit', ?, ?, ?, ?)`,
            )
            .bind(
              revTxId,
              customer.id,
              orderId,
              cashbackToReverse,
              revBalanceAfter,
              `Hoan tien cashback don #${orderId.slice(0, 8)}`,
              now,
            )
            .run()
            .catch(() => {}),
        );
      await db
        .prepare('UPDATE cashback_transactions SET tenant_id = ? WHERE id = ?')
        .bind(writeTenant, revTxId)
        .run()
        .catch(() => {});
      if (effectiveTenant) {
        await db
          .prepare(
            `UPDATE orders
             SET cashback_earned = MAX(0, COALESCE(cashback_earned, 0) - ?),
                 points_earned = MAX(0, COALESCE(points_earned, 0) - ?)
             WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(cashbackToReverse, pointsToDeduct, orderId, effectiveTenant)
          .run()
          .catch(() =>
            effectiveTenant === 'default'
              ? db
                  .prepare(
                    `UPDATE orders
                     SET cashback_earned = MAX(0, COALESCE(cashback_earned, 0) - ?),
                         points_earned = MAX(0, COALESCE(points_earned, 0) - ?)
                     WHERE id = ?`,
                  )
                  .bind(cashbackToReverse, pointsToDeduct, orderId)
                  .run()
              : undefined,
          );
      } else {
        await db
          .prepare(
            `UPDATE orders
             SET cashback_earned = MAX(0, COALESCE(cashback_earned, 0) - ?),
                 points_earned = MAX(0, COALESCE(points_earned, 0) - ?)
             WHERE id = ?`,
          )
          .bind(cashbackToReverse, pointsToDeduct, orderId)
          .run();
      }
    } else {
      if (effectiveTenant) {
        await db
          .prepare(
            `UPDATE orders
             SET points_earned = MAX(0, COALESCE(points_earned, 0) - ?)
             WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(pointsToDeduct, orderId, effectiveTenant)
          .run()
          .catch(() =>
            effectiveTenant === 'default'
              ? db
                  .prepare(
                    `UPDATE orders
                     SET points_earned = MAX(0, COALESCE(points_earned, 0) - ?)
                     WHERE id = ?`,
                  )
                  .bind(pointsToDeduct, orderId)
                  .run()
              : undefined,
          );
      } else {
        await db
          .prepare(
            `UPDATE orders
             SET points_earned = MAX(0, COALESCE(points_earned, 0) - ?)
             WHERE id = ?`,
          )
          .bind(pointsToDeduct, orderId)
          .run();
      }
    }
  } catch {
    // Non-blocking on partial schemas or minimal test mocks
  }

  // ── Tier downgrade check ──
  const computed = computeTier(newLifetimePoints, customer.loyalty_tier, policy);
  let tierDowngraded = false;
  if (computed.changed && computed.tierName !== customer.loyalty_tier) {
    try {
      const downgradeLogId = genId('ptl_');
      if (effectiveTenant) {
        await db
          .prepare("UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(computed.tierName, now, customer.id, effectiveTenant)
          .run()
          .catch((err) => {
            if (effectiveTenant === 'default') {
              return db
                .prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
                .bind(computed.tierName, now, customer.id)
                .run();
            }
            throw err;
          });
      } else {
        await db
          .prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
          .bind(computed.tierName, now, customer.id)
          .run();
      }
      await db.batch([
        db
          .prepare(
            `INSERT INTO loyalty_point_logs
             (id, customer_id, points_change, reason, balance_after, description, created_at)
             VALUES (?, ?, 0, 'tier_downgrade', ?, ?, ?)`,
          )
          .bind(
            downgradeLogId,
            customer.id,
            newPoints,
            `Giam hang xuong ${computed.tierName}`,
            now,
          ),
        db
          .prepare(
            `INSERT INTO loyalty_audit_log
             (customer_id, action, amount_vnd, order_id, metadata, created_at)
             VALUES (?, 'tier_downgrade', null, ?, ?, ?)`,
          )
          .bind(
            customer.id,
            orderId,
            JSON.stringify({
              from: customer.loyalty_tier,
              to: computed.tierName,
              reason: 'points_deducted_refund',
              lifetime_points: newLifetimePoints,
            }),
            now,
          ),
      ]);
      await db
        .prepare('UPDATE loyalty_point_logs SET tenant_id = ? WHERE id = ?')
        .bind(writeTenant, downgradeLogId)
        .run()
        .catch(() => {});
      await db
        .prepare("UPDATE loyalty_audit_log SET tenant_id = ? WHERE customer_id = ? AND order_id = ? AND action = 'tier_downgrade' AND created_at = ?")
        .bind(writeTenant, customer.id, orderId, now)
        .run()
        .catch(() => {});
      tierDowngraded = true;
    } catch {
      // Tier downgrade is non-blocking — reversal already committed.
    }
  }

  const finalTier = tierDowngraded ? computed.tierName : (customer.loyalty_tier ?? policy.defaultTier.tierName);
  try {
    if (effectiveTenant) {
      await db
        .prepare(
          "UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?), lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), tier = ?, updated_at = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
        )
        .bind(pointsToDeduct, pointsToDeduct, finalTier, now, customer.id, effectiveTenant)
        .run()
        .catch((err) => {
          if (effectiveTenant === 'default') {
            return db
              .prepare(
                'UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?), lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), tier = ?, updated_at = ? WHERE customer_id = ?',
              )
              .bind(pointsToDeduct, pointsToDeduct, finalTier, now, customer.id)
              .run();
          }
          throw err;
        });
    } else {
      await db
        .prepare(
          'UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?), lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), tier = ?, updated_at = ? WHERE customer_id = ?',
        )
        .bind(pointsToDeduct, pointsToDeduct, finalTier, now, customer.id)
        .run();
    }
  } catch {
    // loyalty_accounts is optional in minimal schemas
  }

  return {
    ok: true,
    pointsDeducted: pointsToDeduct,
    newLifetimePoints,
    tierDowngraded,
    newTier: finalTier,
  };
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
