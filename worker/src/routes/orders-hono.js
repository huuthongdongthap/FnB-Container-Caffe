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
  const since = c.req.query('since'); // ISO timestamp — returns only newer orders
  const includeItems = c.req.query('include') === 'items';
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let query = `
    SELECT o.*,
           t.table_number,
           t.zone
    FROM orders o
    LEFT JOIN cafe_tables t ON o.table_id = t.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND o.status = ?'; params.push(status); }
  if (tableId) { query += ' AND o.table_id = ?'; params.push(tableId); }
  if (since) { query += ' AND o.created_at > ?'; params.push(since); }
  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const { results } = await db.prepare(query).bind(...params).all();

  // Batch-fetch items from order_items table (KDS schema)
  const itemMap = new Map();
  if (results.length > 0) {
    const ids = results.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const { results: itemRows } = await db.prepare(`
      SELECT oi.order_id, oi.product_id, oi.quantity, oi.subtotal, oi.modifiers,
             p.name AS product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (${placeholders})
    `).bind(...ids).all();
    for (const it of itemRows) {
      if (!itemMap.has(it.order_id)) {itemMap.set(it.order_id, []);}
      itemMap.get(it.order_id).push(it);
    }
  }

  // Normalize each order: parse items JSON (checkout schema) OR use order_items rows (KDS schema)
  for (const o of results) {
    const kdsItems = itemMap.get(o.id) || [];
    let normalizedItems = [];
    if (kdsItems.length > 0) {
      normalizedItems = kdsItems.map(i => ({
        name: i.product_name || 'Unknown',
        product_name: i.product_name || 'Unknown',
        quantity: i.quantity || 1,
        price: i.subtotal && i.quantity ? Math.round(i.subtotal / i.quantity) : 0,
      }));
    } else if (typeof o.items === 'string' && o.items.length > 0) {
      try {
        const parsed = JSON.parse(o.items);
        normalizedItems = (parsed || []).map(i => ({
          name: i.name || i.product_name || 'Unknown',
          product_name: i.name || i.product_name || 'Unknown',
          quantity: i.quantity || i.qty || 1,
          price: i.price || 0,
        }));
      } catch (_e) { normalizedItems = []; }
    }
    o.items = normalizedItems;
    // Backward-compat: total_amount fallback to total
    if (o.total_amount == null && o.total != null) {o.total_amount = o.total;}
    if (o.total == null && o.total_amount != null) {o.total = o.total_amount;}
  }

  return c.json({ success: true, data: results });
});

ordersRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const order = await db.prepare(`
    SELECT o.*, t.table_number, t.zone
    FROM orders o
    LEFT JOIN cafe_tables t ON o.table_id = t.id
    WHERE o.id = ?
  `).bind(id).first();

  if (!order) {return c.json({ success: false, error: 'Order not found' }, 404);}

  // Try order_items table first (KDS schema)
  const { results: itemRows } = await db.prepare(`
    SELECT oi.*, p.name AS product_name, p.image_url
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(id).all();

  // Fallback: parse orders.items JSON blob (checkout flow schema)
  let items = itemRows || [];
  if ((!items || items.length === 0) && order.items) {
    try {
      const parsed = JSON.parse(order.items);
      items = (parsed || []).map(i => ({
        product_name: i.name || i.product_name || 'Unknown',
        quantity: i.quantity || i.qty || 1,
        price: i.price || 0,
        subtotal: (i.price || 0) * (i.quantity || i.qty || 1),
      }));
    } catch (_e) { items = []; }
  }

  // Backward-compat: total_amount = total if not set
  const total_amount = order.total_amount ?? order.total ?? 0;

  return c.json({ success: true, data: { ...order, items, total_amount } });
});

ordersRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const body = await c.req.json();
  const { customer_name, phone, table_id, notes, items, shipping_fee = 0, discount = 0 } = body;

  if (!items || !Array.isArray(items) || items.length === 0)
  {return c.json({ success: false, error: 'items array is required' }, 400);}
  if (!customer_name)
  {return c.json({ success: false, error: 'customer_name is required' }, 400);}

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total_amount = subtotal + (Number(shipping_fee) || 0) - (Number(discount) || 0);
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // INSERT order
  await db.prepare(`
    INSERT INTO orders (id, customer_name, phone, table_id, subtotal, tax, total_amount, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).bind(orderId, customer_name, phone ?? null, table_id ?? null,
    subtotal, 0, total_amount, notes ?? null, now, now).run();

  // INSERT order_items (batch)
  await db.batch(items.map((item) => {
    const modifiers = item.modifiers ? JSON.stringify(item.modifiers) : null;
    return db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, quantity, subtotal, modifiers, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), orderId, item.product_id,
      item.quantity, item.price * item.quantity, modifiers, now);
  }));

  // Mark table Occupied
  if (table_id) {
    await db.prepare('UPDATE cafe_tables SET status = \'Occupied\' WHERE id = ?')
      .bind(table_id).run();
  }

  // ── KV realtime flag: KDS pollers see this change within 3s ──────────
  await kv.put(KV_LATEST_KEY, now);
  return c.json({ success: true, data: { id: orderId, status: 'pending', total_amount } }, 201);
});

ordersRouter.patch('/:id/status', async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;

  const allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!allowed.includes(status))
  {return c.json({ success: false, error: `status must be one of: ${allowed.join(', ')}` }, 400);}

  const now = new Date().toISOString();
  await db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id).run();
  if (status === 'completed' || status === 'cancelled') {
    const order = await db.prepare('SELECT table_id FROM orders WHERE id = ?').bind(id).first();
    if (order?.table_id) {
      await db.prepare('UPDATE cafe_tables SET status = \'Available\' WHERE id = ?')
        .bind(order.table_id).run();
    }
  }
  await kv.put(KV_LATEST_KEY, now);
  return c.json({ success: true, data: { id, status } });
});
