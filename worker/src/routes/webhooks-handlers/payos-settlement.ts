import type { D1Database } from '@cloudflare/workers-types';

export interface SettlementPayment {
  id: string; order_id: string; status: string; amount: number; method: string;
}

/** D1 batch is transactional: payment and order either commit together or neither does. */
export async function settlePayOS(
  db: D1Database,
  payment: SettlementPayment,
  success: boolean,
  status: string,
  now: string,
  providerReference?: string | null,
) {
  if (!success) {
    const result = await db.prepare("UPDATE payments SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
      .bind(status, now, payment.id).run();
    return { paymentChanged: (result.meta?.changes ?? 0) > 0, orderChanged: false };
  }
  const reference = typeof providerReference === 'string' ? providerReference.trim() : '';
  const buildBatch = (withReference: boolean) => [
    db.prepare(`UPDATE payments SET status = 'completed', updated_at = ?${withReference ? ", provider_reference = COALESCE(NULLIF(provider_reference, ''), ?)" : ''}
      WHERE id = ? AND status IN ('pending', 'failed', 'cancelled', 'expired')
      AND NOT EXISTS (SELECT 1 FROM payments other WHERE other.order_id = ? AND other.id != ?
        AND other.status IN ('completed', 'paid', 'refunded'))`)
      .bind(...(withReference ? [now, reference] : [now]), payment.id, payment.order_id, payment.id),
    db.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = ?
      WHERE id = ? AND payment_method = 'payos' AND payment_status NOT IN ('paid', 'completed', 'refunded')
      AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
      AND EXISTS (SELECT 1 FROM payments WHERE id = ? AND status = 'completed')`)
      .bind(now, payment.order_id, payment.id),
  ];
  let results;
  if (reference) {
    try {
      results = await db.batch(buildBatch(true));
    } catch (err) {
      // Legacy schemas without the column settle exactly as before; a duplicate reference must surface.
      if (!/no such column:\s*provider_reference/i.test(String(err))) throw err;
      results = await db.batch(buildBatch(false));
    }
  } else {
    results = await db.batch(buildBatch(false));
  }
  if (results.length !== 2 || results.some((result) => !result.success)) throw new Error('Payment settlement transaction failed');
  return { paymentChanged: (results[0].meta?.changes ?? 0) > 0, orderChanged: (results[1].meta?.changes ?? 0) > 0 };
}
