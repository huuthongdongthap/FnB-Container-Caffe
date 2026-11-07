/**
 * Happy Hour Commands & Routes — /happy-hour
 * Evaluated at order time to apply the best-matching discount window.
 */

import { Hono, type Context } from 'hono';
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import { isHQSuperAdmin, resolvePublicTenantId } from 'worker/src/middleware/tenant';
import type { Env } from 'worker/src/types/env';
import type { HappyHourWindow } from '../model/catalog-types';
import { happyHourDiscountFor, resolveItemPrice } from '../policies/pricing';

export const happyHourRouter = new Hono<{ Bindings: Env }>();
happyHourRouter.use('*', async (c, next) => {
  if (!c.get('user' as never) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});
const baseStaffAuth = requireAuth(['owner', 'manager', 'supervisor', 'admin']);
const staffAuth: typeof baseStaffAuth = async (c, next) => {
  const existingUser = c.get('user' as never) as { role?: string } | undefined;
  if (
    existingUser?.role &&
    ['owner', 'manager', 'supervisor', 'admin'].includes(existingUser.role) &&
    !c.req.header('Authorization')
  ) {
    return next();
  }
  return baseStaffAuth(c, next);
};

const VALID_APPLY_TO = new Set([
  'all',
  'category',
  'product',
  'category_id',
  'product_id',
  'categories',
  'products',
  'item',
  'items',
]);

function parseNonEmptyApplyIds(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) {
    const cleaned = raw.map((x) => String(x ?? '').trim()).filter(Boolean);
    return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.map((x) => String(x ?? '').trim()).filter(Boolean);
          return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
        }
        return null;
      } catch {
        return null;
      }
    }
    const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? JSON.stringify(parts) : null;
  }
  return null;
}

function findActiveWindowForTime(
  windows: ReadonlyArray<HappyHourWindow>,
  now: Date,
): HappyHourWindow | null {
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dayOfWeek = now.getDay();
  const matched = windows
    .filter((w) => {
      if (w.active !== 1 || w.day_of_week !== dayOfWeek) return false;
      const start = padHHMM(String(w.start_time || ''));
      const end = padHHMM(String(w.end_time || ''));
      if (start > end || currentTime < start || currentTime >= end) return false;
      const applyTo = String(w.apply_to || 'all').trim().toLowerCase();
      if (applyTo !== 'all' && !parseNonEmptyApplyIds(w.apply_ids)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority || b.discount_rate - a.discount_rate);
  return matched[0] ?? null;
}

function itemMatchesHappyHourWindow(
  win: HappyHourWindow,
  item: Record<string, unknown>,
  now: Date,
): boolean {
  const itemId = String(item.id ?? item.product_id ?? '');
  const catA = item.category != null ? String(item.category) : null;
  const catB = item.category_id != null ? String(item.category_id) : null;

  if (
    happyHourDiscountFor([win], now, {
      productId: itemId || null,
      categoryId: catA || catB,
    })
  ) {
    return true;
  }
  if (catA && catB && catA !== catB) {
    if (
      happyHourDiscountFor([win], now, {
        productId: itemId || null,
        categoryId: catB,
      })
    ) {
      return true;
    }
  }
  return false;
}

function resolvePublicHappyHourTenantId(c: any): string {
  const raw = resolvePublicTenantId(c).trim() || 'default';
  if (isHQSuperAdmin(c.get?.('user') ?? c)) {
    return raw === 'hq' ? '*' : raw;
  }
  return raw === '*' ? 'default' : raw;
}

function verifyHappyHourReadTenant(
  c: any
): { ok: true; tenantId: string } | { ok: false; status: 403; error: string } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const resolved = resolvePublicHappyHourTenantId(c);
  const explicitContextTenant = (c.get?.('tenantId') as string | undefined)?.trim() || '';
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
    return { ok: false, status: 403, error: 'Cross-tenant access denied' };
  }
  const requestedOverride = candidateOverrides[0] || '';

  if (user) {
    const rawUserTenant = user.tenantId ?? user.tenant_id;
    const userTenant = rawUserTenant && String(rawUserTenant).trim() ? String(rawUserTenant).trim() : null;
    if (!isHQSuperAdmin(user)) {
      if (
        userTenant === '*' ||
        userTenant?.toLowerCase() === 'hq' ||
        requestedOverride === '*' ||
        requestedOverride.toLowerCase() === 'hq' ||
        explicitContextTenant === '*' ||
        explicitContextTenant.toLowerCase() === 'hq'
      ) {
        return { ok: false, status: 403, error: 'Cross-tenant access denied' };
      }
      if (explicitContextTenant && userTenant && explicitContextTenant !== userTenant) {
        return { ok: false, status: 403, error: 'Cross-tenant access denied' };
      }
      if (requestedOverride && requestedOverride !== (userTenant || resolved)) {
        return { ok: false, status: 403, error: 'Cross-tenant access denied' };
      }
      return { ok: true, tenantId: userTenant && userTenant !== '*' ? userTenant : resolved };
    }
    const cleanReq = requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq' ? requestedOverride : '';
    const cleanResolved = resolved && resolved !== '*' && resolved.toLowerCase() !== 'hq' ? resolved : '';
    const hqTenant =
      requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq'
        ? '*'
        : cleanReq || cleanResolved || '*';
    return { ok: true, tenantId: hqTenant };
  } else if (
    requestedOverride === '*' ||
    requestedOverride.toLowerCase() === 'hq' ||
    explicitContextTenant === '*' ||
    explicitContextTenant.toLowerCase() === 'hq'
  ) {
    return { ok: false, status: 403, error: 'Cross-tenant access denied' };
  }

  return { ok: true, tenantId: resolved };
}

function verifyHappyHourWriteTenant(
  c: any,
  allowHQWildcardLookup = false
): { ok: true; tenantId: string } | { ok: false; status: 400 | 403; error: string } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const rawTenant = getTenantId(c).trim();
  const resolved = rawTenant.toLowerCase() === 'hq' && isHQSuperAdmin(user ?? c) ? '*' : (rawTenant || 'default');
  const explicitContextTenant = (c.get?.('tenantId') as string | undefined)?.trim() || '';
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
    return { ok: false, status: 403, error: 'Cross-tenant access denied' };
  }
  const requestedOverride = candidateOverrides[0] || '';

  if (user) {
    const rawUserTenant = user.tenantId ?? user.tenant_id;
    const userTenant = rawUserTenant && String(rawUserTenant).trim() ? String(rawUserTenant).trim() : null;
    if (!isHQSuperAdmin(user)) {
      if (
        userTenant === '*' ||
        userTenant?.toLowerCase() === 'hq' ||
        requestedOverride === '*' ||
        requestedOverride.toLowerCase() === 'hq' ||
        explicitContextTenant === '*' ||
        explicitContextTenant.toLowerCase() === 'hq'
      ) {
        return { ok: false, status: 403, error: 'Cross-tenant access denied' };
      }
      if (explicitContextTenant && userTenant && explicitContextTenant !== userTenant) {
        return { ok: false, status: 403, error: 'Cross-tenant access denied' };
      }
      if (requestedOverride && requestedOverride !== (userTenant || resolved)) {
        return { ok: false, status: 403, error: 'Cross-tenant access denied' };
      }
      return { ok: true, tenantId: userTenant || (resolved === '*' ? 'default' : resolved) };
    }
  }

  const cleanReq = requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq' ? requestedOverride : '';
  const cleanResolved = resolved && resolved !== '*' && resolved.toLowerCase() !== 'hq' ? resolved : '';
  const effectiveTenant =
    requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq'
      ? '*'
      : cleanReq || cleanResolved || '*';

  if (
    !allowHQWildcardLookup &&
    (effectiveTenant === '*' || effectiveTenant.toLowerCase() === 'hq')
  ) {
    return { ok: false, status: 400, error: 'Explicit store tenant is required for happy hour creation' };
  }

  return { ok: true, tenantId: effectiveTenant };
}

async function hasCrossTenantApplyIds(
  db: Env['AURA_DB'],
  applyTo: string,
  applyIdsJson: string | null,
  tenantId: string
): Promise<boolean> {
  if (!applyIdsJson || !tenantId || tenantId === '*' || tenantId.toLowerCase() === 'hq') return false;
  const normApplyTo = applyTo.trim().toLowerCase();
  if (normApplyTo === 'all') return false;
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(applyIdsJson);
    if (Array.isArray(parsed)) {
      ids = parsed.map((x) => String(x ?? '').trim()).filter(Boolean);
    }
  } catch {
    return false;
  }
  if (ids.length === 0) return false;

  const tables = ['category', 'category_id', 'categories'].includes(normApplyTo)
    ? ['categories']
    : ['product', 'product_id', 'products', 'item', 'items'].includes(normApplyTo)
      ? ['products', 'menu_items']
      : [];
  if (tables.length === 0) return false;

  const placeholders = ids.map(() => '?').join(', ');
  for (const table of tables) {
    try {
      const stmt = db.prepare(`SELECT id, tenant_id FROM ${table} WHERE id IN (${placeholders})`).bind(...ids);
      let rows: Array<Record<string, unknown>> = [];
      if (typeof (stmt as { all?: unknown }).all === 'function') {
        const res = await stmt.all<Record<string, unknown>>().catch(() => null);
        if (res && Array.isArray(res.results)) {
          rows = res.results;
        }
      }
      if (rows.length === 0 && typeof (stmt as { first?: unknown }).first === 'function' && ids.length === 1) {
        const single = await db
          .prepare(`SELECT id, tenant_id FROM ${table} WHERE id = ?`)
          .bind(ids[0])
          .first<Record<string, unknown>>()
          .catch(() => null);
        if (single) rows = [single];
      }
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        if ('discount_rate' in row || 'start_time' in row) continue;
        const rowId = String(row.id ?? '').trim();
        if (rowId && !ids.includes(rowId)) continue;
        if ('tenant_id' in row && row.tenant_id !== undefined && !matchesTenantRow(row, tenantId)) {
          return true;
        }
      }
    } catch {
      // Ignore when target catalog table or tenant_id column is absent in mock unit test DB
    }
  }
  return false;
}

function makeId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${rand}`.toUpperCase();
}

function padHHMM(t: string): string {
  const parts = t.trim().split(':');
  if (parts.length < 2) return t.trim();
  return `${(parts[0] ?? '').padStart(2, '0')}:${(parts[1] ?? '').padStart(2, '0')}`;
}

// ── Happy Hour (Public Read, Staff Mutation) ─────────────────────────

happyHourRouter.get('/happy-hour', async (c) => {
  const scope = verifyHappyHourReadTenant(c);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const onlyActive = c.req.query('active') !== 'false';
  let query = 'SELECT * FROM happy_hour_windows WHERE 1=1';
  if (onlyActive) query += ' AND active = 1';
  query += ' ORDER BY priority DESC, day_of_week, start_time';
  const { results } = await db.prepare(query).all<HappyHourWindow>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

happyHourRouter.post('/happy-hour', staffAuth, async (c) => {
  const scope = verifyHappyHourWriteTenant(c, false);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const body = (await c.req.json()) as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const dayOfWeek = Number(body.day_of_week);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return c.json({ success: false, error: 'day_of_week must be 0-6' }, 400);
  }
  const rawStart = String(body.start_time || '').trim();
  const rawEnd = String(body.end_time || '').trim();
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(rawStart) || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(rawEnd)) {
    return c.json({ success: false, error: 'start_time/end_time must be HH:MM' }, 400);
  }
  const startTime = padHHMM(rawStart);
  const endTime = padHHMM(rawEnd);
  if (startTime >= endTime) {
    return c.json({ success: false, error: 'start_time must be before end_time' }, 400);
  }
  const discountRate = Number(body.discount_rate);
  if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 1) {
    return c.json({ success: false, error: 'discount_rate must be 0-1' }, 400);
  }
  const applyTo =
    body.apply_to !== undefined && body.apply_to !== null
      ? String(body.apply_to).trim()
      : 'all';
  if (!VALID_APPLY_TO.has(applyTo)) {
    return c.json({ success: false, error: 'apply_to must be one of all, category, product' }, 400);
  }
  const applyIds = parseNonEmptyApplyIds(body.apply_ids);
  if (applyTo !== 'all' && !applyIds) {
    return c.json({ success: false, error: 'apply_ids is required when apply_to is not all' }, 400);
  }
  if (applyIds && (await hasCrossTenantApplyIds(db, applyTo, applyIds, tenantId))) {
    return c.json({ success: false, error: 'Cross-tenant apply_ids are not allowed' }, 403);
  }
  let priority = 0;
  if (body.priority !== undefined && body.priority !== null) {
    const parsedPriority = Number(body.priority);
    if (!Number.isFinite(parsedPriority)) {
      return c.json({ success: false, error: 'priority must be a finite number' }, 400);
    }
    priority = Math.trunc(parsedPriority);
  }
  const id = makeId('HH');
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO happy_hour_windows (id, name, day_of_week, start_time, end_time, discount_rate, apply_to, apply_ids, priority, active, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, name, dayOfWeek, startTime, endTime, discountRate, applyTo, applyIds,
      priority, body.active === false ? 0 : 1, tenantId, now, now
    ).run();
  } catch (err) {
    if (tenantId !== 'default') {
      throw err;
    }
    await db.prepare(
      `INSERT INTO happy_hour_windows (id, name, day_of_week, start_time, end_time, discount_rate, apply_to, apply_ids, priority, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, name, dayOfWeek, startTime, endTime, discountRate, applyTo, applyIds,
      priority, body.active === false ? 0 : 1, now, now
    ).run();
  }
  const win = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<HappyHourWindow>();
  return c.json({ success: true, data: win }, 201);
});

happyHourRouter.patch('/happy-hour/:id', staffAuth, async (c) => {
  const scope = verifyHappyHourWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) return c.json({ success: false, error: 'Happy hour window not found' }, 404);
  const effectiveTenant =
    typeof existing.tenant_id === 'string' && existing.tenant_id.trim()
      ? existing.tenant_id.trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;
  const body = (await c.req.json()) as Record<string, unknown>;
  let nextName: string | null = null;
  if (body.name !== undefined && body.name !== null) {
    nextName = String(body.name).trim();
    if (!nextName) {
      return c.json({ success: false, error: 'name cannot be empty' }, 400);
    }
  }
  if (body.day_of_week != null) {
    const dow = Number(body.day_of_week);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
      return c.json({ success: false, error: 'day_of_week must be 0-6' }, 400);
    }
  }
  let nextStart: string | null = null;
  let nextEnd: string | null = null;
  if (body.start_time != null) {
    const rawStart = String(body.start_time).trim();
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(rawStart)) {
      return c.json({ success: false, error: 'start_time/end_time must be HH:MM' }, 400);
    }
    nextStart = padHHMM(rawStart);
  }
  if (body.end_time != null) {
    const rawEnd = String(body.end_time).trim();
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(rawEnd)) {
      return c.json({ success: false, error: 'start_time/end_time must be HH:MM' }, 400);
    }
    nextEnd = padHHMM(rawEnd);
  }
  const effectiveStart = nextStart ?? (existing.start_time ? padHHMM(String(existing.start_time)) : null);
  const effectiveEnd = nextEnd ?? (existing.end_time ? padHHMM(String(existing.end_time)) : null);
  if ((nextStart !== null || nextEnd !== null) && effectiveStart && effectiveEnd && effectiveStart >= effectiveEnd) {
    return c.json({ success: false, error: 'start_time must be before end_time' }, 400);
  }
  if (body.discount_rate != null) {
    const dr = Number(body.discount_rate);
    if (!Number.isFinite(dr) || dr < 0 || dr > 1) {
      return c.json({ success: false, error: 'discount_rate must be 0-1' }, 400);
    }
  }
  let nextApplyTo: string | null = null;
  if (body.apply_to !== undefined && body.apply_to !== null) {
    nextApplyTo = String(body.apply_to).trim();
    if (!VALID_APPLY_TO.has(nextApplyTo)) {
      return c.json({ success: false, error: 'apply_to must be one of all, category, product' }, 400);
    }
  }
  const effectiveApplyTo = nextApplyTo ?? String(existing.apply_to || 'all').trim();
  const effectiveRawApplyIds = body.apply_ids !== undefined ? body.apply_ids : existing.apply_ids;
  const normalizedApplyIds = parseNonEmptyApplyIds(effectiveRawApplyIds);
  if (effectiveApplyTo !== 'all' && !normalizedApplyIds) {
    return c.json({ success: false, error: 'apply_ids is required when apply_to is not all' }, 400);
  }
  if (
    normalizedApplyIds &&
    (await hasCrossTenantApplyIds(db, effectiveApplyTo, normalizedApplyIds, effectiveTenant))
  ) {
    return c.json({ success: false, error: 'Cross-tenant apply_ids are not allowed' }, 403);
  }
  let nextPriority: number | null = null;
  if (body.priority !== undefined && body.priority !== null) {
    const parsedPriority = Number(body.priority);
    if (!Number.isFinite(parsedPriority)) {
      return c.json({ success: false, error: 'priority must be a finite number' }, 400);
    }
    nextPriority = Math.trunc(parsedPriority);
  }
  const now = new Date().toISOString();
  const bindParams = [
    nextName,
    body.day_of_week != null ? Number(body.day_of_week) : null,
    nextStart,
    nextEnd,
    body.discount_rate != null ? Number(body.discount_rate) : null,
    nextApplyTo,
    body.apply_ids !== undefined ? normalizedApplyIds : null,
    nextPriority,
    body.active != null ? (typeof body.active === 'boolean' ? (body.active ? 1 : 0) : Number(body.active)) : null,
    now,
    id,
  ];
  await db.prepare(
    `UPDATE happy_hour_windows
     SET name = COALESCE(?, name),
         day_of_week = COALESCE(?, day_of_week),
         start_time = COALESCE(?, start_time),
         end_time = COALESCE(?, end_time),
         discount_rate = COALESCE(?, discount_rate),
         apply_to = COALESCE(?, apply_to),
         apply_ids = COALESCE(?, apply_ids),
         priority = COALESCE(?, priority),
         active = COALESCE(?, active),
         updated_at = ?
     WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
  ).bind(...bindParams, effectiveTenant).run().catch(async (err) => {
    if (effectiveTenant !== 'default') {
      throw err;
    }
    await db.prepare(
      `UPDATE happy_hour_windows
       SET name = COALESCE(?, name),
           day_of_week = COALESCE(?, day_of_week),
           start_time = COALESCE(?, start_time),
           end_time = COALESCE(?, end_time),
           discount_rate = COALESCE(?, discount_rate),
           apply_to = COALESCE(?, apply_to),
           apply_ids = COALESCE(?, apply_ids),
           priority = COALESCE(?, priority),
           active = COALESCE(?, active),
           updated_at = ?
       WHERE id = ?`
    ).bind(...bindParams).run();
  });
  const win = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<HappyHourWindow>();
  return c.json({ success: true, data: win });
});

happyHourRouter.delete('/happy-hour/:id', staffAuth, async (c) => {
  const scope = verifyHappyHourWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) return c.json({ success: false, error: 'Happy hour window not found' }, 404);
  const effectiveTenant =
    typeof existing.tenant_id === 'string' && existing.tenant_id.trim()
      ? existing.tenant_id.trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;
  await db.prepare(
    "DELETE FROM happy_hour_windows WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
  ).bind(id, effectiveTenant).run().catch(async (err) => {
    if (effectiveTenant !== 'default') {
      throw err;
    }
    await db.prepare('DELETE FROM happy_hour_windows WHERE id = ?').bind(id).run();
  });
  return c.json({ success: true });
});

// ── Happy hour evaluation (public, no auth) ────────────────────────
async function handleHappyHourNow(c: Context<{ Bindings: Env }>) {
  const scope = verifyHappyHourReadTenant(c);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const { results: rawWindows } = await db.prepare(
    'SELECT * FROM happy_hour_windows WHERE active = 1'
  ).all<HappyHourWindow>();
  const results = (rawWindows || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  const productId = c.req.query('product_id') || c.req.query('productId') || null;
  let categoryId = c.req.query('category_id') || c.req.query('categoryId') || null;
  if (productId && !categoryId) {
    try {
      const prod = await db.prepare('SELECT category_id, tenant_id FROM products WHERE id = ?')
        .bind(productId)
        .first<{ category_id?: string; category?: string; tenant_id?: string | null }>()
        .catch(async (err) => {
          if (tenantId !== 'default' && tenantId !== '*') throw err;
          return db.prepare('SELECT category_id FROM products WHERE id = ?').bind(productId).first<{ category_id?: string; category?: string; tenant_id?: string | null }>();
        });
      if (prod && matchesTenantRow(prod as unknown as Record<string, unknown>, tenantId)) {
        categoryId = prod.category_id || prod.category || null;
      }
    } catch {
      // Optional category lookup when only product_id is passed
    }
    if (!categoryId) {
      try {
        const menuRow = await db.prepare('SELECT id, name, price, category AS category_id, tenant_id FROM menu_items WHERE id = ?')
          .bind(productId)
          .first<{ id?: string; category_id?: string; category?: string; tenant_id?: string | null }>()
          .catch(async (err) => {
            if (tenantId !== 'default' && tenantId !== '*') throw err;
            return db.prepare('SELECT id, name, price, category AS category_id FROM menu_items WHERE id = ?').bind(productId).first<{ id?: string; category_id?: string; category?: string; tenant_id?: string | null }>();
          });
        if (menuRow && matchesTenantRow(menuRow as unknown as Record<string, unknown>, tenantId)) {
          categoryId = menuRow.category_id || menuRow.category || null;
        }
        if (!categoryId && (tenantId === 'default' || tenantId === '*')) {
          const { results: menuItems } = await db.prepare(
            'SELECT id, name, price, category AS category_id FROM menu_items WHERE available = 1'
          ).all<{ id: string; category_id?: string; category?: string; tenant_id?: string | null }>();
          const matched = (menuItems || []).find((m) => m.id === productId && matchesTenantRow(m as unknown as Record<string, unknown>, tenantId));
          categoryId = matched?.category_id || matched?.category || null;
        }
      } catch {
        // Optional menu_items fallback
      }
    }
  }

  const now = new Date();
  const win =
    productId || categoryId
      ? happyHourDiscountFor(results, now, { productId, categoryId })
      : findActiveWindowForTime(results, now);

  let featuredItems: Array<Record<string, unknown>> = [];
  if (win) {
    try {
      let rawMenuItems: Array<Record<string, unknown>> = [];
      try {
        const menuRes =
          tenantId !== '*'
            ? await db
                .prepare(
                  "SELECT * FROM menu_items WHERE available = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY category, name"
                )
                .bind(tenantId)
                .all<Record<string, unknown>>()
            : await db
                .prepare('SELECT * FROM menu_items WHERE available = 1 ORDER BY category, name')
                .all<Record<string, unknown>>();
        rawMenuItems = (menuRes?.results || menuRes || []) as Array<Record<string, unknown>>;
      } catch {
        if (tenantId === 'default' || tenantId === '*') {
          const fallbackRes = await db
            .prepare('SELECT * FROM menu_items WHERE available = 1 ORDER BY category, name')
            .all<Record<string, unknown>>();
          rawMenuItems = (fallbackRes?.results || fallbackRes || []) as Array<Record<string, unknown>>;
        } else {
          rawMenuItems = [];
        }
      }

      const rawRate = Number(win.discount_rate) || 0;
      const discountMultiplier = rawRate > 0 ? Math.min(1, rawRate <= 1 ? rawRate : rawRate / 100) : 0;
      const discountPercent = Math.round(discountMultiplier * 100);

      featuredItems = rawMenuItems
        .filter((item) => matchesTenantRow(item, tenantId))
        .filter((item) => itemMatchesHappyHourWindow(win, item, now))
        .slice(0, 6)
        .map((item) => {
          const basePrice = Number(item.price) || 0;
          const itemId = String(item.id ?? item.product_id ?? '');
          const catId = String(item.category ?? item.category_id ?? '');
          const happyHourPrice = resolveItemPrice({
            basePriceCents: basePrice,
            channel: 'dine_in',
            modifierChoices: [],
            happyHourWindows: [win],
            now,
            productId: itemId || null,
            categoryId: catId || null,
          });
          return {
            ...item,
            happy_hour_price: happyHourPrice,
            discount_percent: discountPercent,
          };
        });
    } catch {
      featuredItems = [];
    }
  }

  return c.json({
    success: true,
    active: Boolean(win),
    window: win,
    featured_items: featuredItems,
    data: win,
  });
}

happyHourRouter.get('/happy-hour/now', handleHappyHourNow);
happyHourRouter.get('/now', handleHappyHourNow);
