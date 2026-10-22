import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';
import { canAccessPaymentOrder, paymentTenantScope } from '../../../../packages/domain/payment/policies/payment-access';

type PaymentRow = Record<string, any>;
const paymentResponse = (p: PaymentRow) => ({
  id: p.id, orderId: p.order_id, order: { id: p.order_id }, amount: p.amount, method: p.method,
  status: p.status, transactionId: p.transaction_id, payosOrderCode: Number(p.transaction_id) || null,
  payosPaymentLinkId: null, qrCodeUrl: p.payment_url, deeplink: null,
  paidAt: p.status === 'completed' ? p.updated_at : null,
  failedAt: p.status === 'failed' ? p.updated_at : null, failureReason: null,
  refundedAmount: p.refund_amount || (p.status === 'refunded' ? p.amount : 0),
  refundedAt: p.refunded_at || (p.status === 'refunded' ? p.updated_at : null),
  metadata: null, createdAt: p.created_at, updatedAt: p.updated_at,
});

export function registerPaymentReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  router.openapi(PaymentRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query' as never);
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc', orderId, method, status, dateFrom, dateTo } = query;
    const conditions = ['1=1'];
    const params: (string | number)[] = [];
    const tenant = paymentTenantScope(c);
    if (tenant !== null) { conditions.push("COALESCE(o.tenant_id, 'default') = ?"); params.push(tenant); }
    const user = c.get('user');
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
    if (user.role === 'customer') { conditions.push('o.customer_id = ?'); params.push(user.id); }
    for (const [column, value] of [['p.order_id', orderId], ['p.method', method], ['p.status', status]] as const) {
      if (value) { conditions.push(`${column} = ?`); params.push(value); }
    }
    if (dateFrom) { conditions.push('date(p.created_at) >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date(p.created_at) <= ?'); params.push(dateTo); }
    const from = `FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${conditions.join(' AND ')}`;
    const count = await db.prepare(`SELECT COUNT(*) as total ${from}`).bind(...params).first<{ total: number }>();
    const allowedSorts: Record<string, string> = { created_at: 'p.created_at', amount: 'p.amount', status: 'p.status', payment_method: 'p.method', updated_at: 'p.updated_at' };
    const rows = await db.prepare(`SELECT p.* ${from} ORDER BY ${allowedSorts[sort] || 'p.created_at'} ${order.toLowerCase() === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`)
      .bind(...params, limit, (page - 1) * limit).all<PaymentRow>();
    const total = count?.total || 0;
    return c.json({ success: true, data: { payments: rows.results.map(paymentResponse), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  });

  router.openapi(PaymentRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const payment = await db.prepare('SELECT p.*, o.tenant_id, o.customer_id FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?')
      .bind(id).first<PaymentRow>();
    if (!payment || !canAccessPaymentOrder(c, payment)) return c.json({ success: false, error: 'Payment not found' }, 404);
    return c.json({ success: true, data: paymentResponse(payment) });
  });
}
