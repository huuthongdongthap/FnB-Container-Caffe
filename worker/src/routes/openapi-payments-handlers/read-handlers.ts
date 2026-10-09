import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { getDatabase } from '../../lib/db';

interface PaymentRow {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  status: string;
  transaction_id: string | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export function registerPaymentReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // GET /api/payments - List payments
  router.openapi(PaymentRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
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

    const countResult = (await db.prepare(
      `SELECT COUNT(*) as total FROM payments ${whereClause}`
    ).bind(...params).first()) as { total: number } | null;
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const allowedSorts: Record<string, string> = {
      created_at: 'p.created_at',
      amount: 'p.amount',
      status: 'p.status',
      payment_method: 'p.method',
      updated_at: 'p.updated_at',
    };
    const safeSort = allowedSorts[sort] || 'p.created_at';
    const safeDirection = (order?.toLowerCase() === 'asc') ? 'ASC' : 'DESC';
    const orderClause = `${safeSort} ${safeDirection}`;
    const rows = (await db.prepare(
      `SELECT p.* FROM payments p
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all()) as { results: PaymentRow[] };

    const payments = (rows.results || []).map((p) => ({
      id: p.id,
      orderId: p.order_id,
      order: { id: p.order_id },
      amount: p.amount,
      method: p.method,
      status: p.status,
      transactionId: p.transaction_id,
      payosOrderCode: p.transaction_id ? parseInt(p.transaction_id, 10) || null : null,
      payosPaymentLinkId: null,
      qrCodeUrl: p.payment_url,
      deeplink: null,
      paidAt: p.status === 'completed' ? p.updated_at : null,
      failedAt: p.status === 'failed' ? p.updated_at : null,
      failureReason: null,
      refundedAmount: p.status === 'refunded' ? p.amount : 0,
      refundedAt: p.status === 'refunded' ? p.updated_at : null,
      metadata: null,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return c.json({
      success: true,
      data: { payments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/payments/:id - Get payment by ID
  router.openapi(PaymentRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };

    const payment = (await db.prepare(
      'SELECT p.* FROM payments p WHERE p.id = ?'
    ).bind(id).first()) as PaymentRow | null;

    if (!payment) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: payment.id,
        orderId: payment.order_id,
        order: { id: payment.order_id },
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        transactionId: payment.transaction_id,
        payosOrderCode: payment.transaction_id ? parseInt(payment.transaction_id, 10) || null : null,
        payosPaymentLinkId: null,
        qrCodeUrl: payment.payment_url,
        deeplink: null,
        paidAt: payment.status === 'completed' ? payment.updated_at : null,
        failedAt: payment.status === 'failed' ? payment.updated_at : null,
        failureReason: null,
        refundedAmount: payment.status === 'refunded' ? payment.amount : 0,
        refundedAt: payment.status === 'refunded' ? payment.updated_at : null,
        metadata: null,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      },
    });
  });
}
