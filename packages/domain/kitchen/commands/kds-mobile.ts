import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import type { Env } from 'worker/src/types/env';
import type { Context } from 'hono';
import { executeKdsStatusTransition } from './kds-status-transition';

const log = createLogger({ route: 'kds-mobile' });

// Allowed roles per action
const VIEW_ROLES: string[] = ['owner', 'manager', 'staff', 'kitchen', 'barista', 'chef', 'admin', 'waiter', 'cashier'];
const UPDATE_ROLES: string[] = ['owner', 'manager', 'staff', 'kitchen', 'barista', 'chef', 'admin', 'waiter', 'cashier'];
const VALID_STATUSES: string[] = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];

function parseKdsItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// GET /mobile/kds/orders — list active kitchen orders
export async function getKdsMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const user = context.get('user') as { role?: string } | undefined;
    const role = user?.role || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    let orders: { results: unknown[] };
    try {
      orders = await context.env.AURA_DB
        .prepare(
          `SELECT o.id, o.order_number, o.table_id, o.items, o.notes, o.status, o.created_at, o.updated_at,
                  COALESCE(t.table_number, t.id) as table_name
           FROM orders o
           LEFT JOIN cafe_tables t ON (t.id = o.table_id OR CAST(t.table_number AS TEXT) = CAST(o.table_id AS TEXT))
           WHERE o.status IN ('pending','confirmed','preparing','ready')
           ORDER BY o.created_at ASC`
        )
        .all();
    } catch {
      orders = await context.env.AURA_DB
        .prepare(
          `SELECT o.id, o.table_id, o.items, o.status, o.created_at, o.updated_at,
                  COALESCE(t.table_number, t.id) as table_name
           FROM orders o
           LEFT JOIN cafe_tables t ON t.id = o.table_id
           WHERE o.status IN ('pending','confirmed','preparing','ready')
           ORDER BY o.created_at ASC`
        )
        .all();
    }

    const rows = orders.results as Array<Record<string, unknown>>;
    return jsonResponse({
      success: true,
      orders: rows.map((r) => ({
        id: r.id as string,
        order_number: (r.order_number as string | undefined) ?? undefined,
        table_id: r.table_id as string,
        table_name: r.table_name as string | null,
        items: parseKdsItems(r.items),
        notes: (r.notes as string | null | undefined) ?? null,
        status: r.status as string,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      })),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getKdsMobile error:', { message: errMsg });
    return errorResponse('Không thể tải danh sách đơn bếp', 500);
  }
}

// PATCH /mobile/kds/orders/:id/status — update order status (staff+ only)
export async function updateKdsStatus(
  context: Context<{ Bindings: Env }>
) {
  try {
    const user = context.get('user') as { role?: string } | undefined;
    const role = user?.role || '';
    if (!UPDATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    const orderId = context.req.param('id');
    if (!orderId) {
      return errorResponse('Thiếu order id', 400);
    }

    const body = await context.req.json<{ status: string }>();
    if (!body?.status || !VALID_STATUSES.includes(body.status)) {
      return errorResponse('Trạng thái không hợp lệ', 400);
    }

    if (role === 'waiter' && body.status !== 'served' && body.status !== 'completed') {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
    try {
      const ctx = context.executionCtx;
      if (ctx) waitUntilFn = (p) => ctx.waitUntil(p);
    } catch {
      // Context without Cloudflare executionCtx (e.g. test harness)
    }

    const effectiveRole = body.status === 'served' && ['kitchen', 'barista', 'chef'].includes(role)
      ? 'staff'
      : role;

    const result = await executeKdsStatusTransition(
      context.env.AURA_DB,
      orderId,
      body.status,
      effectiveRole,
      {
        kv: context.env.AUTH_KV,
        waitUntil: waitUntilFn,
      }
    );

    if (!result.success) {
      return errorResponse(`Trạng thái không hợp lệ: ${result.error || ''}`, result.statusCode || 400);
    }

    if (result.idempotent) {
      return jsonResponse({ success: true, idempotent: true });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('updateKdsStatus error:', { message: errMsg });
    return errorResponse('Không thể cập nhật trạng thái đơn bếp', 500);
  }
}
