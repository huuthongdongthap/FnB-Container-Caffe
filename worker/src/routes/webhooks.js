/**
 * Webhook Routes — PayOS IPN Handler
 * Verifies HMAC-SHA256 signature + updates D1 database
 */

import { Hono } from 'hono';

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

  try {
    const payload = await c.req.json();

    // 1. Verify PayOS Webhook Signature
    const signature = c.req.header('x-payos-signature');
    if (signature && c.env.PAYOS_CHECKSUM_KEY) {
      const isValid = await verifySignature(
        payload.data || {},
        signature,
        c.env.PAYOS_CHECKSUM_KEY
      );
      if (!isValid) {
        console.error('[PayOS Webhook] Invalid signature');
        return c.json({ error: 1, message: 'Invalid signature' }, 401);
      }
    }

    // 2. Extract payment data
    const { orderCode, amount, code, desc } = payload.data || {};
    const isSuccess = payload.success === true || code === '00';

    console.log(`[PayOS Webhook] orderCode=${orderCode} amount=${amount} success=${isSuccess}`);

    if (!orderCode) {
      return c.json({ error: 0, message: 'No orderCode, skipped', data: null });
    }

    // 3. Update D1: payments table
    const now = new Date().toISOString();
    const newStatus = isSuccess ? 'completed' : 'failed';

    await db.prepare(`
      UPDATE payments
      SET status = ?
      WHERE transaction_id = ?
    `).bind(newStatus, String(orderCode)).run();

    // 4. Update D1: orders table — set payment_status + auto-confirm on success
    if (isSuccess) {
      // Find the order linked to this payment
      const payment = await db.prepare(
        'SELECT order_id FROM payments WHERE transaction_id = ?'
      ).bind(String(orderCode)).first();

      if (payment?.order_id) {
        await db.prepare(`
          UPDATE orders
          SET status = 'San sang', updated_at = ?
          WHERE id = ?
        `).bind(now, payment.order_id).run();

        // Update KV flag so KDS pollers see the change
        const kv = c.env.AUTH_KV;
        if (kv) {
          await kv.put('latest_order_ts', now);
        }

        console.log(`[PayOS] Order ${payment.order_id} → paid + confirmed`);
      }
    }

    // 5. Must return 200 OK so PayOS stops retrying
    return c.json({ error: 0, message: 'Webhook processed', data: null });
  } catch (err) {
    console.error('[PayOS Webhook] Error:', err.message);
    // Still return 200 to prevent PayOS retry storms
    return c.json({ error: 0, message: 'Webhook received', data: null });
  }
});
