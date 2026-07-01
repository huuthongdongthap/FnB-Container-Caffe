// Plan CRUD handlers extracted from routes/subscriptions.ts

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { PlanRecord } from './types';
import { requireAdmin } from './middleware';
import { generateId, nowStr } from './helpers';
import { createPlanSchema, updatePlanSchema } from '../../lib/validators';

export async function listPlans(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const includeInactive = c.req.query('all') === '1';

  let query = 'SELECT * FROM subscription_plans';
  if (!includeInactive) query += ' WHERE is_active = 1';
  query += ' ORDER BY sort_order ASC, monthly_price_vnd ASC';

  const plans = await db.prepare(query).all<PlanRecord>();
  const results = (plans.results || []).map(p => ({
    ...p,
    features: p.features ? JSON.parse(p.features) : [],
  }));
  return c.json({ success: true, data: results });
}

export async function getPlan(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const plan = await db.prepare(
    'SELECT * FROM subscription_plans WHERE id = ?'
  ).bind(c.req.param('id')).first<PlanRecord>();

  if (!plan) return c.json({ success: false, error: 'Plan not found' }, 404);
  return c.json({ success: true, data: { ...plan, features: plan.features ? JSON.parse(plan.features) : [] } });
}

export async function createPlan(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) return adminErr;

  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);

  const id = generateId('plan_');
  const nowIso = nowStr();

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

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  return c.json({ success: true, data: { ...plan, features: plan?.features ? JSON.parse(plan.features) : [] } }, 201);
}

export async function updatePlan(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) return adminErr;

  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const parsed = updatePlanSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);

  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  if (!existing) return c.json({ success: false, error: 'Plan not found' }, 404);

  await db.prepare(
    `UPDATE subscription_plans SET name=?, slug=?, description=?, container_size=?,
     monthly_price_vnd=?, deposit_vnd=?, features=?, max_occupants=?, is_popular=?, is_active=?, sort_order=?, updated_at=?
     WHERE id = ?`
  ).bind(
    body.name ?? existing.name, body.slug ?? existing.slug, body.description ?? existing.description,
    body.container_size ?? existing.container_size, body.monthly_price_vnd ?? existing.monthly_price_vnd,
    body.deposit_vnd ?? existing.deposit_vnd,
    JSON.stringify(body.features ?? JSON.parse(existing.features || '[]')),
    body.max_occupants ?? existing.max_occupants,
    body.is_popular !== undefined ? (body.is_popular ? 1 : 0) : existing.is_popular,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
    body.sort_order ?? existing.sort_order, nowStr(), id
  ).run();

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<PlanRecord>();
  return c.json({ success: true, data: { ...plan, features: plan?.features ? JSON.parse(plan.features) : [] } });
}
