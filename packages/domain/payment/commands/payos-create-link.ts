/** PayOS checkout: authorize the linked order and reserve before contacting PayOS. */
import { Hono } from 'hono';
import { optionalAuth } from 'worker/src/middleware/auth';
import { createLogger } from 'worker/src/middleware/logger';
import { payOSCreateLinkSchema } from 'worker/src/lib/validators';
import { canAccessPaymentOrder, resolvePaymentCustomerOwnerIds, resolvePaymentTenantScope } from '../policies/payment-access';
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
    const scope = resolvePaymentTenantScope(c, true);
    if (!scope) return c.json({ success: false, error: errMsg.forbidden[locale] }, 403);
    const parsed = payOSCreateLinkSchema.safeParse(input ?? await c.req.json());
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const { order_id, description, customer_name } = parsed.data;
    type Order = {
      id: string;
      total: number;
      status: string;
      payment_status: string;
      payment_method: string;
      customer_id: string | null;
      tenant_id?: string | null;
      order_token?: string | null;
    };
    let order: Order | null = null;
    try {
      order = await db
        .prepare(
          'SELECT id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method, customer_id, tenant_id, order_token FROM orders WHERE id = ?'
        )
        .bind(order_id)
        .first<Order>();
    } catch {
      try {
        order = await db
          .prepare('SELECT id, total, status, payment_status, payment_method, customer_id, tenant_id, order_token FROM orders WHERE id = ?')
          .bind(order_id)
          .first<Order>();
      } catch {
        try {
          order = await db
            .prepare('SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id, tenant_id, order_token FROM orders WHERE id = ?')
            .bind(order_id)
            .first<Order>();
        } catch {
          try {
            order = await db
              .prepare('SELECT id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
              .bind(order_id)
              .first<Order>();
          } catch {
            try {
              order = await db
                .prepare('SELECT id, total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
                .bind(order_id)
                .first<Order>();
            } catch {
              try {
                order = await db
                  .prepare('SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id, tenant_id FROM orders WHERE id = ?')
                  .bind(order_id)
                  .first<Order>();
              } catch {
                if (scope.tenantId === 'default' || scope.wildcard) {
                  try {
                    order = await db
                      .prepare(
                        'SELECT id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method, customer_id, order_token FROM orders WHERE id = ?'
                      )
                      .bind(order_id)
                      .first<Order>();
                  } catch {
                    try {
                      order = await db
                        .prepare('SELECT id, total, status, payment_status, payment_method, customer_id FROM orders WHERE id = ?')
                        .bind(order_id)
                        .first<Order>();
                    } catch {
                      order = await db
                        .prepare('SELECT id, total_amount AS total, status, payment_status, payment_method, customer_id FROM orders WHERE id = ?')
                        .bind(order_id)
                        .first<Order>();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (!order) return c.json({ success: false, error: errMsg.order_not_found[locale] }, 404);
    const orderTenant =
      (order.tenant_id &&
      String(order.tenant_id).trim() &&
      String(order.tenant_id).trim() !== '*' &&
      String(order.tenant_id).trim().toLowerCase() !== 'hq')
        ? String(order.tenant_id).trim()
        : (scope.wildcard ? 'default' : scope.tenantId);
    let effectiveOrderForAccess: Order = order;
    const user = c?.get?.('user') as Record<string, any> | undefined;
    if (user && String(user.role || '').trim().toLowerCase() === 'customer' && order.customer_id) {
      const ownerIds = await resolvePaymentCustomerOwnerIds(db, user, orderTenant);
      try { c.set?.('customerOwnerIds', ownerIds); } catch { /* optional on mock context */ }
      const ordCustId = String(order.customer_id).trim();
      if (ownerIds.includes(ordCustId)) {
        const canonicalActorId = String(user.id ?? user.sub ?? ordCustId).trim() || ordCustId;
        effectiveOrderForAccess = { ...order, customer_id: canonicalActorId };
      }
    }
    if (!canAccessPaymentOrder(c, effectiveOrderForAccess, true)) return c.json({ success: false, error: errMsg.forbidden[locale] }, 403);
    const normalizedOrderStatus = String(order.status || '').trim().toLowerCase();
    if (['cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired'].includes(normalizedOrderStatus)) {
      return c.json({ success: false, error: `Cannot pay for ${order.status} order` }, 409);
    }
    if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return c.json({
        success: false,
        error: errMsg.already_paid[locale],
        ...(order.payment_status === 'paid' ? { code: 'ORDER_ALREADY_PAID', orderId: order.id } : {}),
      }, 409);
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
    const result = await getOrCreatePayOSAttempt({ db, kv: c.env.AUTH_KV ?? null, orderId: order_id, amount, clientId, apiKey, checksumKey,
      description: (description || `Order #${order_id}`).slice(0, 25), buyerName: customer_name || 'Khách hàng',
      returnUrl: `${baseUrl}/order-success?order_id=${encodeURIComponent(order_id)}`,
      cancelUrl: `${baseUrl}/checkout?cancelled=true&order_id=${encodeURIComponent(order_id)}`,
      tenantId: orderTenant,
    });
    if (result.ok === false) {
      if (result.status === 202) c.header('Retry-After', '2');
      return c.json({
        success: false,
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.orderId ? { orderId: result.orderId } : {}),
        orderCode: result.payment?.transaction_id,
        retryable: result.status === 202 || result.status === 502,
      }, result.status);
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
