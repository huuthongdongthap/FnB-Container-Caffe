/**
 * Orders (Hono) Routes — /api/orders
 * KDS dashboard + checkout flow.
 */

import { Hono } from 'hono';
import { updateOrderStatusSchema, createOrderInputSchema, guestCheckinSchema, zodErrorResponse } from '../lib/validators';
import { createMetricsCollector } from '../lib/metrics-collector';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { rateLimitMiddleware, ORDER_RATE_LIMIT } from '../middleware/rate-limit';
import { deductInventoryForOrder } from '../routes/inventory/order-deduction';
import { sendPushToStaff } from '../tree/push/notifier';
import { notifyCustomerOnStatusChange, notifyStaffOnNewOrder } from '../tree/push/triggers';
import { syncOrderToERPNext } from '../tree/erpnext/sync';
import { verifyJWT } from './auth';

/** CSPRNG-suffixed order ID — replaces Math.random() (predictable / collidable) */
function makeOrderId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return (`ORD-${Date.now().toString(36)}${rand}`).toUpperCase();
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
}

interface OrderInput {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  table_id?: string;
  items: OrderItem[];
  subtotal: number;
  discount_amount?: number;
  discount_code?: string;
  total: number;
  payment_method?: string;
  notes?: string;
}

interface OrderRecord {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  table_id: string | null;
  items: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
}

interface KdsOrder {
  id: string;
  customer_name: string;
  table_id: string | null;
  items: OrderItem[];
  status: string;
  elapsed_minutes: number;
  created_at: string;
}

// Allowed statuses for the KDS status query parameter — used for input validation only.
// The SQL filter always includes 'preparing' regardless, so staff see in-flight + next-up orders.
export const ALLOWED_KDS_STATUSES = ['pending', 'preparing', 'served', 'completed', 'cancelled'] as const;

export const ordersRouter = new Hono<{ Bindings: Env }>();

// GET /api/orders/kds — Kitchen Display System dashboard
// Intent: show the requested status PLUS 'preparing' (so staff see in-flight + next-up orders).
// Invalid status values fall back to 'pending'.
ordersRouter.get('/kds', requireAuth(['owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const raw = c.req.query('status') || 'pending';
  const status = ALLOWED_KDS_STATUSES.includes(raw as typeof ALLOWED_KDS_STATUSES[number]) ? raw : 'pending';

  const { results } = await db.prepare(
    `SELECT * FROM orders WHERE status IN (?, 'preparing')
     ORDER BY created_at ASC LIMIT 50`
  ).bind(status).all<OrderRecord>();

  const kdsOrders: KdsOrder[] = (results || []).map(order => {
    let items: OrderItem[] = [];
    try {
      items = JSON.parse(order.items);
    } catch { /* keep empty */ }

    const elapsed = Math.round(
      (Date.now() - new Date(order.created_at).getTime()) / 60000
    );

    return {
      id: order.id,
      customer_name: order.customer_name,
      table_id: order.table_id,
      items,
      status: order.status,
      elapsed_minutes: elapsed,
      created_at: order.created_at
    };
  });

  return c.json({ success: true, data: kdsOrders });
});

// PATCH /api/orders/:id/status — update order status
ordersRouter.patch('/:id/status', requireAuth(['owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { status } = parsed.data;

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();

  // Broadcast order status change via KV for SSE subscribers
  if (c.env.AUTH_KV) {
    try {
      c.executionCtx?.waitUntil(
        c.env.AUTH_KV.put(`order_event:${id}`, JSON.stringify({
          orderId: id,
          status,
          timestamp: new Date().toISOString()
        }), { expirationTtl: 60 })
      );
    } catch { /* executionCtx unavailable */ }
  }

  return c.json({ success: true, message: `Order ${id} → ${status}` });
});

// POST /api/orders/checkout — create order (used by KDS/POS, not customer-facing)
ordersRouter.post('/checkout', async(c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = createOrderInputSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;

  const id = makeOrderId();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO orders (id, customer_name, customer_phone, table_id, items,
     total, status, payment_method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).bind(
    id,
    data.customer_name || 'Walk-in',
    data.customer_phone || '',
    body.table_id || null,
    JSON.stringify(data.items),
    parseInt(String(body.total || 0)),
    data.payment_method || 'cash',
    data.notes || '',
    now,
    now
  ).run();
  // Auto-deduct inventory (non-blocking — fires in background)
  try {
    const items: Array<{ product_id: string; quantity: number; name?: string }> =
    Array.isArray(data.items) ? data.items : [];
    if (items.length > 0) {
      c.executionCtx?.waitUntil(deductInventoryForOrder(c.env as Env, id, items));
    }
  } catch { /* inventory deduction best-effort */ }
  // ERPNext sync (fire-and-forget, non-blocking — delegated to syncOrderToERPNext)
  if (syncOrderToERPNext) {
    try {
      if (c.env.ERPNEXT_SYNC_ENABLED === 'true') {
        c.executionCtx?.waitUntil(
          Promise.resolve(
            syncOrderToERPNext(
              {
                ERPNEXT_URL: c.env.ERPNEXT_URL!,
                ERPNEXT_API_KEY: c.env.ERPNEXT_API_KEY!,
                ERPNEXT_API_SECRET: c.env.ERPNEXT_API_SECRET!
              },
              id,
              {
                customer_name: data.customer_name || 'Walk-in',
                customer_phone: data.customer_phone,
                customer_id: undefined,
                table_id: (body.table_id as string) || null,
                items: (data.items as Array<Record<string, unknown>>) || [],
                total: parseInt(String(body.total || 0)),
                payment_method: data.payment_method,
                notes: data.notes
              }
            )
          )
        );
      }
    } catch { /* ERPNext sync best-effort */ }
  }

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();

  // Record order creation metric
  const mc = createMetricsCollector(db);
  try {
    c.executionCtx?.waitUntil(mc.recordMetric('order_created', parseInt(String(body.total || 0)), {
      payment_method: order?.payment_method || 'unknown'
    }));
  } catch { /* executionCtx unavailable */ }

  // Notify staff of new order (non-blocking)
  try {
    const itemCount = Array.isArray(data.items) ? data.items.length : 0;
  c.executionCtx?.waitUntil(
    notifyStaffOnNewOrder(c.env as Env, {
      id,
      table_id: (body.table_id as string) || null,
      items: (data.items as Array<Record<string, unknown>>) || [],
      total: parseInt(String(body.total || 0))
    })
  );
  } catch { /* push best-effort */ }
  return c.json({ success: true, data: order }, 201);
});

// POST /api/orders/guest-checkin — no auth, for QR guests
// Creates a placeholder order and marks the table Occupied in a single atomic batch.
// If the INSERT fails, the table stays Available — no orphaned Occupied state.
ordersRouter.post('/guest-checkin', rateLimitMiddleware(ORDER_RATE_LIMIT), async(c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = guestCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;

  const tableRow = await db.prepare(
    'SELECT id FROM cafe_tables WHERE table_number = ?'
  ).bind(data.table_id).first<{ id: string }>();
  if (!tableRow) {
    return c.json({ success: false, error: 'Bàn không tồn tại' }, 404);
  }

  const orderId = makeOrderId();
  const now = new Date().toISOString();

  // Atomic batch: seat the guest + create placeholder order together.
  // If either fails, neither state change is persisted.
  const batchResult = await db.batch([
    db.prepare(
      'UPDATE cafe_tables SET status = \'Occupied\', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'Available\''
    ).bind(tableRow.id),
    db.prepare(
      'INSERT INTO orders (id, customer_name, customer_phone, table_id, items, total, status, payment_method, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      orderId, data.customer_name, data.customer_phone, tableRow.id,
      JSON.stringify([]), 0, 'pending', 'cash',
      'Khách QR - cho don mon', now, now
    )
  ]);

  // Verify the UPDATE matched a row (table was Available, not already occupied)
  const updateInfo = batchResult[0] as { success: boolean; changes?: number };
  if (!updateInfo.success || (updateInfo.changes ?? 0) === 0) {
    return c.json({ success: false, error: 'Bàn đang được sử dụng, vui lòng chọn bàn khác' }, 409);
  }

  try {
    const { sendPushToStaff } = await import('../tree/push/notifier.js');
    const pushPromise = sendPushToStaff(c.env as Env, {
      title: 'Khách check-in 🪑',
      body: `Ban ${data.table_id} - ${data.customer_name} / ${data.customer_phone}`,
      data: { url: '/kds', orderId }
    }, 'staff-kitchen').catch(() => {});
    c.executionCtx?.waitUntil(pushPromise);
  } catch { /* push best-effort */ }

  try {
    const mc = createMetricsCollector(db);
    c.executionCtx?.waitUntil(mc.recordMetric('guest_checkin', 0, { table: data.table_id }));
  } catch { /* metrics best-effort */ }

  return c.json({
    success: true,
    data: {
      id: orderId, table_id: tableRow.id, table_number: data.table_id,
      customer_name: data.customer_name, customer_phone: data.customer_phone,
      status: 'pending', total: 0, created_at: now
    }
  }, 201);
});

// GET /api/orders — list recent orders
ordersRouter.get('/', async(c) => {
  const db = c.env.AURA_DB;
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const { results } = await db.prepare(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all<OrderRecord>();

  return c.json({ success: true, data: results || [] });
});

// GET /api/orders/my-orders — current customer's order history (JWT)
ordersRouter.get('/my-orders', async(c) => {
  const db = c.env.AURA_DB;
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET) as unknown as Record<string, unknown> | null;
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }

  const customerId = payload.customerId || payload.sub || payload.id;
  if (!customerId) {
    return c.json({ success: true, data: [] });
  }

  // Orders table links customers by phone, not customer_id.
  // Look up the customer's phone first.
  const customer = await db.prepare(
    'SELECT phone FROM customers WHERE id = ?'
  ).bind(customerId).first<{ phone: string }>();

  if (!customer || !customer.phone) {
    return c.json({ success: true, data: [] });
  }

  const limit = parseInt(c.req.query('limit') || '20', 10);

  const { results } = await db.prepare(
    'SELECT id, customer_name, items, total, status, payment_method, created_at FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(customer.phone, limit).all<Record<string, unknown>>();

  return c.json({ success: true, data: results || [] });
});

// GET /api/orders/:id — get single order
ordersRouter.get('/:id', async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  return c.json({ success: true, data: order });
});

  // PATCH /api/orders/:id/mark-cod-paid — owner taps "Đã thu tiền" (idempotent)
  ordersRouter.patch('/:id/mark-cod-paid', requireAuth(['owner']), async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    if (!id) return c.json({ success: false, error: 'Missing order id' }, 400);

    const order = await db.prepare(
      'SELECT total, status, payment_status, is_cod FROM orders WHERE id = ?'
    ).bind(id).first<{ total: number; status: string; payment_status: string; is_cod: number }>();

    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
if (order.status === 'cancelled') return c.json({ success: false, error: 'Cannot mark cancelled order as paid' }, 409);
    if ((order.is_cod ?? 0) !== 1 && order.payment_status !== 'cod_pending') {
      return c.json({ success: false, error: 'Not a COD order' }, 409);
    }
    if (order.payment_status === 'paid') {
      return c.json({ success: true, message: 'Already paid', order_id: id });
    }

    const now = new Date().toISOString();
    await db.prepare(
      'UPDATE orders SET status = \'completed\', payment_status = \'paid\', cod_paid_at = ?, updated_at = ? WHERE id = ?'
    ).bind(now, now, id).run();
    return c.json({ success: true, message: 'Marked as paid', order_id: id });
  });

  // POST /api/orders/guest-checkout — no login (dine-in / takeaway / delivery)
  ordersRouter.post('/guest-checkout', async (c) => {
    const db = c.env.AURA_DB;
    try {
      const body = await c.req.json<{
        customer_name: string;
        customer_phone: string;
        table_id?: string;
        items: Array<{ name: string; qty: number; price: number; note?: string }>;
        fulfillment_type?: string;
        delivery_address?: string;
        payment_method?: string;
      }>();

      const name = (body.customer_name || '').trim();
      const phone = (body.customer_phone || '').trim();
      if (!name || !phone) {
        return c.json({ success: false, error: 'Name and phone required' }, 400);
      }
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ success: false, error: 'Items required' }, 400);
      }

      const fulfillment = (body.fulfillment_type || 'DINE_IN').toUpperCase();
      if (!['DINE_IN', 'TAKEAWAY', 'DELIVERY'].includes(fulfillment)) {
        return c.json({ success: false, error: 'Invalid fulfillment_type' }, 400);
      }
      if (fulfillment === 'DELIVERY' && !(body.delivery_address || '').trim()) {
        return c.json({ success: false, error: 'Delivery address required' }, 400);
      }

      const tableId = body.table_id || null;
      const orderId = makeOrderId();
      const now = new Date().toISOString();
      const payMethod = (body.payment_method || 'cash').toLowerCase();

      // If dine-in with table_id, mark table Occupied
      if (tableId && fulfillment === 'DINE_IN') {
        await db.prepare(
          'UPDATE cafe_tables SET status = \'Occupied\', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'Available\''
        ).bind(tableId).run();
      }

      const total = body.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);

      await db.prepare(
        `INSERT INTO orders (id, customer_name, customer_phone, table_id, items, total, status, payment_method, fulfillment_type, delivery_address, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId, name, phone, tableId,
        JSON.stringify(body.items),
        total,
        payMethod, fulfillment, body.delivery_address || null,
        fulfillment === 'DINE_IN' ? 'QR guest' : 'Takeaway guest',
        now, now
      ).run();

      return c.json({ success: true, order_id: orderId, total, fulfillment_type: fulfillment }, 201);
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message }, 500);
    }
  });

