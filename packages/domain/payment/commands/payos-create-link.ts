/**
 * Payment Routes — PayOS Integration
 * Converted from routes/payment.js with TypeScript.
 * CRITICAL: PayOS return URL updated from checkout.html -> /checkout (React SPA paths).
 */

import { Hono } from 'hono';
import { optionalAuth } from 'worker/src/middleware/auth';
import { createLogger } from 'worker/src/middleware/logger';
import { payOSCreateLinkSchema } from 'worker/src/lib/validators';
import { createMetricsCollector } from 'worker/src/lib/metrics-collector';
import { momoCreate } from './momo-create';
import {
  PAYOS_API,
  PAYOS_ERROR_MESSAGES as errMsg,
  buildPayOSSignature,
  generateOrderCode,
  validatePayOSAccess,
  persistPaymentWithRetries,
} from './payos-helpers';
import type { Env } from 'worker/src/types/env';

const log = createLogger({ route: 'payment' });
export const paymentRouter = new Hono<{ Bindings: Env }>();

const handleCreateLink = async (c: any) => {
  const db = (c.env.AURA_DB ?? c.env.DB) as import('@cloudflare/workers-types').D1Database;
  const user = (c.get as any)('user') as { id?: string; role?: string } | undefined;
  const customerId = user?.id ?? null;
  const mc = createMetricsCollector(db);
  const locale = (c.req.query('locale') || 'vi') as 'vi' | 'en';

  try {
    const body = await c.req.json();
    const parsed = payOSCreateLinkSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'validation_error' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: first.message }, 400);
    }
    const { order_id, description, customer_name } = parsed.data;

    const orderRow = await db.prepare(
      'SELECT id, total, status, payment_status, customer_id, is_cod FROM orders WHERE id = ?'
    ).bind(order_id).first<{ id: string; total: number; status: string; payment_status: string; customer_id: string | null; is_cod: number }>();

    if (!orderRow) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'order_not_found' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.order_not_found[locale] }, 404);
    }

    if (orderRow.status === 'cancelled' || orderRow.status === 'failed' || orderRow.status === 'expired') {
      return c.json({ success: false, error: `Cannot pay for ${orderRow.status} order` }, 409);
    }

    const rawAmount = parseInt(String(orderRow.total), 10);
    if (!Number.isFinite(rawAmount) || rawAmount < 1000) {
      return c.json({ success: false, error: errMsg.invalid_total[locale] }, 400);
    }
    if (parsed.data.amount !== undefined && parsed.data.amount !== rawAmount) {
      return c.json({ success: false, error: 'Tampered amount: does not match order total' }, 400);
    }
    const amount = rawAmount;

    const access = validatePayOSAccess({ ...orderRow, total: amount }, customerId, user?.role);
    if (!access.allowed && access.reason) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: access.reason }));
      } catch { /* executionCtx unavailable */ }
      const status = access.reason === 'forbidden' ? 403 : access.reason === 'already_paid' ? 409 : 400;
      return c.json({ success: false, error: errMsg[access.reason][locale] }, status);
    }

    // ── COD short-circuit: skip PayOS, mark order as paid immediately ──
    const rawIsCod = Number(orderRow.is_cod ?? 0);
    if (rawIsCod === 1 || orderRow.payment_status === 'cod_pending') {
      const now = new Date().toISOString();
      await db.prepare(
        'UPDATE orders SET status = \'completed\', payment_status = \'paid\', cod_paid_at = ?, updated_at = ? WHERE id = ?'
      ).bind(now, now, order_id).run();
      await db.prepare(
        'UPDATE payments SET status = \'completed\', updated_at = ? WHERE order_id = ? AND method = \'cod\''
      ).bind(now, order_id).run();
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
      return c.json({
        success: true,
        checkoutUrl: existingPayment.payment_url,
        checkout_url: existingPayment.payment_url,
        orderCode: parseInt(existingPayment.transaction_id, 10),
        cached: true
      });
    }

    const orderCode = generateOrderCode();
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
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.payos_not_configured[locale] }, 500);
    }

    const signature = await buildPayOSSignature(
      { amount, cancelUrl, description: desc, orderCode, returnUrl },
      checksumKey
    );

    const payosPayload: Record<string, unknown> = {
      orderCode, amount, description: desc,
      buyerName: customer_name || (locale === 'en' ? 'Customer' : 'Khách hàng'),
      returnUrl, cancelUrl, signature, items: []
    };

    const payosRes = await fetch(PAYOS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
      body: JSON.stringify(payosPayload)
    });

    const payosData = await payosRes.json() as { code: string; desc?: string; data?: { checkoutUrl?: string; paymentLinkId?: string } };
    if (payosData.code !== '00') {
      log.error('PayOS create-link failed:', { response: JSON.stringify(payosData) });
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'payos_api_error' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: payosData.desc || errMsg.payos_error[locale] }, 502);
    }

    const persistResult = await persistPaymentWithRetries({
      db, orderId: order_id, amount, initialOrderCode: orderCode,
      checkoutUrl: payosData.data?.checkoutUrl || '', payosPayload,
      checksumKey, clientId, apiKey, cancelUrl, description: desc, returnUrl,
    });

    if (!persistResult.ok) {
      try {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'insert_retries_exhausted' }));
      } catch { /* executionCtx unavailable */ }
      return c.json({ success: false, error: errMsg.insert_failed[locale] }, 500);
    }

    try {
      c.executionCtx?.waitUntil(mc.recordMetric('payment_success', amount, {
        payment_method: 'payos',
        amount: String(amount)
      }));
    } catch { /* executionCtx unavailable */ }

    return c.json({
      success: true,
      checkoutUrl: persistResult.checkoutUrl,
      checkout_url: persistResult.checkoutUrl,
      orderCode: persistResult.finalOrderCode,
      paymentLinkId: payosData.data?.paymentLinkId
    });
  } catch (err) {
    log.error('PayOS create-link error:', { message: (err as Error).message });
    try {
      c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', 1, { reason: 'internal_error' }));
    } catch { /* executionCtx unavailable */ }
    return c.json({ success: false, error: errMsg.internal_error[locale] }, 500);
  }
};

paymentRouter.post('/create-link', optionalAuth() as any, handleCreateLink);
paymentRouter.post('/payos/create', optionalAuth() as any, handleCreateLink);

// MoMo route
momoCreate(paymentRouter);
