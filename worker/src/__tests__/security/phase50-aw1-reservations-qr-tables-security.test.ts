// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { reservationsRouter } from '@aura/domain-reservation';
import { scanQrAndResolveTable } from '../../../../packages/domain/table/commands/qr-scan';
import { adminQrRouter } from '../../routes/admin-qr';
import * as qrGenerator from '../../tree/qr/generator';
import { registerSessionCrudHandlers } from '../../routes/table-sessions-handlers/session-handlers';
import { registerTableCrudHandlers } from '../../routes/openapi-tables-handlers/table-crud-handlers';
import { registerZoneCrudHandlers } from '../../routes/openapi-tables-handlers/zone-crud-handlers';
import { registerBookingsHandler } from '../../routes/cal-booking-webhook-handlers/bookings-handler';
import { registerWebhookHandler } from '../../routes/cal-booking-webhook-handlers/webhook-handler';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const s = sqlite.prepare(sql);
        const row = s.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
        const s = sqlite.prepare(sql);
        const rows = s.all(...(params as never[])) as unknown as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const s = sqlite.prepare(sql);
        const info = s.run(...(params as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    };
    return stmt;
  };

  return {
    prepare,
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const st of statements) {
        out.push(await st.run());
      }
      return out;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}

function createSchema(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE cafe_tables (
      id TEXT PRIMARY KEY,
      number INTEGER,
      table_number TEXT,
      name TEXT,
      zone TEXT DEFAULT 'Indoor',
      zone_id TEXT,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available',
      is_active INTEGER DEFAULT 1,
      qr_slug TEXT,
      qr_code TEXT,
      current_order_id TEXT,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      shape TEXT DEFAULT 'rect',
      notes TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE table_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT,
      capacity INTEGER DEFAULT 20,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE reservations (
      id TEXT PRIMARY KEY,
      cal_booking_uid TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      guest_name TEXT,
      guest_phone TEXT,
      guest_email TEXT,
      party_size INTEGER DEFAULT 2,
      date TEXT,
      time TEXT,
      reservation_date TEXT,
      reservation_time TEXT,
      table_id TEXT,
      zone_preference TEXT,
      notes TEXT,
      special_requests TEXT,
      status TEXT DEFAULT 'confirmed',
      pre_order_id TEXT,
      created_by TEXT,
      confirmed_at TEXT,
      seated_at TEXT,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE waitlist (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      zone_preference TEXT DEFAULT 'any',
      estimated_wait INTEGER DEFAULT 15,
      status TEXT DEFAULT 'waiting',
      table_id TEXT,
      notified_at TEXT,
      seated_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE table_qr_codes (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      zone TEXT NOT NULL,
      qr_slug TEXT NOT NULL,
      qr_url TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      scans_count INTEGER DEFAULT 0,
      last_scanned_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE qr_scan_logs (
      id TEXT PRIMARY KEY,
      qr_slug TEXT NOT NULL,
      table_id TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      session_id TEXT,
      converted_to_order INTEGER DEFAULT 0,
      order_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      scanned_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE table_sessions (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      started_by TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      guest_count INTEGER DEFAULT 1,
      notes TEXT,
      order_id TEXT,
      total_amount REAL DEFAULT 0,
      duration_minutes INTEGER,
      status TEXT DEFAULT 'active',
      tenant_id TEXT DEFAULT 'default'
    );

    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      table_id TEXT,
      table_number TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      total REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cal_uid TEXT NOT NULL,
      title TEXT,
      start_time TEXT,
      end_time TEXT,
      attendee_name TEXT,
      attendee_email TEXT,
      guest_phone TEXT,
      guest_email TEXT,
      status TEXT DEFAULT 'confirmed',
      cancellation_reason TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return sqlite;
}

describe('Phase 50 Slice AW1 — Reservations, QR Codes, Table Sessions, OpenAPI Tables/Zones & Cal.com Webhooks Security', () => {
  describe('1. Public Reservation Availability PII Redaction & Booking Capacity/Date Validation', () => {
    it('redacts guest PII from GET /availability while exposing reserved_slots', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES ('tbl-1', 1, 'Table 1', 'Indoor', 4, 'available', 1, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO reservations (id, customer_name, customer_phone, customer_email, guest_name, guest_phone, guest_email, party_size, date, time, reservation_date, reservation_time, table_id, notes, special_requests, status, tenant_id)
           VALUES ('rsv-1', 'Nguyen Van Secret', '0909998887', 'secret@vip.vn', 'Nguyen Van Secret', '0909998887', 'secret@vip.vn', 3, '2027-05-10', '19:00', '2027-05-10', '19:00', 'tbl-1', 'VIP allergy note', 'Birthday cake surprise', 'confirmed', 'store-a')`
        )
        .run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.route('/api/reservations', reservationsRouter);

      const res = await app.request(
        'http://localhost/api/reservations/availability?date=2027-05-10&time=19:00&party_size=2',
        { method: 'GET' },
        { AURA_DB: db } as unknown as Env
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const rawJson = JSON.stringify(body);

      // Must NOT leak any guest PII or private notes
      expect(rawJson).not.toContain('Nguyen Van Secret');
      expect(rawJson).not.toContain('0909998887');
      expect(rawJson).not.toContain('secret@vip.vn');
      expect(rawJson).not.toContain('VIP allergy note');
      expect(rawJson).not.toContain('Birthday cake surprise');
      expect(body.reservations).toBeUndefined();

      // Must expose non-PII reserved_slots summary
      expect(Array.isArray(body.reserved_slots)).toBe(true);
      const slots = body.reserved_slots as Array<Record<string, unknown>>;
      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({
        table_id: 'tbl-1',
        time: '19:00',
        reservation_time: '19:00',
        party_size: 3,
        status: 'confirmed',
      });
    });

    it('rejects past reservation dates, over-capacity tables, and maintenance/inactive tables on POST /', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES
             ('tbl-small', 1, 'Small 2-Top', 'Indoor', 2, 'available', 1, 'store-a'),
             ('tbl-maint', 2, 'Maint Table', 'Indoor', 6, 'maintenance', 1, 'store-a'),
             ('tbl-inactive', 3, 'Inactive Table', 'Indoor', 6, 'available', 0, 'store-a'),
             ('tbl-ok', 4, 'Family 6-Top', 'Indoor', 6, 'available', 1, 'store-a')`
        )
        .run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.route('/api/reservations', reservationsRouter);

      // 1. Past date -> 400
      const pastRes = await app.request(
        'http://localhost/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: 'Past Guest',
            guest_phone: '0901112222',
            party_size: 2,
            reservation_date: '2020-01-01',
            reservation_time: '18:00',
            table_id: 'tbl-ok',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(pastRes.status).toBe(400);

      // 2. Party size exceeds table capacity -> 400
      const capRes = await app.request(
        'http://localhost/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: 'Large Party',
            guest_phone: '0901112222',
            party_size: 5,
            reservation_date: '2027-06-15',
            reservation_time: '18:00',
            table_id: 'tbl-small',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(capRes.status).toBe(400);

      // 3. Maintenance table -> 400
      const maintRes = await app.request(
        'http://localhost/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: 'Maint Guest',
            guest_phone: '0901112222',
            party_size: 4,
            reservation_date: '2027-06-15',
            reservation_time: '18:00',
            table_id: 'tbl-maint',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(maintRes.status).toBe(400);

      // 4. Inactive table -> 400
      const inactiveRes = await app.request(
        'http://localhost/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: 'Inactive Guest',
            guest_phone: '0901112222',
            party_size: 4,
            reservation_date: '2027-06-15',
            reservation_time: '18:00',
            table_id: 'tbl-inactive',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(inactiveRes.status).toBe(400);

      // 5. Valid future booking within capacity -> 201
      const okRes = await app.request(
        'http://localhost/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: 'Valid Guest',
            guest_phone: '0901112222',
            party_size: 4,
            reservation_date: '2027-06-15',
            reservation_time: '18:00',
            table_id: 'tbl-ok',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(okRes.status).toBe(201);
    });
  });

  describe('2. Reservation State Machine & Table Status Release on Cancellation', () => {
    it('releases table to available on cancel when no active session exists, and blocks re-mutating terminal reservations with 409', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES ('tbl-rsv', 5, 'Table 5', 'Indoor', 4, 'reserved', 1, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO reservations (id, customer_name, customer_phone, party_size, date, time, table_id, status, tenant_id)
           VALUES ('rsv-cancel-1', 'Alice', '0901234567', 2, '2027-06-20', '19:00', 'tbl-rsv', 'confirmed', 'store-a')`
        )
        .run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { sub: 'staff-1', role: 'manager', tenant_id: 'store-a' } as never);
        await next();
      });
      app.route('/api/reservations', reservationsRouter);

      // Cancel via POST /:id/cancel
      const cancelRes = await app.request(
        'http://localhost/api/reservations/rsv-cancel-1/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Guest called to cancel' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(cancelRes.status).toBe(200);

      // Table status must be released back to available
      const tableAfterCancel = sqlite
        .prepare('SELECT status FROM cafe_tables WHERE id = ?')
        .get('tbl-rsv') as { status: string };
      expect(tableAfterCancel.status.toLowerCase()).toBe('available');

      // Attempting to transition a cancelled reservation back to seated via PATCH /:id/status must return 409
      const reSeatRes = await app.request(
        'http://localhost/api/reservations/rsv-cancel-1/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'seated' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(reSeatRes.status).toBe(409);

      // Attempting to mutate via PATCH /:id must also return 409
      const patchTerminalRes = await app.request(
        'http://localhost/api/reservations/rsv-cancel-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(patchTerminalRes.status).toBe(409);

      // Attempting to cancel again must return 409
      const doubleCancelRes = await app.request(
        'http://localhost/api/reservations/rsv-cancel-1/cancel',
        { method: 'POST' },
        { AURA_DB: db } as unknown as Env
      );
      expect(doubleCancelRes.status).toBe(409);
    });

    it('preserves table status on reservation cancel when an active table_sessions row exists', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES ('tbl-busy', 6, 'Table 6', 'Indoor', 4, 'occupied', 1, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO table_sessions (id, table_id, started_at, status, tenant_id)
           VALUES ('sess-active-1', 'tbl-busy', datetime('now'), 'active', 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO reservations (id, customer_name, customer_phone, party_size, date, time, table_id, status, tenant_id)
           VALUES ('rsv-busy-1', 'Bob', '0902223333', 2, '2027-06-20', '20:00', 'tbl-busy', 'confirmed', 'store-a')`
        )
        .run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { sub: 'staff-1', role: 'manager', tenant_id: 'store-a' } as never);
        await next();
      });
      app.route('/api/reservations', reservationsRouter);

      const cancelRes = await app.request(
        'http://localhost/api/reservations/rsv-busy-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(cancelRes.status).toBe(200);

      const tableRow = sqlite
        .prepare('SELECT status FROM cafe_tables WHERE id = ?')
        .get('tbl-busy') as { status: string };
      expect(tableRow.status).toBe('occupied');
    });
  });

  describe('3. QR Scan Table Availability & Admin QR Signed PNG Export', () => {
    it('rejects scanning QR codes for inactive or maintenance tables with 409 and isolates tenants', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES
             ('tbl-qr-maint', 10, 'Table 10', 'Patio', 4, 'maintenance', 1, 'store-a'),
             ('tbl-qr-inactive', 11, 'Table 11', 'Patio', 4, 'available', 0, 'store-a'),
             ('tbl-qr-active', 12, 'Table 12', 'Patio', 4, 'available', 1, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO table_qr_codes (id, table_id, table_number, zone, qr_slug, qr_url, status, tenant_id)
           VALUES
             ('qr-10', 'tbl-qr-maint', 10, 'Patio', 'slug-maint', 'https://order.example/order/slug-maint', 'active', 'store-a'),
             ('qr-11', 'tbl-qr-inactive', 11, 'Patio', 'slug-inactive', 'https://order.example/order/slug-inactive', 'active', 'store-a'),
             ('qr-12', 'tbl-qr-active', 12, 'Patio', 'slug-active', 'https://order.example/order/slug-active', 'active', 'store-a')`
        )
        .run();

      // Maintenance table -> 409
      const maintScan = await scanQrAndResolveTable(db, {
        slug: 'slug-maint',
        ip: '127.0.0.1',
        userAgent: 'TestAgent',
        tenantId: 'store-a',
      });
      expect(maintScan.ok).toBe(false);
      expect(maintScan.status).toBe(409);
      if (!maintScan.ok) {
        expect(maintScan.error).toBe('Table is currently unavailable');
      }

      // Inactive table -> 409
      const inactiveScan = await scanQrAndResolveTable(db, {
        slug: 'slug-inactive',
        ip: '127.0.0.1',
        userAgent: 'TestAgent',
        tenantId: 'store-a',
      });
      expect(inactiveScan.ok).toBe(false);
      expect(inactiveScan.status).toBe(409);

      // Cross-tenant scan -> 404
      const crossTenantScan = await scanQrAndResolveTable(db, {
        slug: 'slug-active',
        ip: '127.0.0.1',
        userAgent: 'TestAgent',
        tenantId: 'store-b',
      });
      expect(crossTenantScan.ok).toBe(false);
      expect(crossTenantScan.status).toBe(404);

      // Same-tenant active table -> 200
      const activeScan = await scanQrAndResolveTable(db, {
        slug: 'slug-active',
        ip: '127.0.0.1',
        userAgent: 'TestAgent',
        tenantId: 'store-a',
      });
      expect(activeScan.ok).toBe(true);
      expect(activeScan.status).toBe(200);
    });

    it('embeds HMAC-signed QR URL (sig= & exp=) when downloading PNG from GET /api/admin/qr/:slug/download', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES ('tbl-qr-dl', 20, 'Table 20', 'Indoor', 4, 'available', 1, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO table_qr_codes (id, table_id, table_number, zone, qr_slug, qr_url, status, tenant_id)
           VALUES ('qr-20', 'tbl-qr-dl', 20, 'Indoor', 'slug-dl-20', 'https://order.containers.vn/order/slug-dl-20', 'active', 'store-a')`
        )
        .run();

      // Verify generatePNG encodes the signed URL when passed
      const signedSample = 'https://order.containers.vn/order/slug-dl-20?exp=9999999999&sig=abcdef123456';
      const pngSigned = await qrGenerator.generatePNG('slug-dl-20', 'https://order.containers.vn', signedSample);
      const pngUnsigned = await qrGenerator.generatePNG('slug-dl-20', 'https://order.containers.vn');
      expect(pngSigned.byteLength).toBeGreaterThan(60);
      expect(Buffer.from(pngSigned).equals(Buffer.from(pngUnsigned))).toBe(false);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { sub: 'mgr-1', role: 'manager', tenant_id: 'store-a' } as never);
        await next();
      });
      app.route('/api/admin/qr', adminQrRouter);

      const res = await app.request(
        'http://localhost/api/admin/qr/slug-dl-20/download',
        { method: 'GET' },
        {
          AURA_DB: db,
          QR_SIGNING_SECRET: 'super-secret-qr-signing-key-for-test',
          JWT_SECRET: 'super-secret-jwt-key-for-qr-signing-test',
          FRONTEND_URL: 'https://order.containers.vn',
        } as unknown as Env
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      const downloadedBytes = new Uint8Array(await res.arrayBuffer());
      // Must NOT equal the unsigned PNG because it encodes ?exp=...&sig=...
      expect(Buffer.from(downloadedBytes).equals(Buffer.from(pngUnsigned))).toBe(false);
    });
  });

  describe('4. Table Session Close Guard Against Active Unpaid Orders', () => {
    it('blocks closing a table session with unpaid active orders (409) unless manager forces or order is paid', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES ('tbl-sess-1', 30, 'Table 30', 'Indoor', 4, 'occupied', 1, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO table_sessions (id, table_id, started_by, started_at, guest_count, status, tenant_id)
           VALUES ('sess-open-1', 'tbl-sess-1', 'waiter-1', datetime('now', '-30 minutes'), 3, 'active', 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO orders (id, order_number, table_id, status, payment_status, total, total_amount, tenant_id)
           VALUES ('ord-unpaid-1', 'ORD-301', 'tbl-sess-1', 'preparing', 'unpaid', 185000, 185000, 'store-a')`
        )
        .run();

      let currentRole = 'waiter';
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { sub: 'u-1', role: currentRole, tenant_id: 'store-a' } as never);
        await next();
      });
      registerSessionCrudHandlers(app);

      // 1. Waiter tries POST /:id/close -> 409 Conflict
      const closeAttempt1 = await app.request(
        'http://localhost/sess-open-1/close',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(closeAttempt1.status).toBe(409);
      const errBody1 = (await closeAttempt1.json()) as { success: boolean; unpaid_order_id?: string };
      expect(errBody1.success).toBe(false);
      expect(errBody1.unpaid_order_id).toBe('ord-unpaid-1');

      // 2. Waiter tries force: true -> still 409 (only manager/owner/admin can force close)
      const waiterForceAttempt = await app.request(
        'http://localhost/sess-open-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed', force: true }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(waiterForceAttempt.status).toBe(409);

      // 3. Manager with force: true -> 200 OK
      currentRole = 'manager';
      const managerForceClose = await app.request(
        'http://localhost/sess-open-1/close',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(managerForceClose.status).toBe(200);
    });
  });

  describe('5. OpenAPI Table & Zone Deletion Dependency Guards', () => {
    it('blocks deleting a table that is occupied or has active sessions/unpaid orders (409)', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, capacity, status, is_active, tenant_id)
           VALUES
             ('tbl-del-occ', 40, 'Occupied Table', 'Indoor', 4, 'occupied', 1, 'store-a'),
             ('tbl-del-ord', 41, 'Unpaid Order Table', 'Indoor', 4, 'available', 1, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO orders (id, order_number, table_id, status, payment_status, total, tenant_id)
           VALUES ('ord-del-1', 'ORD-401', 'tbl-del-ord', 'confirmed', 'unpaid', 95000, 'store-a')`
        )
        .run();

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { sub: 'mgr-1', role: 'manager', tenant_id: 'store-a' } as never);
        await next();
      });
      registerTableCrudHandlers(app);

      // 1. Occupied table -> 409
      const occDelRes = await app.request(
        'http://localhost/api/tables/tbl-del-occ',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(occDelRes.status).toBe(409);

      // 2. Table with unpaid active order -> 409
      const ordDelRes = await app.request(
        'http://localhost/api/tables/tbl-del-ord',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(ordDelRes.status).toBe(409);

      // 3. Mark order paid -> DELETE succeeds (200)
      sqlite.prepare("UPDATE orders SET payment_status = 'paid', status = 'completed' WHERE id = 'ord-del-1'").run();
      const cleanDelRes = await app.request(
        'http://localhost/api/tables/tbl-del-ord',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(cleanDelRes.status).toBe(200);
    });

    it('blocks deleting a table zone when cafe_tables still reference the zone (409)', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO table_zones (id, name, slug, capacity, tenant_id)
           VALUES ('zone-rooftop', 'Rooftop', 'rooftop', 30, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, number, name, zone, zone_id, capacity, status, is_active, tenant_id)
           VALUES ('tbl-roof-1', 50, 'Roof 1', 'Rooftop', 'zone-rooftop', 4, 'available', 1, 'store-a')`
        )
        .run();

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { sub: 'mgr-1', role: 'manager', tenant_id: 'store-a' } as never);
        await next();
      });
      registerZoneCrudHandlers(app);

      // Zone has assigned table -> 409 Conflict
      const blockedZoneDel = await app.request(
        'http://localhost/api/table-zones/zone-rooftop',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(blockedZoneDel.status).toBe(409);

      // Reassign table to another zone -> DELETE zone succeeds (200)
      sqlite
        .prepare("UPDATE cafe_tables SET zone = 'Indoor', zone_id = 'zone-indoor' WHERE id = 'tbl-roof-1'")
        .run();

      const allowedZoneDel = await app.request(
        'http://localhost/api/table-zones/zone-rooftop',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(allowedZoneDel.status).toBe(200);
    });
  });

  describe('6. Cal.com Bookings Staff PII Masking & Webhook Tenant Isolation', () => {
    it('masks guest phone and email for waiter role while returning full PII for manager role', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO reservations (id, cal_booking_uid, customer_name, customer_phone, customer_email, reservation_time, status, special_requests, tenant_id)
           VALUES ('rsv-cal-1', 'cal-uid-100', 'Tran Thi Guest', '0912345678', 'tranthi@gmail.com', '2027-07-01T18:30:00Z', 'confirmed', '{"guest_phone":"0912345678","guest_email":"tranthi@gmail.com"}', 'store-a')`
        )
        .run();

      let callerRole = 'waiter';
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { sub: 'u-staff', role: callerRole, tenant_id: 'store-a' } as never);
        await next();
      });
      registerBookingsHandler(app);

      // 1. Waiter gets masked phone & email
      const waiterRes = await app.request(
        'http://localhost/bookings',
        { method: 'GET' },
        { AURA_DB: db } as unknown as Env
      );
      expect(waiterRes.status).toBe(200);
      const waiterData = (await waiterRes.json()) as { success: boolean; data: Array<Record<string, unknown>> };
      expect(waiterData.data).toHaveLength(1);
      const waiterBooking = waiterData.data[0];
      expect(waiterBooking.guest_phone).toBe('***678');
      expect(waiterBooking.attendee_email).toBe('t***@gmail.com');
      expect(JSON.stringify(waiterBooking)).not.toContain('0912345678');
      expect(JSON.stringify(waiterBooking)).not.toContain('tranthi@gmail.com');

      // 2. Manager gets full unmasked PII
      callerRole = 'manager';
      const mgrRes = await app.request(
        'http://localhost/bookings',
        { method: 'GET' },
        { AURA_DB: db } as unknown as Env
      );
      expect(mgrRes.status).toBe(200);
      const mgrData = (await mgrRes.json()) as { success: boolean; data: Array<Record<string, unknown>> };
      expect(mgrData.data[0].guest_phone).toBe('0912345678');
      expect(mgrData.data[0].attendee_email).toBe('tranthi@gmail.com');
    });

    it('prevents cross-tenant BOOKING_CANCELLED and BOOKING_RESCHEDULED mutations in Cal.com webhook', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO bookings (cal_uid, title, start_time, end_time, attendee_name, attendee_email, status, tenant_id)
           VALUES ('cal-store-a-uid', 'Dinner Table', '2027-07-02T19:00:00Z', '2027-07-02T20:00:00Z', 'Le Van A', 'levana@example.com', 'confirmed', 'store-a')`
        )
        .run();

      const app = new Hono<{ Bindings: Env }>();
      registerWebhookHandler(app);

      // Cross-tenant cancellation attempt from store-b -> 404
      const crossCancelRes = await app.request(
        'http://localhost/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cal-webhook-secret': 'cal-secret-123',
            'X-Tenant-ID': 'store-b',
          },
          body: JSON.stringify({
            triggerEvent: 'BOOKING_CANCELLED',
            createdAt: '2027-07-01T12:00:00Z',
            payload: {
              uid: 'cal-store-a-uid',
              title: 'Dinner Table',
              startTime: '2027-07-02T19:00:00Z',
              endTime: '2027-07-02T20:00:00Z',
              organizer: { name: 'Aura Caffe', email: 'host@auracaffe.vn' },
              location: 'Aura Caffe Store A',
              cancellationReason: 'Cross-tenant spoof',
              metadata: { tenant_id: 'store-b' },
            },
          }),
        },
        { AURA_DB: db, CAL_WEBHOOK_SECRET: 'cal-secret-123' } as unknown as Env
      );
      expect(crossCancelRes.status).toBe(404);

      // Verify store-a booking is still confirmed
      const rowAfterCrossCancel = sqlite
        .prepare('SELECT status FROM bookings WHERE cal_uid = ?')
        .get('cal-store-a-uid') as { status: string };
      expect(rowAfterCrossCancel.status).toBe('confirmed');

      // Same-tenant cancellation from store-a -> 200
      const validCancelRes = await app.request(
        'http://localhost/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cal-webhook-secret': 'cal-secret-123',
            'X-Tenant-ID': 'store-a',
          },
          body: JSON.stringify({
            triggerEvent: 'BOOKING_CANCELLED',
            createdAt: '2027-07-01T12:00:00Z',
            payload: {
              uid: 'cal-store-a-uid',
              title: 'Dinner Table',
              startTime: '2027-07-02T19:00:00Z',
              endTime: '2027-07-02T20:00:00Z',
              organizer: { name: 'Aura Caffe', email: 'host@auracaffe.vn' },
              location: 'Aura Caffe Store A',
              cancellationReason: 'Customer cancelled',
              metadata: { tenant_id: 'store-a' },
            },
          }),
        },
        { AURA_DB: db, CAL_WEBHOOK_SECRET: 'cal-secret-123' } as unknown as Env
      );
      expect(validCancelRes.status).toBe(200);

      const rowAfterValidCancel = sqlite
        .prepare('SELECT status FROM bookings WHERE cal_uid = ?')
        .get('cal-store-a-uid') as { status: string };
      expect(rowAfterValidCancel.status).toBe('cancelled');
    });
  });
});
