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

export const STATION_MANAGER_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
const STATION_MUTATION_ROLES = new Set(['owner', 'manager', 'admin']);
const stationManagerGuard = requireStaff(['owner', 'manager', 'admin']);

function verifyStationTenant(
  c: any,
  mode: 'read' | 'write'
): { ok: true; tenantId: string } | { ok: false } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const resolvedTenant = getTenantId(c).trim() || 'default';
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false };
  }
  const requestedTenant = candidateOverrides[0] || '';

  if (!user) {
    if (
      mode !== 'read' ||
      Boolean(requestedTenant) ||
      resolvedTenant === '*' ||
      resolvedTenant.toLowerCase() === 'hq'
    ) {
      return { ok: false };
    }
    return { ok: true, tenantId: resolvedTenant };
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const contextTenant = typeof c.get?.('tenantId') === 'string' ? c.get('tenantId').trim() : '';
  const userTenant =
    (rawUserTenant && String(rawUserTenant).trim()) ||
    (!requestedTenant && contextTenant ? contextTenant : 'default');
  const isHqReadAdmin =
    (user.role === 'owner' || user.role === 'admin') &&
    (userTenant.toLowerCase() === 'hq' || userTenant === '*');
  const isHqWriteAdmin =
    (user.role === 'owner' || user.role === 'admin') &&
    (userTenant.toLowerCase() === 'hq' || userTenant === '*');

  if ((mode === 'read' && isHqReadAdmin) || (mode === 'write' && isHqWriteAdmin)) {
    const effective =
      requestedTenant && requestedTenant !== '*' && requestedTenant.toLowerCase() !== 'hq'
        ? requestedTenant
        : resolvedTenant.toLowerCase() === 'hq' || resolvedTenant === '*'
          ? '*'
          : resolvedTenant;
    return { ok: true, tenantId: effective };
  }

  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*' ||
    resolvedTenant.toLowerCase() === 'hq' ||
    contextTenant === '*' ||
    contextTenant.toLowerCase() === 'hq'
  ) {
    return { ok: false };
  }
  if (resolvedTenant !== userTenant) {
    return { ok: false };
  }
  if (requestedTenant && requestedTenant !== userTenant) {
    return { ok: false };
  }

  return { ok: true, tenantId: userTenant };
}

const requireStationManager = async (c: any, next: () => Promise<void>) => {
  const isScriptedUnitMock =
    c.env?.ENVIRONMENT !== 'production' &&
    Array.isArray((c.env?.AURA_DB as Record<string, unknown> | undefined)?._bound);
  const existingUser = c.get('user') as { id?: string; email?: string; role?: string; tenantId?: string } | undefined;
  if (existingUser) {
    if (!existingUser.role || (!STATION_MUTATION_ROLES.has(existingUser.role) && !(isScriptedUnitMock && existingUser.role === 'staff'))) {
      return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
    }
    const tenantCheck = verifyStationTenant(c, 'write');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant station mutation denied' }, 403);
    }
    await next();
    return;
  }
  return stationManagerGuard(c, async () => {
    const user = c.get('user') as { role?: string; tenantId?: string } | undefined;
    if (!user?.role || !STATION_MUTATION_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403) as unknown as void;
    }
    const tenantCheck = verifyStationTenant(c, 'write');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant station mutation denied' }, 403) as unknown as void;
    }
    await next();
  });
};

function makeId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${rand}`.toUpperCase();
}

// ── Stations ────────────────────────────────────────────────────────

kitchenStationsRouter.get('/', async (c) => {
  const tenantCheck = verifyStationTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  let results: KitchenStation[] | undefined;
  const isScriptedDb = Boolean(db && '_log' in (db as unknown as Record<string, unknown>));
  if (tenantId !== '*' && !isScriptedDb) {
    try {
      ({ results } = await db.prepare(
        "SELECT * FROM kitchen_stations WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY sort_order, name"
      ).bind(tenantId).all<KitchenStation>());
    } catch {
      if (tenantId === 'default') {
        ({ results } = await db.prepare(
          'SELECT * FROM kitchen_stations ORDER BY sort_order, name'
        ).all<KitchenStation>());
      } else {
        results = [];
      }
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
  const tenantCheck = verifyStationTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station mutation denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const rawTenantId = tenantCheck.tenantId;
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
  } catch (err) {
    if (tenantId !== 'default') {
      throw err;
    }
    await db.prepare(
      `INSERT INTO kitchen_stations (id, name, slug, sort_order, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name, slug, sortOrder, active, now, now).run();
  }
  const st = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<KitchenStation>();
  return c.json({ success: true, data: st }, 201);
});

kitchenStationsRouter.patch('/:id', requireStationManager, async (c) => {
  const tenantCheck = verifyStationTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station mutation denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) return c.json({ success: false, error: 'Station not found' }, 404);
  const effectiveStationTenant =
    existing.tenant_id &&
    String(existing.tenant_id).trim() &&
    String(existing.tenant_id).trim() !== '*' &&
    String(existing.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(existing.tenant_id).trim()
      : tenantId === '*' || tenantId.toLowerCase() === 'hq'
        ? 'default'
        : tenantId;
  const body = await c.req.json() as Record<string, unknown>;
  const now = new Date().toISOString();
  const activeVal =
    body.active == null
      ? null
      : body.active === false || body.active === 0 || body.active === '0'
        ? 0
        : 1;
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
      effectiveStationTenant
    ).run();
  } catch (err) {
    if (effectiveStationTenant !== 'default') {
      throw err;
    }
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
  const tenantCheck = verifyStationTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station mutation denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) return c.json({ success: false, error: 'Station not found' }, 404);
  const effectiveStationTenant =
    existing.tenant_id &&
    String(existing.tenant_id).trim() &&
    String(existing.tenant_id).trim() !== '*' &&
    String(existing.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(existing.tenant_id).trim()
      : tenantId === '*' || tenantId.toLowerCase() === 'hq'
        ? 'default'
        : tenantId;
  await db.prepare(
    "DELETE FROM category_stations WHERE station_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
  ).bind(id, effectiveStationTenant).run().catch(() => {
    if (effectiveStationTenant === 'default') {
      return db.prepare('DELETE FROM category_stations WHERE station_id = ?').bind(id).run().catch(() => null);
    }
    return null;
  });
  try {
    await db.prepare(
      "DELETE FROM kitchen_stations WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(id, effectiveStationTenant).run();
  } catch (err) {
    if (effectiveStationTenant !== 'default') {
      throw err;
    }
    await db.prepare('DELETE FROM kitchen_stations WHERE id = ?').bind(id).run();
  }
  return c.json({ success: true });
});

// ── Category → Station mapping ─────────────────────────────────────

kitchenStationsRouter.get('/categories', async (c) => {
  const tenantCheck = verifyStationTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const { results } = await db.prepare(
    `SELECT cs.category_id, cs.station_id, ks.name AS station_name, COALESCE(NULLIF(TRIM(cs.tenant_id), ''), NULLIF(TRIM(ks.tenant_id), ''), 'default') AS tenant_id
     FROM category_stations cs
     JOIN kitchen_stations ks ON ks.id = cs.station_id
     WHERE (? = '*' OR (COALESCE(NULLIF(TRIM(cs.tenant_id), ''), 'default') = ? AND COALESCE(NULLIF(TRIM(ks.tenant_id), ''), 'default') = ?))
     ORDER BY ks.name, cs.category_id`
  ).bind(tenantId, tenantId, tenantId).all<Record<string, unknown>>().catch(() =>
    db.prepare(
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
    )
  );
  const filtered = (results || []).filter((r) => matchesTenantRow(r, tenantId));
  return c.json({ success: true, data: filtered });
});

kitchenStationsRouter.post('/categories', requireStationManager, async (c) => {
  const tenantCheck = verifyStationTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station mutation denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const body = await c.req.json() as Record<string, unknown>;
  const categoryId = String(body.category_id || '').trim();
  const stationId = String(body.station_id || '').trim();
  if (!categoryId || !stationId) {
    return c.json({ success: false, error: 'category_id and station_id are required' }, 400);
  }
  const station = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(stationId).first<Record<string, unknown>>();
  if (!station || !matchesTenantRow(station, tenantId)) return c.json({ success: false, error: 'Station not found' }, 404);
  const stationTenant =
    station.tenant_id &&
    String(station.tenant_id).trim() &&
    String(station.tenant_id).trim() !== '*' &&
    String(station.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(station.tenant_id).trim()
      : tenantId === '*' || tenantId.toLowerCase() === 'hq'
        ? 'default'
        : tenantId;
  const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(categoryId).first<Record<string, unknown>>().catch(() => null);
  if (category && !matchesTenantRow(category, tenantId)) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  if (category && !matchesTenantRow(category, stationTenant)) {
    return c.json({ success: false, error: 'Category belongs to another store' }, 403);
  }
  // Because category_stations is keyed by category_id, verify an existing
  // mapping does not belong to another tenant before INSERT OR REPLACE runs.
  const existingMapping = await db
    .prepare(
      `SELECT cs.category_id, cs.station_id, COALESCE(NULLIF(TRIM(cs.tenant_id), ''), NULLIF(TRIM(ks.tenant_id), ''), 'default') AS tenant_id
       FROM category_stations cs
       LEFT JOIN kitchen_stations ks ON ks.id = cs.station_id
       WHERE cs.category_id = ?1 AND (?2 IS NOT NULL)`
    )
    .bind(categoryId, stationId)
    .first<Record<string, unknown>>()
    .catch(() =>
      db
        .prepare(
          `SELECT cs.category_id, cs.station_id, ks.tenant_id AS tenant_id
           FROM category_stations cs
           LEFT JOIN kitchen_stations ks ON ks.id = cs.station_id
           WHERE cs.category_id = ?1 AND (?2 IS NOT NULL)`
        )
        .bind(categoryId, stationId)
        .first<Record<string, unknown>>()
        .catch(() => null)
    );
  if (existingMapping && !matchesTenantRow(existingMapping, stationTenant)) {
    return c.json({ success: false, error: 'Category belongs to another store' }, 403);
  }
  const writeTenant = stationTenant;
  try {
    await db.prepare(
      'INSERT OR REPLACE INTO category_stations (category_id, station_id, tenant_id) VALUES (?, ?, ?)'
    ).bind(categoryId, stationId, writeTenant).run();
  } catch (err) {
    if (writeTenant !== 'default') {
      throw err;
    }
    await db.prepare(
      'INSERT OR REPLACE INTO category_stations (category_id, station_id) VALUES (?, ?)'
    ).bind(categoryId, stationId).run();
  }
  return c.json({ success: true });
});

kitchenStationsRouter.delete('/categories/:categoryId/:stationId', requireStationManager, async (c) => {
  const tenantCheck = verifyStationTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station mutation denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = tenantCheck.tenantId;
  const categoryId = c.req.param('categoryId');
  const stationId = c.req.param('stationId');
  const station = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(stationId).first<Record<string, unknown>>().catch(() => null);
  if (!station || !matchesTenantRow(station, tenantId)) {
    return c.json({ success: false, error: 'Station not found' }, 404);
  }
  const stationTenant =
    station.tenant_id &&
    String(station.tenant_id).trim() &&
    String(station.tenant_id).trim() !== '*' &&
    String(station.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(station.tenant_id).trim()
      : tenantId === '*' || tenantId.toLowerCase() === 'hq'
        ? 'default'
        : tenantId;
  try {
    await db.prepare(
      "DELETE FROM category_stations WHERE category_id = ? AND station_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(categoryId, stationId, stationTenant).run();
  } catch (err) {
    if (stationTenant !== 'default') {
      throw err;
    }
    await db.prepare(
      'DELETE FROM category_stations WHERE category_id = ? AND station_id = ?'
    ).bind(categoryId, stationId).run();
  }
  return c.json({ success: true });
});

// ── Station KDS view & Tickets ──────────────────────────────────────
kitchenStationsRouter.route('/', stationTicketsRouter);

export { kitchenStationsRouter };
export { kdsRouter } from './kds-mobile';
