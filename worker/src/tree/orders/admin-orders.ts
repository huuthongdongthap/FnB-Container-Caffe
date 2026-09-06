/**
 * Orders — Admin orders listing handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { buildOrderFilterClause, buildOrderTail, OrderSortColumn } from './shared-listing';

const log = createLogger({ route: 'orders' });

export async function getAdminOrders(request: Request, env: Record<string, unknown>) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('payment_status');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';
    const sortParam = (url.searchParams.get('sort') || 'created_at') as OrderSortColumn;
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' as const : 'DESC' as const;

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    const filters: Array<[string, string]> = [];
    if (status) filters.push(['o.status', status]);
    if (paymentStatus) filters.push(['o.payment_status', paymentStatus]);

    let query = `SELECT o.id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
       p.id AS payment_id, p.refund_status, p.refund_amount, p.amount AS payment_amount, p.method AS payment_method
     FROM orders o LEFT JOIN payments p ON o.id = p.order_id AND p.status IN ('paid', 'completed') WHERE 1=1`;
    const { clause, params } = buildOrderFilterClause({ filters });
    query += clause;
    query += buildOrderTail({
      sort: sortParam,
      order,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await db.prepare(query).bind(...params).all<Record<string, unknown>>();

    const orders = results.map(order => ({
      ...order,
      items: order.items ? JSON.parse(order.items as string) : [],
      total: parseInt(order.total as string),
      payment_id: order.payment_id || null,
      payment_amount: order.payment_amount ? Number(order.payment_amount) : null,
      refund_amount: order.refund_amount ? Number(order.refund_amount) : null,
      shipping_fee: parseInt(String(order.shipping_fee || 0)),
      discount: parseInt(String(order.discount || 0))
    }));

    const countQuery = `SELECT COUNT(*) as total FROM orders WHERE 1=1${clause.replace(/o\./g, '')}`;
    const countParams = filters.map(([, value]) => value);

    const { results: countResult } = await db.prepare(countQuery).bind(...countParams).all<{ total: number }>();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      orders,
      pagination: {
        total: parseInt(total as unknown as string),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    log.error('GetAdminOrders error:', { message: (error as Error).message });
    return errorResponse(`Failed to fetch orders: ${(error as Error).message}`, 500);
  }
}
