import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { getTenantId } from '../middleware/tenant';
import { createOrderFromAlias } from '../../../packages/domain/order/commands/create-order-alias';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'orders-mobile' });

const VIEW_ROLES: string[] = ['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin', 'cashier'];
const CREATE_ROLES: string[] = ['owner', 'manager', 'waiter', 'admin', 'cashier'];

function normalizeOrderItems(raw: unknown): Array<Record<string, unknown>> {
  let parsed: unknown[] = [];
  if (Array.isArray(raw)) {
    parsed = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) parsed = json;
    } catch {
      parsed = [];
    }
  }
  return parsed.map((entry) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const qty = Number(item.qty ?? item.quantity ?? 1);
    const price = Number(item.price ?? item.unit_price ?? 0);
    const name = String(item.name ?? item.product_name ?? '');
    return {
      ...item,
      name,
      qty,
      quantity: qty,
      price,
    };
  });
}

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

    const tenantId = getTenantId(context);
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: string[] = [];
    if (tenantId !== '*') { query += ' AND tenant_id = ?'; params.push(tenantId); }

    if (tableId) {
      query += ' AND table_id = ?';
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
        items: normalizeOrderItems(r.items),
      })),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getOrdersMobile error:', { message: errMsg });
    return errorResponse('Không thể tải danh sách đơn hàng', 500);
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

    const body = await context.req.json<Record<string, unknown>>();
    if (!body.table_id) return errorResponse('Thiếu table_id', 400);
    if (!Array.isArray(body.items) || body.items.length === 0) return errorResponse('Danh sách món trống', 400);
    let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
    try { ctx = context.executionCtx; } catch { /* unit tests have no execution context */ }
    const response = await createOrderFromAlias(context.req.raw, context.env, {
      ...body,
      customer_name: body.customer_name || `Bàn ${body.table_number || body.table_id}`,
      customer_phone: body.customer_phone || '0000000000',
      order_type: 'dine_in',
      payment_method: String(body.payment_method || 'cod').toLowerCase(),
    }, ctx, context.get('user'));
    if (!response.ok) return response;
    const result = await response.json() as { data: { id: string; total: number } };
    return jsonResponse({ success: true, order_id: result.data.id, total: result.data.total }, response.status);
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('createOrderMobile error:', { message: errMsg });
    return errorResponse('Không thể tạo đơn hàng', 500);
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

    const tenantId = getTenantId(context);
    const row = await context.env.AURA_DB
      .prepare(`SELECT * FROM orders WHERE id = ?${tenantId === '*' ? '' : ' AND tenant_id = ?'}`)
      .bind(...(tenantId === '*' ? [orderId] : [orderId, tenantId]))
      .first();

    if (!row) {
      return errorResponse('Đơn hàng không tồn tại', 404);
    }

    const data = row as Record<string, unknown>;
    return jsonResponse({
      success: true,
      order: {
        ...data,
        items: normalizeOrderItems(data.items),
      },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getOrderDetail error:', { message: errMsg });
    return errorResponse('Không thể tải chi tiết đơn hàng', 500);
  }
}
