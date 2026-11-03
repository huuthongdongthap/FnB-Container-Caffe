// Plan CRUD handlers extracted from routes/subscriptions.ts

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { PlanRecord } from './types';
import { requireAdmin } from './middleware';
import { generateId, nowStr } from './helpers';
import { createPlanSchema, updatePlanSchema } from '../../lib/validators';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { resolvePublicTenantId } from '../../middleware/tenant';

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

function resolveCatalogTenantId(c: Context<{ Bindings: Env }>): string {
  const hasAuthenticatedUser = typeof c.get === 'function' && Boolean(c.get('user' as never));
  if (hasAuthenticatedUser) {
    return getTenantId(c).trim() || 'default';
  }
  return resolvePublicTenantId(c);
}

export async function listPlans(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const tenantId = resolveCatalogTenantId(c);
  const wantsAll = c.req.query('all') === '1';
  const includeInactive = wantsAll ? (await requireAdmin(c)) === null : false;

  let query = 'SELECT * FROM subscription_plans';
  if (!includeInactive) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY sort_order ASC, monthly_price_vnd ASC';

  try {
    const plans = await db.prepare(query).all<PlanRecord>();
    const allRows = plans.results || [];
    const tenantRows = allRows.filter((p) =>
      matchesTenantRow(p as unknown as Record<string, unknown>, tenantId)
    );
    const effectiveRows =
      tenantRows.length > 0 || tenantId === 'default' || includeInactive
        ? tenantRows
        : allRows.filter((p) =>
            matchesTenantRow(p as unknown as Record<string, unknown>, 'default')
          );
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
  const db = c.env.AURA_DB;
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
    (isActive && matchesTenantRow(planRow, 'default'));
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
  const body = await c.req.json();
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }

  const id = generateId('plan_');
  const nowIso = nowStr();

  try {
    await db.prepare(
      `INSERT INTO subscription_plans (id, name, slug, description, container_size,
       monthly_price_vnd, deposit_vnd, features, max_occupants, is_popular, is_active, sort_order, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.name, body.slug, body.description || '', body.container_size || '20ft',
      body.monthly_price_vnd, body.deposit_vnd || 0, JSON.stringify(body.features || []),
      body.max_occupants || 1, body.is_popular ? 1 : 0,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      body.sort_order || 0, tenantId, nowIso, nowIso
    ).run();
  } catch {
    await db.prepare(
      `INSERT INTO subscription_plans (id, name, slug, description, container_size,
       monthly_price_vnd, deposit_vnd, features, max_occupants, is_popular, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.name, body.slug, body.description || '', body.container_size || '20ft',
      body.monthly_price_vnd, body.deposit_vnd || 0, JSON.stringify(body.features || []),
      body.max_occupants || 1, body.is_popular ? 1 : 0,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      body.sort_order || 0, nowIso, nowIso
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
  const body = await c.req.json();
  const parsed = updatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }

  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Plan not found' }, 404);
  }

  const nextFeatures = JSON.stringify(body.features ?? parsePlanFeatures(existing.features));
  const updatedAt = nowStr();
  try {
    await db.prepare(
      `UPDATE subscription_plans SET name=?, slug=?, description=?, container_size=?,
       monthly_price_vnd=?, deposit_vnd=?, features=?, max_occupants=?, is_popular=?, is_active=?, sort_order=?, updated_at=?
       WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
    ).bind(
      body.name ?? existing.name, body.slug ?? existing.slug, body.description ?? existing.description,
      body.container_size ?? existing.container_size, body.monthly_price_vnd ?? existing.monthly_price_vnd,
      body.deposit_vnd ?? existing.deposit_vnd,
      nextFeatures,
      body.max_occupants ?? existing.max_occupants,
      body.is_popular !== undefined ? (body.is_popular ? 1 : 0) : existing.is_popular,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      body.sort_order ?? existing.sort_order, updatedAt, id, tenantId, tenantId
    ).run();
  } catch {
    await db.prepare(
      `UPDATE subscription_plans SET name=?, slug=?, description=?, container_size=?,
       monthly_price_vnd=?, deposit_vnd=?, features=?, max_occupants=?, is_popular=?, is_active=?, sort_order=?, updated_at=?
       WHERE id = ?`
    ).bind(
      body.name ?? existing.name, body.slug ?? existing.slug, body.description ?? existing.description,
      body.container_size ?? existing.container_size, body.monthly_price_vnd ?? existing.monthly_price_vnd,
      body.deposit_vnd ?? existing.deposit_vnd,
      nextFeatures,
      body.max_occupants ?? existing.max_occupants,
      body.is_popular !== undefined ? (body.is_popular ? 1 : 0) : existing.is_popular,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      body.sort_order ?? existing.sort_order, updatedAt, id
    ).run();
  }

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  return c.json({ success: true, data: { ...plan, features: parsePlanFeatures(plan?.features) } });
}
