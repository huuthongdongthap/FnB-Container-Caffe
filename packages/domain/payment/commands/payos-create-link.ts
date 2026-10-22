/** PayOS checkout: authorize the linked order and reserve before contacting PayOS. */
import { Hono } from 'hono';
import { optionalAuth } from 'worker/src/middleware/auth';
import { createLogger } from 'worker/src/middleware/logger';
import { payOSCreateLinkSchema } from 'worker/src/lib/validators';
import { canAccessPaymentOrder } from '../policies/payment-access';
import { getOrCreatePayOSAttempt } from './payos-attempt';
import { PAYOS_ERROR_MESSAGES as errMsg } from './payos-helpers';
import type { Env } from 'worker/src/types/env';

const log = createLogger({ route: 'payment' });
export const paymentRouter = new Hono<{ Bindings: Env }>();

/** Shared by legacy checkout aliases and the authenticated OpenAPI create route. */
export const handleCreateLink = async (c: any, input?: unknown, openApi = false) => {
  const db = (c.env.AURA_DB ?? c.env.DB) as import('@cloudflare/workers-types').D1Database;
  const locale = c.req.query('locale') === 'en' ? 'en' : 'vi';
  try {
    const parsed = payOSCreateLinkSchema.safeParse(input ?? await c.req.json());
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const { order_id, description, customer_name } = parsed.data;
    type Order = { id: string; total: number; status: string; payment_status: string;
      payment_method: string; customer_id: string | null; tenant_id?: string | null };
    let order: Order | null;
    try {
      order = await db.prepare('SELECT id, total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
        .bind(order_id).first<Order>();
    } catch {
      order = await db.prepare('SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
        .bind(order_id).first<Order>();
    }
    if (!order) return c.json({ success: false, error: errMsg.order_not_found[locale] }, 404);
    if (!canAccessPaymentOrder(c, order, true)) return c.json({ success: false, error: errMsg.forbidden[locale] }, 403);
    if (['cancelled', 'failed', 'expired'].includes(order.status)) {
      return c.json({ success: false, error: `Cannot pay for ${order.status} order` }, 409);
    }
    if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return c.json({ success: false, error: errMsg.already_paid[locale] }, 409);
    }
    if (order.payment_method !== 'payos') {
      return c.json({ success: false, error: 'PayOS payment links are only available for PayOS orders' }, 409);
    }
    const amount = Number(order.total);
    if (!Number.isSafeInteger(amount) || amount < 1000) return c.json({ success: false, error: errMsg.invalid_total[locale] }, 400);
    if (parsed.data.amount !== undefined && parsed.data.amount !== amount) {
      return c.json({ success: false, error: 'Tampered amount: does not match order total' }, 400);
    }
    const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = c.env;
    if (!clientId || !apiKey || !checksumKey) return c.json({ success: false, error: errMsg.payos_not_configured[locale] }, 500);
    const baseUrl = c.env.FE_BASE_URL || 'https://auraspace.cafe';
    const result = await getOrCreatePayOSAttempt({ db, orderId: order_id, amount, clientId, apiKey, checksumKey,
      description: (description || `Order #${order_id}`).slice(0, 25), buyerName: customer_name || 'Khách hàng',
      returnUrl: `${baseUrl}/order-success?order_id=${encodeURIComponent(order_id)}`,
      cancelUrl: `${baseUrl}/checkout?cancelled=true&order_id=${encodeURIComponent(order_id)}`,
    });
    if (result.ok === false) {
      if (result.status === 202) c.header('Retry-After', '2');
      return c.json({ success: false, error: result.error, orderCode: result.payment?.transaction_id,
        retryable: result.status === 202 || result.status === 502 }, result.status);
    }
    const { payment, cached } = result;
    if (openApi) return c.json({ success: true, data: {
      paymentId: payment.id, paymentUrl: payment.payment_url, qrCodeUrl: null, deeplink: null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), status: 'pending',
    } }, 201);
    return c.json({ success: true, checkoutUrl: payment.payment_url, checkout_url: payment.payment_url,
      orderCode: Number(payment.transaction_id), paymentId: payment.id, cached });
  } catch (err) {
    log.error('PayOS create-link error:', { message: (err as Error).message });
    return c.json({ success: false, error: errMsg.internal_error[locale] }, 500);
  }
};

paymentRouter.post('/create-link', optionalAuth() as any, (c) => handleCreateLink(c));
paymentRouter.post('/payos/create', optionalAuth() as any, (c) => handleCreateLink(c));
