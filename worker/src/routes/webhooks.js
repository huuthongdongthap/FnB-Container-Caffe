/* eslint-disable no-console */
/**
 * Webhook Routes — PayOS IPN Handler
 * Verifies HMAC-SHA256 signature + updates D1 database
 */

import { Hono } from 'hono';
import { notifyTelegram } from './orders.js';

export const webhookRouter = new Hono();

/**
 * Verify PayOS webhook signature using HMAC-SHA256
 */
async function verifySignature(data, receivedSignature, checksumKey) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(checksumKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sortedData = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('&');

  const computed = await crypto.subtle.sign('HMAC', key, encoder.encode(sortedData));
  const computedHex = Array.from(new Uint8Array(computed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHex === receivedSignature;
}

// ── POST /api/webhook/payos ──────────────────────────────────────────────
webhookRouter.post('/payos', async (c) => {
  const db = c.env.AURA_DB;
  const now = new Date().toISOString();

  try {
    const payload = await c.req.json();

    // 1. Verify PayOS Webhook Signature (MANDATORY)
    const signature = payload.signature || c.req.header('x-payos-signature');
    if (!c.env.PAYOS_CHECKSUM_KEY) {
      console.error('[PayOS Webhook] PAYOS_CHECKSUM_KEY not configured');
      return c.json({ error: 1, message: 'Server misconfiguration' }, 500);
    }

    // Accept test probe / empty payload — return 200 so PayOS marks endpoint healthy.
    if (!signature || !payload.data || Object.keys(payload.data).length === 0) {
      console.log('[PayOS Webhook] Test probe / empty payload — ack 200');
      return c.json({ error: 0, message: 'Webhook endpoint alive', data: null });
    }

    const isValid = await verifySignature(
      payload.data,
      signature,
      c.env.PAYOS_CHECKSUM_KEY
    );
    if (!isValid) {
      console.error('[PayOS Webhook] Invalid signature');
      return c.json({ error: 1, message: 'Invalid signature' }, 401);
    }

    // 2. Extract payment data
    const { orderCode, amount, code } = payload.data || {};
    const isSuccess = payload.success === true || code === '00';

    console.log(`[PayOS Webhook] orderCode=${orderCode} amount=${amount} success=${isSuccess}`);

    if (!orderCode) {
      return c.json({ error: 0, message: 'No orderCode, skipped', data: null });
    }

    // 3. Idempotency: lookup payment row
    const existingPayment = await db.prepare(
      'SELECT id, order_id, status, amount FROM payments WHERE transaction_id = ?'
    ).bind(String(orderCode)).first();

    if (!existingPayment) {
      console.warn(`[PayOS Webhook] Unknown orderCode=${orderCode} — no payment row`);
      return c.json({ error: 0, message: 'Unknown order, acknowledged', data: null });
    }

    // FIX 3 (mid-crash split-brain): self-heal order.payment_status when payment already completed
    if (existingPayment.status === 'completed' || existingPayment.status === 'failed') {
      console.log(`[PayOS Webhook] orderCode=${orderCode} already ${existingPayment.status} — idempotent skip`);
      // Self-heal: if payment is completed but order still unpaid, fix it
      if (existingPayment.status === 'completed' && existingPayment.order_id) {
        const orderRow = await db.prepare(
          'SELECT id, payment_status FROM orders WHERE id = ?'
        ).bind(existingPayment.order_id).first();
        if (orderRow && orderRow.payment_status !== 'paid') {
          await db.prepare(
            "UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ?"
          ).bind(now, existingPayment.order_id).run();
          console.log(`[PayOS Webhook] Self-healed order ${existingPayment.order_id}: payment_status → paid`);
        }
      }
      return c.json({ error: 0, message: 'Already processed', data: null });
    }

    // FIX 2 (stuck payments): on amount mismatch, log to KV and return 400
    if (isSuccess && amount && parseInt(amount, 10) !== parseInt(existingPayment.amount, 10)) {
      console.error(`[PayOS Webhook] Amount mismatch orderCode=${orderCode} db=${existingPayment.amount} webhook=${amount}`);
      const kv = c.env.AUTH_KV;
      if (kv) {
        await kv.put(
          `payment:stuck:${existingPayment.order_id}`,
          JSON.stringify({
            orderId: existingPayment.order_id,
            orderCode,
            dbAmount: existingPayment.amount,
            webhookAmount: amount,
            detectedAt: now,
          }),
          { expirationTtl: 86400 * 7 }
        );
      }
      return c.json({ error: 1, message: 'Amount mismatch' }, 400);
    }

    // 4. Update D1: payments table
    const newStatus = isSuccess ? 'completed' : 'failed';

    await db.prepare(`
      UPDATE payments
      SET status = ?
      WHERE transaction_id = ? AND status = 'pending'
    `).bind(newStatus, String(orderCode)).run();

    // 5. Update D1: orders table — set payment_status + auto-confirm on success
    if (isSuccess && existingPayment.order_id) {
      await db.prepare(`
        UPDATE orders
        SET payment_status = 'paid',
            status = CASE WHEN status = 'pending' THEN 'pending' ELSE status END,
            updated_at = ?
        WHERE id = ?
      `).bind(now, existingPayment.order_id).run();

      // Update KV flag so KDS pollers see the change
      const kv = c.env.AUTH_KV;
      if (kv) {
        await kv.put('latest_order_ts', now);
      }

      // Telegram notify NOW — payment confirmed
      try {
        const orderRow = await db.prepare(
          'SELECT id, items, total, customer_name, customer_phone, customer_address, payment_method, notes FROM orders WHERE id = ?'
        ).bind(existingPayment.order_id).first();
        if (orderRow) {
          let parsedItems = [];
          try { parsedItems = JSON.parse(orderRow.items || '[]'); } catch { /* ignore */ }
          const tgPromise = notifyTelegram(c.env, {
            id: orderRow.id,
            items: parsedItems,
            total: orderRow.total,
            customer_name: orderRow.customer_name,
            customer_phone: orderRow.customer_phone,
            customer_address: orderRow.customer_address,
            payment_method: orderRow.payment_method,
            notes: orderRow.notes,
          }).catch(e => console.error('[Telegram webhook] Async error:', e));
          if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(tgPromise); }
          else { await tgPromise; }
        }
      } catch (tgErr) {
        console.error('[Telegram webhook] Failed:', tgErr.message);
      }

      console.log(`[PayOS] Order ${existingPayment.order_id} → paid + Telegram fired`);
    }

    return c.json({ error: 0, message: 'Webhook processed', data: null });

  } catch (err) {
    console.error('[PayOS Webhook] Error:', err.message);
    // FIX 1: log to KV dead-letter queue for inspection
    const kv = c.env.AUTH_KV;
    if (kv) {
      const dlqKey = `webhook:dlq:${Date.now()}`;
      await kv.put(dlqKey, JSON.stringify({
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      }), { expirationTtl: 86400 * 7 });
    }
    // Return 500 so PayOS retries; 200 only for known idempotent cases above
    return c.json({ error: 1, message: 'Internal error' }, 500);
  }
});
