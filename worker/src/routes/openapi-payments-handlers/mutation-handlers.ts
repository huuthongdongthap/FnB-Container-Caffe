import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';
import { canAccessPaymentOrder, resolvePaymentCustomerOwnerIds, resolvePaymentTenantScope } from '../../../../packages/domain/payment/policies/payment-access';
import { handleCreateLink } from '../../../../packages/domain/payment/commands/payos-create-link';
import { handleRefund } from '../refunds-handlers/mutation-handlers';

export async function handleCreatePayment(c: any) {
  const scope = resolvePaymentTenantScope(c, true);
  if (!scope) return c.json({ success: false, error: 'Forbidden' }, 403);
  const body = c.req.valid('json' as never) as { orderId: string; method: string; amount?: number };
  if (body.method === 'payos') return handleCreateLink(c, { order_id: body.orderId, amount: body.amount }, true);
  const db = getDatabase(c);
  type OrderPaymentRow = {
    id: string;
    customer_id: string | null;
    tenant_id: string | null;
    order_token?: string | null;
    total: number;
    status?: string | null;
    payment_status: string;
    payment_method: string;
  };
  let order: OrderPaymentRow | null = null;
  try {
    order = await db
      .prepare(
        'SELECT id, customer_id, tenant_id, COALESCE(total, total_amount) AS total, order_token, status, payment_status, payment_method FROM orders WHERE id = ?'
      )
      .bind(body.orderId)
      .first<OrderPaymentRow>();
  } catch {
    try {
      order = await db
        .prepare('SELECT id, customer_id, tenant_id, total, order_token, status, payment_status, payment_method FROM orders WHERE id = ?')
        .bind(body.orderId)
        .first<OrderPaymentRow>();
    } catch {
      try {
        order = await db
          .prepare('SELECT id, customer_id, tenant_id, total_amount AS total, order_token, status, payment_status, payment_method FROM orders WHERE id = ?')
          .bind(body.orderId)
          .first<OrderPaymentRow>();
      } catch {
        try {
          order = await db
            .prepare('SELECT id, customer_id, tenant_id, COALESCE(total, total_amount) AS total, status, payment_status, payment_method FROM orders WHERE id = ?')
            .bind(body.orderId)
            .first<OrderPaymentRow>();
        } catch {
          try {
            order = await db
              .prepare('SELECT id, customer_id, tenant_id, total, status, payment_status, payment_method FROM orders WHERE id = ?')
              .bind(body.orderId)
              .first<OrderPaymentRow>();
          } catch {
            try {
              order = await db
                .prepare('SELECT id, customer_id, tenant_id, total_amount AS total, status, payment_status, payment_method FROM orders WHERE id = ?')
                .bind(body.orderId)
                .first<OrderPaymentRow>();
            } catch {
              try {
                order = await db
                  .prepare('SELECT id, customer_id, tenant_id, total, payment_status, payment_method FROM orders WHERE id = ?')
                  .bind(body.orderId)
                  .first<OrderPaymentRow>();
              } catch {
                if (scope.tenantId === 'default' || scope.wildcard) {
                  order = await db
                    .prepare(
                      'SELECT id, customer_id, COALESCE(total, total_amount) AS total, order_token, status, payment_status, payment_method FROM orders WHERE id = ?'
                    )
                    .bind(body.orderId)
                    .first<OrderPaymentRow>()
                    .catch(() =>
                      db
                        .prepare('SELECT id, customer_id, total, status, payment_status, payment_method FROM orders WHERE id = ?')
                        .bind(body.orderId)
                        .first<OrderPaymentRow>()
                        .catch(() => null)
                    );
                }
              }
            }
          }
        }
      }
    }
  }
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
  const rawOrderTenant = order.tenant_id ? String(order.tenant_id).trim() : '';
  const orderTenant =
    rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq'
      ? rawOrderTenant
      : scope.wildcard
        ? 'default'
        : scope.tenantId;
  let effectiveOrderForAccess: OrderPaymentRow = order;
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
  if (!canAccessPaymentOrder(c, effectiveOrderForAccess, true)) return c.json({ success: false, error: 'Forbidden' }, 403);
  const normalizedStatus = String(order.status || '').trim().toLowerCase();
  const normalizedPaymentStatus = String(order.payment_status || '').trim().toLowerCase();
  if (
    ['cancelled', 'canceled', 'rejected', 'refunded', 'expired', 'failed'].includes(normalizedStatus) ||
    normalizedPaymentStatus === 'refunded'
  ) {
    return c.json({ success: false, error: 'Cannot create payment for cancelled or terminal order' }, 400);
  }
  if (normalizedPaymentStatus === 'paid') return c.json({ success: false, error: 'Order already paid' }, 409);
  const amount = Number(order.total);
  if (!Number.isSafeInteger(amount) || amount <= 0 || (body.amount !== undefined && body.amount !== amount)) {
    return c.json({ success: false, error: 'Tampered amount: does not match order total' }, 400);
  }
  if (body.method !== 'cod' || order.payment_method !== 'cod') {
    return c.json({ success: false, error: 'Payment method does not match the order' }, 409);
  }
  const now = new Date().toISOString();
  const id = `cod:${order.id}`;
  try {
    await db.prepare(`INSERT OR IGNORE INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
      SELECT ?, ?, 'cod', ?, 'pending', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method = 'cod' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`)
      .bind(id, order.id, amount, orderTenant, now, now, order.id, orderTenant).run();
  } catch (err) {
    if (orderTenant === 'default') {
      await db.prepare(`INSERT OR IGNORE INTO payments (id, order_id, method, amount, status, created_at, updated_at)
        SELECT ?, ?, 'cod', ?, 'pending', ?, ? WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method = 'cod')`)
        .bind(id, order.id, amount, now, now, order.id).run();
    } else {
      throw err;
    }
  }
  const payment = await db.prepare(
    "SELECT id, status FROM payments WHERE order_id = ? AND method = 'cod' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at ASC LIMIT 1"
  ).bind(order.id, orderTenant).first<{ id: string; status: string }>().catch(() =>
    orderTenant === 'default'
      ? db.prepare("SELECT id, status FROM payments WHERE order_id = ? AND method = 'cod' ORDER BY created_at ASC LIMIT 1")
          .bind(order.id).first<{ id: string; status: string }>()
      : null
  );
  if (!payment || payment.status !== 'pending') return c.json({ success: false, error: 'Payment state changed; refresh the order' }, 409);
  return c.json({ success: true, data: { paymentId: payment.id, paymentUrl: null, qrCodeUrl: null, deeplink: null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), status: 'pending' } }, 201);
}

export function registerPaymentMutationHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  router.openapi(PaymentRoutes.create as any, handleCreatePayment);

  // No separate database-only refund path: an acknowledgment requires the canonical provider flow.
  router.openapi(PaymentRoutes.refund as any, (c: any) => handleRefund(c, true));
}
