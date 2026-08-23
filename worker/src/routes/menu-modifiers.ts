/**
 * Menu Modifiers + Happy Hour Routes — /api/menu-modifiers, /api/happy-hour
 *
 * F&B Gap 2.2/2.3: item modifiers (sugar/ice/size, add-ons) and
 * time-based pricing windows. Modifiers are per-product option groups;
 * each choice carries an optional price delta. Happy-hour windows are
 * evaluated at order time and the best-matching discount is applied.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import { zodErrorResponse } from '../lib/validators';

export interface ModifierGroup {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ModifierChoice {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_default: number;
  sort_order: number;
}

export interface ProductModifierGroup {
  product_id: string;
  group_id: string;
  sort_order: number;
}

export interface HappyHourWindow {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  discount_rate: number;
  apply_to: string;
  apply_ids: string | null;
  priority: number;
  active: number;
  created_at: string;
  updated_at: string;
}

const menuModifiersRouter = new Hono<{ Bindings: Env }>();

function makeId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${rand}`.toUpperCase();
}

// ── Modifier Groups ────────────────────────────────────────────────

menuModifiersRouter.get('/groups', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare(
    'SELECT * FROM modifier_groups ORDER BY sort_order, name'
  ).all<ModifierGroup>();
  return c.json({ success: true, data: results });
});

menuModifiersRouter.post('/groups', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const type = body.type === 'multiple' ? 'multiple' : 'single';
  const required = body.required ? 1 : 0;
  const id = makeId('MG');
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO modifier_groups (id, name, type, required, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, name, type, required, Number(body.sort_order) || 0, now, now).run();
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(id).first<ModifierGroup>();
  return c.json({ success: true, data: group }, 201);
});

menuModifiersRouter.delete('/groups/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT id FROM modifier_groups WHERE id = ?').bind(id).first<{ id: string }>();
  if (!existing) return c.json({ success: false, error: 'Modifier group not found' }, 404);
  await db.prepare('DELETE FROM modifier_groups WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ── Modifier Choices ───────────────────────────────────────────────

menuModifiersRouter.get('/groups/:groupId/choices', async (c) => {
  const db = c.env.AURA_DB;
  const groupId = c.req.param('groupId');
  const { results } = await db.prepare(
    'SELECT * FROM modifier_choices WHERE group_id = ? ORDER BY sort_order, name'
  ).bind(groupId).all<ModifierChoice>();
  return c.json({ success: true, data: results });
});

menuModifiersRouter.post('/groups/:groupId/choices', async (c) => {
  const db = c.env.AURA_DB;
  const groupId = c.req.param('groupId');
  const group = await db.prepare('SELECT id FROM modifier_groups WHERE id = ?').bind(groupId).first<{ id: string }>();
  if (!group) return c.json({ success: false, error: 'Modifier group not found' }, 404);
  const body = await c.req.json() as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const id = makeId('MC');
  await db.prepare(
    `INSERT INTO modifier_choices (id, group_id, name, price_delta, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    id, groupId, name,
    Number(body.price_delta) || 0,
    body.is_default ? 1 : 0,
    Number(body.sort_order) || 0
  ).run();
  const choice = await db.prepare('SELECT * FROM modifier_choices WHERE id = ?').bind(id).first<ModifierChoice>();
  return c.json({ success: true, data: choice }, 201);
});

// ── Product ↔ Modifier Group mapping ───────────────────────────────

menuModifiersRouter.get('/products/:productId/groups', async (c) => {
  const db = c.env.AURA_DB;
  const productId = c.req.param('productId');
  const { results } = await db.prepare(
    `SELECT pm.group_id, pm.sort_order, mg.name, mg.type, mg.required
     FROM product_modifier_groups pm
     JOIN modifier_groups mg ON mg.id = pm.group_id
     WHERE pm.product_id = ?
     ORDER BY pm.sort_order, mg.name`
  ).bind(productId).all<ModifierGroup & { group_id: string; sort_order: number }>();
  return c.json({ success: true, data: results });
});

menuModifiersRouter.post('/products/:productId/groups', async (c) => {
  const db = c.env.AURA_DB;
  const productId = c.req.param('productId');
  const body = await c.req.json() as Record<string, unknown>;
  const groupId = String(body.group_id || '').trim();
  if (!groupId) return c.json({ success: false, error: 'group_id is required' }, 400);
  const group = await db.prepare('SELECT id FROM modifier_groups WHERE id = ?').bind(groupId).first<{ id: string }>();
  if (!group) return c.json({ success: false, error: 'Modifier group not found' }, 404);
  await db.prepare(
    'INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order) VALUES (?, ?, ?)'
  ).bind(productId, groupId, Number(body.sort_order) || 0).run();
  return c.json({ success: true });
});

menuModifiersRouter.delete('/products/:productId/groups/:groupId', async (c) => {
  const db = c.env.AURA_DB;
  await db.prepare(
    'DELETE FROM product_modifier_groups WHERE product_id = ? AND group_id = ?'
  ).bind(c.req.param('productId'), c.req.param('groupId')).run();
  return c.json({ success: true });
});

// ── Happy Hour ─────────────────────────────────────────────────────

menuModifiersRouter.get('/happy-hour', async (c) => {
  const db = c.env.AURA_DB;
  const onlyActive = c.req.query('active') !== 'false';
  let query = 'SELECT * FROM happy_hour_windows WHERE 1=1';
  if (onlyActive) query += ' AND active = 1';
  query += ' ORDER BY priority DESC, day_of_week, start_time';
  const { results } = await db.prepare(query).all<HappyHourWindow>();
  return c.json({ success: true, data: results });
});

menuModifiersRouter.post('/happy-hour', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const dayOfWeek = Number(body.day_of_week);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return c.json({ success: false, error: 'day_of_week must be 0-6' }, 400);
  }
  const startTime = String(body.start_time || '').trim();
  const endTime = String(body.end_time || '').trim();
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    return c.json({ success: false, error: 'start_time/end_time must be HH:MM' }, 400);
  }
  const discountRate = Number(body.discount_rate);
  if (isNaN(discountRate) || discountRate < 0 || discountRate > 1) {
    return c.json({ success: false, error: 'discount_rate must be 0-1' }, 400);
  }
  const id = makeId('HH');
  const now = new Date().toISOString();
  const applyTo = String(body.apply_to || 'all');
  const applyIds = body.apply_ids ? JSON.stringify(body.apply_ids) : null;
  await db.prepare(
    `INSERT INTO happy_hour_windows (id, name, day_of_week, start_time, end_time, discount_rate, apply_to, apply_ids, priority, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, name, dayOfWeek, startTime, endTime, discountRate, applyTo, applyIds,
    Number(body.priority) || 0, body.active === false ? 0 : 1, now, now
  ).run();
  const win = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<HappyHourWindow>();
  return c.json({ success: true, data: win }, 201);
});

menuModifiersRouter.patch('/happy-hour/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<HappyHourWindow>();
  if (!existing) return c.json({ success: false, error: 'Happy hour window not found' }, 404);
  const body = await c.req.json() as Record<string, unknown>;
  const now = new Date().toISOString();
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
  ).bind(
    body.name ? String(body.name) : null,
    body.day_of_week != null ? Number(body.day_of_week) : null,
    body.start_time ? String(body.start_time) : null,
    body.end_time ? String(body.end_time) : null,
    body.discount_rate != null ? Number(body.discount_rate) : null,
    body.apply_to ? String(body.apply_to) : null,
    body.apply_ids != null ? JSON.stringify(body.apply_ids) : null,
    body.priority != null ? Number(body.priority) : null,
    body.active != null ? Number(body.active) : null,
    now, id
  ).run();
  const win = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<HappyHourWindow>();
  return c.json({ success: true, data: win });
});

menuModifiersRouter.delete('/happy-hour/:id', async (c) => {
  const db = c.env.AURA_DB;
  const existing = await db.prepare('SELECT id FROM happy_hour_windows WHERE id = ?').bind(c.req.param('id')).first<{ id: string }>();
  if (!existing) return c.json({ success: false, error: 'Happy hour window not found' }, 404);
  await db.prepare('DELETE FROM happy_hour_windows WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// ── Happy hour evaluation (public, no auth) ────────────────────────
// Returns the best-matching active discount for the current time, or null.

menuModifiersRouter.get('/happy-hour/now', async (c) => {
  const db = c.env.AURA_DB;
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const { results } = await db.prepare(
    `SELECT * FROM happy_hour_windows
     WHERE active = 1 AND day_of_week = ?
       AND start_time <= end_time AND ? >= start_time AND ? < end_time
     ORDER BY priority DESC, discount_rate DESC LIMIT 1`
  ).bind(dayOfWeek, currentTime, currentTime).all<HappyHourWindow>();
  const win = results[0] || null;
  return c.json({ success: true, data: win });
});

export { menuModifiersRouter };
