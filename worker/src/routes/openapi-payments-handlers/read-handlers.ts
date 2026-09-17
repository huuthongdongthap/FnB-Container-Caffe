import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';

interface PaymentRow {
  id: string;
  order_id: string;
  payment_number: string;
  method: string;
  amount: number;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  order_number?: string;
  [key: string]: unknown;
}

export function registerPaymentReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // GET /api/payments - List payments
  router.openapi(PaymentRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const query = c.req.valid('query' as never) as {
      page?: number;
      limit?: number;
      sort?: string;
      order?: string;
      orderId?: string;
      method?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc', orderId, method, status, dateFrom, dateTo } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (orderId) {
      whereClause += ' AND order_id = ?';
      params.push(orderId);
    }
    if (method) {
      whereClause += ' AND method = ?';
      params.push(method);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (dateFrom) {
      whereClause += ' AND date(created_at) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND date(created_at) <= ?';
      params.push(dateTo);
    }

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM order_payments ${whereClause}`
    ).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT op.*, o.order_number FROM order_payments op
       LEFT JOIN orders o ON op.order_id = o.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all<PaymentRow>();

    const payments = rows.results.map((p) => ({
      ...p,
      metadata: p.metadata ? JSON.parse(p.metadata) : {},
      order: { id: p.order_id, orderNumber: p.order_number },
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return c.json({
      success: true,
      data: { payments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/payments/:id - Get payment by ID
  router.openapi(PaymentRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param' as never) as { id: string };

    const payment = await db.prepare(
      `SELECT op.*, o.order_number FROM order_payments op
       LEFT JOIN orders o ON op.order_id = o.id
       WHERE op.id = ?`
    ).bind(id).first<PaymentRow>();

    if (!payment) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...payment,
        metadata: payment.metadata ? JSON.parse(payment.metadata) : {},
        order: { id: payment.order_id, orderNumber: payment.order_number },
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      },
    });
  });
}
