// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { tableSessionsRouter } from '../table-sessions';
import { openApiTablesRouter } from '../openapi-tables';
import { openApiStaffRouter } from '../openapi-staff';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import type { Env } from '../../types/env';

const TEST_JWT_SECRET = 'table-sessions-openapi-staff-secret-32chars!';

function createSqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  const runStatement = new WeakMap<object, () => unknown>();

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'staff',
      locale TEXT DEFAULT 'vi',
      is_active INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      avatar_url TEXT,
      hire_date TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      auth_version INTEGER NOT NULL DEFAULT 1,
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE staff_login_identities (
      email TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    );
    CREATE TABLE shifts (
      id TEXT PRIMARY KEY,
      staff_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      status TEXT DEFAULT 'scheduled',
      clock_in TEXT,
      clock_out TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE cafe_tables (
      id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL,
      code TEXT,
      name TEXT,
      capacity INTEGER NOT NULL DEFAULT 4,
      zone TEXT NOT NULL DEFAULT 'indoor',
      zone_id TEXT,
      status TEXT NOT NULL DEFAULT 'Available',
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      width REAL DEFAULT 80,
      height REAL DEFAULT 80,
      rotation REAL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      location_id TEXT DEFAULT 'default',
      qr_code TEXT,
      metadata TEXT DEFAULT '{}',
      tenant_id TEXT NOT NULL DEFAULT 'default',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE table_zones (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      location_id TEXT DEFAULT 'default',
      metadata TEXT DEFAULT '{}',
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE table_sessions (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      guest_count INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      order_count INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      table_id TEXT,
      total INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  function prepare(sql: string) {
    let args: unknown[] = [];
    const run = () => {
      const before = Number((sqlite.prepare('SELECT total_changes() AS count').get() as { count?: number })?.count ?? 0);
      const result = sqlite.prepare(sql).run(...(args as never[]));
      const after = Number((sqlite.prepare('SELECT total_changes() AS count').get() as { count?: number })?.count ?? 0);
      return { success: true, meta: { changes: after - before, last_row_id: Number(result.lastInsertRowid) } };
    };
    const statement = {
      bind(...values: unknown[]) {
        args = values;
        return statement;
      },
      async first() {
        return sqlite.prepare(sql).get(...(args as never[])) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...(args as never[])), success: true, meta: {} };
      },
      async run() {
        return run();
      },
      async raw() {
        return [];
      },
    };
    runStatement.set(statement, run);
    return statement as unknown as D1PreparedStatement;
  }

  const db = {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((st) => {
          const fn = runStatement.get(st);
          if (!fn) throw new Error('Unknown statement in D1 batch');
          return fn();
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;

  const kvMap = new Map<string, string>();
  const authKV = {
    get: async (k: string) => kvMap.get(k) ?? null,
    put: async (k: string, v: string) => {
      kvMap.set(k, v);
    },
    delete: async (k: string) => {
      kvMap.delete(k);
    },
    list: async () => ({ keys: [], list_complete: true, cursor: '' }),
  } as unknown as KVNamespace;

  return { sqlite, db, authKV };
}

describe('Table Sessions RBAC, Tenant Conflict Isolation, Order Total Resolution & OpenAPI Tables/Staff Governance', () => {
  it('enforces staff RBAC on table-sessions when Authorization header is provided or in production environment', async () => {
    const { sqlite, db, authKV } = createSqliteD1();
    try {
      sqlite.prepare(
        "INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version) VALUES ('waiter-1', 'Waiter One', 'waiter@aura.vn', '0901111222', 'waiter', 'default', 1, 1)"
      ).run();
      sqlite.prepare(
        "INSERT INTO cafe_tables (id, table_number, code, name, zone, status, tenant_id) VALUES ('T-01', 1, 'T01', 'Table 1', 'indoor', 'Available', 'default')"
      ).run();

      const customerToken = await generateJWT(
        { id: 'cust-1', email: 'customer@aura.vn', name: 'Customer One', role: 'customer', tenantId: 'default' },
        TEST_JWT_SECRET
      );
      const { token: waiterToken } = await issueStaffSession(
        { JWT_SECRET: TEST_JWT_SECRET },
        { id: 'waiter-1', name: 'Waiter One', phone: '0901111222', role: 'waiter', active: 1, is_active: 1, tenant_id: 'default', auth_version: 1 },
        { email: 'waiter@aura.vn', sessionType: 'staff-web' }
      );

      const prodEnv = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: authKV,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_SESSION_SECRET: TEST_JWT_SECRET,
        ENVIRONMENT: 'production',
      } as unknown as Env;

      // Unauthenticated in production -> 401
      const unauthRes = await tableSessionsRouter.request('/', { method: 'GET' }, prodEnv);
      expect(unauthRes.status).toBe(401);

      // Customer token -> 403
      const custListRes = await tableSessionsRouter.request(
        '/',
        { method: 'GET', headers: { Authorization: `Bearer ${customerToken}` } },
        prodEnv
      );
      expect(custListRes.status).toBe(403);

      const custOpenRes = await tableSessionsRouter.request(
        '/',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: 'T-01' }),
        },
        prodEnv
      );
      expect(custOpenRes.status).toBe(403);

      // Staff token -> 201
      const staffOpenRes = await tableSessionsRouter.request(
        '/',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${waiterToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: 'T-01', customer_name: 'Khách Bàn 1' }),
        },
        prodEnv
      );
      expect(staffOpenRes.status).toBe(201);
    } finally {
      sqlite.close();
    }
  });

  it('scopes active-session conflict check by tenant, validates guest_count/total_amount, and resolves COALESCE(total_amount, total, 0) while rejecting terminal orders with 400', async () => {
    const { sqlite, db, authKV } = createSqliteD1();
    try {
      sqlite.prepare(
        "INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version) VALUES ('staff-a', 'Staff A', 'staff-a@aura.vn', '0904000001', 'waiter', 'tenant-a', 1, 1)"
      ).run();
      sqlite.prepare(
        "INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version) VALUES ('staff-b', 'Staff B', 'staff-b@aura.vn', '0904000002', 'waiter', 'tenant-b', 1, 1)"
      ).run();
      sqlite.prepare(
        "INSERT INTO cafe_tables (id, table_number, code, name, zone, status, tenant_id) VALUES ('T-A1', 1, 'TA1', 'Table A1', 'indoor', 'Available', 'tenant-a')"
      ).run();
      sqlite.prepare(
        "INSERT INTO cafe_tables (id, table_number, code, name, zone, status, tenant_id) VALUES ('T-B1', 1, 'TB1', 'Table B1', 'indoor', 'Available', 'tenant-b')"
      ).run();

      const { token: tokenA } = await issueStaffSession(
        { JWT_SECRET: TEST_JWT_SECRET },
        { id: 'staff-a', name: 'Staff A', phone: '0904000001', role: 'waiter', active: 1, is_active: 1, tenant_id: 'tenant-a', auth_version: 1 },
        { email: 'staff-a@aura.vn', sessionType: 'staff-web' }
      );
      const { token: tokenB } = await issueStaffSession(
        { JWT_SECRET: TEST_JWT_SECRET },
        { id: 'staff-b', name: 'Staff B', phone: '0904000002', role: 'waiter', active: 1, is_active: 1, tenant_id: 'tenant-b', auth_version: 1 },
        { email: 'staff-b@aura.vn', sessionType: 'staff-web' }
      );
      const headersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
      const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };
      const env = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: authKV,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_SESSION_SECRET: TEST_JWT_SECRET,
      } as unknown as Env;

      // Open session on T-A1 for tenant-a
      const openARes = await tableSessionsRouter.request(
        '/',
        {
          method: 'POST',
          headers: headersA,
          body: JSON.stringify({ table_id: 'T-A1', customer_name: 'Tenant A Guest' }),
        },
        env
      );
      expect(openARes.status).toBe(201);
      const sessionA = ((await openARes.json()) as { data: { id: string } }).data;

      // Tenant B attempting to open session on T-A1 gets 404 (not 409 leaking sessionA.id)
      const crossOpenRes = await tableSessionsRouter.request(
        '/',
        {
          method: 'POST',
          headers: headersB,
          body: JSON.stringify({ table_id: 'T-A1' }),
        },
        env
      );
      expect(crossOpenRes.status).toBe(404);
      const crossOpenJson = (await crossOpenRes.json()) as { error: string };
      expect(crossOpenJson.error).not.toContain(sessionA.id);

      // Tenant A duplicate open on T-A1 gets 409
      const dupARes = await tableSessionsRouter.request(
        '/',
        {
          method: 'POST',
          headers: headersA,
          body: JSON.stringify({ table_id: 'T-A1' }),
        },
        env
      );
      expect(dupARes.status).toBe(409);

      // PATCH /:id validates guest_count >= 1 and total_amount >= 0
      const invalidGuestRes = await tableSessionsRouter.request(
        `/${sessionA.id}`,
        {
          method: 'PATCH',
          headers: headersA,
          body: JSON.stringify({ guest_count: 0 }),
        },
        env
      );
      expect(invalidGuestRes.status).toBe(400);

      const invalidTotalRes = await tableSessionsRouter.request(
        `/${sessionA.id}`,
        {
          method: 'PATCH',
          headers: headersA,
          body: JSON.stringify({ total_amount: -5000 }),
        },
        env
      );
      expect(invalidTotalRes.status).toBe(400);

      // Seed orders: one where total = 0 but total_amount = 135000, plus cancelled/failed/expired orders
      const now = new Date().toISOString();
      sqlite.prepare(
        "INSERT INTO orders (id, table_id, total, total_amount, status, tenant_id, created_at, updated_at) VALUES ('ORD-TOTAL-AMOUNT', NULL, 0, 135000, 'pending', 'tenant-a', ?, ?)"
      ).run(now, now);
      sqlite.prepare(
        "INSERT INTO orders (id, table_id, total, total_amount, status, tenant_id, created_at, updated_at) VALUES ('ORD-CANC-400', NULL, 50000, 50000, 'cancelled', 'tenant-a', ?, ?)"
      ).run(now, now);
      sqlite.prepare(
        "INSERT INTO orders (id, table_id, total, total_amount, status, tenant_id, created_at, updated_at) VALUES ('ORD-FAILED-400', NULL, 50000, 50000, 'failed', 'tenant-a', ?, ?)"
      ).run(now, now);
      sqlite.prepare(
        "INSERT INTO orders (id, table_id, total, total_amount, status, tenant_id, created_at, updated_at) VALUES ('ORD-EXPIRED-400', NULL, 50000, 50000, 'expired', 'tenant-a', ?, ?)"
      ).run(now, now);

      for (const badOrderId of ['ORD-CANC-400', 'ORD-FAILED-400', 'ORD-EXPIRED-400']) {
        const badRes = await tableSessionsRouter.request(
          `/${sessionA.id}/orders`,
          {
            method: 'POST',
            headers: headersA,
            body: JSON.stringify({ order_id: badOrderId }),
          },
          env
        );
        expect(badRes.status).toBe(400);
      }

      const attachRes = await tableSessionsRouter.request(
        `/${sessionA.id}/orders`,
        {
          method: 'POST',
          headers: headersA,
          body: JSON.stringify({ order_id: 'ORD-TOTAL-AMOUNT' }),
        },
        env
      );
      expect(attachRes.status).toBe(200);
      const attachedBody = (await attachRes.json()) as { data: { total_amount: number; order_count: number } };
      expect(attachedBody.data.total_amount).toBe(135000);
      expect(attachedBody.data.order_count).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it('isolates table_zones LEFT JOIN by tenant, guards DELETE /api/tables/:id against active/occupied/ordering/paid sessions, and propagates virtual zone renames to cafe_tables', async () => {
    const { sqlite, db, authKV } = createSqliteD1();
    try {
      sqlite.prepare(
        "INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version) VALUES ('owner-a', 'Owner A', 'owner-a@aura.vn', '0902000001', 'owner', 'tenant-a', 1, 1)"
      ).run();
      // Foreign tenant-b has a zone with id 'vip-zone' named 'Foreign VIP Secret'
      sqlite.prepare(
        "INSERT INTO table_zones (id, slug, name, tenant_id, location_id) VALUES ('vip-zone', 'vip-zone', 'Foreign VIP Secret', 'tenant-b', 'tenant-b')"
      ).run();
      // Tenant A has a table referencing zone 'vip-zone' (without a tenant-a table_zones row)
      sqlite.prepare(
        "INSERT INTO cafe_tables (id, table_number, code, name, zone, zone_id, status, tenant_id, location_id) VALUES ('tbl-a1', 10, 'TA10', 'Bàn A10', 'vip-zone', 'vip-zone', 'Available', 'tenant-a', 'tenant-a')"
      ).run();

      const { token: ownerAToken } = await issueStaffSession(
        { JWT_SECRET: TEST_JWT_SECRET },
        { id: 'owner-a', name: 'Owner A', phone: '0902000001', role: 'owner', active: 1, is_active: 1, tenant_id: 'tenant-a', auth_version: 1 },
        { email: 'owner-a@aura.vn', sessionType: 'staff-web' }
      );
      const env = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: authKV,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_SESSION_SECRET: TEST_JWT_SECRET,
      } as unknown as Env;
      const headers = {
        Authorization: `Bearer ${ownerAToken}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'tenant-a',
      };

      // 1. GET /api/tables and GET /api/tables/:id must NOT leak tenant-b's zone name 'Foreign VIP Secret'
      const listRes = await openApiTablesRouter.request('/api/tables', { method: 'GET', headers }, env);
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()) as { data: { tables: Array<{ id: string; zone: { id: string; name: string } }> } };
      expect(listData.data.tables[0].zone.name).toBe('vip-zone');
      expect(listData.data.tables[0].zone.name).not.toBe('Foreign VIP Secret');

      const getRes = await openApiTablesRouter.request('/api/tables/tbl-a1', { method: 'GET', headers }, env);
      expect(getRes.status).toBe(200);
      const getData = (await getRes.json()) as { data: { zone: { id: string; name: string } } };
      expect(getData.data.zone.name).toBe('vip-zone');

      // 2. Virtual fallback zone rename updates cafe_tables.zone for tenant-a only
      sqlite.prepare(
        "INSERT INTO cafe_tables (id, table_number, code, name, zone, zone_id, status, tenant_id, location_id) VALUES ('tbl-b1', 11, 'TB11', 'Bàn B11', 'vip-zone', 'vip-zone', 'Available', 'tenant-b', 'tenant-b')"
      ).run();
      const renameZoneRes = await openApiTablesRouter.request(
        '/api/table-zones/vip-zone',
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ name: 'Sân Thượng A' }),
        },
        env
      );
      expect(renameZoneRes.status).toBe(200);
      const tblAAfterRename = sqlite.prepare('SELECT zone FROM cafe_tables WHERE id = ?').get('tbl-a1') as { zone: string };
      const tblBAfterRename = sqlite.prepare('SELECT zone FROM cafe_tables WHERE id = ?').get('tbl-b1') as { zone: string };
      expect(tblAAfterRename.zone).toBe('Sân Thượng A');
      expect(tblBAfterRename.zone).toBe('vip-zone');

      // 3. DELETE /api/tables/:id blocked when table has a session in 'paid' or 'occupied' status in tenant-a
      sqlite.prepare(
        "INSERT INTO table_sessions (id, table_id, status, tenant_id) VALUES ('ses-paid-a', 'tbl-a1', 'paid', 'tenant-a')"
      ).run();
      const blockedDeleteRes = await openApiTablesRouter.request('/api/tables/tbl-a1', { method: 'DELETE', headers }, env);
      expect(blockedDeleteRes.status).toBe(409);

      // Audit log includes tenant_id
      const auditRow = sqlite.prepare("SELECT tenant_id FROM audit_logs WHERE action = 'table_zone_update' LIMIT 1").get() as { tenant_id: string } | undefined;
      expect(auditRow?.tenant_id).toBe('tenant-a');
    } finally {
      sqlite.close();
    }
  });

  it('prevents duplicate staff phone on POST /api/staff and PATCH /api/staff/:id with 409 and writes tenant_id to staff audit_logs', async () => {
    const { sqlite, db, authKV } = createSqliteD1();
    try {
      sqlite.prepare(
        "INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version) VALUES ('owner-1', 'Owner 1', 'owner1@aura.vn', '0903000001', 'owner', 'tenant-a', 1, 1)"
      ).run();
      sqlite.prepare(
        "INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version) VALUES ('staff-1', 'Staff 1', 'staff1@aura.vn', '0903000002', 'staff', 'tenant-a', 1, 1)"
      ).run();
      sqlite.prepare(
        "INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version) VALUES ('staff-2', 'Staff 2', 'staff2@aura.vn', '0903000003', 'staff', 'tenant-a', 1, 1)"
      ).run();

      const { token: ownerToken } = await issueStaffSession(
        { JWT_SECRET: TEST_JWT_SECRET },
        { id: 'owner-1', name: 'Owner 1', phone: '0903000001', role: 'owner', active: 1, is_active: 1, tenant_id: 'tenant-a', auth_version: 1 },
        { email: 'owner1@aura.vn', sessionType: 'staff-web' }
      );
      const env = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: authKV,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_SESSION_SECRET: TEST_JWT_SECRET,
      } as unknown as Env;
      const headers = {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'tenant-a',
      };

      // POST /api/staff with existing phone -> 409
      const dupCreateRes = await openApiStaffRouter.request(
        '/api/staff',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'Duplicate Phone Staff',
            email: 'unique-email@aura.vn',
            phone: '0903000002',
            password: 'StrongPassword123!',
            role: 'staff',
          }),
        },
        env
      );
      expect(dupCreateRes.status).toBe(409);

      // PATCH /api/staff/:id with another user's phone -> 409 (not 503)
      const dupPatchRes = await openApiStaffRouter.request(
        '/api/staff/staff-2',
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ phone: '0903000002' }),
        },
        env
      );
      expect(dupPatchRes.status).toBe(409);

      // Valid PATCH /api/staff/:id succeeds and records tenant_id in audit_logs
      const okPatchRes = await openApiStaffRouter.request(
        '/api/staff/staff-2',
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ phone: '0903000099' }),
        },
        env
      );
      expect(okPatchRes.status).toBe(200);
      const staffAudit = sqlite.prepare("SELECT tenant_id FROM audit_logs WHERE action = 'staff_update' LIMIT 1").get() as { tenant_id: string } | undefined;
      expect(staffAudit?.tenant_id).toBe('tenant-a');
    } finally {
      sqlite.close();
    }
  });
});
