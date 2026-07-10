import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireStaff } from '../middleware/staff-auth';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'kds-mobile' });

// Allowed roles per action
const VIEW_ROLES: string[] = ['owner', 'manager', 'staff'];
const UPDATE_ROLES: string[] = ['owner', 'manager', 'staff'];

// GET /mobile/kds/orders — list active kitchen orders
export async function getKdsMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    const orders = await context.env.AURA_DB
      .prepare(
        `SELECT o.id, o.table_id, o.items, o.status, o.created_at, o.updated_at,
                t.table_number as table_name
         FROM orders o
         JOIN tables t ON t.id = o.table_id
         WHERE o.status IN ('pending','preparing')
         ORDER BY o.created_at ASC`
      )
      .all();

    const rows = orders.results as Array<Record<string, unknown>>;
    return jsonResponse({
      success: true,
      orders: rows.map((r) => ({
        id: r.id as string,
        table_id: r.table_id as string,
        table_name: r.table_name as string | null,
        items: JSON.parse((r.items as string) || '[]'),
        status: r.status as string,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      })),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getKdsMobile error:', { message: errMsg });
    return errorResponse(`Lỗi: ${(err as Error).message}`, 500);
  }
}

// PATCH /mobile/kds/orders/:id/status — update order status (staff+ only)
export async function updateKdsStatus(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!UPDATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    const orderId = context.req.param('id');
    if (!orderId) {
      return errorResponse('Thiếu order id', 400);
    }

    const body = await context.req.json<{ status: string }>();
    const allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!allowed.includes(String(body.status))) {
      return errorResponse('Trạng thái không hợp lệ', 400);
    }

    await context.env.AURA_DB
      .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .bind(body.status, new Date().toISOString(), orderId)
      .run();

    return jsonResponse({ success: true });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('updateKdsStatus error:', { message: errMsg });
    return errorResponse(`Lỗi: ${(err as Error).message}`, 500);
  }
}
