/**
 * Happy Hour Commands & Routes — /happy-hour
 * Evaluated at order time to apply the best-matching discount window.
 */

import { Hono } from 'hono';
import { requireAuth } from 'worker/src/middleware/auth';
import type { Env } from 'worker/src/types/env';
import type { HappyHourWindow } from '../model/catalog-types';
import { happyHourDiscountFor } from '../policies/pricing';

export const happyHourRouter = new Hono<{ Bindings: Env }>();
const staffAuth = requireAuth(['owner', 'manager', 'staff', 'admin']);

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
  const db = c.env.AURA_DB;
  const onlyActive = c.req.query('active') !== 'false';
  let query = 'SELECT * FROM happy_hour_windows WHERE 1=1';
  if (onlyActive) query += ' AND active = 1';
  query += ' ORDER BY priority DESC, day_of_week, start_time';
  const { results } = await db.prepare(query).all<HappyHourWindow>();
  return c.json({ success: true, data: results });
});

happyHourRouter.post('/happy-hour', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
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
  if (isNaN(discountRate) || discountRate < 0 || discountRate > 1) {
    return c.json({ success: false, error: 'discount_rate must be 0-1' }, 400);
  }
  const id = makeId('HH');
  const now = new Date().toISOString();
  const applyTo = String(body.apply_to || 'all');
  const applyIds = body.apply_ids != null
    ? (typeof body.apply_ids === 'string' ? body.apply_ids : JSON.stringify(body.apply_ids))
    : null;
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

happyHourRouter.patch('/happy-hour/:id', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT id FROM happy_hour_windows WHERE id = ?').bind(id).first<{ id: string }>();
  if (!existing) return c.json({ success: false, error: 'Happy hour window not found' }, 404);
  const body = (await c.req.json()) as Record<string, unknown>;
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
    body.start_time ? padHHMM(String(body.start_time)) : null,
    body.end_time ? padHHMM(String(body.end_time)) : null,
    body.discount_rate != null ? Number(body.discount_rate) : null,
    body.apply_to ? String(body.apply_to) : null,
    body.apply_ids != null ? (typeof body.apply_ids === 'string' ? body.apply_ids : JSON.stringify(body.apply_ids)) : null,
    body.priority != null ? Number(body.priority) : null,
    body.active != null ? (typeof body.active === 'boolean' ? (body.active ? 1 : 0) : Number(body.active)) : null,
    now, id
  ).run();
  const win = await db.prepare('SELECT * FROM happy_hour_windows WHERE id = ?').bind(id).first<HappyHourWindow>();
  return c.json({ success: true, data: win });
});

happyHourRouter.delete('/happy-hour/:id', staffAuth, async (c) => {
  const db = c.env.AURA_DB;
  const existing = await db.prepare('SELECT id FROM happy_hour_windows WHERE id = ?').bind(c.req.param('id')).first<{ id: string }>();
  if (!existing) return c.json({ success: false, error: 'Happy hour window not found' }, 404);
  await db.prepare('DELETE FROM happy_hour_windows WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// ── Happy hour evaluation (public, no auth) ────────────────────────
happyHourRouter.get('/happy-hour/now', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare(
    'SELECT * FROM happy_hour_windows WHERE active = 1'
  ).all<HappyHourWindow>();
  const productId = c.req.query('product_id') || c.req.query('productId') || null;
  let categoryId = c.req.query('category_id') || c.req.query('categoryId') || null;
  if (productId && !categoryId) {
    try {
      const prod = await db.prepare('SELECT category_id FROM products WHERE id = ?')
        .bind(productId)
        .first<{ category_id?: string; category?: string }>();
      categoryId = prod?.category_id || prod?.category || null;
    } catch {
      // Optional category lookup when only product_id is passed
    }
    if (!categoryId) {
      try {
        const menuRow = await db.prepare('SELECT id, name, price, category AS category_id FROM menu_items WHERE id = ?')
          .bind(productId)
          .first<{ id?: string; category_id?: string; category?: string }>();
        categoryId = menuRow?.category_id || menuRow?.category || null;
        if (!categoryId) {
          const { results: menuItems } = await db.prepare(
            'SELECT id, name, price, category AS category_id FROM menu_items WHERE available = 1'
          ).all<{ id: string; category_id?: string; category?: string }>();
          const matched = (menuItems || []).find((m) => m.id === productId);
          categoryId = matched?.category_id || matched?.category || null;
        }
      } catch {
        // Optional menu_items fallback
      }
    }
  }
  const win = happyHourDiscountFor(results, new Date(), {
    productId,
    categoryId,
  });
  return c.json({ success: true, data: win });
});
