import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireStaff } from '../middleware/staff-auth';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'orders-mobile' });

const VIEW_ROLES: string[] = ['owner', 'manager', 'staff', 'waiter'];
const CREATE_ROLES: string[] = ['owner', 'manager', 'waiter'];

// GET /mobile/orders?table_id=xxx — list orders for a table
export async function getOrdersMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    const tableId = context.req.query('table_id');

    let query = 'SELECT * FROM orders';
    const params: string[] = [];

    if (tableId) {
      query += ' WHERE table_id = ?';
      params.push(tableId);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = params.length > 0
      ? await context.env.AURA_DB.prepare(query).bind(...params)
      : await context.env.AURA_DB.prepare(query);

    const { results } = await stmt.all();

    return jsonResponse({
      success: true,
      orders: (results as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        items: JSON.parse((r.items as string) || '[]'),
      })),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getOrdersMobile error:', { message: errMsg });
    return errorResponse(`Lỗi: ${(err as Error).message}`, 500);
  }
}

// POST /mobile/orders — create order (owner/manager/waiter)
export async function createOrderMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!CREATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền tạo đơn', 403);
    }

    const body = await context.req.json<{
      table_id: string;
      items: Array<{ name: string; qty: number; price: number; note?: string }>;
    }>();

    if (!body.table_id) {
      return errorResponse('Thiếu table_id', 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse('Danh sách món trống', 400);
    }

    const id = `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await context.env.AURA_DB
      .prepare(
        `INSERT INTO orders (id, table_id, items, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`
      )
      .bind(id, body.table_id, JSON.stringify(body.items), now, now)
      .run();

    return jsonResponse({ success: true, order_id: id }, 201);
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('createOrderMobile error:', { message: errMsg });
    return errorResponse(`Lỗi: ${(err as Error).message}`, 500);
  }
}

// GET /mobile/orders/:id — order detail
export async function getOrderDetail(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    const orderId = context.req.param('id');
    if (!orderId) {
      return errorResponse('Thiếu order id', 400);
    }

    const row = await context.env.AURA_DB
      .prepare('SELECT * FROM orders WHERE id = ?')
      .bind(orderId)
      .first();

    if (!row) {
      return errorResponse('Đơn hàng không tồn tại', 404);
    }

    const data = row as Record<string, unknown>;
    return jsonResponse({
      success: true,
      order: {
        ...data,
        items: JSON.parse((data.items as string) || '[]'),
      },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getOrderDetail error:', { message: errMsg });
    return errorResponse(`Lỗi: ${(err as Error).message}`, 500);
  }
}
