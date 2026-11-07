// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { issueStaffSession, requireStaffAccount } from '../../lib/staff-session';
import { inventoryCRUD } from '../../../../packages/domain/inventory/src/routes/inventory-crud';
import { inventorySnapshots } from '../../../../packages/domain/inventory/src/routes/inventory-snapshots';
import { tablesRouter } from '../../../../packages/domain/table/commands/tables';
import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import { getKdsMobile, updateKdsStatus } from '../../../../packages/domain/kitchen/commands/kds-mobile';
import { executeKdsStatusTransition } from '../../../../packages/domain/kitchen/commands/kds-status-transition';
import { kitchenStationsRouter } from '../../../../packages/domain/kitchen/commands/kitchen-stations';
import { getAdminOrders } from '../../../../packages/domain/order/queries/admin-orders';
import { getStats } from '../../../../packages/domain/order/queries/stats';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const runStatement = new WeakMap<object, () => any>();

  function prepare(sql: string) {
    let args: any[] = [];
    const run = () => {
      const before = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      const result = sqlite.prepare(sql).run(...args);
      const after = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      return {
        success: true,
        meta: { changes: after - before, last_row_id: Number(result.lastInsertRowid) },
      };
    };
    const statement = {
      bind(...values: any[]) {
        args = values;
        return statement;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...args) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = Record<string, unknown>>() {
        return {
          results: sqlite.prepare(sql).all(...args) as T[],
          success: true,
          meta: {},
        };
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

  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => {
          const run = runStatement.get(statement);
          if (!run) throw new Error('Unknown statement in local D1 batch');
          return run();
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new Uint8Array();
    },
  } as unknown as D1Database;
}

describe('Phase 49 Slice AV4 — Domain Inventory, Tables, Kitchen KDS/COD & Order Queries Security', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. inventory-crud.ts & inventory-snapshots.ts fail-closed RBAC, tenant binding & ICT date', () => {
    function buildInventoryEnv() {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          unit TEXT NOT NULL,
          category TEXT DEFAULT 'other',
          current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0,
          max_stock REAL DEFAULT 100,
          cost_per_unit REAL DEFAULT 0,
          supplier TEXT,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE inventory_snapshots (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          date TEXT NOT NULL,
          opening_stock REAL DEFAULT 0,
          closing_stock REAL DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite
        .prepare(
          `INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, tenant_id)
           VALUES ('ing-a', 'Coffee Beans A', 'kg', 25, 5, 'store-a'),
                  ('ing-b', 'Coffee Beans B', 'kg', 40, 5, 'store-b')`
        )
        .run();
      return { sqlite, db: createSqliteD1(sqlite) };
    }

    it('enforces fail-closed RBAC when user is undefined or non-manager on inventory CRUD and snapshots', async () => {
      const { db } = buildInventoryEnv();
      const app = new Hono<{ Bindings: any }>();
      app.use('*', async (c, next) => {
        (c as any).set('tenantId', 'store-a');
        await next();
      });
      inventoryCRUD(app as any);
      inventorySnapshots(app as any);

      // Unauthenticated (user === undefined) POST/PUT/DELETE/snapshot must be rejected with 403
      const anonPost = await app.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Milk', unit: 'L' }),
        },
        { AURA_DB: db }
      );
      expect(anonPost.status).toBe(403);

      const anonPut = await app.request(
        '/ing-a',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Hacked Beans' }),
        },
        { AURA_DB: db }
      );
      expect(anonPut.status).toBe(403);

      const anonDelete = await app.request('/ing-a', { method: 'DELETE' }, { AURA_DB: db });
      expect(anonDelete.status).toBe(403);

      const anonSnapshot = await app.request('/ing-a/snapshots', { method: 'POST' }, { AURA_DB: db });
      expect(anonSnapshot.status).toBe(403);
    });

    it('rejects cross-tenant spoofing and records snapshot date in Asia/Ho_Chi_Minh (UTC+7)', async () => {
      vi.useFakeTimers();
      // 2026-11-02T18:30:00.000Z is 2026-11-03 01:30:00 in Asia/Ho_Chi_Minh (UTC+7)
      vi.setSystemTime(new Date('2026-11-02T18:30:00.000Z'));

      const { sqlite, db } = buildInventoryEnv();
      let currentUser: { id: string; role: string; tenantId: string } = {
        id: 'mgr-a',
        role: 'manager',
        tenantId: 'store-a',
      };
      let currentTenant = 'store-a';

      const app = new Hono<{ Bindings: any }>();
      app.use('*', async (c, next) => {
        (c as any).set('user', currentUser);
        (c as any).set('tenantId', currentTenant);
        await next();
      });
      inventoryCRUD(app as any);
      inventorySnapshots(app as any);

      // Mismatch between user.tenantId ('store-a') and resolved tenant ('store-b') -> 403
      currentTenant = 'store-b';
      const crossList = await app.request('/', { method: 'GET' }, { AURA_DB: db });
      expect(crossList.status).toBe(403);

      const crossSnapRead = await app.request('/ing-b/snapshots', { method: 'GET' }, { AURA_DB: db });
      expect(crossSnapRead.status).toBe(403);

      // Valid store-a manager records snapshot -> date is 2026-11-03 (ICT), not 2026-11-02 (UTC)
      currentTenant = 'store-a';
      const snapRes = await app.request('/ing-a/snapshots', { method: 'POST' }, { AURA_DB: db });
      expect(snapRes.status).toBe(201);
      const snapBody = (await snapRes.json()) as { date: string; closing_stock: number };
      expect(snapBody.date).toBe('2026-11-03');
      expect(snapBody.closing_stock).toBe(25);

      const dbSnap = sqlite
        .prepare('SELECT date, tenant_id, closing_stock FROM inventory_snapshots WHERE item_id = ?')
        .get('ing-a') as { date: string; tenant_id: string; closing_stock: number };
      expect(dbSnap).toEqual({
        date: '2026-11-03',
        tenant_id: 'store-a',
        closing_stock: 25,
      });
    });
  });

  describe('2. tables.ts tenant verification, QR slug isolation & session auto-close protection', () => {
    it('prevents cross-tenant QR slug collision and preserves paying/paid sessions on table release', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT NOT NULL,
          zone TEXT DEFAULT 'indoor',
          capacity INTEGER DEFAULT 4,
          status TEXT DEFAULT 'Available',
          current_order_id TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE table_qr_codes (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          slug TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE table_sessions (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          status TEXT NOT NULL,
          closed_at TEXT,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);

      // Store A has table 't1'; Store B has a QR row for table_id 't1' inserted AFTER Store A's QR row
      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id)
           VALUES ('t1', 'T01', 'indoor', 4, 'Occupied', 'store-a')`
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO table_qr_codes (id, table_id, slug, is_active, tenant_id)
           VALUES ('qr-a', 't1', 'store-a-t01', 1, 'store-a'),
                  ('qr-b', 't1', 'store-b-hijack-slug', 1, 'store-b'),
                  ('qr-a-inactive', 't1', 'store-a-inactive-slug', 0, 'store-a')`
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO table_sessions (id, table_id, status, tenant_id)
           VALUES ('sess-active-a', 't1', 'active', 'store-a'),
                  ('sess-ordering-a', 't1', 'ordering', 'store-a'),
                  ('sess-paying-a', 't1', 'paying', 'store-a'),
                  ('sess-paid-a', 't1', 'paid', 'store-a'),
                  ('sess-active-b', 't1', 'active', 'store-b')`
        )
        .run();

      const db = createSqliteD1(sqlite);
      let currentUser: { id: string; role: string; tenantId: string } = {
        id: 'staff-a',
        role: 'staff',
        tenantId: 'store-a',
      };
      let currentTenant = 'store-a';

      const app = new Hono<{ Bindings: any }>();
      app.use('*', async (c, next) => {
        (c as any).set('user', currentUser);
        (c as any).set('tenantId', currentTenant);
        await next();
      });
      app.route('/api/tables', tablesRouter);

      // 1. GET /api/tables for store-a signs 'store-a-t01', NOT 'store-b-hijack-slug' or inactive slug
      const listRes = await app.request(
        'http://localhost:3000/api/tables',
        { method: 'GET' },
        { AURA_DB: db, QR_SIGNING_SECRET: 'qr-secret-key-for-av4-tests' }
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as {
        success: boolean;
        data: Array<{ id: string; qr_code_url: string }>;
      };
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0]!.qr_code_url).toContain('/api/qr/store-a-t01?');
      expect(listBody.data[0]!.qr_code_url).not.toContain('store-b-hijack-slug');

      // 2. Cross-tenant header/context mismatch is rejected with 403
      currentTenant = 'store-b';
      const crossRelease = await app.request(
        'http://localhost:3000/api/tables/t1/release',
        { method: 'PATCH' },
        { AURA_DB: db }
      );
      expect(crossRelease.status).toBe(403);

      // 3. Releasing table t1 in store-a closes ONLY 'active' and 'ordering' sessions in store-a
      currentTenant = 'store-a';
      const releaseRes = await app.request(
        'http://localhost:3000/api/tables/t1/release',
        { method: 'PATCH' },
        { AURA_DB: db }
      );
      expect(releaseRes.status).toBe(200);

      const sessions = sqlite
        .prepare('SELECT id, status FROM table_sessions ORDER BY id ASC')
        .all() as Array<{ id: string; status: string }>;
      const sessionMap = Object.fromEntries(sessions.map((s) => [s.id, s.status]));
      expect(sessionMap['sess-active-a']).toBe('closed');
      expect(sessionMap['sess-ordering-a']).toBe('closed');
      expect(sessionMap['sess-paying-a']).toBe('paying');
      expect(sessionMap['sess-paid-a']).toBe('paid');
      expect(sessionMap['sess-active-b']).toBe('active');
    });
  });

  describe('3. collect-cod-payment.ts, kds-mobile.ts, kitchen-stations.ts & kds-status-transition.ts', () => {
    it('scopes COD payment ledger lookup and insert by tenant_id in collectCodPayment', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total INTEGER NOT NULL,
          status TEXT NOT NULL,
          payment_status TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          cod_paid_at TEXT,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          method TEXT NOT NULL,
          amount INTEGER NOT NULL,
          status TEXT NOT NULL,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);

      // Order in store-a, while store-b has a conflicting payment row with the same order_id and different amount
      sqlite
        .prepare(
          `INSERT INTO orders (id, total, status, payment_status, payment_method, tenant_id)
           VALUES ('ord-cod-1', 120000, 'preparing', 'pending', 'cod', 'store-a')`
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO payments (id, order_id, method, amount, status, tenant_id)
           VALUES ('pay-foreign-b', 'ord-cod-1', 'cod', 999999, 'Failed_Cross_Tenant', 'store-b')`
        )
        .run();

      const db = createSqliteD1(sqlite);
      const res = await collectCodPayment(db, 'ord-cod-1', 'store-a');
      expect(res).toEqual({ success: true, status: 'preparing' });

      const storeAPayment = sqlite
        .prepare('SELECT id, amount, status, tenant_id FROM payments WHERE id = ?')
        .get('cod:ord-cod-1') as { id: string; amount: number; status: string; tenant_id: string };
      expect(storeAPayment).toEqual({
        id: 'cod:ord-cod-1',
        amount: 120000,
        status: 'completed',
        tenant_id: 'store-a',
      });
    });

    it('rejects cross-tenant access in kds-mobile.ts and bounds active KDS order query with LIMIT 200', async () => {
      const capturedSql: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          capturedSql.push(sql);
          return {
            bind: () => ({
              all: async () => ({ results: [] }),
            }),
          };
        },
      } as unknown as D1Database;

      const makeCtx = (userTenant: string, headerTenant: string) =>
        ({
          env: { AURA_DB: mockDb },
          get: (k: string) =>
            k === 'user'
              ? { id: 'k-1', role: 'kitchen', tenantId: userTenant }
              : k === 'tenantId'
                ? headerTenant
                : undefined,
          req: {
            query: () => undefined,
            header: (h: string) => (h.toLowerCase() === 'x-tenant-id' ? headerTenant : undefined),
            param: () => 'ord-1',
            json: async () => ({ status: 'preparing' }),
          },
        }) as any;

      const mismatchGet = await getKdsMobile(makeCtx('store-a', 'store-b'));
      expect(mismatchGet.status).toBe(403);

      const mismatchPatch = await updateKdsStatus(makeCtx('store-a', 'store-b'));
      expect(mismatchPatch.status).toBe(403);

      const validGet = await getKdsMobile(makeCtx('store-a', 'store-a'));
      expect(validGet.status).toBe(200);
      expect(capturedSql[0]).toContain('LIMIT 200');
    });

    it('removes the hardcoded u1/a@b.c backdoor and blocks supervisor mutations in kitchen-stations.ts', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        CREATE TABLE kitchen_stations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);
      sqlite
        .prepare(
          `INSERT INTO users (id, name, email, role, tenant_id)
           VALUES ('u1', 'Backdoor User', 'a@b.c', 'staff', 'store-a'),
                  ('sup-1', 'Supervisor User', 'sup@aura.vn', 'supervisor', 'store-a'),
                  ('mgr-1', 'Manager User', 'mgr@aura.vn', 'manager', 'store-a')`
        )
        .run();

      const db = createSqliteD1(sqlite);
      // Even when _log and _bound are attached to db, user u1 with staff or supervisor role MUST be rejected
      (db as unknown as Record<string, unknown>)._log = [];
      (db as unknown as Record<string, unknown>)._bound = [];

      const env = createMockEnv({
        AURA_DB: db,
        ENVIRONMENT: 'production',
        PILOT_TENANT_ID: 'store-a',
      });

      const tokenFor = async (id: string) =>
        (
          await issueStaffSession(
            { JWT_SECRET: TEST_JWT_SECRET },
            await requireStaffAccount(db, id),
            { sessionType: 'staff-web' }
          )
        ).token;

      const u1Token = await tokenFor('u1');
      const supToken = await tokenFor('sup-1');
      const mgrToken = await tokenFor('mgr-1');

      let overrideTenant: string | null = null;
      const app = new Hono<{ Bindings: any }>();
      app.use('*', async (c, next) => {
        if (overrideTenant) {
          (c as any).set('tenantId', overrideTenant);
        }
        await next();
      });
      app.route('/api/kitchen-stations', kitchenStationsRouter);

      const u1StaffRes = await app.request(
        '/api/kitchen-stations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${u1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Backdoor Station', slug: 'backdoor' }),
        },
        env
      );
      expect(u1StaffRes.status).toBe(403);

      const supervisorRes = await app.request(
        '/api/kitchen-stations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Supervisor Station', slug: 'sup' }),
        },
        env
      );
      expect(supervisorRes.status).toBe(403);

      // Manager with mismatched tenant is rejected with 403
      overrideTenant = 'store-b';
      const crossTenantMgrRes = await app.request(
        '/api/kitchen-stations?tenant_id=store-b',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'store-b',
          },
          body: JSON.stringify({ name: 'Cross Station', slug: 'cross' }),
        },
        env
      );
      expect(crossTenantMgrRes.status).toBe(403);

      // Manager with matching tenant succeeds
      overrideTenant = 'store-a';
      const validMgrRes = await app.request(
        '/api/kitchen-stations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Espresso Bar', slug: 'espresso' }),
        },
        env
      );
      expect(validMgrRes.status).toBe(201);
    });

    it('scopes promotion_redemptions, promotion_usages, and referrals by tenant_id during KDS order cancellation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          status TEXT NOT NULL,
          total INTEGER DEFAULT 100000,
          customer_id TEXT,
          cashback_used INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          current_uses INTEGER DEFAULT 0,
          used_count INTEGER DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotion_redemptions (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          promotion_id TEXT,
          code TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotion_usages (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          promotion_id TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE referrals (
          id TEXT PRIMARY KEY,
          first_order_id TEXT,
          status TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);

      sqlite
        .prepare(
          `INSERT INTO orders (id, status, total, tenant_id)
           VALUES ('ord-cancel-a', 'pending', 100000, 'store-a')`
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO promotions (id, code, current_uses, used_count, usage_count, tenant_id)
           VALUES ('promo-a', 'SAVEA', 5, 5, 5, 'store-a'),
                  ('promo-b', 'SAVEB', 5, 5, 5, 'store-b')`
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO promotion_redemptions (id, order_id, promotion_id, code, tenant_id)
           VALUES ('red-a', 'ord-cancel-a', 'promo-a', 'SAVEA', 'store-a'),
                  ('red-b', 'ord-cancel-a', 'promo-b', 'SAVEB', 'store-b')`
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO promotion_usages (id, order_id, promotion_id, tenant_id)
           VALUES ('use-a', 'ord-cancel-a', 'promo-a', 'store-a'),
                  ('use-b', 'ord-cancel-a', 'promo-b', 'store-b')`
        )
        .run();

      const db = createSqliteD1(sqlite);
      const cancelRes = await executeKdsStatusTransition(db, 'ord-cancel-a', 'cancelled', 'manager', {
        tenantId: 'store-a',
      });
      expect(cancelRes.success).toBe(true);

      // Store A's redemptions/usages are rolled back; Store B's rows with colliding order_id remain untouched
      const remainingRedemptions = sqlite
        .prepare('SELECT id, tenant_id FROM promotion_redemptions')
        .all() as Array<{ id: string; tenant_id: string }>;
      expect(remainingRedemptions).toEqual([{ id: 'red-b', tenant_id: 'store-b' }]);

      const remainingUsages = sqlite
        .prepare('SELECT id, tenant_id FROM promotion_usages')
        .all() as Array<{ id: string; tenant_id: string }>;
      expect(remainingUsages).toEqual([{ id: 'use-b', tenant_id: 'store-b' }]);

      const promoA = sqlite.prepare('SELECT usage_count FROM promotions WHERE id = ?').get('promo-a') as {
        usage_count: number;
      };
      const promoB = sqlite.prepare('SELECT usage_count FROM promotions WHERE id = ?').get('promo-b') as {
        usage_count: number;
      };
      expect(promoA.usage_count).toBe(4);
      expect(promoB.usage_count).toBe(5);
    });
  });

  describe('4. admin-orders.ts & stats.ts tenant defaults, payment deduplication & terminal revenue exclusion', () => {
    it('defaults missing tenantId to default, clamps pagination, and deduplicates split/cross-tenant payments in getAdminOrders', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          status TEXT NOT NULL,
          total INTEGER NOT NULL,
          payment_status TEXT NOT NULL,
          customer_name TEXT,
          customer_phone TEXT,
          created_at TEXT NOT NULL,
          items TEXT,
          shipping_fee INTEGER DEFAULT 0,
          discount INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          status TEXT NOT NULL,
          refund_status TEXT,
          refund_amount INTEGER,
          amount INTEGER NOT NULL,
          method TEXT NOT NULL,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT NOT NULL
        );
      `);

      sqlite
        .prepare(
          `INSERT INTO orders (id, table_id, status, total, payment_status, created_at, items, tenant_id)
           VALUES ('ord-def-1', 'T1', 'completed', 100000, 'paid', '2026-11-03T01:00:00Z', '[]', 'default'),
                  ('ord-store-b', 'T2', 'completed', 200000, 'paid', '2026-11-03T02:00:00Z', '[]', 'store-b')`
        )
        .run();

      // Two split payments in 'default' and one foreign payment in 'store-b' for 'ord-def-1'
      sqlite
        .prepare(
          `INSERT INTO payments (id, order_id, status, amount, method, tenant_id, created_at)
           VALUES ('pay-split-1', 'ord-def-1', 'paid', 40000, 'cash', 'default', '2026-11-03T01:01:00Z'),
                  ('pay-split-2', 'ord-def-1', 'completed', 60000, 'payos', 'default', '2026-11-03T01:02:00Z'),
                  ('pay-foreign-b', 'ord-def-1', 'paid', 999999, 'hacker', 'store-b', '2026-11-03T03:00:00Z')`
        )
        .run();

      const db = createSqliteD1(sqlite);
      // Even when caller omits tenantId and passes ?tenant_id=store-b&limit=9999&offset=-20,
      // getAdminOrders defaults to 'default', clamps limit to 200 and offset to 0, and returns 1 deduplicated row
      const req = new Request(
        'https://test.aura/api/admin/orders?tenant_id=store-b&limit=9999&offset=-20'
      );
      const res = await getAdminOrders(req, { AURA_DB: db });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        orders: Array<{ id: string; payment_id: string; payment_amount: number }>;
        pagination: { total: number; limit: number; offset: number };
      };
      expect(body.orders).toHaveLength(1);
      expect(body.orders[0]!.id).toBe('ord-def-1');
      expect(body.orders[0]!.payment_id).toBe('pay-split-2');
      expect(body.orders[0]!.payment_amount).toBe(60000);
      expect(body.pagination).toEqual({
        total: 1,
        limit: 200,
        offset: 0,
        page: 1,
        pageSize: 200,
      });
    });

    it('defaults missing tenantId to default, uses ICT business dates, and excludes refunded/failed/expired orders in getStats', async () => {
      vi.useFakeTimers();
      // 2026-11-02T18:30:00.000Z is 2026-11-03 01:30:00 ICT
      vi.setSystemTime(new Date('2026-11-02T18:30:00.000Z'));

      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          payment_status TEXT DEFAULT 'paid',
          total INTEGER NOT NULL,
          items TEXT NOT NULL,
          created_at TEXT NOT NULL,
          tenant_id TEXT DEFAULT 'default'
        );
      `);

      const validItems = JSON.stringify([{ name: 'Cà Phê Sữa', quantity: 2 }]);
      const refundedItems = JSON.stringify([{ name: 'Refunded Drink', quantity: 10 }]);

      sqlite
        .prepare(
          `INSERT INTO orders (id, status, payment_status, total, items, created_at, tenant_id)
           VALUES ('ord-valid', 'completed', 'paid', 90000, ?, '2026-11-03 01:00:00', 'default'),
                  ('ord-refunded-status', 'refunded', 'paid', 500000, ?, '2026-11-03 01:05:00', 'default'),
                  ('ord-refunded-pay', 'completed', 'refunded', 300000, ?, '2026-11-03 01:10:00', 'default'),
                  ('ord-failed', 'failed', 'failed', 200000, ?, '2026-11-03 01:15:00', 'default'),
                  ('ord-expired', 'expired', 'unpaid', 150000, ?, '2026-11-03 01:20:00', 'default'),
                  ('ord-other-tenant', 'completed', 'paid', 888000, ?, '2026-11-03 01:00:00', 'store-b')`
        )
        .run(validItems, refundedItems, refundedItems, refundedItems, refundedItems, validItems);

      const db = createSqliteD1(sqlite);
      const res = await getStats(new Request('https://test.aura/api/orders/stats'), { AURA_DB: db });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        stats: {
          orders_today: number;
          revenue_today: number;
          top_products: Array<{ name: string; quantity: number }>;
          revenue_7days: Array<{ date: string; revenue: number }>;
        };
      };
      expect(body.stats.orders_today).toBe(1);
      expect(body.stats.revenue_today).toBe(90000);
      expect(body.stats.top_products).toEqual([{ name: 'Cà Phê Sữa', quantity: 2 }]);
      expect(body.stats.revenue_7days).toEqual([{ date: '2026-11-03', revenue: 90000 }]);
    });
  });
});
