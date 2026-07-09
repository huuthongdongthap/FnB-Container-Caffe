/**
 * Orders — Get order handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'orders' });

export async function getOrder(request: Request, env: Record<string, unknown>, id: string) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const { results } = await db.prepare(
      'SELECT id, status, total, payment_status, customer_name, customer_phone, customer_address, items, created_at, updated_at FROM orders WHERE id = ?'
    ).bind(id).all<Record<string, unknown>>();

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    const order: Record<string, unknown> = {
      ...results[0],
      items: JSON.parse(results[0].items as string),
      total: parseInt(results[0].total as string),
      shipping_fee: parseInt(String(results[0].shipping_fee || 0)),
      discount: parseInt(String(results[0].discount || 0))
    };

    const { results: paymentResults } = await db.prepare(
      'SELECT * FROM payments WHERE order_id = ?'
    ).bind(id).all<Record<string, unknown>>();

    order.payment = paymentResults[0] || null;

    return jsonResponse({ success: true, order });
  } catch (error) {
    log.error('GetOrder error:', { message: (error as Error).message });
    return errorResponse(`Failed to fetch order: ${(error as Error).message}`, 500);
  }
}
