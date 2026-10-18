import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from 'worker/src/middleware/auth';

const reservationSchema = z.object({
  table_id: z.string().min(1),
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(8).max(15),
  guest_count: z.number().int().min(1).max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (YYYY-MM-DD)'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ không hợp lệ (HH:MM)'),
  notes: z.string().max(500).optional(),
});

function zodErrorResponse(c: import('hono').Context, error: z.ZodError) {
  return c.json({ success: false, errors: error.issues.map(i => i.message) }, 400);
}

interface Env {
  AURA_DB: D1Database;
  AUTH_KV: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
  };
}

export const reservationsRouter = new Hono<{ Bindings: Env }>();

async function checkRateLimit(c: { env: Env; req: { header: (n: string) => string | undefined } }, key: string, max = 5, windowSec = 3600): Promise<boolean> {
  const kv = c.env.AUTH_KV;
  if (!kv) return true;
  const cur = parseInt((await kv.get(key)) || '0', 10);
  if (cur >= max) return false;
  await kv.put(key, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

// GET /api/reservations/availability?date=YYYY-MM-DD&time=HH:MM
reservationsRouter.get('/availability', async (c) => {
  const db = c.env.AURA_DB;
  const date = c.req.query('date');
  const time = c.req.query('time');

  if (!date) {
    return c.json({ success: false, error: 'date is required' }, 400);
  }

  const { results: tables } = await db.prepare(
    'SELECT * FROM cafe_tables ORDER BY zone ASC, table_number ASC'
  ).all<Record<string, unknown>>();

  let reservations: { table_id: string }[] = [];
  try {
    let query = "SELECT table_id, time FROM reservations WHERE date = ? AND status IN ('confirmed', 'pending', 'seated')";
    const params: unknown[] = [date];
    if (time) {
      query += ' AND time = ?';
      params.push(time);
    }
    const res = await db.prepare(query).bind(...params).all<{ table_id: string }>();
    reservations = res.results || [];
  } catch {
    let fallbackQuery = "SELECT table_id, reservation_time AS time FROM reservations WHERE reservation_date = ? AND status IN ('confirmed', 'pending', 'seated')";
    const params: unknown[] = [date];
    if (time) {
      fallbackQuery += ' AND reservation_time = ?';
      params.push(time);
    }
    const res = await db.prepare(fallbackQuery).bind(...params).all<{ table_id: string }>();
    reservations = res.results || [];
  }
  const bookedIds = new Set(reservations.map(r => String(r.table_id)));
  const data = tables.map(t => ({
    ...t,
    available: !bookedIds.has(String(t.id)) && !bookedIds.has(String(t.table_number)),
  }));

  return c.json({ success: true, data });
});

// POST /api/reservations
reservationsRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const allowed = await checkRateLimit(c, `rl:rsv:${ip}`, 5, 3600);
  if (!allowed) {
    return c.json({ success: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' }, 429);
  }

  const body = await c.req.json() as Record<string, unknown>;
  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { table_id, customer_name, customer_phone, date, time, notes, guest_count } = parsed.data;

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    return c.json({ success: false, error: 'Không thể đặt bàn cho ngày trong quá khứ' }, 400);
  }
  const guests = guest_count || 2;

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?').bind(table_id, table_id).first<Record<string, unknown>>();
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  const canonicalTableId = String(table.id ?? table_id);
  let existing: { id: string } | null = null;
  try {
    existing = await db.prepare(
      "SELECT id FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status IN ('confirmed', 'pending', 'seated')"
    ).bind(canonicalTableId, date, time).first<{ id: string }>();
  } catch {
    existing = await db.prepare(
      "SELECT id FROM reservations WHERE table_id = ? AND reservation_date = ? AND reservation_time = ? AND status IN ('confirmed', 'pending', 'seated')"
    ).bind(canonicalTableId, date, time).first<{ id: string }>();
  }
  if (existing) {
    return c.json({ success: false, error: 'Table already reserved for this time slot' }, 409);
  }

  const id = `rsv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  try {
    await db.prepare(
      `INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`
    ).bind(id, canonicalTableId, customer_name, customer_phone, guests, date, time, (table.zone as string) || '', String(notes || '').slice(0, 500), now, now).run();
  } catch {
    await db.prepare(
      `INSERT INTO reservations (id, table_id, customer_name, phone, pax, reservation_date, reservation_time, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`
    ).bind(id, canonicalTableId, customer_name, customer_phone, guests, date, time, String(notes || '').slice(0, 500), now, now).run();
  }

  if (date === today) {
    await db.prepare("UPDATE cafe_tables SET status = 'Reserved' WHERE id = ?").bind(canonicalTableId).run();
  }

  return c.json({
    success: true,
    data: { id, table_id: canonicalTableId, table_number: table.table_number, zone: table.zone, date, time, guest_count: guests }
  }, 201);
});

const reservationStaffRoles = ['owner', 'staff', 'manager', 'admin', 'waiter', 'cashier'];

// GET /api/reservations?date=&limit=&offset=
reservationsRouter.get('/', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const date = c.req.query('date');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let results: unknown[] = [];
  try {
    let query = `
      SELECT r.*, t.table_number, t.zone AS table_zone, t.capacity
      FROM reservations r LEFT JOIN cafe_tables t ON r.table_id = t.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (date) {
      query += ' AND r.date = ?'; params.push(date);
    }
    query += ' ORDER BY r.date DESC, r.time ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const res = await db.prepare(query).bind(...params).all();
    results = res.results || [];
  } catch {
    let fallbackQuery = `
      SELECT r.*, r.reservation_date AS date, r.reservation_time AS time, r.phone AS customer_phone, r.pax AS guest_count,
             t.table_number, t.zone AS table_zone, t.capacity
      FROM reservations r LEFT JOIN cafe_tables t ON r.table_id = t.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (date) {
      fallbackQuery += ' AND r.reservation_date = ?'; params.push(date);
    }
    fallbackQuery += ' ORDER BY r.reservation_date DESC, r.reservation_time ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const res = await db.prepare(fallbackQuery).bind(...params).all();
    results = res.results || [];
  }
  return c.json({ success: true, data: results });
});

// PATCH /api/reservations/:id/approve
reservationsRouter.patch('/:id/approve', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!rsv) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  await db.prepare("UPDATE reservations SET status = 'confirmed', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  return c.json({ success: true, message: 'Reservation confirmed' });
});

// PATCH /api/reservations/:id/reject
reservationsRouter.patch('/:id/reject', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!rsv) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  await db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  await db.prepare("UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Reserved'").bind(rsv.table_id).run();
  return c.json({ success: true, message: 'Reservation rejected' });
});

// DELETE /api/reservations/:id
reservationsRouter.delete('/:id', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!rsv) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  await db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  await db.prepare("UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Reserved'").bind(rsv.table_id).run();
  return c.json({ success: true, message: 'Reservation cancelled' });
});
