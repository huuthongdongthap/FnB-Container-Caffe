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
import { stationTicketsRouter } from './kitchen-station-tickets';

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

// ── Station KDS view & Tickets ──────────────────────────────────────
kitchenStationsRouter.route('/', stationTicketsRouter);

export { kitchenStationsRouter };
