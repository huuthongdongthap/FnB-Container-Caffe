/* eslint-disable no-console */
/**
 * Payment Routes — PayOS Integration
 * POST /api/payment/create-link → creates PayOS payment request
 * Uses HMAC-SHA256 signature per PayOS spec
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/admin-auth.js';

export const paymentRouter = new Hono();

const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

/**
 * Build HMAC-SHA256 signature for PayOS
 * Canonical string: amount=&cancelUrl=&description=&orderCode=&returnUrl=
 */
async function buildSignature(params, checksumKey) {
  const canonical = [
    `amount=${params.amount}`,
    `cancelUrl=${params.cancelUrl}`,
    `description=${params.description}`,
    `orderCode=${params.orderCode}`,
    `returnUrl=${params.returnUrl}`,
  ].join('&');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(checksumKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── POST /api/payment/create-link ────────────────────────────────────────────
paymentRouter.post('/create-link', requireAuth(['customer', 'owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const customerId = c.get('user').id;

  try {
    const body = await c.req.json();
    const { order_id, description, customer_name } = body;

    if (!order_id) {
      return c.json({ success: false, error: 'order_id is required' }, 400);
    }

    // ── SECURITY: derive amount from D1, NEVER trust client body.amount
    const orderRow = await db.prepare(
      'SELECT id, total, payment_status, customer_id FROM orders WHERE id = ?'
    ).bind(order_id).first();

    if (!orderRow) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // ── SECURITY: verify requesting customer owns this order
    if (orderRow.customer_id && orderRow.customer_id !== customerId) {
      return c.json({ success: false, error: 'Forbidden — not your order' }, 403);
    }

    if (orderRow.payment_status === 'paid') {
      return c.json({ success: false, error: 'Order already paid' }, 409);
    }
    const amount = parseInt(orderRow.total, 10);
    if (!Number.isFinite(amount) || amount < 1000) {
      return c.json({ success: false, error: 'Invalid order total' }, 400);
    }

    // Generate numeric order_code for PayOS (must be Int64, unique)
    // Collision-safe: (ms timestamp * 1000) + 3-digit random → ~9.0e12 max, fits Int64
    let orderCode = (Date.now() * 1000) + Math.floor(Math.random() * 1000);

    // FE_BASE_URL: prefer env binding, else hardcode prod (Pages domain serves HTML, NOT worker domain)
    const baseUrl = c.env.FE_BASE_URL || 'https://auraspace.cafe';
    const returnUrl = `${baseUrl}/checkout.html?payment=pending&order_id=${order_id}`;
    const cancelUrl = `${baseUrl}/checkout.html?cancelled=true&order_id=${order_id}`;

    const desc = (description || `Don hang #${order_id}`).slice(0, 25);

    const clientId = c.env.PAYOS_CLIENT_ID;
    const apiKey = c.env.PAYOS_API_KEY;
    const checksumKey = c.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      return c.json({ success: false, error: 'PayOS env vars not configured' }, 500);
    }

    const signature = await buildSignature(
      { amount, cancelUrl, description: desc, orderCode, returnUrl },
      checksumKey
    );

    const payosPayload = {
      orderCode,
      amount,
      description: desc,
      buyerName: customer_name || 'Khach hang',
      returnUrl,
      cancelUrl,
      signature,
      items: [],
    };

    const payosRes = await fetch(PAYOS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payosPayload),
    });

    const payosData = await payosRes.json();
    if (payosData.code !== '00') {
      console.error('[PayOS] create-link failed:', JSON.stringify(payosData));
      return c.json({ success: false, error: payosData.desc || 'PayOS error' }, 502);
    }

    // Persist payment record in D1
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

 // FIX 4: Retry up to 3x on UNIQUE constraint violation (orderCode collision)
 function generateOrderCode() {
   return (Date.now() * 1000) + Math.floor(Math.random() * 1000);
 }
 let insertOk = false;
 for (let attempt = 0; attempt < 3 && !insertOk; attempt++) {
   try {
     const attemptCode = attempt === 0 ? orderCode : generateOrderCode();
     await db.prepare(`
       INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at)
       VALUES (?, ?, 'payos', ?, 'pending', ?, ?, ?)
     `).bind(paymentId, order_id, amount, String(attemptCode), payosData.data.checkoutUrl, now).run();
     insertOk = true;
     if (attempt > 0) { orderCode = attemptCode; }
   } catch (insertErr) {
     if (insertErr.message?.includes('UNIQUE constraint') || insertErr.code === 'SQLITE_CONSTRAINT') {
       console.warn(`[PayOS] orderCode collision attempt ${attempt + 1}, retrying...`);
       orderCode = generateOrderCode();
       const newSig = await buildSignature(
         { amount, cancelUrl, description: desc, orderCode, returnUrl }, checksumKey
       );
       payosPayload.orderCode = orderCode;
       payosPayload.signature = newSig;
       const retryRes = await fetch(PAYOS_API, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
         body: JSON.stringify(payosPayload),
       });
       const retryData = await retryRes.json();
       if (retryData.code !== '00') {
         return c.json({ success: false, error: retryData.desc || 'PayOS error on retry' }, 502);
       }
       payosData.data = retryData.data;
     } else { throw insertErr; }
   }
 }
 if (!insertOk) {
   return c.json({ success: false, error: 'Failed to create payment after 3 retries' }, 500);
 }

    return c.json({
      success: true,
      checkoutUrl: payosData.data.checkoutUrl,
      orderCode,
      paymentLinkId: payosData.data.paymentLinkId,
    });
  } catch (err) {
    console.error('[PayOS] create-link error:', err.message);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});
