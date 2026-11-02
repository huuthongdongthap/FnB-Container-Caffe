import { Hono } from 'hono';
import { z } from 'zod';
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { getTenantId } from 'worker/src/middleware/tenant';

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

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
reservationsRouter.get('/availability', optionalAuth() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as any);
  const date = c.req.query('date');
  const time = c.req.query('time');

  if (!date) {
    return c.json({ success: false, error: 'date is required' }, 400);
  }

  const { results: rawTables } = await db.prepare(
    'SELECT * FROM cafe_tables ORDER BY zone ASC, table_number ASC'
  ).all<Record<string, unknown>>();
  const tables = tenantId === '*'
    ? rawTables
    : (rawTables || []).filter((t) => matchesTenantRow(t, tenantId));

  let rawReservations: Array<Record<string, unknown>> = [];
  try {
    let query = "SELECT * FROM reservations WHERE date = ? AND status IN ('confirmed', 'pending', 'seated')";
    const params: unknown[] = [date];
    if (time) {
      query += ' AND time = ?';
      params.push(time);
    }
    const res = await db.prepare(query).bind(...params).all<Record<string, unknown>>();
    rawReservations = res.results || [];
  } catch {
    let fallbackQuery = "SELECT *, reservation_time AS time FROM reservations WHERE reservation_date = ? AND status IN ('confirmed', 'pending', 'seated')";
    const params: unknown[] = [date];
    if (time) {
      fallbackQuery += ' AND reservation_time = ?';
      params.push(time);
    }
    const res = await db.prepare(fallbackQuery).bind(...params).all<Record<string, unknown>>();
    rawReservations = res.results || [];
  }
  const reservations: Array<Record<string, unknown>> = [];
  for (const r of rawReservations) {
    if (tenantId === '*' || (await matchesReservationTenant(db, r, tenantId))) {
      reservations.push(r);
    }
  }
  const bookedIds = new Set(reservations.map(r => String(r.table_id)));
  const data = tables.map(t => ({
    ...t,
    available: !bookedIds.has(String(t.id)) && !bookedIds.has(String(t.table_number)),
  }));

  return c.json({ success: true, data });
});

// POST /api/reservations
reservationsRouter.post('/', optionalAuth() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as any);

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

  let candidateTables: Record<string, unknown>[] = [];
  try {
    const tblRes = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
      .bind(table_id, table_id)
      .all<Record<string, unknown>>();
    candidateTables = tblRes.results || [];
  } catch {
    candidateTables = [];
  }
  if (candidateTables.length === 0) {
    const singleTable = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
      .bind(table_id, table_id)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (singleTable) candidateTables = [singleTable];
  }
  const table = candidateTables.find((t) => matchesTenantRow(t, tenantId)) ?? null;
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  const canonicalTableId = String(table.id ?? table_id);
  const effectiveTenant =
    table.tenant_id && String(table.tenant_id).trim()
      ? String(table.tenant_id).trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;
  let existingRows: Record<string, unknown>[] = [];
  try {
    const res = await db.prepare(
      "SELECT * FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status IN ('confirmed', 'pending', 'seated')"
    ).bind(canonicalTableId, date, time).all<Record<string, unknown>>();
    existingRows = (res.results || []).filter((r) => 'table_id' in r || 'date' in r || 'reservation_date' in r);
    if (existingRows.length === 0) {
      const single = await db.prepare(
        "SELECT * FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status IN ('confirmed', 'pending', 'seated')"
      ).bind(canonicalTableId, date, time).first<Record<string, unknown>>().catch(() => null);
      if (single) existingRows = [single];
    }
  } catch {
    const res = await db.prepare(
      "SELECT * FROM reservations WHERE table_id = ? AND reservation_date = ? AND reservation_time = ? AND status IN ('confirmed', 'pending', 'seated')"
    ).bind(canonicalTableId, date, time).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }));
    existingRows = (res.results || []).filter((r) => 'table_id' in r || 'date' in r || 'reservation_date' in r);
    if (existingRows.length === 0) {
      const single = await db.prepare(
        "SELECT * FROM reservations WHERE table_id = ? AND reservation_date = ? AND reservation_time = ? AND status IN ('confirmed', 'pending', 'seated')"
      ).bind(canonicalTableId, date, time).first<Record<string, unknown>>().catch(() => null);
      if (single) existingRows = [single];
    }
  }
  let hasConflict = false;
  for (const row of existingRows) {
    if (await matchesReservationTenant(db, row, effectiveTenant)) {
      hasConflict = true;
      break;
    }
  }
  if (hasConflict) {
    return c.json({ success: false, error: 'Table already reserved for this time slot' }, 409);
  }

  const rsvRand = new Uint8Array(3);
  crypto.getRandomValues(rsvRand);
  const id = `rsv_${Date.now()}_${Array.from(rsvRand, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  const now = new Date().toISOString();

  try {
    await db.prepare(
      `INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, status, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`
    ).bind(id, canonicalTableId, customer_name, customer_phone, guests, date, time, (table.zone as string) || '', String(notes || '').slice(0, 500), effectiveTenant, now, now).run();
  } catch {
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
  }

  if (date === today) {
    await db.prepare("UPDATE cafe_tables SET status = 'Reserved' WHERE id = ?").bind(canonicalTableId).run();
  }

  return c.json({
    success: true,
    data: { id, table_id: canonicalTableId, table_number: table.table_number, zone: table.zone, date, time, guest_count: guests }
  }, 201);
});

const reservationStaffRoles = ['owner', 'staff', 'manager', 'supervisor', 'admin', 'waiter', 'cashier'];

async function matchesReservationTenant(
  db: D1Database,
  rsv: Record<string, unknown>,
  tenantId: string
): Promise<boolean> {
  if (tenantId === '*') return true;
  const rawRsvTenant = 'tenant_id' in rsv && rsv.tenant_id !== undefined && rsv.tenant_id !== null
    ? String(rsv.tenant_id).trim()
    : '';
  if (rawRsvTenant && rawRsvTenant !== 'default') {
    return rawRsvTenant === tenantId;
  }
  if (rsv.table_id) {
    const tbl = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
      .bind(rsv.table_id, rsv.table_id)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (tbl) {
      return matchesTenantRow(tbl, tenantId);
    }
  }
  if (rawRsvTenant) {
    return rawRsvTenant === tenantId;
  }
  return tenantId === 'default';
}

// GET /api/reservations?date=&limit=&offset=
reservationsRouter.get('/', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as any);
  const date = c.req.query('date');
  const rawLimit = parseInt(c.req.query('limit') || '50', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
  const rawOffset = parseInt(c.req.query('offset') || '0', 10);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const fetchLimit = tenantId === '*' ? limit : Math.max(limit + offset, 200);
  const fetchOffset = tenantId === '*' ? offset : 0;

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
    params.push(fetchLimit, fetchOffset);

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
    params.push(fetchLimit, fetchOffset);

    const res = await db.prepare(fallbackQuery).bind(...params).all();
    results = res.results || [];
  }
  if (tenantId !== '*' && results.length > 0) {
    const filtered: unknown[] = [];
    for (const r of results as Array<Record<string, unknown>>) {
      if (await matchesReservationTenant(db, r, tenantId)) {
        filtered.push(r);
      }
    }
    results = filtered.slice(offset, offset + limit);
  }
  return c.json({ success: true, data: results });
});

// PATCH /api/reservations/:id/approve
reservationsRouter.patch('/:id/approve', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as any);
  const id = c.req.param('id');

  const rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  await db.prepare("UPDATE reservations SET status = 'confirmed', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  return c.json({ success: true, message: 'Reservation confirmed' });
});

// PATCH /api/reservations/:id/reject
reservationsRouter.patch('/:id/reject', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as any);
  const id = c.req.param('id');

  const rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  await db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  await db.prepare("UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Reserved'").bind(rsv.table_id).run();
  return c.json({ success: true, message: 'Reservation rejected' });
});

// DELETE /api/reservations/:id
reservationsRouter.delete('/:id', requireAuth(reservationStaffRoles) as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as any);
  const id = c.req.param('id');

  const rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  await db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  await db.prepare("UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Reserved'").bind(rsv.table_id).run();
  return c.json({ success: true, message: 'Reservation cancelled' });
});
