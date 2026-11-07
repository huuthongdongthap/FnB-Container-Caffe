/**
 * Menu Modifiers Commands — /api/menu-modifiers
 * Item modifiers (sugar/ice/size, add-ons) and product-group mappings.
 */

import { Hono } from 'hono';
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import { isHQSuperAdmin, resolvePublicTenantId } from 'worker/src/middleware/tenant';
import type { Env } from 'worker/src/types/env';
import type { ModifierGroup, ModifierChoice } from '../model/catalog-types';
import {
  syncModifierChoiceToMenuProjection,
  syncModifierGroupAvailabilityToMenuProjection,
} from '../policies/menu-projection';
import { happyHourRouter } from './happy-hour';

export const menuModifiersRouter = new Hono<{ Bindings: Env }>();
menuModifiersRouter.use('*', async (c, next) => {
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

function resolvePublicCatalogTenantId(c: any): string {
  const raw = resolvePublicTenantId(c).trim() || 'default';
  if (isHQSuperAdmin(c.get?.('user') ?? c)) {
    return raw === 'hq' ? '*' : raw;
  }
  return raw === '*' ? 'default' : raw;
}

export function resolveWriteCatalogTenantId(c: any): string {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const raw = getTenantId(c).trim() || 'default';
  const requestedOverride = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (user && !isHQSuperAdmin(user)) {
    const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
    if (userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq') {
      return userTenant;
    }
  }
  if (isHQSuperAdmin(user ?? c)) {
    if (requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq') {
      return requestedOverride;
    }
    return raw.toLowerCase() === 'hq' ? '*' : raw;
  }
  return raw === '*' || raw.toLowerCase() === 'hq' ? 'default' : raw;
}

export function verifyModifierReadTenant(
  c: any
): { ok: true; tenantId: string } | { ok: false; status: 403; error: string } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const resolved = resolvePublicCatalogTenantId(c);
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

export function verifyModifierWriteTenant(
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
    return { ok: false, status: 400, error: 'Explicit store tenant is required for modifier mutations' };
  }

  return { ok: true, tenantId: effectiveTenant };
}

function makeId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${rand}`.toUpperCase();
}

// ── Modifier Groups ────────────────────────────────────────────────

menuModifiersRouter.get('/groups', async (c) => {
  const scope = verifyModifierReadTenant(c);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const { results } = await db.prepare(
    'SELECT * FROM modifier_groups ORDER BY sort_order, name'
  ).all<ModifierGroup>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

menuModifiersRouter.post('/groups', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, false);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const body = (await c.req.json()) as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const type = body.type === 'multiple' ? 'multiple' : 'single';
  const required = body.required ? 1 : 0;
  const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
  const id = makeId('MG');
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO modifier_groups (id, name, type, required, sort_order, is_active, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name, type, required, Number(body.sort_order) || 0, isActive, tenantId, now, now).run();
  } catch (err) {
    if (tenantId !== 'default') {
      throw err;
    }
    try {
      await db.prepare(
        `INSERT INTO modifier_groups (id, name, type, required, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, name, type, required, Number(body.sort_order) || 0, isActive, now, now).run();
    } catch {
      await db.prepare(
        `INSERT INTO modifier_groups (id, name, type, required, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, name, type, required, Number(body.sort_order) || 0, now, now).run();
    }
  }
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(id).first<ModifierGroup>();
  return c.json({ success: true, data: group }, 201);
});

menuModifiersRouter.patch('/groups/:id', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) {
    return c.json({ success: false, error: 'Modifier group not found' }, 404);
  }
  const body = (await c.req.json()) as Record<string, unknown>;
  let nextName: string | null = null;
  if (body.name !== undefined && body.name !== null) {
    nextName = String(body.name).trim();
    if (!nextName) {
      return c.json({ success: false, error: 'name cannot be empty' }, 400);
    }
  }
  const nextType =
    body.type !== undefined && body.type !== null
      ? (body.type === 'multiple' ? 'multiple' : 'single')
      : null;
  const nextRequired =
    body.required !== undefined && body.required !== null
      ? (body.required ? 1 : 0)
      : null;
  const nextSortOrder =
    body.sort_order !== undefined && body.sort_order !== null
      ? (Number(body.sort_order) || 0)
      : null;
  const rawActiveInput =
    body.is_active !== undefined
      ? body.is_active
      : body.active !== undefined
        ? body.active
        : body.available;
  const nextIsActive =
    rawActiveInput !== undefined && rawActiveInput !== null
      ? (rawActiveInput ? 1 : 0)
      : null;
  const now = new Date().toISOString();
  const bindParams = [nextName, nextType, nextRequired, nextSortOrder, nextIsActive, now, id];

  const effectiveGroupTenant =
    typeof existing.tenant_id === 'string' && existing.tenant_id.trim()
      ? existing.tenant_id.trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;

  await db.prepare(
    `UPDATE modifier_groups
     SET name = COALESCE(?, name),
         type = COALESCE(?, type),
         required = COALESCE(?, required),
         sort_order = COALESCE(?, sort_order),
         is_active = COALESCE(?, is_active),
         updated_at = ?
     WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
  ).bind(...bindParams, effectiveGroupTenant).run().catch(async (err) => {
    if (effectiveGroupTenant !== 'default') {
      throw err;
    }
    await db.prepare(
      `UPDATE modifier_groups
       SET name = COALESCE(?, name),
           type = COALESCE(?, type),
           required = COALESCE(?, required),
           sort_order = COALESCE(?, sort_order),
           is_active = COALESCE(?, is_active),
           updated_at = ?
       WHERE id = ?`
    ).bind(...bindParams).run();
  });

  if (nextIsActive !== null) {
    await syncModifierGroupAvailabilityToMenuProjection(db, id, nextIsActive, effectiveGroupTenant);
  }

  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(id).first<ModifierGroup>();
  return c.json({ success: true, data: group });
});

menuModifiersRouter.delete('/groups/:id', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) {
    return c.json({ success: false, error: 'Modifier group not found' }, 404);
  }
  const effectiveGroupTenant =
    typeof existing.tenant_id === 'string' && existing.tenant_id.trim()
      ? existing.tenant_id.trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;
  // product_modifier_groups has no FK to products, so the cascade on
  // modifier_choices leaves these links behind and the product silently
  // loses modifiers it still advertises.
  await db
    .prepare(
      "DELETE FROM product_modifier_groups WHERE group_id = ? AND (COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR tenant_id IS NULL)"
    )
    .bind(id, effectiveGroupTenant)
    .run()
    .catch(async (err) => {
      if (effectiveGroupTenant !== 'default') throw err;
      await db.prepare('DELETE FROM product_modifier_groups WHERE group_id = ?').bind(id).run();
    });
  await db
    .prepare(
      "DELETE FROM modifier_choices WHERE group_id = ? AND (COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR tenant_id IS NULL)"
    )
    .bind(id, effectiveGroupTenant)
    .run()
    .catch(async (err) => {
      if (effectiveGroupTenant !== 'default') throw err;
      await db.prepare('DELETE FROM modifier_choices WHERE group_id = ?').bind(id).run();
    });
  await db
    .prepare("DELETE FROM menu_modifiers WHERE group_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
    .bind(id, effectiveGroupTenant)
    .run()
    .catch(async () => {
      if (effectiveGroupTenant === 'default') {
        await db.prepare('DELETE FROM menu_modifiers WHERE group_id = ?').bind(id).run();
      }
    });
  await db.prepare(
    "DELETE FROM modifier_groups WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
  ).bind(id, effectiveGroupTenant).run().catch(async (err) => {
    if (effectiveGroupTenant !== 'default') {
      throw err;
    }
    await db.prepare('DELETE FROM modifier_groups WHERE id = ?').bind(id).run();
  });
  return c.json({ success: true });
});

// ── Modifier Choices ───────────────────────────────────────────────

menuModifiersRouter.get('/groups/:groupId/choices', async (c) => {
  const scope = verifyModifierReadTenant(c);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const groupId = c.req.param('groupId');
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(groupId).first<Record<string, unknown>>().catch(() => null);
  if ((group && !matchesTenantRow(group, tenantId)) || (tenantId !== 'default' && !group)) {
    return c.json({ success: true, data: [] });
  }
  const { results } = await db.prepare(
    'SELECT * FROM modifier_choices WHERE group_id = ? ORDER BY sort_order, name'
  ).bind(groupId).all<ModifierChoice>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

menuModifiersRouter.post('/groups/:groupId/choices', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const groupId = c.req.param('groupId');
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(groupId).first<Record<string, unknown>>();
  if (!group || !matchesTenantRow(group, tenantId)) return c.json({ success: false, error: 'Modifier group not found' }, 404);
  const body = (await c.req.json()) as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const rawPriceDelta = body.price_delta !== undefined && body.price_delta !== null ? Number(body.price_delta) : 0;
  if (!Number.isInteger(rawPriceDelta) || rawPriceDelta < 0) {
    return c.json({ success: false, error: 'price_delta must be a non-negative integer in VND' }, 400);
  }
  const priceDelta = rawPriceDelta;
  const id = makeId('MC');
  const isAvailable = body.is_available !== undefined ? (body.is_available ? 1 : 0) : 1;
  const groupTenant =
    typeof group.tenant_id === 'string' && group.tenant_id.trim()
      ? group.tenant_id.trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;
  try {
    await db.prepare(
      `INSERT INTO modifier_choices (id, group_id, name, price_delta, is_default, sort_order, is_available, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, groupId, name,
      priceDelta,
      body.is_default ? 1 : 0,
      Number(body.sort_order) || 0,
      isAvailable,
      groupTenant
    ).run();
  } catch (err) {
    if (groupTenant !== 'default') throw err;
    try {
      await db.prepare(
        `INSERT INTO modifier_choices (id, group_id, name, price_delta, is_default, sort_order, is_available)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, groupId, name,
        priceDelta,
        body.is_default ? 1 : 0,
        Number(body.sort_order) || 0,
        isAvailable
      ).run();
    } catch {
      await db.prepare(
        `INSERT INTO modifier_choices (id, group_id, name, price_delta, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        id, groupId, name,
        priceDelta,
        body.is_default ? 1 : 0,
        Number(body.sort_order) || 0
      ).run();
    }
  }
  const groupActive = group.is_active !== 0 && group.is_active !== false && group.active !== 0 && group.active !== false;
  await syncModifierChoiceToMenuProjection(
    db,
    {
      id,
      group_id: groupId,
      name,
      price_delta: priceDelta,
      is_available: groupActive ? isAvailable : 0,
      tenant_id: groupTenant,
    },
    groupTenant
  );
  const choice = await db.prepare('SELECT * FROM modifier_choices WHERE id = ?').bind(id).first<ModifierChoice>();
  return c.json({ success: true, data: choice }, 201);
});

menuModifiersRouter.patch('/groups/:groupId/choices/:choiceId', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const { groupId, choiceId } = c.req.param();
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(groupId).first<Record<string, unknown>>().catch(() => null);
  if ((group && !matchesTenantRow(group, tenantId)) || (tenantId !== 'default' && !group)) {
    return c.json({ success: false, error: 'Modifier choice not found' }, 404);
  }
  const existing = await db.prepare(
    'SELECT id, name, price_delta, is_available, tenant_id FROM modifier_choices WHERE id = ? AND group_id = ?'
  ).bind(choiceId, groupId).first<{ id: string; name?: string; price_delta?: number; is_available?: number | boolean; tenant_id?: string }>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Modifier choice not found' }, 404);
  }

  const body = (await c.req.json()) as Record<string, unknown>;
  const name =
    body.name !== undefined && body.name !== null
      ? String(body.name).trim()
      : String(existing.name ?? '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const rawPriceDelta =
    body.price_delta !== undefined ? Number(body.price_delta) : Number(existing.price_delta);
  if (!Number.isInteger(rawPriceDelta) || rawPriceDelta < 0) {
    return c.json({ success: false, error: 'price_delta must be a non-negative integer in VND' }, 400);
  }
  const priceDelta = rawPriceDelta;
  const isAvailable =
    body.is_available !== undefined
      ? (body.is_available ? 1 : 0)
      : existing.is_available !== undefined
        ? (existing.is_available ? 1 : 0)
        : 1;

  const groupTenant =
    group && typeof group.tenant_id === 'string' && group.tenant_id.trim() && group.tenant_id.trim() !== '*' && group.tenant_id.trim().toLowerCase() !== 'hq'
      ? group.tenant_id.trim()
      : existing && typeof existing.tenant_id === 'string' && existing.tenant_id.trim() && existing.tenant_id.trim() !== '*' && existing.tenant_id.trim().toLowerCase() !== 'hq'
        ? existing.tenant_id.trim()
        : tenantId === '*'
          ? 'default'
          : tenantId;
  if (
    existing.tenant_id !== undefined &&
    existing.tenant_id !== null &&
    String(existing.tenant_id).trim() !== '' &&
    !matchesTenantRow(existing as unknown as Record<string, unknown>, groupTenant)
  ) {
    return c.json({ success: false, error: 'Modifier choice not found' }, 404);
  }
  try {
    await db.prepare(
      `UPDATE modifier_choices
       SET name = ?, price_delta = ?, is_available = ?
       WHERE id = ? AND group_id = ? AND (COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR tenant_id IS NULL)`
    ).bind(name, priceDelta, isAvailable, choiceId, groupId, groupTenant).run();
  } catch (err) {
    if (groupTenant !== 'default') throw err;
    try {
      await db.prepare(
        `UPDATE modifier_choices
         SET name = ?, price_delta = ?, is_available = ?
         WHERE id = ? AND group_id = ?`
      ).bind(name, priceDelta, isAvailable, choiceId, groupId).run();
    } catch {
      // Older databases predate the is_available column.
      await db.prepare(
        'UPDATE modifier_choices SET name = ?, price_delta = ? WHERE id = ? AND group_id = ?'
      ).bind(name, priceDelta, choiceId, groupId).run();
    }
  }
  const groupActive = !group || (group.is_active !== 0 && group.is_active !== false && group.active !== 0 && group.active !== false);
  // The projection is the customer-facing copy of this price; leaving it stale
  // makes the customer see one number while the server charges another.
  await syncModifierChoiceToMenuProjection(
    db,
    {
      id: choiceId,
      group_id: groupId,
      name,
      price_delta: priceDelta,
      is_available: groupActive ? isAvailable : 0,
      tenant_id: groupTenant,
    },
    groupTenant
  );

  const choice = await db.prepare('SELECT * FROM modifier_choices WHERE id = ?').bind(choiceId).first<ModifierChoice>();
  return c.json({ success: true, data: choice });
});

menuModifiersRouter.delete('/groups/:groupId/choices/:choiceId', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const { groupId, choiceId } = c.req.param();
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(groupId).first<Record<string, unknown>>().catch(() => null);
  if ((group && !matchesTenantRow(group, tenantId)) || (tenantId !== 'default' && !group)) {
    return c.json({ success: false, error: 'Modifier choice not found' }, 404);
  }
  const existing = await db.prepare(
    'SELECT id, tenant_id FROM modifier_choices WHERE id = ? AND group_id = ?'
  ).bind(choiceId, groupId).first<{ id: string; tenant_id?: string }>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Modifier choice not found' }, 404);
  }

  const groupTenant =
    group && typeof group.tenant_id === 'string' && group.tenant_id.trim() && group.tenant_id.trim() !== '*' && group.tenant_id.trim().toLowerCase() !== 'hq'
      ? group.tenant_id.trim()
      : existing && typeof existing.tenant_id === 'string' && existing.tenant_id.trim() && existing.tenant_id.trim() !== '*' && existing.tenant_id.trim().toLowerCase() !== 'hq'
        ? existing.tenant_id.trim()
        : tenantId === '*'
          ? 'default'
          : tenantId;
  if (
    existing.tenant_id !== undefined &&
    existing.tenant_id !== null &&
    String(existing.tenant_id).trim() !== '' &&
    !matchesTenantRow(existing as unknown as Record<string, unknown>, groupTenant)
  ) {
    return c.json({ success: false, error: 'Modifier choice not found' }, 404);
  }
  await db.prepare(
    "DELETE FROM modifier_choices WHERE id = ? AND group_id = ? AND (COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR tenant_id IS NULL)"
  ).bind(choiceId, groupId, groupTenant).run().catch(async (err) => {
    if (groupTenant !== 'default') throw err;
    await db.prepare('DELETE FROM modifier_choices WHERE id = ? AND group_id = ?').bind(choiceId, groupId).run();
  });
  // Retiring a choice must retire it on the customer side too, scoped to the verified group.
  await db
    .prepare("DELETE FROM menu_modifiers WHERE id = ? AND group_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
    .bind(choiceId, groupId, groupTenant)
    .run()
    .catch(async () => {
      if (groupTenant === 'default') {
        await db.prepare('DELETE FROM menu_modifiers WHERE id = ? AND group_id = ?').bind(choiceId, groupId).run();
      }
    });
  return c.json({ success: true });
});

// ── Product ↔ Modifier Group mapping ───────────────────────────────

async function shouldRequireProductRow(db: Env['AURA_DB'], tenantId: string): Promise<boolean> {
  if (tenantId !== 'default') return true;
  const hasTable = await db
    .prepare("SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'products'")
    .first<{ ok?: number }>()
    .catch(() => null);
  if (hasTable?.ok === 1) return true;
  const anyProd = await db
    .prepare('SELECT id FROM products LIMIT 1')
    .first<{ id?: string }>()
    .catch(() => null);
  return Boolean(anyProd?.id);
}

menuModifiersRouter.get('/products/:productId/groups', async (c) => {
  const scope = verifyModifierReadTenant(c);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const productId = c.req.param('productId');
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<Record<string, unknown>>().catch(() => null);
  if (
    (product && !matchesTenantRow(product, tenantId)) ||
    (!product && tenantId !== '*' && (await shouldRequireProductRow(db, tenantId)))
  ) {
    return c.json({ success: true, data: [] });
  }
  const { results } = await db.prepare(
    `SELECT pm.group_id, pm.sort_order, mg.*
     FROM product_modifier_groups pm
     JOIN modifier_groups mg ON mg.id = pm.group_id
     WHERE pm.product_id = ?
     ORDER BY pm.sort_order, mg.name`
  ).bind(productId).all<ModifierGroup & { group_id: string; sort_order: number }>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  return c.json({ success: true, data: filtered });
});

menuModifiersRouter.post('/products/:productId/groups', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const productId = c.req.param('productId');
  const body = (await c.req.json()) as Record<string, unknown>;
  const groupId = String(body.group_id || '').trim();
  if (!groupId) return c.json({ success: false, error: 'group_id is required' }, 400);
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<Record<string, unknown>>().catch(() => null);
  if (
    (product && !matchesTenantRow(product, tenantId)) ||
    (!product && (await shouldRequireProductRow(db, tenantId)))
  ) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  const productTenant = product && typeof product.tenant_id === 'string' && product.tenant_id.trim()
    ? product.tenant_id.trim()
    : (product && 'tenant_id' in product ? 'default' : tenantId);
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(groupId).first<Record<string, unknown>>();
  if (!group || !matchesTenantRow(group, tenantId) || (productTenant !== '*' && !matchesTenantRow(group, productTenant))) {
    return c.json({ success: false, error: 'Modifier group not found' }, 404);
  }
  const effectiveLinkTenant =
    typeof group.tenant_id === 'string' && group.tenant_id.trim()
      ? group.tenant_id.trim()
      : productTenant === '*'
        ? 'default'
        : productTenant;
  try {
    await db.prepare(
      'INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order, tenant_id) VALUES (?, ?, ?, ?)'
    ).bind(productId, groupId, Number(body.sort_order) || 0, effectiveLinkTenant).run();
  } catch (err) {
    if (effectiveLinkTenant !== 'default') throw err;
    await db.prepare(
      'INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order) VALUES (?, ?, ?)'
    ).bind(productId, groupId, Number(body.sort_order) || 0).run();
  }
  return c.json({ success: true });
});

menuModifiersRouter.delete('/products/:productId/groups/:groupId', staffAuth, async (c) => {
  const scope = verifyModifierWriteTenant(c, true);
  if (!scope.ok) return c.json({ success: false, error: scope.error }, scope.status);
  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;
  const productId = c.req.param('productId');
  const groupId = c.req.param('groupId');
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<Record<string, unknown>>().catch(() => null);
  if (
    (product && !matchesTenantRow(product, tenantId)) ||
    (!product && (await shouldRequireProductRow(db, tenantId)))
  ) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }
  const productTenant = product && typeof product.tenant_id === 'string' && product.tenant_id.trim()
    ? product.tenant_id.trim()
    : (product && 'tenant_id' in product ? 'default' : tenantId);
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(groupId).first<Record<string, unknown>>().catch(() => null);
  if (
    (group && !matchesTenantRow(group, tenantId)) ||
    (tenantId !== 'default' && !group) ||
    (group && productTenant !== '*' && !matchesTenantRow(group, productTenant))
  ) {
    return c.json({ success: false, error: 'Modifier group not found' }, 404);
  }
  const effectiveLinkTenant =
    group && typeof group.tenant_id === 'string' && group.tenant_id.trim() && group.tenant_id.trim() !== '*' && group.tenant_id.trim().toLowerCase() !== 'hq'
      ? group.tenant_id.trim()
      : productTenant === '*'
        ? 'default'
        : productTenant;
  await db.prepare(
    "DELETE FROM product_modifier_groups WHERE product_id = ? AND group_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
  ).bind(productId, groupId, effectiveLinkTenant).run().catch(async (err) => {
    if (effectiveLinkTenant !== 'default') throw err;
    await db.prepare(
      'DELETE FROM product_modifier_groups WHERE product_id = ? AND group_id = ?'
    ).bind(productId, groupId).run();
  });
  return c.json({ success: true });
});

// Mount happy hour sub-router to maintain backwards-compatible paths
menuModifiersRouter.route('/', happyHourRouter);
