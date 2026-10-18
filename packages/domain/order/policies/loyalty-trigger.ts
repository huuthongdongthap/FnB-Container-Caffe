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
import { loadPolicy, applyAccrual } from '@aura/domain-crm';

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
    'SELECT * FROM orders WHERE id = ?'
  ).bind(orderId).first<{
    id: string;
    total_amount?: number | null;
    total?: number | null;
    customer_id: string | null;
    status?: string;
    payment_status?: string;
  }>();

  if (!orderRow || !orderRow.customer_id || orderRow.status === 'cancelled') {
    log.info('Loyalty credit skipped (no order, customer, or cancelled)', { orderId });
    return;
  }

  if (
    orderRow.status &&
    ['pending', 'confirmed', 'preparing', 'ready', 'failed', 'expired'].includes(orderRow.status) &&
    orderRow.payment_status !== 'paid'
  ) {
    log.info('Loyalty credit skipped (order not yet paid or completed)', {
      orderId,
      status: orderRow.status,
      payment_status: orderRow.payment_status,
    });
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
