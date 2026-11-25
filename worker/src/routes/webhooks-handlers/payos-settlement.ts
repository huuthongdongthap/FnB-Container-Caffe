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
    // A provider link that expired or was cancelled closes only that attempt. The order stays
    // pending because POS retry rotation reopens `payments.status = 'expired'` in place, and a
    // retry link can never be created for an order already marked `expired`.
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
      WHERE id = ? AND payment_method = 'payos' AND payment_status NOT IN ('paid', 'completed', 'partially_refunded', 'refunded')
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
  const paymentChanged = (results[0].meta?.changes ?? 0) > 0;
  const orderChanged = (results[1].meta?.changes ?? 0) > 0;
  if (paymentChanged && payment.amount > 0) {
    try {
      await db
        .prepare(
          `UPDATE staff_shifts
           SET online_sales = COALESCE(online_sales, 0) + ?,
               total_sales = COALESCE(total_sales, 0) + ?,
               order_count = COALESCE(order_count, 0) + 1
           WHERE id = (
             SELECT s.id FROM staff_shifts s
             INNER JOIN orders o ON o.id = ?
             WHERE COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
               AND s.clock_in IS NOT NULL AND s.clock_out IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM shift_reconciliations sr
                 WHERE sr.shift_id = CAST(s.id AS TEXT)
                   AND COALESCE(NULLIF(TRIM(sr.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default')
               )
             ORDER BY CASE WHEN LOWER(COALESCE(s.role, '')) IN ('owner', 'admin', 'manager', 'supervisor', 'cashier') THEN 0 ELSE 1 END, s.clock_in DESC
             LIMIT 1
           )`,
        )
        .bind(payment.amount, payment.amount, payment.order_id)
        .run();
    } catch {
      try {
        await db
          .prepare(
            `UPDATE staff_shifts
             SET online_sales = COALESCE(online_sales, 0) + ?,
                 total_sales = COALESCE(total_sales, 0) + ?,
                 order_count = COALESCE(order_count, 0) + 1
             WHERE id = (
               SELECT s.id FROM staff_shifts s
               INNER JOIN orders o ON o.id = ?
               WHERE COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
                 AND s.clock_in IS NOT NULL AND s.clock_out IS NULL
               ORDER BY CASE WHEN LOWER(COALESCE(s.role, '')) IN ('owner', 'admin', 'manager', 'supervisor', 'cashier') THEN 0 ELSE 1 END, s.clock_in DESC
               LIMIT 1
             )`,
          )
          .bind(payment.amount, payment.amount, payment.order_id)
          .run();
      } catch {
        // Best-effort shift online_sales sync; never fail PayOS settlement on legacy schemas
      }
    }
  }
  return { paymentChanged, orderChanged };
}
