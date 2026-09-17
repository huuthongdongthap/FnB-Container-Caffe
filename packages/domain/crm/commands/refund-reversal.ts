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

  // ── Idempotency: skip if reversal already exists ──
  try {
    const existing = await db
      .prepare(
        `SELECT id FROM loyalty_point_logs
         WHERE order_id = ? AND reason = 'refund' AND points_change < 0 LIMIT 1`,
      )
      .bind(orderId)
      .first<{ id: string }>();
    if (existing) {
      return { ok: false, reason: 'already_reversed' };
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `idempotency check failed: ${(e as Error).message}` };
  }

  // ── Load the original order ──
  let order: { total: number; points_earned: number } | null = null;
  try {
    order = await db
      .prepare('SELECT total, points_earned FROM orders WHERE id = ?')
      .bind(orderId)
      .first<{ total: number; points_earned: number }>();
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read order: ${(e as Error).message}` };
  }
  if (!order) {
    return { ok: false, reason: 'order_not_found' };
  }

  const pointsEarned = order.points_earned ?? 0;
  if (pointsEarned <= 0) {
    return { ok: false, reason: 'no_points_to_reverse' };
  }

  // ── Proportional deduction ──
  const total = order.total ?? 0;
  const ratio = total > 0 ? Math.min(refundAmountVnd / total, 1) : 1;
  const pointsToDeduct = Math.max(1, Math.round(pointsEarned * ratio));

  // ── Load the customer ──
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

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newPoints = Math.max(0, (customer.loyalty_points ?? 0) - pointsToDeduct);
  const newLifetimePoints = Math.max(0, (customer.lifetime_points ?? 0) - pointsToDeduct);

  // ── Batch: update customer + reversal log + audit trail ──
  try {
    await db.batch([
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
           VALUES (?, ?, ?, ?, 'refund', ?, ?, ?)`,
        )
        .bind(
          genId('ptl_'),
          customer.id,
          orderId,
          -pointsToDeduct,
          newPoints,
          `Hoan tien diem don #${orderId.slice(0, 8)}`,
          now,
        ),
      db
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
            refund_amount: refundAmountVnd,
            order_total: total,
            proportional: total > 0 && refundAmountVnd < total,
          }),
          now,
        ),
    ]);
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `batch failed: ${(e as Error).message}` };
  }

  // ── Tier downgrade check ──
  const computed = computeTier(newLifetimePoints, customer.loyalty_tier, policy);
  let tierDowngraded = false;
  if (computed.changed && computed.tierName !== customer.loyalty_tier) {
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
             VALUES (?, ?, 0, 'tier_downgrade', ?, ?, ?)`,
          )
          .bind(
            genId('ptl_'),
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
      tierDowngraded = true;
    } catch {
      // Tier downgrade is non-blocking — reversal already committed.
    }
  }

  return {
    ok: true,
    pointsDeducted: pointsToDeduct,
    newLifetimePoints,
    tierDowngraded,
    newTier: tierDowngraded ? computed.tierName : (customer.loyalty_tier ?? policy.defaultTier.tierName),
  };
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
