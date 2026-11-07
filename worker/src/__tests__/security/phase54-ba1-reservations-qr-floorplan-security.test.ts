// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { reservationsRouter } from '@aura/domain-reservation';
import { scanQrAndResolveTable } from '../../../../packages/domain/table/commands/qr-scan';
import { registerTableCrudHandlers } from '../../routes/openapi-tables-handlers/table-crud-handlers';

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

    CREATE TABLE table_qr_codes (
      id TEXT PRIMARY KEY,
      table_id TEXT,
      qr_slug TEXT,
      slug TEXT,
      tenant_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE table_sessions (
      id TEXT PRIMARY KEY,
      table_id TEXT,
      customer_name TEXT,
      status TEXT DEFAULT 'active',
      total_amount REAL DEFAULT 0,
      orders_count INTEGER DEFAULT 0,
      opened_at TEXT,
      started_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      current_order_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      table_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      total REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      tenant_id TEXT DEFAULT 'default'
    );
  `);
  return sqlite;
}

const TEST_ENV = {
  JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
  ENVIRONMENT: 'test',
} as unknown as Env;

describe('Phase 54 Slice BA1: Reservations, QR Scan, Admin QR, Floor Plan Security', () => {
  describe('BA1-1: Unauthenticated reservation mutation guards', () => {
    it('blocks unauthenticated PATCH /api/reservations/:id with 401', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status, tenant_id) VALUES ('rsv1', 't1', 'Alice', '0901234567', '2026-12-01', '18:00', 'confirmed', 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/reservations', reservationsRouter);

      const res = await app.request(
        'http://localhost/api/reservations/rsv1',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(401);
    });

    it('blocks unauthenticated PATCH /api/reservations/:id/status with 401', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status, tenant_id) VALUES ('rsv2', 't1', 'Alice', '0901234567', '2026-12-01', '18:00', 'confirmed', 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/reservations', reservationsRouter);

      const res = await app.request(
        'http://localhost/api/reservations/rsv2/status',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(401);
    });

    it('blocks unauthenticated POST /api/reservations/:id/cancel with 401', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status, tenant_id) VALUES ('rsv3', 't1', 'Alice', '0901234567', '2026-12-01', '18:00', 'confirmed', 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/reservations', reservationsRouter);

      const res = await app.request(
        'http://localhost/api/reservations/rsv3/cancel',
        { method: 'POST' },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(401);
    });

    it('blocks customer role from mutating reservations with 403', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status, tenant_id) VALUES ('rsv4', 't1', 'Alice', '0901234567', '2026-12-01', '18:00', 'confirmed', 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'c1', role: 'customer', tenantId: 'default' } as never);
        await next();
      });
      app.route('/api/reservations', reservationsRouter);

      const res = await app.request(
        'http://localhost/api/reservations/rsv4',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(403);
    });

    it('allows staff to update reservations status with 200', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status, tenant_id) VALUES ('rsv5', 't1', 'Alice', '0901234567', '2026-12-01', '18:00', 'confirmed', 'default')").run();
      sqlite.prepare("INSERT INTO cafe_tables (id, number, table_number, name, zone, capacity, status, is_active, tenant_id) VALUES ('t1', 1, '1', 'Table 1', 'Indoor', 4, 'available', 1, 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 's1', role: 'waiter', tenantId: 'default' } as never);
        await next();
      });
      app.route('/api/reservations', reservationsRouter);

      const res = await app.request(
        'http://localhost/api/reservations/rsv5/status',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'seated' }) },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(200);
    });
  });

  describe('BA1-3: Cross-tenant QR slug fallback isolation', () => {
    it('rejects cross-tenant explicit QR slug resolution', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO cafe_tables (id, number, table_number, name, zone, capacity, status, is_active, tenant_id) VALUES ('tbl-b', 2, '2', 'Table B', 'Indoor', 4, 'available', 1, 'store-b')").run();
      sqlite.prepare("INSERT INTO table_qr_codes (id, table_id, qr_slug, slug, tenant_id) VALUES ('qr2', 'tbl-b', 'slug-b', 'slug-b', 'store-b')").run();

      const result = await scanQrAndResolveTable(db, { slug: 'slug-b', tenantId: 'store-a' });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
    });

    it('allows same-tenant QR slug resolution', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO cafe_tables (id, number, table_number, name, zone, capacity, status, is_active, tenant_id) VALUES ('tbl-a', 1, '1', 'Table A', 'Indoor', 4, 'available', 1, 'store-a')").run();
      sqlite.prepare("INSERT INTO table_qr_codes (id, table_id, qr_slug, slug, tenant_id) VALUES ('qr1', 'tbl-a', 'slug-a', 'slug-a', 'store-a')").run();

      const result = await scanQrAndResolveTable(db, { slug: 'slug-a', tenantId: 'store-a' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.table.id).toBe('tbl-a');
      }
    });
  });

  describe('BA1-5: Unscoped cross-tenant table_sessions join in floor-plan', () => {
    it('does not leak table_sessions from other tenants in list tables', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO cafe_tables (id, number, table_number, name, zone, capacity, status, is_active, tenant_id) VALUES ('tbl-a', 1, '1', 'Table A', 'Indoor', 4, 'available', 1, 'store-a')").run();
      sqlite.prepare("INSERT INTO table_sessions (id, table_id, customer_name, status, total_amount, tenant_id) VALUES ('ses-a', 'tbl-a', 'Alice', 'active', 100000, 'store-b')").run();

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 's1', role: 'manager', tenantId: 'store-a' } as never);
        await next();
      });
      registerTableCrudHandlers(app);

      const res = await app.request(
        'http://localhost/api/tables?tenant_id=store-a',
        { method: 'GET' },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(200);
      const json = await res.json() as { success: boolean; data: { tables: Array<{ currentSession: unknown; id: string }> } };
      const tableA = json.data.tables.find((t) => t.id === 'tbl-a');
      expect(tableA?.currentSession).toBeNull();
    });
  });

  describe('BA1: Tenant isolation in availability endpoint', () => {
    it('does not leak cross-tenant tables in availability', async () => {
      const sqlite = createSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO cafe_tables (id, number, table_number, name, zone, capacity, status, is_active, tenant_id) VALUES ('tbl-a', 1, '1', 'Table A', 'Indoor', 4, 'available', 1, 'store-a'), ('tbl-b', 2, '2', 'Table B', 'Indoor', 4, 'available', 1, 'store-b')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/reservations', reservationsRouter);

      const res = await app.request(
        'http://localhost/api/reservations/availability?date=2026-12-01',
        { method: 'GET' },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(200);
      const json = await res.json() as { success: boolean; data: { available_tables: Array<{ id: string }> } };
      const tableIds = (json.data.available_tables || []).map((t) => t.id);
      expect(tableIds).not.toContain('tbl-b');
    });
  });
});
