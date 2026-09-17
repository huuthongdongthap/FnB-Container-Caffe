/**
 * loyalty-trigger.ts
 *
 * Extracted from update-order.ts: previously duplicated loyalty-credit
 * block (lines 103–112 and 120–128) to prevent double-earn bugs.
 *
 * Call once after the order UPDATE succeeds. Idempotent:
 * exits early when cashback_transactions already contains an `earn`
 * row for this order_id. After the double-earn guard, delegates to
 * the CRM domain accrual command so order-status flows keep accruing
 * until place-order.ts owns the trigger fully.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { loadPolicy } from 'packages/domain/crm/commands/loyalty-policy';
import { applyAccrual } from 'packages/domain/crm/commands/accrual';

const log = createLogger({ route: 'orders' });

export async function creditLoyaltyIfEligible(
  db: D1Database,
  env: Record<string, unknown>,
  orderId: string,
): Promise<void> {
  const existingEarn = await db.prepare(
    'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'earn\' LIMIT 1'
  ).bind(orderId).first<{ id: string }>();

  if (existingEarn) {
    log.info('Loyalty credit skipped (already earned)', { orderId, existingId: existingEarn.id });
    return;
  }

  const policy = await loadPolicy(db).catch(() => null);
  if (!policy) {
    log.warn('Loyalty credit skipped (no policy)', { orderId });
    return;
  }

  const orderRow = await db.prepare(
    'SELECT id, total_amount, total, customer_id FROM orders WHERE id = ?'
  ).bind(orderId).first<{ id: string; total_amount: number | null; total: number | null; customer_id: string | null }>();

  if (!orderRow || !orderRow.customer_id) {
    log.info('Loyalty credit skipped (no order or customer)', { orderId });
    return;
  }

  const total = orderRow.total_amount || orderRow.total || 0;
  if (total < 20_000) {
    log.info('Loyalty credit skipped (below min)', { orderId, total });
    return;
  }

  await applyAccrual(db, policy, {
    orderId,
    customerId: orderRow.customer_id,
    orderTotalVnd: total,
  }).catch((err) => {
    log.error('Loyalty accrual failed', { orderId, error: String(err) });
  });
}
