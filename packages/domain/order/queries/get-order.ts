/**
 * Orders — Get order handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'orders' });

export async function getOrder(request: Request, env: Record<string, unknown>, id: string) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    let results: Record<string, unknown>[] = [];
    try {
      const res = await db.prepare(
        'SELECT id, status, total, shipping_fee, discount, payment_status, customer_name, customer_phone, customer_address, items, created_at, updated_at, points_earned, cashback_earned FROM orders WHERE id = ?'
      ).bind(id).all<Record<string, unknown>>();
      results = res.results ?? [];
    } catch {
      const res = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all<Record<string, unknown>>();
      results = res.results ?? [];
    }

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    let parsedItems: unknown = [];
    if (Array.isArray(results[0].items)) {
      parsedItems = results[0].items;
    } else if (typeof results[0].items === 'string' && results[0].items) {
      try {
        parsedItems = JSON.parse(results[0].items);
      } catch {
        parsedItems = [];
      }
    }

    const order: Record<string, unknown> = {
      ...results[0],
      items: parsedItems,
      total: parseInt(String(results[0].total ?? results[0].total_amount ?? 0), 10) || 0,
      shipping_fee: parseInt(String(results[0].shipping_fee || 0), 10) || 0,
      discount: parseInt(String(results[0].discount || 0), 10) || 0,
      points_earned: Number(results[0].points_earned ?? 0),
      cashback_earned: Number(results[0].cashback_earned ?? 0)
    };

    const { results: paymentResults } = await db.prepare(
      'SELECT * FROM payments WHERE order_id = ?'
    ).bind(id).all<Record<string, unknown>>();

    order.payment = paymentResults[0] || null;

    return jsonResponse({ success: true, order });
  } catch (error) {
    log.error('GetOrder error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch order', 500);
  }
}
