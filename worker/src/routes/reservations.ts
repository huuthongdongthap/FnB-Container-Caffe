/**
 * Reservations Routes - /api/reservations
 * Converted from routes/reservations.js with TypeScript.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { reservationSchema } from '../lib/validators';
import type { Env } from '../types/env';

export const reservationsRouter = new Hono<{ Bindings: Env }>();

async function checkRateLimit(c: { env: Env; req: { header: (n: string) => string | undefined } }, key: string, max = 5, windowSec = 3600): Promise<boolean> {
  const kv = c.env.AUTH_KV;
  if (!kv) { return true; }
  const cur = parseInt(await kv.get(key) || '0', 10);
  if (cur >= max) { return false; }
  await kv.put(key, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

reservationsRouter.get('/availability', async (c) => {
  const db = c.env.AURA_DB;
  const date = c.req.query('date');
  const time = c.req.query('time');

  if (!date) { return c.json({ success: false, error: 'date is required' }, 400); }

  const { results: tables } = await db.prepare(
    'SELECT * FROM cafe_tables ORDER BY zone ASC, table_number ASC'
  ).all<Record<string, unknown>>();

  let query = 'SELECT table_id, time FROM reservations WHERE date = ? AND status = \'confirmed\'';
  const params: unknown[] = [date];
  if (time) {
    query += ' AND time = ?';
    params.push(time);
  }

  const { results: reservations } = await db.prepare(query).bind(...params).all<{ table_id: string }>();

  const bookedIds = new Set(reservations.map(r => r.table_id));
  const data = tables.map(t => ({ ...t, available: !bookedIds.has(t.id as string) }));

  return c.json({ success: true, data });
});

reservationsRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const allowed = await checkRateLimit(c, `rl:rsv:${ip}`, 5, 3600);
  if (!allowed) {
    return c.json({ success: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' }, 429);
  }

  const body = await c.req.json() as Record<string, unknown>;
  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const { table_id, customer_name, customer_phone, date, time, notes, guest_count } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    return c.json({ success: false, error: 'Không thể đặt bàn cho ngày trong quá khứ' }, 400);
  }
  const guests = guest_count || 2;

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(table_id).first<Record<string, unknown>>();
  if (!table) { return c.json({ success: false, error: 'Table not found' }, 404); }

  const existing = await db.prepare(
    'SELECT id FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status = \'confirmed\''
  ).bind(table_id, date, time).first<{ id: string }>();
  if (existing) {
    return c.json({ success: false, error: 'Table already reserved for this time slot' }, 409);
  }

  const id = `rsv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
  `).bind(id, table_id, customer_name, customer_phone, guests, date, time, (table.zone as string) || '', String(notes || '').slice(0, 500), now, now).run();

  await db.prepare('UPDATE cafe_tables SET status = \'Reserved\' WHERE id = ?').bind(table_id).run();

  return c.json({
    success: true,
    data: { id, table_id, table_number: table.table_number, zone: table.zone, date, time, guest_count: guests },
  }, 201);
});

reservationsRouter.get('/', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const date = c.req.query('date');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let query = `
    SELECT r.*, t.table_number, t.zone AS table_zone, t.capacity
    FROM reservations r LEFT JOIN cafe_tables t ON r.table_id = t.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (date) { query += ' AND r.date = ?'; params.push(date); }
  query += ' ORDER BY r.date DESC, r.time ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

reservationsRouter.delete('/:id', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!rsv) { return c.json({ success: false, error: 'Reservation not found' }, 404); }

  await db.prepare('UPDATE reservations SET status = \'cancelled\', updated_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
  await db.prepare('UPDATE cafe_tables SET status = \'Available\' WHERE id = ?').bind(rsv.table_id).run();

  return c.json({ success: true, message: 'Reservation cancelled' });
});
