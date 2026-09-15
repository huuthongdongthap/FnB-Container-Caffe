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
import type { Env } from 'worker/src/types/env';
import { requireStaff } from 'worker/src/middleware/staff-auth';
import { buildIndexFromDbRows, filterItemsForStation } from '../src/policies/station-policy';

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

// ── Station KDS view ────────────────────────────────────────────────────────
// Returns active orders routed to the given station, with per-item status.
// Each item appears in exactly one station view (no duplication).

kitchenStationsRouter.get('/:id/tickets', async (c) => {
  const db = c.env.AURA_DB;
  const stationId = c.req.param('id');
  const station = await db.prepare('SELECT id FROM kitchen_stations WHERE id = ?').bind(stationId).first<{ id: string }>();
  if (!station) return c.json({ success: false, error: 'Station not found' }, 404);

  // Load category → station mappings and build the routing index.
  const { results: mappings } = await db.prepare(
    'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
  ).all<Record<string, unknown>>();
  const categoryIndex = buildIndexFromDbRows(mappings);

  // Fetch all active orders.
  const { results: activeOrders } = await db.prepare(
    'SELECT DISTINCT o.id, o.table_id, o.items, o.status, o.created_at, t.table_number AS table_name FROM orders o LEFT JOIN tables t ON t.id = o.table_id WHERE o.status IN (?, ?, ?) ORDER BY o.created_at ASC'
  ).bind('pending', 'preparing', 'ready').all<Record<string, unknown>>();

  // Check which orders have an explicit item assignment for this station.
  const { results: assignedItems } = await db.prepare(
    'SELECT order_item_id FROM order_item_stations WHERE station_id = ?'
  ).bind(stationId).all<{ order_item_id: string }>();
  const assignedOrderIds = new Set(assignedItems.map((r) => r.order_item_id));

  // Build station-filtered tickets using the pure policy.
  const tickets: Array<Record<string, unknown>> = [];
  for (const order of activeOrders) {
    const itemsForStation = filterItemsForStation(order.items as string, stationId, categoryIndex);
    const hasAssignedItems = assignedOrderIds.has(order.id);
    if (itemsForStation.length === 0 && !hasAssignedItems) continue;
    tickets.push({
      id: order.id,
      table_id: order.table_id,
      table_name: order.table_name,
      status: order.status,
      created_at: order.created_at,
      items: itemsForStation.map((i: Record<string, unknown>) => ({
        name: i.name,
        qty: i.qty || i.quantity || 1,
        price: i.price || 0,
        category_id: i.category_id || null,
      })),
    });
  }
  return c.json({ success: true, data: tickets });
});

// ── Per-item station lifecycle ──────────────────────────────────────

kitchenStationsRouter.post('/tickets/:orderId/items/:itemId/start', async (c) => {
  const db = c.env.AURA_DB;
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
