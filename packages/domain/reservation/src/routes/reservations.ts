import { Hono } from 'hono';
import { z } from 'zod';
import { optionalAuth, requireAuth } from 'worker/src/middleware/auth';
import { getTenantId, matchesTenantRow, resolvePublicTenantId } from 'worker/src/middleware/tenant';

function resolveRequestTenantId(c: any): string {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const reqTenant = (
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
  if (user) {
    const rawUserTenant = user.tenantId ?? user.tenant_id;
    const userTenant = rawUserTenant !== undefined && rawUserTenant !== null ? String(rawUserTenant).trim() : '';
    const role = String(user.role || '').trim().toLowerCase();
    const isHqAdmin = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
    if (isHqAdmin) {
      if (reqTenant && reqTenant.toLowerCase() !== 'hq') return reqTenant;
      const ctxTenant = typeof c.get?.('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
      return ctxTenant && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '*';
    }
    return getTenantId(c).trim() || 'default';
  }
  return resolvePublicTenantId(c).trim() || 'default';
}

const reservationSchema = z.object({
  table_id: z.string().min(1),
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(8).max(20),
  guest_count: z.number().int().min(1).max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (YYYY-MM-DD)'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ không hợp lệ (HH:MM)'),
  notes: z.string().max(500).optional(),
});

function getTodayVN(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

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

const INACTIVE_TABLE_STATUSES = new Set(['maintenance', 'outoforder', 'out_of_order', 'disabled', 'inactive']);
const ACTIVE_RESERVATION_STATUSES = new Set(['pending', 'confirmed', 'approved', 'seated']);
const TERMINAL_RESERVATION_STATUSES = new Set(['cancelled', 'completed', 'rejected', 'no_show']);
const RESERVATION_STAFF_ROLES = ['staff', 'owner', 'manager', 'supervisor', 'admin', 'cashier', 'waiter'];

function verifyReservationStaffTenant(c: any): Response | null {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (!user) return null;
  const rawUserTenant = user.tenantId ?? user.tenant_id;
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
    .map((v) => (v || '').trim())
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant reservation access denied' }, 403);
  }
  const reqTenant = candidateOverrides[0] || '';
  const ctxTenant = typeof c.get?.('tenantId') === 'string' ? c.get('tenantId').trim() : '';
  const userTenant =
    rawUserTenant !== undefined && rawUserTenant !== null && String(rawUserTenant).trim()
      ? String(rawUserTenant).trim()
      : (!reqTenant && ctxTenant && ctxTenant !== '*' ? ctxTenant : 'default');
  const role = String(user.role || '').trim().toLowerCase();
  const isHqAdmin = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
  if (isHqAdmin) return null;
  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    reqTenant === '*' ||
    reqTenant.toLowerCase() === 'hq' ||
    (reqTenant && reqTenant !== userTenant) ||
    (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' && ctxTenant !== userTenant) ||
    (!rawUserTenant && ctxTenant.toLowerCase() === 'hq')
  ) {
    return c.json({ success: false, error: 'Cross-tenant reservation access denied' }, 403);
  }
  return null;
}

function requireReservationStaff() {
  return async (c: any, next: () => Promise<void>) => {
    const existingUser = c.get?.('user');
    if (existingUser && typeof existingUser === 'object') {
      const role = String(existingUser.role || '').trim().toLowerCase();
      if (!RESERVATION_STAFF_ROLES.includes(role)) {
        return c.json({ success: false, error: 'Insufficient permissions' }, 403);
      }
      const tenantErr = verifyReservationStaffTenant(c);
      if (tenantErr) return tenantErr;
      return next();
    }
    const middleware = requireAuth(RESERVATION_STAFF_ROLES) as any;
    return middleware(c, async () => {
      const tenantErr = verifyReservationStaffTenant(c);
      if (tenantErr) {
        c.res = tenantErr;
        return;
      }
      await next();
    });
  };
}

function isBookableTableRow(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  if (row.is_active !== undefined && row.is_active !== null && (row.is_active === false || Number(row.is_active) === 0)) {
    return false;
  }
  const rawStatus = row.status !== undefined && row.status !== null ? String(row.status).trim().toLowerCase() : '';
  return !INACTIVE_TABLE_STATUSES.has(rawStatus);
}

async function checkRateLimit(c: { env: Env; req: { header: (n: string) => string | undefined } }, key: string, max = 5, windowSec = 3600): Promise<boolean> {
  const kv = c.env.AUTH_KV;
  if (!kv) return true;
  const rawCur = parseInt((await kv.get(key)) || '0', 10);
  const cur = Number.isFinite(rawCur) && rawCur >= 0 ? rawCur : 0;
  if (cur >= max) return false;
  await kv.put(key, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

// GET /api/reservations/availability?date=YYYY-MM-DD&time=HH:MM
reservationsRouter.get('/availability', optionalAuth() as any, async (c) => {
  const tenantErr = verifyReservationStaffTenant(c);
  if (tenantErr) return tenantErr;
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const date = c.req.query('date');
  if (!date) {
    return c.json({ success: false, error: 'date is required (YYYY-MM-DD)' }, 400);
  }
  const time = c.req.query('time');

  const { results: rawTables } = await db.prepare(
    'SELECT * FROM cafe_tables ORDER BY zone ASC, table_number ASC'
  ).all<Record<string, unknown>>();
  const tables = (tenantId === '*'
    ? (rawTables || [])
    : (rawTables || []).filter((t) => matchesTenantRow(t, tenantId))
  ).filter((t) => isBookableTableRow(t));

  let rawReservations: Array<Record<string, unknown>> = [];
  try {
    let query = "SELECT table_id, time AS reservation_time, guest_count AS party_size, status, tenant_id FROM reservations WHERE date = ? AND status IN ('confirmed', 'pending', 'seated') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
    const params: unknown[] = [date, tenantId, tenantId];
    if (time) {
      query += ' AND time = ?';
      params.push(time);
    }
    const res = await db.prepare(query).bind(...params).all<Record<string, unknown>>();
    rawReservations = res.results || [];
  } catch {
    try {
      let query = "SELECT table_id, reservation_time, party_size, status, tenant_id FROM reservations WHERE reservation_date = ? AND status IN ('confirmed', 'pending', 'seated') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
      const params: unknown[] = [date, tenantId, tenantId];
      if (time) {
        query += ' AND reservation_time = ?';
        params.push(time);
      }
      const res = await db.prepare(query).bind(...params).all<Record<string, unknown>>();
      rawReservations = res.results || [];
    } catch {
      if (tenantId === 'default' || tenantId === '*') {
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
          const res = await db.prepare(fallbackQuery).bind(...params).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }));
          rawReservations = res.results || [];
        }
      }
    }
  }
  const reservations: Array<Record<string, unknown>> = [];
  for (const r of rawReservations) {
    if (tenantId === '*' || (await matchesReservationTenant(db, r, tenantId))) {
      reservations.push(r);
    }
  }
  const bookedIds = new Set(reservations.map(r => String(r.table_id)));
  const reservedSlots = reservations.map((r) => ({
    table_id: r.table_id ?? null,
    time: r.reservation_time ?? r.time ?? null,
    reservation_time: r.reservation_time ?? r.time ?? null,
    party_size: Number(r.party_size ?? r.guest_count ?? r.pax ?? 1),
    status: r.status ?? 'confirmed',
  }));
  const data = tables.map((t) => {
    const safeTable = { ...t };
    delete safeTable.guest_name;
    delete safeTable.guest_phone;
    delete safeTable.customer_name;
    delete safeTable.customer_phone;
    delete safeTable.phone;
    return {
      ...safeTable,
      available: !bookedIds.has(String(t.id)) && !bookedIds.has(String(t.table_number)),
    };
  });

  return c.json({ success: true, data, reserved_slots: reservedSlots });
});

// POST /api/reservations
reservationsRouter.post('/', optionalAuth() as any, async (c) => {
  const tenantErr = verifyReservationStaffTenant(c);
  if (tenantErr) return tenantErr;
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);

  const cfIp = c.req.header('CF-Connecting-IP')?.trim();
  const xffIp = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
  const ip = cfIp || xffIp || 'unknown';
  const allowed = await checkRateLimit(c, `rl:rsv:${tenantId}:${ip}`, 5, 3600);
  if (!allowed) {
    return c.json({ success: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' }, 429);
  }

  const rawBody = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const todayVN = getTodayVN();
  const rawDateCandidate = String(rawBody.date ?? rawBody.reservation_date ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateCandidate) && rawDateCandidate < todayVN) {
    return c.json({ success: false, error: 'Không thể đặt bàn cho ngày trong quá khứ' }, 400);
  }
  const normalizedBody: Record<string, unknown> = {
    ...rawBody,
    table_id: rawBody.table_id !== undefined ? String(rawBody.table_id) : undefined,
    customer_name: rawBody.customer_name ?? rawBody.guest_name,
    customer_phone: rawBody.customer_phone ?? rawBody.guest_phone ?? rawBody.phone,
    guest_count: rawBody.guest_count !== undefined
      ? Number(rawBody.guest_count)
      : rawBody.party_size !== undefined
        ? Number(rawBody.party_size)
        : rawBody.pax !== undefined
          ? Number(rawBody.pax)
          : undefined,
    date: rawBody.date ?? rawBody.reservation_date,
    time: rawBody.time ?? rawBody.reservation_time ?? '18:00',
    notes: rawBody.notes ?? rawBody.special_requests,
  };
  const parsed = reservationSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { table_id, customer_name, customer_phone, date, time, notes, guest_count } = parsed.data;

  const today = todayVN;
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
    candidateTables = (tblRes.results || []).filter(
      (t) =>
        (!('id' in t) && !('table_number' in t)) ||
        String(t.id ?? '') === String(table_id) ||
        String(t.table_number ?? '') === String(table_id)
    );
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
  const tenantMatchedTables = candidateTables.filter((t) => matchesTenantRow(t, tenantId));
  if (tenantMatchedTables.length === 0) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }
  const table = tenantMatchedTables.find((t) => isBookableTableRow(t)) ?? null;
  if (!table) {
    return c.json({ success: false, error: 'Table is unavailable for reservation' }, 400);
  }
  const tableCapacity = Number(table.capacity ?? 0);
  if (Number.isFinite(tableCapacity) && tableCapacity > 0 && guests > tableCapacity) {
    return c.json({ success: false, error: 'Guest count exceeds table capacity' }, 400);
  }

  const canonicalTableId = String(table.id ?? table_id);
  const effectiveTenant =
    table.tenant_id &&
    String(table.tenant_id).trim() &&
    String(table.tenant_id).trim() !== '*' &&
    String(table.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(table.tenant_id).trim()
      : tenantId === '*' || tenantId.toLowerCase() === 'hq'
        ? 'default'
        : tenantId;
  let existingRows: Record<string, unknown>[] = [];
  try {
    const res = await db.prepare(
      "SELECT * FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated')"
    ).bind(canonicalTableId, date, time).all<Record<string, unknown>>();
    existingRows = (res.results || []).filter((r) => 'table_id' in r || 'date' in r || 'reservation_date' in r);
    if (existingRows.length === 0) {
      const single = await db.prepare(
        "SELECT * FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated')"
      ).bind(canonicalTableId, date, time).first<Record<string, unknown>>().catch(() => null);
      if (single) existingRows = [single];
    }
  } catch {
    const res = await db.prepare(
      "SELECT * FROM reservations WHERE table_id = ? AND reservation_date = ? AND reservation_time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated')"
    ).bind(canonicalTableId, date, time).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }));
    existingRows = (res.results || []).filter((r) => 'table_id' in r || 'date' in r || 'reservation_date' in r);
    if (existingRows.length === 0) {
      const single = await db.prepare(
        "SELECT * FROM reservations WHERE table_id = ? AND reservation_date = ? AND reservation_time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated')"
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
  } catch (err) {
    try {
      await db.prepare(
        `INSERT INTO reservations (id, table_id, guest_name, guest_phone, party_size, reservation_date, reservation_time, status, tenant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`
      ).bind(id, canonicalTableId, customer_name, customer_phone, guests, date, time, effectiveTenant, now, now).run();
    } catch {
      if (effectiveTenant !== 'default') {
        throw err;
      }
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
  }

  const currentTableStatus = table.status !== undefined && table.status !== null
    ? String(table.status).trim().toLowerCase()
    : 'available';
  const canMarkReserved =
    currentTableStatus !== 'occupied' &&
    !INACTIVE_TABLE_STATUSES.has(currentTableStatus);
  if (date === today && canMarkReserved) {
    if (effectiveTenant && effectiveTenant !== '*') {
      await db
        .prepare("UPDATE cafe_tables SET status = 'Reserved' WHERE id = ? AND status = 'Available' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(canonicalTableId, effectiveTenant)
        .run()
        .catch(() =>
          effectiveTenant === 'default'
            ? db.prepare("UPDATE cafe_tables SET status = 'Reserved' WHERE id = ? AND status = 'Available'").bind(canonicalTableId).run()
            : undefined
        );
    } else {
      await db.prepare("UPDATE cafe_tables SET status = 'Reserved' WHERE id = ? AND status = 'Available'").bind(canonicalTableId).run();
    }
  }

  return c.json({
    success: true,
    data: { id, table_id: canonicalTableId, table_number: table.table_number, zone: table.zone, date, time, guest_count: guests }
  }, 201);
});

async function matchesReservationTenant(
  db: D1Database,
  rsv: Record<string, unknown>,
  tenantId: string
): Promise<boolean> {
  if (tenantId === '*') return true;
  const rawRsvTenant = 'tenant_id' in rsv && rsv.tenant_id !== undefined && rsv.tenant_id !== null
    ? String(rsv.tenant_id).trim()
    : '';
  if (rawRsvTenant) {
    if (rawRsvTenant !== 'default') {
      return rawRsvTenant === tenantId;
    }
    if (rsv.table_id) {
      let tblById = await db
        .prepare('SELECT * FROM cafe_tables WHERE id = ?')
        .bind(rsv.table_id)
        .first<Record<string, unknown>>()
        .catch(() => null);
      if (!tblById) {
        const candidate = await db
          .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
          .bind(rsv.table_id, rsv.table_id)
          .first<Record<string, unknown>>()
          .catch(() => null);
        if (candidate && (!('id' in candidate) || String(candidate.id) === String(rsv.table_id))) {
          tblById = candidate;
        }
      }
      if (tblById && (!('id' in tblById) || String(tblById.id) === String(rsv.table_id))) {
        return matchesTenantRow(tblById, tenantId);
      }
    }
    return rawRsvTenant === tenantId;
  }
  if (rsv.table_id) {
    const tblById = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(rsv.table_id)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (tblById && (!('id' in tblById) || String(tblById.id) === String(rsv.table_id))) {
      return matchesTenantRow(tblById, tenantId);
    }
    let tablesByNum: Record<string, unknown>[] = [];
    try {
      const stmt = db.prepare('SELECT * FROM cafe_tables WHERE table_number = ?').bind(rsv.table_id);
      if (typeof stmt.all === 'function') {
        const res = await stmt.all<Record<string, unknown>>();
        if (Array.isArray(res?.results) && res.results.length > 0) {
          tablesByNum = res.results;
        }
      }
      if (tablesByNum.length === 0 && typeof stmt.first === 'function') {
        const single = await stmt.first<Record<string, unknown>>();
        if (single) tablesByNum = [single];
      }
    } catch {
      tablesByNum = [];
    }
    if (tablesByNum.length === 0) {
      const legacyTbl = tblById ?? (await db
        .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
        .bind(rsv.table_id, rsv.table_id)
        .first<Record<string, unknown>>()
        .catch(() => null));
      if (legacyTbl) {
        tablesByNum = [legacyTbl];
      }
    }
    if (tablesByNum.length > 0) {
      return tenantId === 'default'
        ? tablesByNum.some((t) => matchesTenantRow(t, tenantId))
        : tablesByNum.every((t) => matchesTenantRow(t, tenantId));
    }
  }
  return tenantId === 'default';
}

// GET /api/reservations?date=&limit=&offset=
reservationsRouter.get('/', requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const date = c.req.query('date');
  const rawLimit = parseInt(c.req.query('limit') || '50', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
  const rawOffset = parseInt(c.req.query('offset') || '0', 10);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  let results: unknown[] = [];
  let sqlTenantScoped = false;
  try {
    let query = `
      SELECT r.*, t.table_number, t.zone AS table_zone, t.capacity
      FROM reservations r LEFT JOIN cafe_tables t ON r.table_id = t.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (tenantId !== '*') {
      query += " AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?";
      params.push(tenantId);
    }
    if (date) {
      query += ' AND r.date = ?'; params.push(date);
    }
    query += ' ORDER BY r.date DESC, r.time ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const res = await db.prepare(query).bind(...params).all();
    results = res.results || [];
    sqlTenantScoped = tenantId !== '*';
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      const fetchLimit = tenantId === '*' ? limit : Math.max(limit + offset, 200);
      const fetchOffset = tenantId === '*' ? offset : 0;
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
    } else {
      try {
        let fallbackQuery = `
          SELECT r.*, r.reservation_date AS date, r.reservation_time AS time,
                 t.table_number, t.zone AS table_zone, t.capacity
          FROM reservations r LEFT JOIN cafe_tables t ON r.table_id = t.id
          WHERE COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?
        `;
        const params: unknown[] = [tenantId];
        if (date) {
          fallbackQuery += ' AND r.reservation_date = ?'; params.push(date);
        }
        fallbackQuery += ' ORDER BY r.reservation_date DESC, r.reservation_time ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const res = await db.prepare(fallbackQuery).bind(...params).all().catch(() => ({ results: [] }));
        results = res.results || [];
        sqlTenantScoped = true;
      } catch {
        results = [];
      }
    }
  }
  if (tenantId !== '*' && results.length > 0) {
    const filtered: unknown[] = [];
    for (const r of results as Array<Record<string, unknown>>) {
      if (await matchesReservationTenant(db, r, tenantId)) {
        filtered.push(r);
      }
    }
    results = sqlTenantScoped ? filtered : filtered.slice(offset, offset + limit);
  }
  return c.json({ success: true, data: results });
});

async function hasActiveTableSession(
  db: D1Database,
  tableIdStr: string,
  targetTenant: string
): Promise<boolean> {
  try {
    const row = await db
      .prepare(
        "SELECT id, status, tenant_id FROM table_sessions WHERE table_id = ? AND LOWER(COALESCE(status, '')) IN ('active', 'ordering', 'paid', 'paying', 'occupied', 'seated') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      )
      .bind(tableIdStr, targetTenant)
      .first<Record<string, unknown>>();
    if (row && ('id' in row || 'status' in row)) {
      if ('status' in row && !['active', 'ordering', 'paid', 'paying', 'occupied', 'seated'].includes(String(row.status || '').toLowerCase())) {
        return false;
      }
      if (!matchesTenantRow(row, targetTenant)) return false;
      return true;
    }
    return false;
  } catch {
    if (targetTenant !== 'default') return false;
    const row = await db
      .prepare(
        "SELECT id, status FROM table_sessions WHERE table_id = ? AND LOWER(COALESCE(status, '')) IN ('active', 'ordering', 'paid', 'paying', 'occupied', 'seated') LIMIT 1"
      )
      .bind(tableIdStr)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (row && ('id' in row || 'status' in row)) {
      if ('status' in row && !['active', 'ordering', 'paid', 'paying', 'occupied', 'seated'].includes(String(row.status || '').toLowerCase())) {
        return false;
      }
      return true;
    }
    return false;
  }
}

async function canResetTableToAvailableOnCancel(
  db: D1Database,
  rsv: Record<string, unknown>,
  rsvTenant: string | null,
  opts?: { allowOccupiedRelease?: boolean }
): Promise<boolean> {
  if (!rsv.table_id) return false;
  const targetTenant = rsvTenant || 'default';
  const tableIdStr = String(rsv.table_id);

  if (await hasActiveTableSession(db, tableIdStr, targetTenant)) {
    return false;
  }

  try {
    const activeOrder = await db
      .prepare(
        "SELECT id, status, payment_status FROM orders WHERE table_id = ? AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'refunded', 'cancelled', 'canceled', 'failed', 'expired') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      )
      .bind(tableIdStr, targetTenant)
      .first<Record<string, unknown>>()
      .catch(() =>
        targetTenant === 'default'
          ? db
              .prepare(
                "SELECT id, status, payment_status FROM orders WHERE table_id = ? AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'refunded', 'cancelled', 'canceled', 'failed', 'expired') LIMIT 1"
              )
              .bind(tableIdStr)
              .first<Record<string, unknown>>()
              .catch(() => null)
          : null
      );
    if (activeOrder && ('id' in activeOrder || 'status' in activeOrder || 'payment_status' in activeOrder)) {
      return false;
    }
  } catch {
    // orders table optional in minimal schemas
  }

  let tableRow: Record<string, unknown> | null = null;
  try {
    const tblRes = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
      .bind(tableIdStr, tableIdStr)
      .all<Record<string, unknown>>();
    const rows = tblRes?.results || [];
    tableRow = rows.find((t) => matchesTenantRow(t, targetTenant)) ?? null;
  } catch {
    tableRow = null;
  }
  if (!tableRow) {
    const single = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(tableIdStr)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (single && matchesTenantRow(single, targetTenant)) {
      tableRow = single;
    }
  }
  const rsvDate = String(rsv.date ?? rsv.reservation_date ?? rsv.reserved_date ?? '').trim();
  const todayVN = getTodayVN();
  if (tableRow) {
    const exactStatus = tableRow.status !== undefined && tableRow.status !== null
      ? String(tableRow.status).trim()
      : '';
    const rawStatus = exactStatus.toLowerCase();
    if (INACTIVE_TABLE_STATUSES.has(rawStatus)) {
      return false;
    }
    if (rawStatus === 'occupied') {
      const rsvStatus = String(rsv.status ?? '').trim().toLowerCase();
      if (rsvStatus !== 'seated' || (rsvDate && rsvDate !== todayVN)) {
        return false;
      }
      if (!opts?.allowOccupiedRelease) {
        return false;
      }
      try {
        const unpaidRes = await db
          .prepare(
            "SELECT id, status, payment_status FROM orders WHERE table_id = ? AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'refunded', 'cancelled', 'canceled', 'failed', 'expired') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
          )
          .bind(tableIdStr, targetTenant)
          .first<Record<string, unknown>>()
          .catch(() =>
            targetTenant === 'default'
              ? db
                  .prepare(
                    "SELECT id, status, payment_status FROM orders WHERE table_id = ? AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'refunded', 'cancelled', 'canceled', 'failed', 'expired') LIMIT 1"
                  )
                  .bind(tableIdStr)
                  .first<Record<string, unknown>>()
                  .catch(() => null)
              : null
          );
        if (unpaidRes && ('id' in unpaidRes || 'status' in unpaidRes || 'payment_status' in unpaidRes)) {
          return false;
        }
      } catch {
        // orders table optional in minimal schemas
      }
    } else if (rawStatus && rawStatus !== 'reserved' && rawStatus !== 'seated') {
      return false;
    }
  }

  const rsvId = String(rsv.id ?? '');
  let otherRows: Record<string, unknown>[] = [];
  const checkDates = Array.from(new Set([rsvDate, todayVN].filter(Boolean)));
  for (const d of checkDates) {
    try {
      const res = await db
        .prepare(
          "SELECT * FROM reservations WHERE table_id = ? AND date = ? AND status IN ('pending', 'confirmed', 'approved', 'seated')"
        )
        .bind(tableIdStr, d)
        .all<Record<string, unknown>>();
      otherRows.push(...(res?.results || []));
    } catch {
      const res = await db
        .prepare(
          "SELECT * FROM reservations WHERE table_id = ? AND reservation_date = ? AND status IN ('pending', 'confirmed', 'approved', 'seated')"
        )
        .bind(tableIdStr, d)
        .all<Record<string, unknown>>()
        .catch(() => ({ results: [] as Record<string, unknown>[] }));
      otherRows.push(...(res?.results || []));
    }
  }
  for (const row of otherRows) {
    if (String(row.id ?? '') === rsvId) continue;
    const rowTableId = String(row.table_id ?? '');
    if (rowTableId && rowTableId !== tableIdStr && (!tableRow || rowTableId !== String(tableRow.table_number ?? ''))) {
      continue;
    }
    const rowDate = String(row.date ?? row.reservation_date ?? '').trim();
    if (checkDates.length > 0 && rowDate && !checkDates.includes(rowDate)) continue;
    const rowStatus = String(row.status ?? '').trim().toLowerCase();
    if (!ACTIVE_RESERVATION_STATUSES.has(rowStatus)) continue;
    if (await matchesReservationTenant(db, row, targetTenant)) {
      return false;
    }
  }
  return true;
}

async function releaseTableIfEligible(
  db: D1Database,
  rsv: Record<string, unknown>,
  rsvTenant: string | null,
  opts?: { allowOccupiedRelease?: boolean; preferLowercaseAvailable?: boolean }
): Promise<void> {
  if (!rsv.table_id) return;
  if (!(await canResetTableToAvailableOnCancel(db, rsv, rsvTenant, opts))) {
    return;
  }
  const targetStatus = opts?.preferLowercaseAvailable ? 'available' : 'Available';
  if (rsvTenant) {
    const res = await db
      .prepare(`UPDATE cafe_tables SET status = '${targetStatus}' WHERE id = ? AND status = 'Reserved' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
      .bind(rsv.table_id, rsvTenant)
      .run()
      .catch(() =>
        rsvTenant === 'default'
          ? db.prepare(`UPDATE cafe_tables SET status = '${targetStatus}' WHERE id = ? AND status = 'Reserved'`).bind(rsv.table_id).run()
          : undefined
      );
    const changes = Number((res as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0);
    if (changes === 0 || opts?.preferLowercaseAvailable) {
      await db
        .prepare("UPDATE cafe_tables SET status = 'available' WHERE id = ? AND LOWER(COALESCE(status, '')) IN ('reserved', 'occupied', 'seated') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(rsv.table_id, rsvTenant)
        .run()
        .catch(() =>
          rsvTenant === 'default'
            ? db.prepare("UPDATE cafe_tables SET status = 'available' WHERE id = ? AND LOWER(COALESCE(status, '')) IN ('reserved', 'occupied', 'seated')").bind(rsv.table_id).run()
            : undefined
        );
    }
  } else {
    await db.prepare(`UPDATE cafe_tables SET status = '${targetStatus}' WHERE id = ? AND status = 'Reserved'`).bind(rsv.table_id).run();
  }
}

function resolveEffectiveRsvTenant(rsv: Record<string, unknown>, tenantId: string): string | null {
  return tenantId === '*' || tenantId.toLowerCase() === 'hq'
    ? ('tenant_id' in rsv &&
       rsv.tenant_id !== undefined &&
       rsv.tenant_id !== null &&
       String(rsv.tenant_id).trim() &&
       String(rsv.tenant_id).trim() !== '*' &&
       String(rsv.tenant_id).trim().toLowerCase() !== 'hq'
        ? String(rsv.tenant_id).trim()
        : null)
    : tenantId;
}

// PATCH /api/reservations/:id — update reservation status, table, or party size
reservationsRouter.patch('/:id', optionalAuth() as any, requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const id = c.req.param('id');

  let rsv: Record<string, unknown> | null = null;
  try {
    rsv = await db
      .prepare("SELECT * FROM reservations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
      .bind(id, tenantId, tenantId)
      .first<Record<string, unknown>>();
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
    }
  }
  if (!rsv && (tenantId === 'default' || tenantId === '*')) {
    rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>().catch(() => null);
  }
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  const currentStatus = String(rsv.status ?? '').trim().toLowerCase();
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const nextStatus = body.status !== undefined ? String(body.status).trim().toLowerCase() : undefined;
  const hasCancelledAtColumn = 'cancelled_at' in rsv;
  const isReopeningCancelled =
    hasCancelledAtColumn &&
    currentStatus === 'cancelled' &&
    rsv.cancelled_at !== undefined &&
    rsv.cancelled_at !== null &&
    nextStatus === 'confirmed';
  if (TERMINAL_RESERVATION_STATUSES.has(currentStatus) && !isReopeningCancelled) {
    const terminalStatusCode = hasCancelledAtColumn && currentStatus === 'completed' ? 400 : 409;
    return c.json({ success: false, error: `Cannot modify a ${currentStatus} reservation` }, terminalStatusCode);
  }

  const nextTableId = body.table_id !== undefined
    ? String(body.table_id).trim()
    : (rsv.table_id !== undefined && rsv.table_id !== null ? String(rsv.table_id).trim() : '');
  const nextPartySize = body.party_size !== undefined
    ? Number(body.party_size)
    : body.guest_count !== undefined
      ? Number(body.guest_count)
      : Number(rsv.party_size ?? rsv.guest_count ?? rsv.pax ?? 1);
  if ((body.party_size !== undefined || body.guest_count !== undefined) && (!Number.isFinite(nextPartySize) || !Number.isInteger(nextPartySize) || nextPartySize < 1)) {
    return c.json({ success: false, error: 'party_size must be a positive integer' }, 400);
  }
  const nextDate = body.date !== undefined
    ? String(body.date).trim()
    : body.reservation_date !== undefined
      ? String(body.reservation_date).trim()
      : body.reserved_date !== undefined
        ? String(body.reserved_date).trim()
        : String(rsv.date ?? rsv.reservation_date ?? rsv.reserved_date ?? '').trim();
  const nextTime = body.time !== undefined
    ? String(body.time).trim()
    : body.reservation_time !== undefined
      ? String(body.reservation_time).trim()
      : body.reserved_time !== undefined
        ? String(body.reserved_time).trim()
        : String(rsv.time ?? rsv.reservation_time ?? rsv.reserved_time ?? '').trim();

  const rsvTenant = resolveEffectiveRsvTenant(rsv, tenantId);
  const targetTenant = rsvTenant || 'default';
  const isTransitioningToTerminal = Boolean(nextStatus && TERMINAL_RESERVATION_STATUSES.has(nextStatus));
  const hasSlotOrTableMutation =
    body.table_id !== undefined ||
    body.date !== undefined ||
    body.reservation_date !== undefined ||
    body.reserved_date !== undefined ||
    body.time !== undefined ||
    body.reservation_time !== undefined ||
    body.reserved_time !== undefined;

  let canonicalNextTableId = nextTableId;
  if (!isTransitioningToTerminal && (hasSlotOrTableMutation || body.party_size !== undefined || body.guest_count !== undefined || nextTableId)) {
    if (nextTableId) {
      let tableRow: Record<string, unknown> | null = null;
      try {
        tableRow = await db
          .prepare("SELECT * FROM cafe_tables WHERE (id = ? OR table_number = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(nextTableId, nextTableId, targetTenant)
          .first<Record<string, unknown>>();
      } catch {
        if (targetTenant === 'default') {
          tableRow = await db
            .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
            .bind(nextTableId, nextTableId)
            .first<Record<string, unknown>>()
            .catch(() => null);
        }
      }
      if (!tableRow || !matchesTenantRow(tableRow, targetTenant)) {
        if (body.table_id !== undefined) {
          return c.json({ success: false, error: 'Table not found in tenant' }, 404);
        }
      } else {
        if (tableRow.id !== undefined && tableRow.id !== null) {
          canonicalNextTableId = String(tableRow.id).trim();
        }
        if (!isBookableTableRow(tableRow)) {
          return c.json({ success: false, error: 'Table is unavailable for reservation' }, 400);
        }
        const tableCapacity = Number(tableRow.capacity ?? tableRow.seats ?? 0);
        if (Number.isFinite(tableCapacity) && tableCapacity > 0 && nextPartySize > tableCapacity) {
          return c.json({ success: false, error: 'Party size exceeds table capacity' }, 400);
        }
      }
    }
    if (hasSlotOrTableMutation && canonicalNextTableId && nextDate && nextTime) {
      let conflictCandidates: Record<string, unknown>[] = [];
      try {
        const res = await db
          .prepare(
            "SELECT * FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated') AND id != ?"
          )
          .bind(canonicalNextTableId, nextDate, nextTime, id)
          .all<Record<string, unknown>>();
        conflictCandidates = res?.results || [];
      } catch {
        try {
          const res = await db
            .prepare(
              "SELECT * FROM reservations WHERE table_id = ? AND reservation_date = ? AND reservation_time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated') AND id != ?"
            )
            .bind(canonicalNextTableId, nextDate, nextTime, id)
            .all<Record<string, unknown>>();
          conflictCandidates = res?.results || [];
        } catch {
          const res = await db
            .prepare(
              "SELECT * FROM reservations WHERE table_id = ? AND reserved_date = ? AND reserved_time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated') AND id != ?"
            )
            .bind(canonicalNextTableId, nextDate, nextTime, id)
            .all<Record<string, unknown>>()
            .catch(() => ({ results: [] as Record<string, unknown>[] }));
          conflictCandidates = res?.results || [];
        }
      }
      for (const row of conflictCandidates) {
        if (!row || String(row.id ?? '') === String(id)) continue;
        const rowTable = String(row.table_id ?? '').trim();
        if (rowTable && rowTable !== canonicalNextTableId && rowTable !== nextTableId) continue;
        const rowDateCandidates = [row.date, row.reservation_date, row.reserved_date]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean);
        if (rowDateCandidates.length > 0 && !rowDateCandidates.includes(nextDate) && !rowDateCandidates.some((d) => d.startsWith(nextDate))) continue;
        const rowTimeCandidates = [row.time, row.reserved_time, row.reservation_time]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean);
        if (rowTimeCandidates.length > 0 && !rowTimeCandidates.includes(nextTime) && !rowTimeCandidates.some((t) => t.endsWith(nextTime))) continue;
        const rowStatus = String(row.status ?? '').trim().toLowerCase();
        if (rowStatus && !ACTIVE_RESERVATION_STATUSES.has(rowStatus)) continue;
        if (await matchesReservationTenant(db, row, targetTenant)) {
          return c.json({ success: false, error: 'Table already reserved for this time slot' }, 409);
        }
      }
    }
  }

  const now = new Date().toISOString();
  const effectiveStatus = nextStatus || currentStatus || 'confirmed';
  const prevTableId = rsv.table_id !== undefined && rsv.table_id !== null ? String(rsv.table_id).trim() : '';
  const hasPartySizeUpdate = body.party_size !== undefined || body.guest_count !== undefined;
  const hasDateUpdate = body.date !== undefined || body.reservation_date !== undefined || body.reserved_date !== undefined;
  const hasTimeUpdate = body.time !== undefined || body.reservation_time !== undefined || body.reserved_time !== undefined;
  if (rsvTenant) {
    try {
      if (hasPartySizeUpdate || hasDateUpdate || hasTimeUpdate) {
        await db
          .prepare(
            "UPDATE reservations SET status = ?, table_id = COALESCE(?, table_id), guest_count = COALESCE(?, guest_count), date = COALESCE(?, date), time = COALESCE(?, time), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(
            effectiveStatus,
            body.table_id !== undefined ? canonicalNextTableId : null,
            hasPartySizeUpdate ? nextPartySize : null,
            hasDateUpdate ? nextDate : null,
            hasTimeUpdate ? nextTime : null,
            now,
            id,
            rsvTenant
          )
          .run()
          .catch(() =>
            db
              .prepare(
                "UPDATE reservations SET status = ?, table_id = COALESCE(?, table_id), party_size = COALESCE(?, party_size), reservation_date = COALESCE(?, reservation_date), reservation_time = COALESCE(?, reservation_time), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(
                effectiveStatus,
                body.table_id !== undefined ? canonicalNextTableId : null,
                hasPartySizeUpdate ? nextPartySize : null,
                hasDateUpdate ? nextDate : null,
                hasTimeUpdate ? nextTime : null,
                now,
                id,
                rsvTenant
              )
              .run()
          )
          .catch(() =>
            db
              .prepare(
                "UPDATE reservations SET status = ?, table_id = COALESCE(?, table_id), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(effectiveStatus, body.table_id !== undefined ? canonicalNextTableId : null, now, id, rsvTenant)
              .run()
          );
      } else {
        await db
          .prepare("UPDATE reservations SET status = ?, table_id = COALESCE(?, table_id), updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(effectiveStatus, body.table_id !== undefined ? canonicalNextTableId : null, now, id, rsvTenant)
          .run();
      }
    } catch (err) {
      if (rsvTenant !== 'default') throw err;
      await db
        .prepare('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?')
        .bind(effectiveStatus, now, id)
        .run();
    }
  } else {
    await db.prepare('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?').bind(effectiveStatus, now, id).run();
  }
  if (isReopeningCancelled) {
    await db
      .prepare('UPDATE reservations SET cancelled_at = NULL WHERE id = ?')
      .bind(id)
      .run()
      .catch(() => {});
  }

  if (body.table_id !== undefined && prevTableId && canonicalNextTableId && prevTableId !== canonicalNextTableId) {
    await releaseTableIfEligible(db, rsv, rsvTenant, { allowOccupiedRelease: false, preferLowercaseAvailable: true });
  }

  if (nextStatus === 'cancelled' || nextStatus === 'completed' || nextStatus === 'no_show') {
    await releaseTableIfEligible(db, rsv, rsvTenant, { allowOccupiedRelease: true, preferLowercaseAvailable: true });
  } else if (nextStatus === 'seated' && canonicalNextTableId) {
    await db
      .prepare("UPDATE cafe_tables SET status = 'occupied' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(canonicalNextTableId, targetTenant)
      .run()
      .catch(() =>
        targetTenant === 'default'
          ? db.prepare("UPDATE cafe_tables SET status = 'occupied' WHERE id = ?").bind(canonicalNextTableId).run()
          : undefined
      );
  }

  return c.json({
    success: true,
    data: {
      id,
      status: effectiveStatus,
      table_id: canonicalNextTableId || null,
      party_size: nextPartySize,
      guest_count: nextPartySize,
      date: nextDate || null,
      time: nextTime || null,
      reservation_date: nextDate || null,
      reservation_time: nextTime || null,
    },
  });
});

// PATCH /api/reservations/:id/status — update reservation status with terminal state guard
reservationsRouter.patch('/:id/status', optionalAuth() as any, requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const id = c.req.param('id');

  let rsv: Record<string, unknown> | null = null;
  try {
    rsv = await db
      .prepare("SELECT * FROM reservations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
      .bind(id, tenantId, tenantId)
      .first<Record<string, unknown>>();
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
    }
  }
  if (!rsv && (tenantId === 'default' || tenantId === '*')) {
    rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>().catch(() => null);
  }
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  const currentStatus = String(rsv.status ?? '').trim().toLowerCase();
  if (TERMINAL_RESERVATION_STATUSES.has(currentStatus)) {
    return c.json({ success: false, error: `Cannot modify a ${currentStatus} reservation` }, 409);
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const nextStatus = body.status !== undefined ? String(body.status).trim().toLowerCase() : '';
  if (!nextStatus) {
    return c.json({ success: false, error: 'status is required' }, 400);
  }

  const rsvTenant = resolveEffectiveRsvTenant(rsv, tenantId);
  const targetTenant = rsvTenant || 'default';
  const now = new Date().toISOString();

  if (rsvTenant) {
    await db
      .prepare("UPDATE reservations SET status = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(nextStatus, now, id, rsvTenant)
      .run()
      .catch((err) => {
        if (rsvTenant !== 'default') throw err;
        return db.prepare('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?').bind(nextStatus, now, id).run();
      });
  } else {
    await db.prepare('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?').bind(nextStatus, now, id).run();
  }

  if (TERMINAL_RESERVATION_STATUSES.has(nextStatus)) {
    await releaseTableIfEligible(db, rsv, rsvTenant, { allowOccupiedRelease: true, preferLowercaseAvailable: true });
  } else if (nextStatus === 'seated' && rsv.table_id) {
    await db
      .prepare("UPDATE cafe_tables SET status = 'occupied' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(rsv.table_id, targetTenant)
      .run()
      .catch(() =>
        targetTenant === 'default'
          ? db.prepare("UPDATE cafe_tables SET status = 'occupied' WHERE id = ?").bind(rsv.table_id).run()
          : undefined
      );
  }

  return c.json({ success: true, data: { id, status: nextStatus } });
});

// POST /api/reservations/:id/cancel — cancel a reservation and release table if no active session
reservationsRouter.post('/:id/cancel', optionalAuth() as any, requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const id = c.req.param('id');

  let rsv: Record<string, unknown> | null = null;
  try {
    rsv = await db
      .prepare("SELECT * FROM reservations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
      .bind(id, tenantId, tenantId)
      .first<Record<string, unknown>>();
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
    }
  }
  if (!rsv && (tenantId === 'default' || tenantId === '*')) {
    rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>().catch(() => null);
  }
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  const currentStatus = String(rsv.status ?? '').trim().toLowerCase();
  if (TERMINAL_RESERVATION_STATUSES.has(currentStatus)) {
    return c.json({ success: false, error: `Cannot cancel a ${currentStatus} reservation` }, 409);
  }

  const rsvTenant = resolveEffectiveRsvTenant(rsv, tenantId);
  const now = new Date().toISOString();
  if (rsvTenant) {
    await db
      .prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(now, id, rsvTenant)
      .run()
      .catch((err) => {
        if (rsvTenant !== 'default') throw err;
        return db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, id).run();
      });
  } else {
    await db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, id).run();
  }

  await releaseTableIfEligible(db, rsv, rsvTenant, { allowOccupiedRelease: true, preferLowercaseAvailable: true });
  return c.json({ success: true, data: { id, status: 'cancelled' }, message: 'Reservation cancelled' });
});

// POST /api/reservations/waitlist/:id/seat — seat a waitlist entry onto an available table
reservationsRouter.post('/waitlist/:id/seat', requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  let entry: Record<string, unknown> | null = null;
  let sourceTable: 'waitlist' | 'reservation_waitlist' | 'reservations' = 'waitlist';
  for (const tblName of ['waitlist', 'reservation_waitlist', 'reservations'] as const) {
    if (tenantId !== '*') {
      try {
        const found = await db
          .prepare(`SELECT * FROM ${tblName} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
          .bind(id, tenantId)
          .first<Record<string, unknown>>();
        if (found) {
          entry = found;
          sourceTable = tblName;
          break;
        }
      } catch {
        if (tenantId === 'default') {
          const found = await db
            .prepare(`SELECT * FROM ${tblName} WHERE id = ?`)
            .bind(id)
            .first<Record<string, unknown>>()
            .catch(() => null);
          if (found && matchesTenantRow(found, tenantId)) {
            entry = found;
            sourceTable = tblName;
            break;
          }
        }
      }
    } else {
      const found = await db
        .prepare(`SELECT * FROM ${tblName} WHERE id = ?`)
        .bind(id)
        .first<Record<string, unknown>>()
        .catch(() => null);
      if (found) {
        entry = found;
        sourceTable = tblName;
        break;
      }
    }
  }

  if (!entry || !matchesTenantRow(entry, tenantId)) {
    return c.json({ success: false, error: 'Waitlist entry not found' }, 404);
  }
  const effectiveTenant =
    tenantId === '*' || tenantId.toLowerCase() === 'hq'
      ? (entry.tenant_id &&
         String(entry.tenant_id).trim() &&
         String(entry.tenant_id).trim() !== '*' &&
         String(entry.tenant_id).trim().toLowerCase() !== 'hq'
          ? String(entry.tenant_id).trim()
          : 'default')
      : tenantId;
  const entryStatus = String(entry.status ?? '').trim().toLowerCase();
  if (TERMINAL_RESERVATION_STATUSES.has(entryStatus) || entryStatus === 'seated') {
    return c.json({ success: false, error: `Waitlist entry is already ${entryStatus}` }, 409);
  }

  const tableId = String(body.table_id ?? entry?.table_id ?? '').trim();
  if (!tableId) {
    return c.json({ success: false, error: 'table_id is required' }, 400);
  }

  let tableRow: Record<string, unknown> | null = null;
  try {
    tableRow = await db
      .prepare("SELECT * FROM cafe_tables WHERE (id = ? OR table_number = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(tableId, tableId, effectiveTenant)
      .first<Record<string, unknown>>();
  } catch {
    if (effectiveTenant === 'default') {
      tableRow = await db
        .prepare('SELECT * FROM cafe_tables WHERE id = ? OR table_number = ?')
        .bind(tableId, tableId)
        .first<Record<string, unknown>>()
        .catch(() => null);
    }
  }
  if (!tableRow || !matchesTenantRow(tableRow, effectiveTenant)) {
    return c.json({ success: false, error: 'Table not found in tenant' }, 404);
  }

  if (!isBookableTableRow(tableRow)) {
    return c.json({ success: false, error: 'Table is in maintenance or out of order' }, 400);
  }
  const tableStatus = String(tableRow.status ?? 'available').trim().toLowerCase();
  if (tableStatus !== 'available' && tableStatus !== 'free') {
    return c.json({ success: false, error: 'Table is not available for seating' }, 409);
  }

  const partySize = Number(body.party_size ?? body.guest_count ?? entry?.party_size ?? entry?.guest_count ?? entry?.pax ?? 1);
  const tableCapacity = Number(tableRow.capacity ?? tableRow.seats ?? 0);
  if (Number.isFinite(tableCapacity) && tableCapacity > 0 && partySize > tableCapacity) {
    return c.json({ success: false, error: 'Party size exceeds table capacity' }, 400);
  }

  const canonicalTableId = String(tableRow.id ?? tableId);
  if (entry) {
    try {
      await db
        .prepare(`UPDATE ${sourceTable} SET status = 'seated', table_id = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`)
        .bind(canonicalTableId, id, effectiveTenant)
        .run();
    } catch {
      if (effectiveTenant === 'default') {
        await db
          .prepare(`UPDATE ${sourceTable} SET status = 'seated' WHERE id = ?`)
          .bind(id)
          .run()
          .catch(() => undefined);
      }
    }
  }

  await db
    .prepare("UPDATE cafe_tables SET status = 'occupied' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
    .bind(canonicalTableId, effectiveTenant)
    .run()
    .catch((err) => {
      if (effectiveTenant !== 'default') throw err;
      return db.prepare("UPDATE cafe_tables SET status = 'occupied' WHERE id = ?").bind(canonicalTableId).run();
    });

  return c.json({
    success: true,
    data: { id, table_id: canonicalTableId, status: 'seated', party_size: partySize },
  });
});

// PATCH /api/reservations/:id/approve
reservationsRouter.patch('/:id/approve', requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const id = c.req.param('id');

  let rsv: Record<string, unknown> | null = null;
  try {
    rsv = await db
      .prepare("SELECT * FROM reservations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
      .bind(id, tenantId, tenantId)
      .first<Record<string, unknown>>();
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
    }
  }
  if (!rsv && (tenantId === 'default' || tenantId === '*')) {
    rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>().catch(() => null);
  }
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  const currentStatus = String(rsv.status ?? '').trim().toLowerCase();
  if (TERMINAL_RESERVATION_STATUSES.has(currentStatus)) {
    return c.json({ success: false, error: `Cannot approve a ${currentStatus} reservation` }, 409);
  }

  const rsvTenant = resolveEffectiveRsvTenant(rsv, tenantId);
  const now = new Date().toISOString();
  if (rsvTenant) {
    await db
      .prepare("UPDATE reservations SET status = 'confirmed', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(now, id, rsvTenant)
      .run()
      .catch(() =>
        rsvTenant === 'default'
          ? db.prepare("UPDATE reservations SET status = 'confirmed', updated_at = ? WHERE id = ?").bind(now, id).run()
          : undefined
      );
  } else {
    await db.prepare("UPDATE reservations SET status = 'confirmed', updated_at = ? WHERE id = ?").bind(now, id).run();
  }
  return c.json({ success: true, message: 'Reservation confirmed' });
});

// PATCH /api/reservations/:id/reject
reservationsRouter.patch('/:id/reject', requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  const id = c.req.param('id');

  let rsv: Record<string, unknown> | null = null;
  try {
    rsv = await db
      .prepare("SELECT * FROM reservations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
      .bind(id, tenantId, tenantId)
      .first<Record<string, unknown>>();
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
    }
  }
  if (!rsv && (tenantId === 'default' || tenantId === '*')) {
    rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>().catch(() => null);
  }
  if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  const currentStatus = String(rsv.status ?? '').trim().toLowerCase();
  if (TERMINAL_RESERVATION_STATUSES.has(currentStatus)) {
    return c.json({ success: false, error: `Cannot reject a ${currentStatus} reservation` }, 409);
  }

  const rsvTenant = resolveEffectiveRsvTenant(rsv, tenantId);
  const now = new Date().toISOString();
  if (rsvTenant) {
    await db
      .prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(now, id, rsvTenant)
      .run()
      .catch(() =>
        rsvTenant === 'default'
          ? db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, id).run()
          : undefined
      );
  } else {
    await db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, id).run();
  }

  await releaseTableIfEligible(db, rsv, rsvTenant);
  return c.json({ success: true, message: 'Reservation rejected' });
});

// DELETE /api/reservations/:id
reservationsRouter.delete(
  '/:id',
  optionalAuth() as any,
  (async (c: any, next: () => Promise<void>) => {
    const existingUser = c.get?.('user') as { id?: string; sub?: string; role?: string } | undefined;
    if (existingUser && String(existingUser.role || '').trim().toLowerCase() === 'customer') {
      const tenantErr = verifyReservationStaffTenant(c);
      if (tenantErr) return tenantErr;
      return next();
    }
    return (requireReservationStaff() as any)(c, next);
  }) as any,
  async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = resolveRequestTenantId(c);
    const id = c.req.param('id');
    const user = c.get('user' as never) as { id?: string; sub?: string; role?: string } | undefined;
    const isCustomer = String(user?.role || '').trim().toLowerCase() === 'customer';

    let rsv: Record<string, unknown> | null = null;
    try {
      rsv = await db
        .prepare("SELECT * FROM reservations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
        .bind(id, tenantId, tenantId)
        .first<Record<string, unknown>>();
    } catch {
      if (tenantId === 'default' || tenantId === '*') {
        rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>();
      }
    }
    if (!rsv && (tenantId === 'default' || tenantId === '*')) {
      rsv = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Record<string, unknown>>().catch(() => null);
    }
    if (!rsv || !(await matchesReservationTenant(db, rsv, tenantId))) {
      return c.json({ success: false, error: 'Reservation not found' }, 404);
    }

    if (isCustomer) {
      const callerId = String(user?.id ?? user?.sub ?? '').trim();
      const ownerId = String(rsv.customer_id ?? '').trim();
      if (!callerId || !ownerId || ownerId !== callerId) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
    }

    const currentStatus = String(rsv.status ?? '').trim().toLowerCase();
    if (isCustomer && currentStatus === 'seated') {
      return c.json({ success: false, error: 'Cannot cancel a seated reservation' }, 400);
    }
    if (TERMINAL_RESERVATION_STATUSES.has(currentStatus)) {
      return c.json({ success: false, error: `Cannot cancel a ${currentStatus} reservation` }, isCustomer ? 400 : 409);
    }

    const rsvTenant = resolveEffectiveRsvTenant(rsv, tenantId);
    const now = new Date().toISOString();
    if (rsvTenant) {
      await db
        .prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(now, id, rsvTenant)
        .run()
        .catch(() =>
          rsvTenant === 'default'
            ? db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, id).run()
            : undefined
        );
    } else {
      await db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, id).run();
    }

    await releaseTableIfEligible(db, rsv, rsvTenant);
    return c.json({ success: true, message: 'Reservation cancelled' });
  }
);

export const waitlistRouter = new Hono<{ Bindings: Env }>();
waitlistRouter.get('/', optionalAuth() as any, requireReservationStaff() as any, async (c) => {
  const db = c.env.AURA_DB;
  const tenantId = resolveRequestTenantId(c);
  let rows: Record<string, unknown>[] = [];
  try {
    const stmt = tenantId !== '*'
      ? db.prepare("SELECT * FROM waitlist WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at ASC").bind(tenantId)
      : db.prepare('SELECT * FROM waitlist ORDER BY created_at ASC');
    const res = await stmt.all<Record<string, unknown>>();
    rows = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
  } catch {
    rows = [];
  }
  return c.json({ success: true, data: rows });
});
