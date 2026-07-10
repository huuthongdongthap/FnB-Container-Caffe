import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireStaff } from '../middleware/staff-auth';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'tables-mobile' });

const VIEW_ROLES: string[] = ['owner', 'manager', 'staff', 'waiter'];
const UPDATE_ROLES: string[] = ['owner', 'manager', 'waiter'];

// GET /mobile/tables — list all tables
export async function getTablesMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    const { results } = await context.env.AURA_DB
      .prepare('SELECT * FROM tables ORDER BY table_number ASC')
      .all();

    return jsonResponse({ success: true, tables: results });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getTablesMobile error:', { message: errMsg });
    return errorResponse(`Lỗi: ${(err as Error).message}`, 500);
  }
}

// PATCH /mobile/tables/:id — change status (owner/manager/waiter)
export async function updateTableStatus(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!UPDATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    const tableId = context.req.param('id');
    if (!tableId) {
      return errorResponse('Thiếu table id', 400);
    }

    const body = await context.req.json<{ status: string }>();
    const allowed = ['free', 'occupied', 'reserved'];
    if (!allowed.includes(String(body.status))) {
      return errorResponse('Trạng thái không hợp lệ', 400);
    }

    // Verify table exists before updating
    const existing = await context.env.AURA_DB
      .prepare('SELECT id, name, status, capacity FROM tables WHERE id = ?')
      .bind(tableId)
      .first<{ id: string; name: string; status: string; capacity: number }>();
    if (!existing) {
      return errorResponse('Bàn không tồn tại', 404);
    }

    await context.env.AURA_DB
      .prepare('UPDATE tables SET status = ? WHERE id = ?')
      .bind(body.status, tableId)
      .run();

    return jsonResponse({ success: true, table: { ...existing, status: body.status } });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('updateTableStatus error:', { message: errMsg });
    return errorResponse(`Lỗi: ${(err as Error).message}`, 500);
  }
}
