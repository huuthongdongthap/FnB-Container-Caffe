/* eslint-disable no-console */
/**
 * Payment Routes — PayOS Integration
 * POST /api/payment/create-link → creates PayOS payment request
 * Uses HMAC-SHA256 signature per PayOS spec
 */

import { Hono } from 'hono';

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
paymentRouter.post('/create-link', async (c) => {
  const db = c.env.AURA_DB;

  try {
    const body = await c.req.json();
    const { order_id, amount, description, customer_name } = body;

    if (!order_id || !amount) {
      return c.json({ success: false, error: 'order_id and amount are required' }, 400);
    }

    // Generate numeric order_code for PayOS (must be Int64)
    const orderCode = Date.now() % 100000000;

    // Determine base URL from request origin
    const reqUrl = new URL(c.req.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    const returnUrl = `${baseUrl}/track-order.html?success=true&order_id=${order_id}`;
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

    await db.prepare(`
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at)
      VALUES (?, ?, 'payos', ?, 'pending', ?, ?, ?)
    `).bind(paymentId, order_id, amount, String(orderCode), payosData.data.checkoutUrl, now).run();

    return c.json({
      success: true,
      checkoutUrl: payosData.data.checkoutUrl,
      orderCode,
      paymentLinkId: payosData.data.paymentLinkId,
    });
  } catch (err) {
    console.error('[PayOS] create-link error:', err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});
