/**
 * Orders (Hono) Routes — /api/orders
 * KDS dashboard + checkout flow.
 */

import { Hono } from 'hono';
import { updateOrderStatusSchema, createOrderInputSchema } from '../lib/validators';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth.js';

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

export const ordersRouter = new Hono<{ Bindings: Env }>();

// GET /api/orders/kds — Kitchen Display System dashboard
ordersRouter.get('/kds', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const status = c.req.query('status') || 'pending';

  const { results } = await db.prepare(
    `SELECT * FROM orders WHERE status IN (?, 'preparing')
     ORDER BY created_at ASC LIMIT 50`
  ).bind(status).all<OrderRecord>();

  const kdsOrders: KdsOrder[] = (results || []).map(order => {
    let items: OrderItem[] = [];
    try { items = JSON.parse(order.items); } catch { /* keep empty */ }

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
      created_at: order.created_at,
    };
  });

  return c.json({ success: true, data: kdsOrders });
});

// PATCH /api/orders/:id/status — update order status
ordersRouter.patch('/:id/status', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const { status } = parsed.data;

  const order = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first<{ id: string }>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();

  return c.json({ success: true, message: `Order ${id} → ${status}` });
});

// POST /api/orders/checkout — create order (used by KDS/POS, not customer-facing)
ordersRouter.post('/checkout', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = createOrderInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;

  const id = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
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

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();

  return c.json({ success: true, data: order }, 201);
});

// GET /api/orders — list recent orders
ordersRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const { results } = await db.prepare(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all<OrderRecord>();

  return c.json({ success: true, data: results || [] });
});

// GET /api/orders/:id — get single order
ordersRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  return c.json({ success: true, data: order });
});
