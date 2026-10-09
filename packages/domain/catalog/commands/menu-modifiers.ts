/**
 * Menu Modifiers Commands — /api/menu-modifiers
 * Item modifiers (sugar/ice/size, add-ons) and product-group mappings.
 */

import { Hono } from 'hono';
import { requireAuth } from 'worker/src/middleware/auth';
import type { Env } from 'worker/src/types/env';
import type { ModifierGroup, ModifierChoice } from '../model/catalog-types';
import { happyHourRouter } from './happy-hour';

export const menuModifiersRouter = new Hono<{ Bindings: Env }>();
const staffAuth = requireAuth(['owner', 'manager', 'staff']);

function makeId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
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

menuModifiersRouter.post('/groups', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const body = (await c.req.json()) as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const type = body.type === 'multiple' ? 'multiple' : 'single';
  const required = body.required ? 1 : 0;
  const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
  const id = makeId('MG');
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO modifier_groups (id, name, type, required, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, name, type, required, Number(body.sort_order) || 0, isActive, now, now).run();
  const group = await db.prepare('SELECT * FROM modifier_groups WHERE id = ?').bind(id).first<ModifierGroup>();
  return c.json({ success: true, data: group }, 201);
});

menuModifiersRouter.delete('/groups/:id', staffAuth, async (c) => {
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

menuModifiersRouter.post('/groups/:groupId/choices', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const groupId = c.req.param('groupId');
  const group = await db.prepare('SELECT id FROM modifier_groups WHERE id = ?').bind(groupId).first<{ id: string }>();
  if (!group) return c.json({ success: false, error: 'Modifier group not found' }, 404);
  const body = (await c.req.json()) as Record<string, unknown>;
  const name = String(body.name || '').trim();
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const id = makeId('MC');
  const isAvailable = body.is_available !== undefined ? (body.is_available ? 1 : 0) : 1;
  await db.prepare(
    `INSERT INTO modifier_choices (id, group_id, name, price_delta, is_default, sort_order, is_available)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, groupId, name,
    Number(body.price_delta) || 0,
    body.is_default ? 1 : 0,
    Number(body.sort_order) || 0,
    isAvailable
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

menuModifiersRouter.post('/products/:productId/groups', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const productId = c.req.param('productId');
  const body = (await c.req.json()) as Record<string, unknown>;
  const groupId = String(body.group_id || '').trim();
  if (!groupId) return c.json({ success: false, error: 'group_id is required' }, 400);
  const group = await db.prepare('SELECT id FROM modifier_groups WHERE id = ?').bind(groupId).first<{ id: string }>();
  if (!group) return c.json({ success: false, error: 'Modifier group not found' }, 404);
  await db.prepare(
    'INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order) VALUES (?, ?, ?)'
  ).bind(productId, groupId, Number(body.sort_order) || 0).run();
  return c.json({ success: true });
});

menuModifiersRouter.delete('/products/:productId/groups/:groupId', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  await db.prepare(
    'DELETE FROM product_modifier_groups WHERE product_id = ? AND group_id = ?'
  ).bind(c.req.param('productId'), c.req.param('groupId')).run();
  return c.json({ success: true });
});

// Mount happy hour sub-router to maintain backwards-compatible paths
menuModifiersRouter.route('/', happyHourRouter);
