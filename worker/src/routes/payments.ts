/**
 * Payment Routes — PayOS Integration
 * Converted from routes/payment.js with TypeScript.
 * CRITICAL: PayOS return URL updated from checkout.html -> /checkout (React SPA paths).
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../middleware/logger';
import { payOSCreateLinkSchema } from '../lib/validators';
import type { Env } from '../types/env';

const log = createLogger({ route: 'payment' });
export const paymentRouter = new Hono<{ Bindings: Env }>();

const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

async function buildSignature(
  params: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string },
  checksumKey: string
): Promise<string> {
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

paymentRouter.post('/create-link', requireAuth(['customer', 'owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const customerId = c.get('user').id;

  try {
    const body = await c.req.json();
    const parsed = payOSCreateLinkSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return c.json({ success: false, error: first.message }, 400);
    }
    const { order_id, description, customer_name } = parsed.data;

    const orderRow = await db.prepare(
      'SELECT id, total, payment_status, customer_id FROM orders WHERE id = ?'
    ).bind(order_id).first<{ id: string; total: number; payment_status: string; customer_id: string | null }>();

    if (!orderRow) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    if (orderRow.customer_id && orderRow.customer_id !== customerId) {
      return c.json({ success: false, error: 'Forbidden — not your order' }, 403);
    }

    if (orderRow.payment_status === 'paid') {
      return c.json({ success: false, error: 'Order already paid' }, 409);
    }

    const amount = parseInt(String(orderRow.total), 10);
    if (!Number.isFinite(amount) || amount < 1000) {
      return c.json({ success: false, error: 'Invalid order total' }, 400);
    }

    // ── Idempotency: check for existing payment before creating new PayOS request ──
    const existingPayment = await db.prepare(
      `SELECT id, transaction_id, payment_url, status
       FROM payments WHERE order_id = ? AND method = 'payos' AND status IN ('pending', 'completed')
       ORDER BY created_at DESC LIMIT 1`
    ).bind(order_id).first<{ id: string; transaction_id: string; payment_url: string; status: string }>();

    if (existingPayment) {
      if (existingPayment.status === 'completed') {
        return c.json({ success: false, error: 'Order already paid' }, 409);
      }
      // Return cached payment link — don't create duplicate
      return c.json({
        success: true,
        checkoutUrl: existingPayment.payment_url,
        orderCode: parseInt(existingPayment.transaction_id, 10),
        cached: true,
      });
    }

    let orderCode = (Date.now() * 1000) + Math.floor(Math.random() * 1000);

    // ── Return URL: direct React SPA route (not legacy checkout.html bridge) ──
    const baseUrl = c.env.FE_BASE_URL || 'https://auraspace.cafe';
    const returnUrl = `${baseUrl}/order-success?order_id=${order_id}`;
    const cancelUrl = `${baseUrl}/checkout?cancelled=true&order_id=${order_id}`;

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

    const payosPayload: Record<string, unknown> = {
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

    const payosData = await payosRes.json() as { code: string; desc?: string; data?: Record<string, unknown> };
    if (payosData.code !== '00') {
      log.error('PayOS create-link failed:', { response: JSON.stringify(payosData) });
      return c.json({ success: false, error: payosData.desc || 'PayOS error' }, 502);
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    function generateOrderCode(): number {
      return (Date.now() * 1000) + Math.floor(Math.random() * 1000);
    }

    let insertOk = false;
    for (let attempt = 0; attempt < 3 && !insertOk; attempt++) {
      try {
        const attemptCode = attempt === 0 ? orderCode : generateOrderCode();
        await db.prepare(`
          INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at)
          VALUES (?, ?, 'payos', ?, 'pending', ?, ?, ?)
        `).bind(paymentId, order_id, amount, String(attemptCode), payosData.data?.checkoutUrl || '', now).run();
        insertOk = true;
        if (attempt > 0) { orderCode = attemptCode; }
      } catch (insertErr) {
        const errMsg = (insertErr as Error).message || '';
        if (errMsg.includes('UNIQUE constraint')) {
          log.warn('PayOS orderCode collision', { attempt: attempt + 1 });
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
          const retryData = await retryRes.json() as { code: string; desc?: string; data?: { checkoutUrl: string } };
          if (retryData.code !== '00') {
            return c.json({ success: false, error: retryData.desc || 'PayOS error on retry' }, 502);
          }
          payosData.data = retryData.data;
        } else {
          throw insertErr;
        }
      }
    }
    if (!insertOk) {
      return c.json({ success: false, error: 'Failed to create payment after 3 retries' }, 500);
    }

    return c.json({
      success: true,
      checkoutUrl: payosData.data?.checkoutUrl,
      orderCode,
      paymentLinkId: payosData.data?.paymentLinkId,
    });
  } catch (err) {
    log.error('PayOS create-link error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});
