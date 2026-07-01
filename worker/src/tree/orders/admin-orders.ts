/**
 * Orders — Admin orders listing handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'orders' });

export async function getAdminOrders(request: Request, env: Record<string, unknown>) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('payment_status');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';
    const sort = url.searchParams.get('sort') || 'created_at';

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    let query = 'SELECT id, status, total, payment_status, customer_name, customer_phone, created_at FROM orders WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (paymentStatus) {
      query += ' AND payment_status = ?';
      params.push(paymentStatus);
    }

    const validSorts = ['created_at', 'total', 'status'];
    const orderDirection = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
    const sortBy = validSorts.includes(sort) ? sort : 'created_at';

    query += ` ORDER BY ${sortBy} ${orderDirection} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await db.prepare(query).bind(...params).all<Record<string, unknown>>();

    const orders = results.map(order => ({
      ...order,
      items: JSON.parse(order.items as string),
      total: parseInt(order.total as string),
      shipping_fee: parseInt(String(order.shipping_fee || 0)),
      discount: parseInt(String(order.discount || 0)),
    }));

    const countQuery = 'SELECT COUNT(*) as total FROM orders WHERE 1=1' +
      (status ? ' AND status = ?' : '') +
      (paymentStatus ? ' AND payment_status = ?' : '');
    const countParams: unknown[] = [];
    if (status) { countParams.push(status); }
    if (paymentStatus) { countParams.push(paymentStatus); }

    const { results: countResult } = await db.prepare(countQuery).bind(...countParams).all<{ total: number }>();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      orders,
      pagination: {
        total: parseInt(total as unknown as string),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    log.error('GetAdminOrders error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch orders: ' + (error as Error).message, 500);
  }
}
