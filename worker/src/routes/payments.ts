/**
 * Payment Routes — PayOS Integration
 * Converted from routes/payment.js with TypeScript.
 * CRITICAL: PayOS return URL updated from checkout.html -> /checkout (React SPA paths).
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../middleware/logger';
import { payOSCreateLinkSchema } from '../lib/validators';
import { createMetricsCollector } from '../lib/metrics-collector';
import { momoCreate } from './payments/momo-create';
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
    `returnUrl=${params.returnUrl}`
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

paymentRouter.post('/create-link', requireAuth(['customer', 'owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const customerId = c.get('user').id;
  const mc = createMetricsCollector(db);
  const locale = (c.req.query('locale') || 'vi') as 'vi' | 'en';

  const errMsg = {
    order_not_found: { vi: 'Không tìm thấy đơn hàng', en: 'Order not found' },
    forbidden: { vi: 'Từ chối — không phải đơn hàng của bạn', en: 'Forbidden — not your order' },
    already_paid: { vi: 'Đơn hàng đã được thanh toán', en: 'Order already paid' },
    invalid_total: { vi: 'Tổng tiền không hợp lệ', en: 'Invalid order total' },
    payos_not_configured: { vi: 'PayOS chưa được cấu hình', en: 'PayOS env vars not configured' },
    payos_error: { vi: 'Lỗi PayOS', en: 'PayOS error' },
    payos_retry_error: { vi: 'Lỗi PayOS khi thử lại', en: 'PayOS error on retry' },
    insert_failed: { vi: 'Không thể tạo thanh toán sau 3 lần thử', en: 'Failed to create payment after 3 retries' },
    internal_error: { vi: 'Lỗi hệ thống', en: 'Internal error' }
  };

  try {
    const body = await c.req.json();
    const parsed = payOSCreateLinkSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'validation_error' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: first.message }, 400);
    }
    const { order_id, description, customer_name } = parsed.data;

    const orderRow = await db.prepare(
      'SELECT id, total, payment_status, customer_id FROM orders WHERE id = ?'
    ).bind(order_id).first<{ id: string; total: number; payment_status: string; customer_id: string | null; is_cod: number }>();

    if (!orderRow) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'order_not_found' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: errMsg.order_not_found[locale] }, 404);
    }

    if (orderRow.customer_id && orderRow.customer_id !== customerId) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'forbidden' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: errMsg.forbidden[locale] }, 403);
    }

    if (orderRow.payment_status === 'paid') {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'already_paid' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: errMsg.already_paid[locale] }, 409);
    }

    const amount = parseInt(String(orderRow.total), 10);
    if (!Number.isFinite(amount) || amount < 1000) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'invalid_total' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: errMsg.invalid_total[locale] }, 400);
    }

 // ── COD short-circuit: skip PayOS, mark order as paid immediately ──
 const rawIsCod = Number(orderRow.is_cod ?? 0);
 if (rawIsCod === 1 || orderRow.payment_status === 'cod_pending') {
   if (orderRow.payment_status === 'paid') {
     return c.json({ success: false, error: errMsg.already_paid[locale] }, 409);
   }
   const now = new Date().toISOString();
   await db.prepare(
     "UPDATE orders SET status = 'completed', payment_status = 'paid', cod_paid_at = ?, updated_at = ? WHERE id = ?"
   ).bind(now, now, order_id).run();
   return c.json({ success: true, is_cod: true, message: 'Cash collected', order_id });
 }

    // ── Idempotency: check for existing payment before creating new PayOS request ──
    const existingPayment = await db.prepare(
      `SELECT id, transaction_id, payment_url, status
       FROM payments WHERE order_id = ? AND method = 'payos' AND status IN ('pending', 'completed')
       ORDER BY created_at DESC LIMIT 1`
    ).bind(order_id).first<{ id: string; transaction_id: string; payment_url: string; status: string }>();

    if (existingPayment) {
      if (existingPayment.status === 'completed') {
        return c.json({ success: false, error: errMsg.already_paid[locale] }, 409);
      }
      // Return cached payment link — don't create duplicate
      return c.json({
        success: true,
        checkoutUrl: existingPayment.payment_url,
        orderCode: parseInt(existingPayment.transaction_id, 10),
        cached: true
      });
    }

    let orderCode = (Date.now() * 1000) + Math.floor(Math.random() * 1000);

    // ── Return URL: direct React SPA route (not legacy checkout.html bridge) ──
    const baseUrl = c.env.FE_BASE_URL || 'https://auraspace.cafe';
    const returnUrl = `${baseUrl}/order-success?order_id=${order_id}`;
    const cancelUrl = `${baseUrl}/checkout?cancelled=true&order_id=${order_id}`;

    const desc = (description || (locale === 'en' ? `Order #${order_id}` : `Đơn hàng #${order_id}`)).slice(0, 25);

    const clientId = c.env.PAYOS_CLIENT_ID;
    const apiKey = c.env.PAYOS_API_KEY;
    const checksumKey = c.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'payos_not_configured' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: errMsg.payos_not_configured[locale] }, 500);
    }

    const signature = await buildSignature(
      { amount, cancelUrl, description: desc, orderCode, returnUrl },
      checksumKey
    );

    const payosPayload: Record<string, unknown> = {
      orderCode,
      amount,
      description: desc,
      buyerName: customer_name || (locale === 'en' ? 'Customer' : 'Khách hàng'),
      returnUrl,
      cancelUrl,
      signature,
      items: []
    };

    const payosRes = await fetch(PAYOS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-key': apiKey
      },
      body: JSON.stringify(payosPayload)
    });

    const payosData = await payosRes.json() as { code: string; desc?: string; data?: Record<string, unknown> };
    if (payosData.code !== '00') {
      log.error('PayOS create-link failed:', { response: JSON.stringify(payosData) });
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'payos_api_error' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: payosData.desc || errMsg.payos_error[locale] }, 502);
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
        if (attempt > 0) {
          orderCode = attemptCode;
        }
      } catch (insertErr) {
        const insertErrMsg = (insertErr as Error).message || '';
        if (insertErrMsg.includes('UNIQUE constraint')) {
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
            body: JSON.stringify(payosPayload)
          });
          const retryData = await retryRes.json() as { code: string; desc?: string; data?: { checkoutUrl: string } };
          if (retryData.code !== '00') {
            try {
              c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'payos_retry_error' }));
            } catch { /* executionCtx unavailable */ };
            return c.json({ success: false, error: retryData.desc || errMsg.payos_retry_error[locale] }, 502);
          }
          payosData.data = retryData.data;
        } else {
          throw insertErr;
        }
      }
    }
    if (!insertOk) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'insert_retries_exhausted' }));
      } catch { /* executionCtx unavailable */ };
      return c.json({ success: false, error: errMsg.insert_failed[locale] }, 500);
    }

    // Record payment success metric
    try {
      c.executionCtx?.waitUntil(mc.recordMetric('payment_success', amount, {
        payment_method: 'payos',
        amount: String(amount)
      }));
    } catch { /* executionCtx unavailable */ }

    return c.json({
      success: true,
      checkoutUrl: payosData.data?.checkoutUrl,
      orderCode,
      paymentLinkId: payosData.data?.paymentLinkId
    });
  } catch (err) {
    log.error('PayOS create-link error:', { message: (err as Error).message });
    try {
      c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'internal_error' }));
    } catch { /* executionCtx unavailable */ };
    return c.json({ success: false, error: errMsg.internal_error[locale] }, 500);
  }
});

// MoMo route
momoCreate(paymentRouter);
