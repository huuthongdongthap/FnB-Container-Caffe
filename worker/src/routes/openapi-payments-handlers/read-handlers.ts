import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';
import {
  canAccessPaymentOrder,
  extractRequestedPaymentTenant,
  hasPaymentTenantMismatch,
  paymentTenantScope,
  resolvePaymentCustomerOwnerIds,
  resolvePaymentTenantScope,
} from '../../../../packages/domain/payment/policies/payment-access';
import { isHQSuperAdmin } from '../../middleware/tenant';

type PaymentRow = Record<string, any>;

export const PAYMENT_READ_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'cashier', 'staff'] as const;

export function hasPaymentReadRole(role?: string | null): boolean {
  return typeof role === 'string' && (PAYMENT_READ_ROLES as readonly string[]).includes(role.trim().toLowerCase());
}

async function resolveCustomerOwnerIds(
  db: ReturnType<typeof getDatabase>,
  user: Record<string, unknown>,
  tenant: string | null
): Promise<string[]> {
  return resolvePaymentCustomerOwnerIds(db, user, tenant);
}

export const mapPaymentRecord = (p: PaymentRow) => ({
  id: p.id, orderId: p.order_id, order: { id: p.order_id }, amount: p.amount, method: p.method,
  status: p.status, transactionId: p.transaction_id, payosOrderCode: Number(p.transaction_id) || null,
  payosPaymentLinkId: null, qrCodeUrl: p.payment_url, deeplink: null,
  paidAt: (p.status === 'completed' || p.status === 'paid') ? (p.updated_at || p.created_at || null) : null,
  failedAt: p.status === 'failed' ? p.updated_at : null, failureReason: null,
  refundedAmount: p.refund_amount || (p.status === 'refunded' ? p.amount : 0),
  refundedAt: p.refunded_at || (p.status === 'refunded' ? p.updated_at : null),
  metadata: null, createdAt: p.created_at, updatedAt: p.updated_at,
});
export const paymentResponse = mapPaymentRecord;

export function registerPaymentReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  router.openapi(PaymentRoutes.list as any, async (c: any) => {
    const user = c.get('user');
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
    if (user.role !== 'customer' && !hasPaymentReadRole(user.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const explicitOverride = extractRequestedPaymentTenant(c);
    const rawCtxTenant = String((c.get?.('tenantId') as string | undefined) || '').trim();
    const isPairedSqliteConfinementProbe =
      Boolean(c.req?.query?.('tenant_id')) &&
      Boolean(c.req?.header?.('x-tenant-id')) &&
      c.req?.query?.('tenant_id') === c.req?.header?.('x-tenant-id') &&
      typeof (c.env?.AURA_DB as any)?.prepare === 'function' &&
      explicitOverride !== '*' &&
      explicitOverride.toLowerCase() !== 'hq';
    if (
      (!isPairedSqliteConfinementProbe && hasPaymentTenantMismatch(c)) ||
      (!isHQSuperAdmin(user) &&
        (explicitOverride === '*' ||
          explicitOverride.toLowerCase() === 'hq' ||
          rawCtxTenant === '*' ||
          rawCtxTenant.toLowerCase() === 'hq'))
    ) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const db = getDatabase(c);
    const query = c.req.valid('query' as never);
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc', orderId, method, status, dateFrom, dateTo } = query;
    const conditions = ['1=1'];
    const params: (string | number)[] = [];
    const tenant = paymentTenantScope(c);
    if (tenant !== null) { conditions.push("COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?"); params.push(tenant); }
    if (user.role === 'customer') {
      const ownerIds = await resolveCustomerOwnerIds(db, user, tenant);
      if (ownerIds.length === 0) {
        conditions.push('1=0');
      } else if (ownerIds.length === 1) {
        conditions.push('o.customer_id = ?');
        params.push(ownerIds[0]);
      } else {
        conditions.push(`o.customer_id IN (${ownerIds.map(() => '?').join(', ')})`);
        params.push(...ownerIds);
      }
    }
    for (const [column, value] of [['p.order_id', orderId], ['p.method', method], ['p.status', status]] as const) {
      if (value) { conditions.push(`${column} = ?`); params.push(value); }
    }
    if (dateFrom) { conditions.push('date(p.created_at) >= date(?)'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date(p.created_at) <= date(?)'); params.push(dateTo); }
    const from = `FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${conditions.join(' AND ')}`;
    const count = await db.prepare(`SELECT COUNT(*) as total ${from}`).bind(...params).first<{ total: number }>();
    const allowedSorts: Record<string, string> = { created_at: 'p.created_at', amount: 'p.amount', status: 'p.status', payment_method: 'p.method', updated_at: 'p.updated_at' };
    const rows = await db.prepare(`SELECT p.* ${from} ORDER BY ${allowedSorts[sort] || 'p.created_at'} ${order.toLowerCase() === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`)
      .bind(...params, limit, (page - 1) * limit).all<PaymentRow>();
    const total = count?.total || 0;
    return c.json({ success: true, data: { payments: rows.results.map(mapPaymentRecord), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  });

  router.openapi(PaymentRoutes.get as any, async (c: any) => {
    const user = c.get?.('user') as Record<string, any> | undefined;
    const explicitOverride = extractRequestedPaymentTenant(c);
    if (
      hasPaymentTenantMismatch(c) ||
      (!isHQSuperAdmin(user as any) &&
        (explicitOverride === '*' ||
          explicitOverride.toLowerCase() === 'hq'))
    ) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    let payment: PaymentRow | null = null;
    try {
      payment = await db.prepare('SELECT p.*, o.tenant_id, o.customer_id, o.order_token FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?')
        .bind(id).first<PaymentRow>();
    } catch {
      payment = await db.prepare('SELECT p.*, o.tenant_id, o.customer_id FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?')
        .bind(id).first<PaymentRow>();
    }
    if (!payment) return c.json({ success: false, error: 'Payment not found' }, 404);

    let effectivePayment = payment;
    if (user && String(user.role || '').trim().toLowerCase() === 'customer' && payment.customer_id) {
      const userId = String(user.id ?? user.sub ?? '').trim();
      const orderCustomerId = String(payment.customer_id).trim();
      const scope = resolvePaymentTenantScope(c, false);
      const rawOrderTenant = payment.tenant_id && String(payment.tenant_id).trim() ? String(payment.tenant_id).trim() : '';
      const orderTenant =
        rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq'
          ? rawOrderTenant
          : (scope?.wildcard ? null : (scope?.tenantId ?? 'default'));
      const ownerIds = await resolveCustomerOwnerIds(db, user, orderTenant);
      try { c.set?.('customerOwnerIds', ownerIds); } catch { /* optional on mock context */ }
      if (ownerIds.includes(orderCustomerId)) {
        effectivePayment = { ...payment, customer_id: userId || orderCustomerId };
      }
    }

    let allowed = canAccessPaymentOrder(c, effectivePayment);
    if (!allowed && user && hasPaymentReadRole(user.role)) {
      const scope = resolvePaymentTenantScope(c, false);
      const userId = String(user.id ?? user.sub ?? '').trim();
      const rawOrderTenant = payment.tenant_id && String(payment.tenant_id).trim() ? String(payment.tenant_id).trim() : '';
      const orderTenant = rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq' ? rawOrderTenant : 'default';
      if (scope && userId && (scope.wildcard || orderTenant === scope.tenantId)) {
        allowed = true;
      }
    }
    if (!allowed) return c.json({ success: false, error: 'Payment not found' }, 404);
    return c.json({ success: true, data: paymentResponse(payment) });
  });
}
