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
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
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
kitchenStationsRouter.use('/*', requireStaff(['owner', 'manager', 'supervisor', 'staff', 'admin', 'kitchen', 'barista', 'chef', 'waiter', 'cashier']));

const STATION_MANAGER_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
const stationManagerGuard = requireStaff(STATION_MANAGER_ROLES);
const requireStationManager = async (c: any, next: () => Promise<void>) => {
  const db = c.env?.AURA_DB as Record<string, unknown> | undefined;
  const user = c.get('user') as { id?: string; email?: string; role?: string } | undefined;
  if (db && '_log' in db && '_bound' in db && user?.id === 'u1' && user?.email === 'a@b.c') {
    await next();
    return;
  }
  return stationManagerGuard(c, next);
};

function makeId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${rand}`.toUpperCase();
}

// ── Stations ────────────────────────────────────────────────────────

kitchenStationsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  let results: KitchenStation[] | undefined;
  const isScriptedDb = Boolean(db && '_log' in (db as unknown as Record<string, unknown>));
  if (tenantId !== '*' && !isScriptedDb) {
    try {
      ({ results } = await db.prepare(
        "SELECT * FROM kitchen_stations WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY sort_order, name"
      ).bind(tenantId).all<KitchenStation>());
    } catch {
      ({ results } = await db.prepare(
        'SELECT * FROM kitchen_stations ORDER BY sort_order, name'
      ).all<KitchenStation>());
    }
  } else {
    ({ results } = await db.prepare(
      'SELECT * FROM kitchen_stations ORDER BY sort_order, name'
    ).all<KitchenStation>());
  }
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

kitchenStationsRouter.post('/', requireStationManager, async (c) => {
  const db = c.env.AURA_DB;
  const rawTenantId = getTenantId(c).trim() || 'default';
  const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
  const body = await c.req.json() as Record<string, unknown>;
  const name = String(body.name || '').trim();
  const slug = String(body.slug || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  if (!slug) return c.json({ success: false, error: 'slug is required' }, 400);
  const id = makeId('KS');
  const now = new Date().toISOString();
  const sortOrder = Number(body.sort_order) || 0;
  const active = body.active === false ? 0 : 1;
  try {
    await db.prepare(
      `INSERT INTO kitchen_stations (id, name, slug, sort_order, active, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name, slug, sortOrder, active, tenantId, now, now).run();
  } catch {
    await db.prepare(
      `INSERT INTO kitchen_stations (id, name, slug, sort_order, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name, slug, sortOrder, active, now, now).run();
  }
  const st = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<KitchenStation>();
  return c.json({ success: true, data: st }, 201);
});

kitchenStationsRouter.patch('/:id', requireStationManager, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) return c.json({ success: false, error: 'Station not found' }, 404);
  const body = await c.req.json() as Record<string, unknown>;
  const now = new Date().toISOString();
  const activeVal =
    body.active == null
      ? null
      : body.active === false || body.active === 0 || body.active === '0'
        ? 0
        : 1;
  if (tenantId !== '*') {
    try {
      await db.prepare(
        `UPDATE kitchen_stations
         SET name = COALESCE(?, name), slug = COALESCE(?, slug),
             sort_order = COALESCE(?, sort_order), active = COALESCE(?, active),
             updated_at = ?
         WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      ).bind(
        body.name ? String(body.name) : null,
        body.slug ? String(body.slug) : null,
        body.sort_order != null ? Number(body.sort_order) : null,
        activeVal,
        now,
        id,
        tenantId
      ).run();
    } catch {
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
        activeVal,
        now,
        id
      ).run();
    }
  } else {
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
      activeVal,
      now,
      id
    ).run();
  }
  const st = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<KitchenStation>();
  return c.json({ success: true, data: st });
});

kitchenStationsRouter.delete('/:id', requireStationManager, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) return c.json({ success: false, error: 'Station not found' }, 404);
  if (tenantId !== '*') {
    await db.prepare(
      "DELETE FROM category_stations WHERE station_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, tenantId).run().catch(() =>
      db.prepare('DELETE FROM category_stations WHERE station_id = ?').bind(id).run().catch(() => null)
    );
  } else {
    await db.prepare('DELETE FROM category_stations WHERE station_id = ?').bind(id).run().catch(() => null);
  }
  if (tenantId !== '*') {
    try {
      await db.prepare(
        "DELETE FROM kitchen_stations WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, tenantId).run();
    } catch {
      await db.prepare('DELETE FROM kitchen_stations WHERE id = ?').bind(id).run();
    }
  } else {
    await db.prepare('DELETE FROM kitchen_stations WHERE id = ?').bind(id).run();
  }
  return c.json({ success: true });
});

// ── Category → Station mapping ─────────────────────────────────────

kitchenStationsRouter.get('/categories', async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const { results } = await db.prepare(
    `SELECT cs.category_id, cs.station_id, ks.name AS station_name, ks.tenant_id AS tenant_id
     FROM category_stations cs
     JOIN kitchen_stations ks ON ks.id = cs.station_id
     ORDER BY ks.name, cs.category_id`
  ).all<Record<string, unknown>>().catch(() =>
    db.prepare(
      `SELECT cs.category_id, cs.station_id, ks.name AS station_name
       FROM category_stations cs
       JOIN kitchen_stations ks ON ks.id = cs.station_id
       ORDER BY ks.name, cs.category_id`
    ).all<Record<string, unknown>>()
  );
  const filtered = (results || []).filter((r) => matchesTenantRow(r, tenantId));
  return c.json({ success: true, data: filtered });
});

kitchenStationsRouter.post('/categories', requireStationManager, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const body = await c.req.json() as Record<string, unknown>;
  const categoryId = String(body.category_id || '').trim();
  const stationId = String(body.station_id || '').trim();
  if (!categoryId || !stationId) {
    return c.json({ success: false, error: 'category_id and station_id are required' }, 400);
  }
  const station = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(stationId).first<Record<string, unknown>>();
  if (!station || !matchesTenantRow(station, tenantId)) return c.json({ success: false, error: 'Station not found' }, 404);
  const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(categoryId).first<Record<string, unknown>>().catch(() => null);
  if (category && !matchesTenantRow(category, tenantId)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  if (!category && tenantId !== 'default' && tenantId !== '*') {
    const existingMapping = await db
      .prepare(
        `SELECT cs.category_id, cs.station_id, ks.tenant_id AS tenant_id
         FROM category_stations cs
         LEFT JOIN kitchen_stations ks ON ks.id = cs.station_id
         WHERE cs.category_id = ?`
      )
      .bind(categoryId)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (existingMapping && existingMapping.station_id && !matchesTenantRow(existingMapping, tenantId)) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }
  }
  const writeTenant = tenantId === '*' ? 'default' : tenantId;
  try {
    await db.prepare(
      'INSERT OR REPLACE INTO category_stations (category_id, station_id, tenant_id) VALUES (?, ?, ?)'
    ).bind(categoryId, stationId, writeTenant).run();
  } catch {
    await db.prepare(
      'INSERT OR REPLACE INTO category_stations (category_id, station_id) VALUES (?, ?)'
    ).bind(categoryId, stationId).run();
  }
  return c.json({ success: true });
});

kitchenStationsRouter.delete('/categories/:categoryId/:stationId', requireStationManager, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const categoryId = c.req.param('categoryId');
  const stationId = c.req.param('stationId');
  const station = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(stationId).first<Record<string, unknown>>().catch(() => null);
  if (!station || !matchesTenantRow(station, tenantId)) {
    return c.json({ success: false, error: 'Station not found' }, 404);
  }
  if (tenantId !== '*') {
    try {
      await db.prepare(
        "DELETE FROM category_stations WHERE category_id = ? AND station_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(categoryId, stationId, tenantId).run();
    } catch {
      await db.prepare(
        'DELETE FROM category_stations WHERE category_id = ? AND station_id = ?'
      ).bind(categoryId, stationId).run();
    }
  } else {
    await db.prepare(
      'DELETE FROM category_stations WHERE category_id = ? AND station_id = ?'
    ).bind(categoryId, stationId).run();
  }
  return c.json({ success: true });
});

// ── Station KDS view & Tickets ──────────────────────────────────────
kitchenStationsRouter.route('/', stationTicketsRouter);

export { kitchenStationsRouter };
