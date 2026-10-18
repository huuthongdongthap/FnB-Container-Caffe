import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
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

    const body = await context.req.json<{
      table_id: string;
      table_number?: string | number;
      customer_name?: string;
      customer_phone?: string;
      payment_method?: string;
      notes?: string;
      items: Array<{ name: string; qty?: number; quantity?: number; price?: number; note?: string }>;
    }>();

    if (!body.table_id) {
      return errorResponse('Thiếu table_id', 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse('Danh sách món trống', 400);
    }

    const id = `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const normalizedItems = normalizeOrderItems(body.items);
    const total = normalizedItems.reduce(
      (sum, item) => sum + Number(item.qty ?? 1) * Number(item.price ?? 0),
      0,
    );
    const itemsJson = JSON.stringify(normalizedItems);
    const tableNumber = String(body.table_number ?? body.table_id);
    const customerName = String(body.customer_name || `Bàn ${tableNumber}`);
    const customerPhone = String(body.customer_phone || '0000000000');
    const paymentMethod = String(body.payment_method || 'cash');

    try {
      await context.env.AURA_DB
        .prepare(
          `INSERT INTO orders (
             id, order_number, table_id, table_number,
             customer_name, customer_phone, items, total,
             status, payment_method, payment_status, order_type,
             notes, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending', 'dine_in', ?, ?, ?)`
        )
        .bind(
          id,
          id,
          body.table_id,
          tableNumber,
          customerName,
          customerPhone,
          itemsJson,
          total,
          paymentMethod,
          body.notes ?? null,
          now,
          now,
        )
        .run();
    } catch (insertErr) {
      const msg = String((insertErr as Error)?.message || '');
      if (msg.includes('no such column') || msg.includes('has no column')) {
        await context.env.AURA_DB
          .prepare(
            `INSERT INTO orders (
               id, table_id, customer_name, customer_phone,
               items, total, status, payment_method, payment_status,
               order_type, notes, created_at, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'unpaid', 'dine_in', ?, ?, ?)`
          )
          .bind(
            id,
            body.table_id,
            customerName,
            customerPhone,
            itemsJson,
            total,
            paymentMethod,
            body.notes ?? null,
            now,
            now,
          )
          .run();
      } else {
        throw insertErr;
      }
    }

    try {
      await context.env.AURA_DB
        .prepare('UPDATE cafe_tables SET status = ? WHERE id = ?')
        .bind('Occupied', body.table_id)
        .run();
    } catch {
      // Non-blocking if cafe_tables is not present in minimal test mock
    }

    if (context.env?.AUTH_KV) {
      await Promise.all([
        context.env.AUTH_KV.put('latest_order_ts', String(Date.now())).catch(() => {}),
        context.env.AUTH_KV.put('orders:latest_updated_at', now).catch(() => {}),
      ]);
    }

    return jsonResponse({ success: true, order_id: id, total }, 201);
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
        items: normalizeOrderItems(data.items),
      },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getOrderDetail error:', { message: errMsg });
    return errorResponse('Không thể tải chi tiết đơn hàng', 500);
  }
}
