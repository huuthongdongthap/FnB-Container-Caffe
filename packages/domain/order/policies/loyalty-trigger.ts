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
    customer_phone?: string | null;
    customer_email?: string | null;
    status?: string;
    payment_status?: string;
  }>();

  if (!orderRow || orderRow.status === 'cancelled' || orderRow.status === 'failed' || orderRow.status === 'expired') {
    log.info('Loyalty credit skipped (no order or cancelled)', { orderId });
    return;
  }

  let customerId = orderRow.customer_id;
  if (!customerId && (orderRow.customer_phone || orderRow.customer_email)) {
    const normalizedPhone = String(orderRow.customer_phone || '').replace(/\D/g, '');
    const cust = await db.prepare(
      'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
    ).bind(orderRow.customer_email ?? null, normalizedPhone || null).first<{ id: string }>().catch(() => null);
    customerId = cust?.id ?? null;
  }

  if (!customerId) {
    log.info('Loyalty credit skipped (no customer)', { orderId });
    return;
  }

  if (orderRow.payment_status && orderRow.payment_status !== 'paid') {
    log.info('Loyalty credit skipped (order payment not yet settled)', {
      orderId,
      status: orderRow.status,
      payment_status: orderRow.payment_status,
    });
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
    customerId,
    orderTotalVnd: total,
  }).catch((err) => {
    log.error('Loyalty accrual failed', { orderId, error: String(err) });
  });
}
