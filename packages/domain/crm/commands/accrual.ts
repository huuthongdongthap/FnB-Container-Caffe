/**
 * CRM — Loyalty accrual.
 * applyAccrual: credits points + cashback wallet for a paid order,
 * recalculates tier, and writes audit logs. Idempotent — skips if an
 * earn transaction already exists for this order.
 *
 * Hono-free, D1-only. Designed to be called after order INSERT.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { LoyaltyPolicy } from './loyalty-policy';
import { tierByName } from './loyalty-policy';
import { computeTier } from './compute-tier';

export const MIN_ORDER_TO_EARN = 20_000;

export interface AccrualInput {
  orderId: string;
  customerId: string;
  /** Total order amount in VND (matches orders.total). */
  orderTotalVnd: number;
  /** Cashback already used on this order (cashback_used column). */
  cashbackUsedVnd?: number;
  actorId?: string;
  actorRole?: string;
}

export interface AccrualSuccess {
  ok: true;
  cashback: number;
  points: number;
  walletBalance: number;
  totalPoints: number;
  lifetimePoints: number;
  tier: string;
  tierUpgraded: boolean;
  multiplierApplied: number;
  campaignCode: string | null;
  expiresAt: string | null;
}

export interface AccrualError {
  ok: false;
  reason:
    | 'order_not_found'
    | 'below_min_order'
    | 'already_processed'
    | 'customer_not_found'
    | 'd1_error';
  error?: string;
}

export type AccrualResult = AccrualSuccess | AccrualError;

/**
 * Apply loyalty accrual for one order. Safe to call multiple times —
 * the idempotency guard ensures exactly one earn transaction per order.
 */
export async function applyAccrual(
  db: D1Database,
  policy: LoyaltyPolicy,
  input: AccrualInput,
): Promise<AccrualResult> {
  const { orderId, customerId, orderTotalVnd } = input;
  const cashbackUsed = input.cashbackUsedVnd ?? 0;

  let order: { total: number; cashback_used: number } | null = null;
  try {
    order = await db
      .prepare('SELECT total, cashback_used FROM orders WHERE id = ?')
      .bind(orderId)
      .first<{ total: number; cashback_used: number }>();
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read order: ${(e as Error).message}` };
  }
  if (!order) {
    return { ok: false, reason: 'order_not_found' };
  }

  const total = order.total ?? orderTotalVnd;
  if (total < MIN_ORDER_TO_EARN) {
    return { ok: false, reason: 'below_min_order' };
  }

  // ── Idempotency: skip if earn transaction already exists ──
  try {
    const existing = await db
      .prepare(`SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1`)
      .bind(orderId)
      .first<{ id: string }>();
    if (existing) {
      return { ok: false, reason: 'already_processed' };
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `idempotency check failed: ${(e as Error).message}` };
  }

  interface CustomerRow {
    id: string;
    loyalty_points: number;
    lifetime_points: number;
    loyalty_tier: string | null;
  }
  let customer: CustomerRow | null = null;
  try {
    customer = await db
      .prepare(
        `SELECT id, loyalty_points, lifetime_points, loyalty_tier
         FROM customers WHERE id = ?`,
      )
      .bind(customerId)
      .first<CustomerRow>();
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read customer: ${(e as Error).message}` };
  }
  if (!customer) {
    return { ok: false, reason: 'customer_not_found' };
  }

  const tier = tierByName(policy, customer.loyalty_tier);
  const multiplier = policy.campaignMultiplier;
  const maxCap = policy.maxCapPerTx;

  const baseRate = tier.cashbackRate;
  const rawCashback = Math.round((total - cashbackUsed) * baseRate * multiplier);
  const cashback = Math.min(rawCashback, maxCap);

  const points = Math.floor((total / 10_000) * (tier.pointMultiplier || 1));

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const expiresAt = policy.expiresAt;

  // ── Ensure wallet exists ──
  let wallet: { id: string; balance: number } | null = null;
  try {
    wallet = await db
      .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
      .bind(customer.id)
      .first<{ id: string; balance: number }>();
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read wallet: ${(e as Error).message}` };
  }

  let walletId: string;
  let newBalance: number;
  if (!wallet) {
    walletId = genId('wal_');
    newBalance = cashback;
    try {
      await db
        .prepare(
          `INSERT INTO cashback_wallets
           (id, customer_id, balance, total_earned, total_spent, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(walletId, customer.id, newBalance, cashback, now, now)
        .run();
    } catch (e) {
      return { ok: false, reason: 'd1_error', error: `failed to create wallet: ${(e as Error).message}` };
    }
  } else {
    walletId = wallet.id;
    newBalance = (wallet.balance ?? 0) + cashback;
  }

  const newPoints = (customer.loyalty_points ?? 0) + points;
  const newLifetimePoints = (customer.lifetime_points ?? 0) + points;

  // ── Batch: wallet + transaction + customer + point log + audit + order ──
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE cashback_wallets
           SET balance = ?, total_earned = total_earned + ?, updated_at = ?
           WHERE customer_id = ?`,
        )
        .bind(newBalance, cashback, now, customer.id),
      db
        .prepare(
          `INSERT INTO cashback_transactions
           (id, wallet_id, customer_id, order_id, type, amount, balance_after,
            expires_at, multiplier_applied, campaign_id, description, created_at)
           VALUES (?, ?, ?, ?, 'earn', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          genId('cbt_'),
          walletId,
          customer.id,
          orderId,
          cashback,
          newBalance,
          expiresAt,
          multiplier,
          policy.campaignCode ?? null,
          `Cashback don #${orderId.slice(0, 8)}${multiplier > 1 ? ` (x${multiplier})` : ''}`,
          now,
        ),
      db
        .prepare(
          `UPDATE customers
           SET loyalty_points = ?, lifetime_points = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(newPoints, newLifetimePoints, now, customer.id),
      db
        .prepare(
          `INSERT INTO loyalty_point_logs
           (id, customer_id, order_id, points_change, reason, balance_after, description, created_at)
           VALUES (?, ?, ?, ?, 'purchase', ?, ?, ?)`,
        )
        .bind(
          genId('ptl_'),
          customer.id,
          orderId,
          points,
          newPoints,
          `Tich diem don #${orderId.slice(0, 8)}`,
          now,
        ),
      db
        .prepare(
          `INSERT INTO loyalty_audit_log
           (customer_id, action, amount_vnd, order_id, metadata, created_at)
           VALUES (?, 'cashback_earn', ?, ?, ?, ?)`,
        )
        .bind(
          customer.id,
          cashback,
          orderId,
          JSON.stringify({
            tier: tier.tierName,
            base_rate: tier.cashbackRate,
            multiplier,
            campaign: policy.campaignCode ?? null,
            raw_cashback: rawCashback,
            capped: cashback < rawCashback,
            cap_used: maxCap,
            actor_id: input.actorId ?? null,
            actor_role: input.actorRole ?? null,
          }),
          now,
        ),
      db
        .prepare('UPDATE orders SET cashback_earned = ?, points_earned = ? WHERE id = ?')
        .bind(cashback, points, orderId),
    ]);
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return { ok: false, reason: 'already_processed' };
    }
    return { ok: false, reason: 'd1_error', error: msg };
  }

  // ── Tier upgrade check ──
  const computed = computeTier(newLifetimePoints, customer.loyalty_tier, policy);
  let tierUpgraded = false;
  if (computed.changed && computed.tierName !== customer.loyalty_tier) {
    tierUpgraded = true;
    try {
      await db
        .prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
        .bind(computed.tierName, now, customer.id)
        .run();
      await db.batch([
        db
          .prepare(
            `INSERT INTO loyalty_point_logs
             (id, customer_id, points_change, reason, balance_after, description, created_at)
             VALUES (?, ?, 0, 'tier_upgrade', ?, ?, ?)`,
          )
          .bind(
            genId('ptl_'),
            customer.id,
            newPoints,
            `Nang hang len ${computed.tierName}`,
            now,
          ),
        db
          .prepare(
            `INSERT INTO loyalty_audit_log
             (customer_id, action, amount_vnd, order_id, metadata, created_at)
             VALUES (?, 'tier_upgrade', null, ?, ?, ?)`,
          )
          .bind(
            customer.id,
            orderId,
            JSON.stringify({
              from: customer.loyalty_tier,
              to: computed.tierName,
              reason: 'points_threshold',
              lifetime_points: newLifetimePoints,
            }),
            now,
          ),
      ]);
    } catch (e) {
      // Tier upgrade is non-blocking — accrual already committed.
      tierUpgraded = false;
    }
  }

  return {
    ok: true,
    cashback,
    points,
    walletBalance: newBalance,
    totalPoints: newPoints,
    lifetimePoints: newLifetimePoints,
    tier: tierUpgraded ? computed.tierName : (customer.loyalty_tier ?? tier.tierName),
    tierUpgraded,
    multiplierApplied: multiplier,
    campaignCode: policy.campaignCode,
    expiresAt,
  };
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
