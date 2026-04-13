/**
 * Orders Routes — /api/orders
 * Phục vụ KDS dashboard + checkout flow
 * Realtime: KV flag pattern (Option A)
 */
import { Hono } from 'hono';
export const ordersRouter = new Hono();
const KV_LATEST_KEY = 'latest_order_ts';

ordersRouter.get('/latest', async (c) => {
  const kv = c.env.AUTH_KV;
  const ts = await kv.get(KV_LATEST_KEY);
  return c.json({ ts: ts ?? null });
});

ordersRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const status = c.req.query('status');
  const tableId = c.req.query('table_id');
  const since = c.req.query('since');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  let query = 'SELECT o.*, t.table_number, t.zone FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE 1=1';
  const params = [];
  if (status) { query += ' AND o.status = ?'; params.push(status); }
  if (tableId) { query += ' AND o.table_id = ?'; params.push(tableId); }
  if (since) { query += ' AND o.created_at > ?'; params.push(since); }
  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

ordersRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const order = await db.prepare('SELECT o.*, t.table_number, t.zone FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE o.id = ?').bind(id).first();
  if (!order) {return c.json({ success: false, error: 'Order not found' }, 404);}
  const { results: items } = await db.prepare('SELECT oi.*, p.name AS product_name, p.image_url FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...order, items } });
});

ordersRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const body = await c.req.json();
  const { customer_name, phone, table_id, notes, items } = body;
  if (!items || !Array.isArray(items) || items.length === 0) {return c.json({ success: false, error: 'items array is required' }, 400);}
  if (!customer_name) {return c.json({ success: false, error: 'customer_name is required' }, 400);}
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total_amount = subtotal + tax;
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO orders (id, customer_name, phone, table_id, subtotal, tax, total_amount, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'Bep tiep nhan\', ?, ?)').bind(orderId, customer_name, phone ?? null, table_id ?? null, subtotal, tax, total_amount, notes ?? null, now, now).run();
  await db.batch(items.map((item) => {
    const modifiers = item.modifiers ? JSON.stringify(item.modifiers) : null;
    return db.prepare('INSERT INTO order_items (id, order_id, product_id, quantity, subtotal, modifiers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), orderId, item.product_id, item.quantity, item.price * item.quantity, modifiers, now);
  }));
  if (table_id) { await db.prepare('UPDATE cafe_tables SET status = \'Occupied\' WHERE id = ?').bind(table_id).run(); }
  await kv.put(KV_LATEST_KEY, now);
  return c.json({ success: true, data: { id: orderId, status: 'Bep tiep nhan', total_amount } }, 201);
});

ordersRouter.patch('/:id/status', async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const id = c.req.param('id');
  const { status } = await c.req.json();
  const allowed = ['Bep tiep nhan', 'Dang pha che', 'San sang', 'Hoan thanh', 'Da huy'];
  if (!allowed.includes(status)) {return c.json({ success: false, error: `status must be one of: ${allowed.join(', ')}` }, 400);}
  const now = new Date().toISOString();
  await db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id).run();
  if (status === 'Hoan thanh' || status === 'Da huy') {
    const order = await db.prepare('SELECT table_id FROM orders WHERE id = ?').bind(id).first();
    if (order?.table_id) { await db.prepare('UPDATE cafe_tables SET status = \'Available\' WHERE id = ?').bind(order.table_id).run(); }
  }
  await kv.put(KV_LATEST_KEY, now);
  return c.json({ success: true, data: { id, status } });
});
