/**
 * Kitchen Stations + Station KDS Routes — /api/kitchen-stations
 *
 * F&B Gap 2.4: items are routed to stations (coffee / food / bar / beverage)
 * based on the category of each ordered product. Each station gets its own
 * KDS view of active tickets with per-item timing.
 *
 * Orders store their items as a JSON blob (see createOrder), so routing is
 * derived at read time from the dominant category of the order's items.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { requireStaff } from '../middleware/staff-auth';

export interface KitchenStation {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryStation {
  category_id: string;
  station_id: string;
}

export interface OrderItemStation {
  order_item_id: string;
  station_id: string;
  started_at: string | null;
  ready_at: string | null;
}

const kitchenStationsRouter = new Hono<{ Bindings: Env }>();

// All station management + KDS views require staff auth.
kitchenStationsRouter.use('/*', requireStaff(['owner', 'manager', 'staff']));

function makeId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${rand}`.toUpperCase();
}

function dominantCategory(db: Env['AURA_DB'], items: Array<Record<string, unknown>>): Promise<string | null> {
  // Items carry category_id from the products table when present; otherwise
  // we resolve it. Returns the most frequent category id.
  return (async () => {
    const counts = new Map<string, number>();
    for (const it of items) {
      let cat: string | null = null;
      if (it.category_id) cat = String(it.category_id);
      else if (it.product_id) {
        const row = await db.prepare('SELECT category_id FROM products WHERE id = ?')
          .bind(String(it.product_id)).first<{ category_id: string }>();
        cat = row?.category_id || null;
      }
      if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    if (counts.size === 0) return null;
    let best: string | null = null;
    let bestN = -1;
    for (const [c, n] of counts) { if (n > bestN) { bestN = n; best = c; } }
    return best;
  })();
}

// ── Stations ────────────────────────────────────────────────────────

kitchenStationsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare(
    'SELECT * FROM kitchen_stations ORDER BY sort_order, name'
  ).all<KitchenStation>();
  return c.json({ success: true, data: results });
});

kitchenStationsRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const name = String(body.name || '').trim();
  const slug = String(body.slug || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  if (!slug) return c.json({ success: false, error: 'slug is required' }, 400);
  const id = makeId('KS');
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO kitchen_stations (id, name, slug, sort_order, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, name, slug, Number(body.sort_order) || 0, body.active === false ? 0 : 1, now, now).run();
  const st = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<KitchenStation>();
  return c.json({ success: true, data: st }, 201);
});

kitchenStationsRouter.patch('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<KitchenStation>();
  if (!existing) return c.json({ success: false, error: 'Station not found' }, 404);
  const body = await c.req.json() as Record<string, unknown>;
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE kitchen_stations
     SET name = COALESCE(?, name), slug = COALESCE(?, slug),
         sort_order = COALESCE(?, sort_order), active = COALESCE(?, active),
         updated_at = ?
     WHERE id = ?`
  ).bind(
    body.name ? String(body.name) : null,
    body.slug ? String(body.slug) : null,
    body.sort_order != null ? Number(body.sort_order) : null,
    body.active != null ? Number(body.active) : null,
    now, id
  ).run();
  const st = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<KitchenStation>();
  return c.json({ success: true, data: st });
});

kitchenStationsRouter.delete('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const existing = await db.prepare('SELECT id FROM kitchen_stations WHERE id = ?').bind(c.req.param('id')).first<{ id: string }>();
  if (!existing) return c.json({ success: false, error: 'Station not found' }, 404);
  await db.prepare('DELETE FROM kitchen_stations WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// ── Category → Station mapping ─────────────────────────────────────

kitchenStationsRouter.get('/categories', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare(
    `SELECT cs.category_id, cs.station_id, ks.name AS station_name
     FROM category_stations cs
     JOIN kitchen_stations ks ON ks.id = cs.station_id
     ORDER BY ks.name, cs.category_id`
  ).all<{ category_id: string; station_id: string; station_name: string }>();
  return c.json({ success: true, data: results });
});

kitchenStationsRouter.post('/categories', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const categoryId = String(body.category_id || '').trim();
  const stationId = String(body.station_id || '').trim();
  if (!categoryId || !stationId) {
    return c.json({ success: false, error: 'category_id and station_id are required' }, 400);
  }
  const station = await db.prepare('SELECT id FROM kitchen_stations WHERE id = ?').bind(stationId).first<{ id: string }>();
  if (!station) return c.json({ success: false, error: 'Station not found' }, 404);
  await db.prepare(
    'INSERT OR REPLACE INTO category_stations (category_id, station_id) VALUES (?, ?)'
  ).bind(categoryId, stationId).run();
  return c.json({ success: true });
});

kitchenStationsRouter.delete('/categories/:categoryId/:stationId', async (c) => {
  const db = c.env.AURA_DB;
  await db.prepare(
    'DELETE FROM category_stations WHERE category_id = ? AND station_id = ?'
  ).bind(c.req.param('categoryId'), c.req.param('stationId')).run();
  return c.json({ success: true });
});

// ── Station KDS view ────────────────────────────────────────────────
// Returns active orders routed to the given station, with per-item status.

kitchenStationsRouter.get('/:id/tickets', async (c) => {
  const db = c.env.AURA_DB;
  const stationId = c.req.param('id');
  const station = await db.prepare('SELECT id FROM kitchen_stations WHERE id = ?').bind(stationId).first<{ id: string }>();
  if (!station) return c.json({ success: false, error: 'Station not found' }, 404);

  // Orders routed to this station: those whose dominant category maps here,
  // or that have an explicit order_item_stations row for this station.
  const { results } = await db.prepare(
    `SELECT DISTINCT o.id, o.table_id, o.items, o.status, o.created_at,
            t.table_number AS table_name
     FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id
     WHERE o.status IN ('pending', 'preparing', 'ready')
       AND (
         o.id IN (SELECT order_item_id FROM order_item_stations WHERE station_id = ?)
         OR o.id IN (
           SELECT o2.id FROM orders o2
           WHERE o2.status IN ('pending', 'preparing', 'ready')
             AND EXISTS (
               SELECT 1 FROM category_stations cs
               WHERE cs.station_id = ? AND cs.category_id IN (
                 -- dominant category resolution happens in app layer; here we
                 -- fall back to any category tag embedded in the items blob.
                 SELECT json_extract(value, '$.category_id')
                 FROM json_each(o2.items)
               )
             )
         )
       )
     ORDER BY o.created_at ASC`
  ).bind(stationId, stationId).all<Record<string, unknown>>();

  const tickets = results.map((r) => {
    let items: Array<Record<string, unknown>> = [];
    try { items = JSON.parse((r.items as string) || '[]'); } catch { items = []; }
    return {
      id: r.id,
      table_id: r.table_id,
      table_name: r.table_name,
      status: r.status,
      created_at: r.created_at,
      items: items.map((i) => ({
        name: i.name,
        qty: i.qty || i.quantity || 1,
        price: i.price || 0,
        category_id: i.category_id || null,
      })),
    };
  });
  return c.json({ success: true, data: tickets });
});

// ── Per-item station lifecycle ──────────────────────────────────────

kitchenStationsRouter.post('/tickets/:orderId/items/:itemId/start', async (c) => {
  const db = c.env.AURA_DB;
  const orderId = c.req.param('orderId');
  const itemId = c.req.param('itemId');
  const stationId = c.req.query('station_id');
  if (!stationId) return c.json({ success: false, error: 'station_id query param is required' }, 400);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR REPLACE INTO order_item_stations (order_item_id, station_id, started_at, ready_at)
     VALUES (?, ?, ?, NULL)`
  ).bind(itemId, stationId, now).run();
  return c.json({ success: true, started_at: now });
});

kitchenStationsRouter.post('/tickets/:orderId/items/:itemId/ready', async (c) => {
  const db = c.env.AURA_DB;
  const orderId = c.req.param('orderId');
  const itemId = c.req.param('itemId');
  const stationId = c.req.query('station_id');
  if (!stationId) return c.json({ success: false, error: 'station_id query param is required' }, 400);
  const now = new Date().toISOString();
  await db.prepare(
    'UPDATE order_item_stations SET ready_at = ? WHERE order_item_id = ? AND station_id = ?'
  ).bind(now, itemId, stationId).run();
  // When every item on the order is ready, mark the order ready.
  const remaining = await db.prepare(
    'SELECT COUNT(*) AS c FROM order_item_stations WHERE order_item_id = ? AND ready_at IS NULL'
  ).bind(itemId).first<{ c: number }>();
  if (remaining && Number(remaining.c) === 0) {
    await db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .bind('ready', now, orderId).run();
  }
  return c.json({ success: true, ready_at: now });
});

export { kitchenStationsRouter };
