import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import type { LoyaltyPolicy } from './loyalty-policy';
import { computeTier } from './compute-tier';

export interface RefundTrancheInput {
  orderId: string; customerId: string; refundAmountVnd: number; tenantId: string;
  reversalKey: string; reason?: string; verifiedLedgerRecipient?: boolean;
}
export type RefundTrancheResult =
  | { ok: true; pointsDeducted: number; newLifetimePoints: number; tierDowngraded: boolean; newTier: string }
  | { ok: false; reason: 'order_not_found' | 'no_points_to_reverse' | 'already_reversed' | 'customer_not_found' | 'd1_error'; error?: string };

/** Apply a transfer-keyed tranche once; every accounting effect commits in one D1 batch. */
export async function reverseRefundTranche(
  db: D1Database, policy: LoyaltyPolicy, input: RefundTrancheInput,
): Promise<RefundTrancheResult> {
  if (!Number.isFinite(input.refundAmountVnd) || input.refundAmountVnd <= 0) return { ok: false, reason: 'no_points_to_reverse' };
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await reverseSnapshot(db, policy, input); }
    catch (error) {
      const message = String((error as Error).message ?? error);
      if (message.includes('CHECK constraint failed: refund_reversal_contention') && attempt < 2) continue;
      return { ok: false, reason: 'd1_error', error: message };
    }
  }
  return { ok: false, reason: 'd1_error', error: 'refund reversal contention' };
}

async function reverseSnapshot(db: D1Database, policy: LoyaltyPolicy, input: RefundTrancheInput): Promise<RefundTrancheResult> {
  const tenant = input.tenantId;
  const key = input.reversalKey;
  let work: { status: string; amount: number; order_id: string; customer_id: string | null } | null = null;
  let hasRetryColumns = true;
  try {
    work = await db.prepare(`SELECT status, amount, order_id, customer_id, attempts FROM refund_loyalty_work
      WHERE tenant_id = ? AND reversal_key = ?`).bind(tenant, key)
      .first<{ status: string; amount: number; order_id: string; customer_id: string | null }>();
  } catch {
    hasRetryColumns = false;
    work = await db.prepare(`SELECT status, amount, order_id, customer_id FROM refund_loyalty_work
      WHERE tenant_id = ? AND reversal_key = ?`).bind(tenant, key)
      .first<{ status: string; amount: number; order_id: string; customer_id: string | null }>();
  }
  if (!work || work.amount !== input.refundAmountVnd || work.order_id !== input.orderId) return { ok: false, reason: 'order_not_found' };
  if (work.status === 'completed') return { ok: false, reason: 'already_reversed' };
  const order = await db.prepare(`SELECT total, points_earned, cashback_earned, customer_id FROM orders
    WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`).bind(input.orderId, tenant)
    .first<{ total: number; points_earned: number; cashback_earned: number; customer_id: string | null }>();
  if (!order || (!input.verifiedLedgerRecipient && order.customer_id && order.customer_id !== 'guest' && order.customer_id !== input.customerId)) {
    return { ok: false, reason: 'order_not_found' };
  }
  const prior = await db.prepare(`SELECT COALESCE(SUM(amount), 0) amount,
    COALESCE(SUM(points_reversed), 0) points, COALESCE(SUM(cashback_reversed), 0) cashback, COUNT(*) count
    FROM refund_loyalty_work WHERE tenant_id = ? AND order_id = ? AND status = 'completed'`)
    .bind(tenant, input.orderId).first<{ amount: number; points: number; cashback: number; count: number }>();
  const oldAmount = Number(prior?.amount ?? 0), oldPoints = Number(prior?.points ?? 0), oldCashback = Number(prior?.cashback ?? 0);
  const originalPoints = Number(order.points_earned ?? 0) + oldPoints;
  const originalCashback = Number(order.cashback_earned ?? 0) + oldCashback;
  const total = Number(order.total ?? 0);
  const cumulativeRatio = total > 0 ? Math.min(1, (oldAmount + input.refundAmountVnd) / total) : 1;
  const targetPoints = Math.round(originalPoints * cumulativeRatio);
  const targetCashback = Math.round(originalCashback * cumulativeRatio);
  const points = Math.max(0, Math.min(Number(order.points_earned ?? 0), targetPoints - oldPoints));
  const cashback = Math.max(0, Math.min(Number(order.cashback_earned ?? 0), targetCashback - oldCashback));
  const customer = await db.prepare(`SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers
    WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`).bind(input.customerId, tenant)
    .first<{ loyalty_points: number; lifetime_points: number; loyalty_tier: string | null }>();
  if (!customer) return { ok: false, reason: 'customer_not_found' };
  const wallet = cashback > 0 ? await db.prepare(`SELECT id, balance, total_earned FROM cashback_wallets
    WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`).bind(input.customerId, tenant)
    .first<{ id: string; balance: number; total_earned: number }>() : null;
  if (cashback > 0 && !wallet) return { ok: false, reason: 'd1_error', error: 'cashback wallet missing' };
  const newPoints = Math.max(0, Number(customer.loyalty_points ?? 0) - points);
  const newLifetime = Math.max(0, Number(customer.lifetime_points ?? 0) - points);
  const tier = computeTier(newLifetime, customer.loyalty_tier, policy);
  const deficit = Math.max(0, points - Math.max(0, Number(customer.loyalty_points ?? 0)));
  const voucherRows = deficit > 0 ? (await db.prepare(`SELECT id, points_spent, code, voucher_code FROM loyalty_redemptions
    WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
      AND LOWER(COALESCE(status, 'active')) = 'active' AND used_at IS NULL
    ORDER BY COALESCE(redeemed_at, created_at) DESC, id DESC`).bind(input.customerId, tenant)
    .all<{ id: string; points_spent: number; code?: string | null; voucher_code?: string | null }>()).results : [];
  const revoke: typeof voucherRows = [];
  let covered = 0;
  for (const voucher of voucherRows) { if (covered >= deficit) break; revoke.push(voucher); covered += Math.max(0, Number(voucher.points_spent)); }
  const now = new Date().toISOString();
  const stable = (prefix: string) => `${prefix}${encodeURIComponent(JSON.stringify([tenant, key]))}`;
  const statements: D1PreparedStatement[] = [];
  const add = (sql: string, ...args: unknown[]) => statements.push(db.prepare(sql).bind(...args));
  const assertChanged = () => add(`INSERT INTO refund_mutation_guards (reversal_ok)
    VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)`);
  if (hasRetryColumns) {
    add(`UPDATE refund_loyalty_work SET status = 'completed', customer_id = ?, points_reversed = ?, cashback_reversed = ?, completed_at = ?,
      updated_at = ?, last_error = NULL
      WHERE tenant_id = ? AND reversal_key = ? AND status IN ('pending', 'failed')
        AND (SELECT COUNT(*) FROM refund_loyalty_work WHERE tenant_id = ? AND order_id = ? AND status = 'completed') = ?`,
      input.customerId, points, cashback, now, now, tenant, key, tenant, input.orderId, Number(prior?.count ?? 0));
  } else {
    add(`UPDATE refund_loyalty_work SET status = 'completed', customer_id = ?, points_reversed = ?, cashback_reversed = ?, completed_at = ?
      WHERE tenant_id = ? AND reversal_key = ? AND status IN ('pending', 'failed')
        AND (SELECT COUNT(*) FROM refund_loyalty_work WHERE tenant_id = ? AND order_id = ? AND status = 'completed') = ?`,
      input.customerId, points, cashback, now, tenant, key, tenant, input.orderId, Number(prior?.count ?? 0));
  }
  assertChanged();
  add(`UPDATE orders SET points_earned = MAX(0, COALESCE(points_earned, 0) - ?), cashback_earned = MAX(0, COALESCE(cashback_earned, 0) - ?)
    WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
      AND COALESCE(points_earned, 0) = ? AND COALESCE(cashback_earned, 0) = ?`,
    points, cashback, input.orderId, tenant, order.points_earned ?? 0, order.cashback_earned ?? 0);
  assertChanged();
  const hasTotalSpent = await db
    .prepare('SELECT total_spent FROM customers LIMIT 0')
    .all()
    .then(() => true)
    .catch(() => false);
  if (hasTotalSpent) {
    add(`UPDATE customers SET loyalty_points = ?, lifetime_points = ?, loyalty_tier = ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = ?
      WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
        AND COALESCE(loyalty_points, 0) = ? AND COALESCE(lifetime_points, 0) = ? AND loyalty_tier IS ?`,
      newPoints, newLifetime, tier.tierName, Math.max(0, Number(input.refundAmountVnd) || 0), now, input.customerId, tenant, customer.loyalty_points,
      customer.lifetime_points, customer.loyalty_tier);
  } else {
    add(`UPDATE customers SET loyalty_points = ?, lifetime_points = ?, loyalty_tier = ?, updated_at = ?
      WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
        AND COALESCE(loyalty_points, 0) = ? AND COALESCE(lifetime_points, 0) = ? AND loyalty_tier IS ?`,
      newPoints, newLifetime, tier.tierName, now, input.customerId, tenant, customer.loyalty_points,
      customer.lifetime_points, customer.loyalty_tier);
  }
  assertChanged();
  const reversalId = stable('ptl_refund_');
  add(`INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, description, tenant_id, created_at)
    VALUES (?, ?, ?, ?, 'refund', ?, ?, ?, ?)`, reversalId, input.customerId, input.orderId, -points, newPoints, input.reason ?? 'Refund', tenant, now);
  add(`INSERT INTO loyalty_audit_log (id, customer_id, action, amount_vnd, order_id, metadata, tenant_id, created_at)
    VALUES (?, ?, 'points_refund', ?, ?, ?, ?, ?)`, stable('audit_refund_'), input.customerId, input.refundAmountVnd,
    input.orderId, JSON.stringify({ transfer_ref: key, points_deducted: points, cashback_deducted: cashback,
      points_earned_on_order: originalPoints, cashback_earned_on_order: originalCashback,
      revoked_voucher_ids: revoke.map(v => v.id), point_deficit: deficit }), tenant, now);
  if (wallet && cashback > 0) {
    add(`UPDATE cashback_wallets SET balance = MAX(0, balance - ?), total_earned = MAX(0, total_earned - ?), updated_at = ?
      WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND balance = ? AND total_earned = ?`,
      cashback, cashback, now, wallet.id, tenant, wallet.balance, wallet.total_earned);
    assertChanged();
    add(`INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, description, tenant_id, created_at)
      VALUES (?, ?, ?, ?, 'debit', ?, ?, ?, ?, ?)`, stable('cbt_refund_'), wallet.id, input.customerId, input.orderId,
      cashback, Math.max(0, Number(wallet.balance) - cashback), input.reason ?? 'Refund', tenant, now);
  }
  for (const voucher of revoke) {
    add(`UPDATE loyalty_redemptions SET status = 'revoked' WHERE id = ? AND customer_id = ?
      AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND LOWER(COALESCE(status, 'active')) = 'active' AND used_at IS NULL`,
      voucher.id, input.customerId, tenant);
    assertChanged();
    const code = String(voucher.code ?? voucher.voucher_code ?? '').trim();
    add(`UPDATE user_rewards SET status = 'revoked' WHERE customer_id = ?
      AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND (id = ? OR (? <> '' AND code = ?))
      AND LOWER(COALESCE(status, 'active')) = 'active'`, input.customerId, tenant, voucher.id, code, code);
  }
  add(`UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?),
    lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), tier = ?, updated_at = ?
    WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`, points, points, tier.tierName, now, input.customerId, tenant);
  add('DELETE FROM refund_mutation_guards');
  await db.batch(statements);
  return { ok: true, pointsDeducted: points, newLifetimePoints: newLifetime, tierDowngraded: tier.changed, newTier: tier.tierName };
}
