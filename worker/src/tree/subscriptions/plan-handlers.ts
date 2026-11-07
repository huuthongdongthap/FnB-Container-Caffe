// Plan CRUD handlers extracted from routes/subscriptions.ts

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { PlanRecord } from './types';
import {
  getSubscriptionTenantCandidates,
  hasConflictingSubscriptionTenantOverride,
  hasForbiddenCatalogTenantOverride,
  requireAdmin,
  requireVendor,
} from './auth-helpers';
import { generateId, nowStr } from './helpers';
import { createPlanSchema, updatePlanSchema } from '../../lib/validators';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';

function parsePlanFeatures(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializePlanFeatures(raw: unknown): string {
  if (typeof raw === 'string') {
    return JSON.stringify(parsePlanFeatures(raw));
  }
  if (Array.isArray(raw)) {
    return JSON.stringify(raw);
  }
  return '[]';
}

function resolveCatalogTenantId(c: Context<{ Bindings: Env }>): string {
  const user = typeof c.get === 'function'
    ? (c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined)
    : undefined;
  if (user) {
    if (isHQSuperAdmin(user)) {
      const { allCandidates } = getSubscriptionTenantCandidates(c);
      const target = allCandidates[0] || getTenantId(c).trim() || '*';
      return target.toLowerCase() === 'hq' ? '*' : target;
    }
    const rawTenant = getTenantId(c).trim() || 'default';
    return rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? 'default' : rawTenant;
  }
  return resolvePublicTenantId(c);
}

export async function listPlans(c: Context<{ Bindings: Env }>) {
  if (hasConflictingSubscriptionTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const wantsAll = c.req.query('all') === '1';
  let includeInactive = false;
  if (wantsAll) {
    includeInactive = (await requireAdmin(c)) === null;
  } else if (
    !(typeof c.get === 'function' && c.get('user' as never)) &&
    (c.req.header?.('Authorization') || c.req.header?.('authorization'))
  ) {
    try {
      await requireVendor(c);
    } catch {
      // Best-effort auth population
    }
  }
  if (hasForbiddenCatalogTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const tenantId = resolveCatalogTenantId(c);

  let query = 'SELECT * FROM subscription_plans';
  if (!includeInactive) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY sort_order ASC, monthly_price_vnd ASC LIMIT 200';

  try {
    const plans = await db.prepare(query).all<PlanRecord>();
    const allRows = plans.results || [];
    const tenantRows = allRows.filter((p) =>
      matchesTenantRow(p as unknown as Record<string, unknown>, tenantId)
    );
    const effectiveRows =
      tenantRows.length > 0 || tenantId === 'default' || tenantId === '*' || includeInactive
        ? tenantRows
        : c.req.path === '/api/subscriptions/plans'
          ? allRows.filter(
              (p) =>
                matchesTenantRow(p as unknown as Record<string, unknown>, 'default') &&
                Boolean((p as unknown as Record<string, unknown>).container_size)
            )
          : [];
    const results = effectiveRows.map((p) => ({
      ...p,
      features: parsePlanFeatures(p.features),
    }));
    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
}

export async function getPlan(c: Context<{ Bindings: Env }>) {
  if (hasConflictingSubscriptionTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  if (
    !(typeof c.get === 'function' && c.get('user' as never)) &&
    (c.req.header('Authorization') || c.req.header('authorization'))
  ) {
    try {
      await requireVendor(c);
    } catch {
      // Handled when plan is inactive
    }
  }
  if (hasForbiddenCatalogTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const tenantId = resolveCatalogTenantId(c);
  const plan = await db.prepare(
    'SELECT * FROM subscription_plans WHERE id = ?'
  ).bind(c.req.param('id')).first<PlanRecord>();

  if (!plan) {
    return c.json({ success: false, error: 'Plan not found' }, 404);
  }
  const planRow = plan as unknown as Record<string, unknown>;
  const isActive = Number(plan.is_active ?? 1) !== 0;
  const matchesTenant =
    matchesTenantRow(planRow, tenantId) ||
    ((tenantId === 'default' || tenantId === '*') && isActive && matchesTenantRow(planRow, 'default'));
  if (!matchesTenant) {
    return c.json({ success: false, error: 'Plan not found' }, 404);
  }
  if (!isActive) {
    const adminErr = await requireAdmin(c);
    if (adminErr) {
      return c.json({ success: false, error: 'Plan not found' }, 404);
    }
  }
  return c.json({ success: true, data: { ...plan, features: parsePlanFeatures(plan.features) } });
}

export async function createPlan(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const rawTenantId = getTenantId(c).trim();
  const tenantId = !rawTenantId || rawTenantId === '*' ? 'default' : rawTenantId;
  const body = await c.req.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }

  const data = parsed.data;
  const id = generateId('plan_');
  const nowIso = nowStr();
  const slug =
    typeof data.slug === 'string' && data.slug.trim()
      ? data.slug.trim()
      : data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const description = data.description ?? '';
  const containerSize = data.container_size || '20ft';
  const monthlyPriceVnd = data.monthly_price_vnd ?? data.price ?? 0;
  const depositVnd = data.deposit_vnd ?? 0;
  const featuresJson = serializePlanFeatures(data.features);
  const maxOccupants = data.max_occupants ?? 1;
  const isPopular = data.is_popular ? 1 : 0;
  const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1;
  const sortOrder = data.sort_order ?? 0;

  try {
    await db.prepare(
      `INSERT INTO subscription_plans (id, name, slug, description, container_size,
       monthly_price_vnd, deposit_vnd, features, max_occupants, is_popular, is_active, sort_order, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.name, slug, description, containerSize,
      monthlyPriceVnd, depositVnd, featuresJson,
      maxOccupants, isPopular, isActive,
      sortOrder, tenantId, nowIso, nowIso
    ).run();
  } catch (err) {
    if (tenantId !== 'default') {
      return c.json({ success: false, error: 'Tenant-scoped plan creation failed', detail: (err as Error).message }, 500);
    }
    await db.prepare(
      `INSERT INTO subscription_plans (id, name, slug, description, container_size,
       monthly_price_vnd, deposit_vnd, features, max_occupants, is_popular, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, data.name, slug, description, containerSize,
      monthlyPriceVnd, depositVnd, featuresJson,
      maxOccupants, isPopular, isActive,
      sortOrder, nowIso, nowIso
    ).run();
  }

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  return c.json({ success: true, data: { ...plan, features: parsePlanFeatures(plan?.features) } }, 201);
}

export async function updatePlan(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const body = await c.req.json().catch(() => null);
  const parsed = updatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }

  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Plan not found' }, 404);
  }

  const data = parsed.data;
  const nextFeatures =
    data.features !== undefined
      ? serializePlanFeatures(data.features)
      : JSON.stringify(parsePlanFeatures(existing.features));
  const nextMonthlyPrice = data.monthly_price_vnd ?? data.price ?? existing.monthly_price_vnd;
  const updatedAt = nowStr();
  try {
    await db.prepare(
      `UPDATE subscription_plans SET name=?, slug=?, description=?, container_size=?,
       monthly_price_vnd=?, deposit_vnd=?, features=?, max_occupants=?, is_popular=?, is_active=?, sort_order=?, updated_at=?
       WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
    ).bind(
      data.name ?? existing.name, data.slug ?? existing.slug, data.description ?? existing.description,
      data.container_size ?? existing.container_size, nextMonthlyPrice,
      data.deposit_vnd ?? existing.deposit_vnd,
      nextFeatures,
      data.max_occupants ?? existing.max_occupants,
      data.is_popular !== undefined ? (data.is_popular ? 1 : 0) : existing.is_popular,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active,
      data.sort_order ?? existing.sort_order, updatedAt, id, tenantId, tenantId
    ).run();
  } catch (err) {
    if (tenantId !== 'default' && tenantId !== '*') {
      return c.json({ success: false, error: 'Tenant-scoped plan update failed', detail: (err as Error).message }, 500);
    }
    await db.prepare(
      `UPDATE subscription_plans SET name=?, slug=?, description=?, container_size=?,
       monthly_price_vnd=?, deposit_vnd=?, features=?, max_occupants=?, is_popular=?, is_active=?, sort_order=?, updated_at=?
       WHERE id = ?`
    ).bind(
      data.name ?? existing.name, data.slug ?? existing.slug, data.description ?? existing.description,
      data.container_size ?? existing.container_size, nextMonthlyPrice,
      data.deposit_vnd ?? existing.deposit_vnd,
      nextFeatures,
      data.max_occupants ?? existing.max_occupants,
      data.is_popular !== undefined ? (data.is_popular ? 1 : 0) : existing.is_popular,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active,
      data.sort_order ?? existing.sort_order, updatedAt, id
    ).run();
  }

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  return c.json({ success: true, data: { ...plan, features: parsePlanFeatures(plan?.features) } });
}
