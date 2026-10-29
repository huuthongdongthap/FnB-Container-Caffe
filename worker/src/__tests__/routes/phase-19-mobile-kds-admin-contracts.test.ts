import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { getTablesMobile, updateTableStatus } from '../../routes/tables-mobile';
import { createOrderMobile, getOrdersMobile } from '../../routes/orders-mobile';
import { birthdayRouter } from '../../routes/birthday';
import { erpnextSyncRoutes } from '../../routes/erpnext-sync';
import { executeKdsStatusTransition } from '../../../../packages/domain/kitchen/commands/kds-status-transition';
import { generateJWT } from '../../lib/jwt';
import { createMockKV, isStaffAccountLookup, TEST_JWT_SECRET } from '../test-utils';

/** Account rows the staff-session gate reads behind a staff token. */
const STAFF_ACCOUNTS: any[] = [
  { id: 'USR_OWNER', name: 'Owner', phone: null, role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
];

function createMockD1Database(initialTables: any[] = [], initialOrders: any[] = [], accountRows: any[] = STAFF_ACCOUNTS) {
  const cafeTables = new Map(initialTables.map((t) => [t.id, t]));
  const orders = new Map(initialOrders.map((o) => [o.id, o]));
  const erpnextLogs: any[] = [];

  return {
    prepare: (sql: string) => {
      const stmt: any = {
        _sql: sql,
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt._binds = args;
          return stmt;
        },
        first: async <T = unknown>(): Promise<T | null> => {
          // The staff-session gate looks the account row up on every request, so
          // an admin route cannot be exercised without answering its lookup.
          if (isStaffAccountLookup(sql)) {
            const id = String(stmt._binds[0]);
            return (accountRows.find((r) => String(r.id) === id) ?? null) as T;
          }
          if (sql.includes('FROM products WHERE id = ?')) {
            const products: Record<string, object> = { tea: { id: 'tea', name: 'Trà sen vàng', price: 45000, available: 1 }, bread: { id: 'bread', name: 'Bánh sừng bò', price: 35000, available: 1 } };
            return (products[String(stmt._binds[0])] || null) as T;
          }
          if (sql.includes('FROM cafe_tables WHERE id = ?')) {
            const id = String(stmt._binds[0]);
            return (cafeTables.get(id) as T) ?? null;
          }
          if (sql.includes('FROM orders WHERE id = ?')) {
            const id = String(stmt._binds[0]);
            return (orders.get(id) as T) ?? null;
          }
          if (sql.includes('FROM erpnext_sync_log')) {
            return (erpnextLogs[erpnextLogs.length - 1] as T) ?? null;
          }
          if (sql.includes('FROM erpnext_sync_queue')) {
            return ({ cnt: 2 } as T);
          }
          return null;
        },
        all: async <T = unknown>(): Promise<{ results: T[]; success: boolean }> => {
          if (sql.includes('FROM cafe_tables')) {
            return { results: Array.from(cafeTables.values()) as T[], success: true };
          }
          if (sql.includes('FROM orders')) {
            return { results: Array.from(orders.values()) as T[], success: true };
          }
          return { results: [] as T[], success: true };
        },
        run: async () => {
          if (sql.includes("UPDATE cafe_tables SET status = 'Occupied'")) {
            const table = cafeTables.get(String(stmt._binds[0]));
            if (table) table.status = 'Occupied';
          }
          if (sql.includes('UPDATE cafe_tables SET status = ?')) {
            const status = stmt._binds[0];
            const id = stmt._binds[stmt._binds.length - 1];
            const updated_at = stmt._binds.length > 2 ? stmt._binds[1] : undefined;
            const current = cafeTables.get(String(id));
            if (current) {
              cafeTables.set(String(id), { ...current, status, ...(updated_at !== undefined ? { updated_at } : {}) });
            }
          }
          if (sql.includes('INSERT INTO orders')) {
            const id = String(stmt._binds[0]);
            orders.set(id, { id, status: 'pending', items: stmt._binds[6] });
          }
          if (sql.includes('UPDATE orders SET status = ?')) {
            const [status, updated_at, id] = stmt._binds;
            const current = orders.get(String(id));
            if (current) {
              orders.set(String(id), { ...current, status, updated_at });
            }
          }
          if (sql.includes('INSERT INTO erpnext_sync_log')) {
            erpnextLogs.push({ id: stmt._binds[0], created_at: new Date().toISOString() });
          }
          return { success: true, changes: 1 };
        },
      };
      return stmt;
    },
    batch: async (statements: { run(): Promise<unknown> }[]) => Promise.all(statements.map(statement => statement.run())),
    cafeTables,
    orders,
    erpnextLogs,
  };
}

describe('Phase 19: Mobile Staff, KDS Lifecycle & Admin Integrations Contracts', () => {
  let mockKv: ReturnType<typeof createMockKV>;
  let mockDb: ReturnType<typeof createMockD1Database>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKv = createMockKV();
    mockDb = createMockD1Database(
      [
        {
          id: 'TBL_1',
          table_number: 1,
          zone: 'A',
          seats: 4,
          status: 'Available',
          created_at: '2026-10-15T00:00:00Z',
          updated_at: '2026-10-15T00:00:00Z',
        },
      ],
      [
        {
          id: 'ORD_100',
          status: 'pending',
          items: JSON.stringify([{ name: 'Cà phê đá', quantity: 2, price: 30000 }]),
        },
      ]
    );
  });

  describe('1. Mobile Tables ↔ cafe_tables Contract', () => {
    it('reads cafe_tables and maps Available to free, seats to capacity, table_number to number', async () => {
      const ctx: any = {
        req: { raw: new Request('https://test.aura/mobile/tables') },
        env: { AURA_DB: mockDb, AUTH_KV: mockKv, JWT_SECRET: TEST_JWT_SECRET },
        get: (k: string) => (k === 'user' ? { id: 'USR_STAFF', role: 'staff' } : undefined),
      };

      const res = await getTablesMobile(ctx);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.tables[0]).toMatchObject({
        id: 'TBL_1',
        number: 1,
        capacity: 4,
        status: 'free',
        zone: 'A',
      });
    });

    it('updates cafe_tables with Occupied when waiter sets occupied', async () => {
      const ctx: any = {
        req: {
          raw: new Request('https://test.aura/mobile/tables/TBL_1', { method: 'PATCH' }),
          param: (k: string) => (k === 'id' ? 'TBL_1' : undefined),
          json: async () => ({ status: 'occupied' }),
        },
        env: { AURA_DB: mockDb, AUTH_KV: mockKv, JWT_SECRET: TEST_JWT_SECRET },
        get: (k: string) => (k === 'user' ? { id: 'USR_WAITER', role: 'waiter' } : undefined),
      };

      const res = await updateTableStatus(ctx);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.table.status).toBe('occupied');
      expect(mockDb.cafeTables.get('TBL_1')?.status).toBe('Occupied');
    });
  });

  describe('2. Mobile Orders ↔ D1 orders NOT NULL Schema', () => {
    it('accepts quantity or qty and inserts valid D1 order with total and cafe_tables occupation', async () => {
      const ctx: any = {
        req: {
          raw: new Request('https://test.aura/mobile/orders', { method: 'POST' }),
          json: async () => ({
            table_id: 'TBL_1',
            table_number: 1,
            items: [
              { product_id: 'tea', name: 'Trà sen vàng', quantity: 2, price: 45000 },
              { product_id: 'bread', name: 'Bánh sừng bò', qty: 1, price: 35000 },
            ],
          }),
        },
        env: { AURA_DB: mockDb, AUTH_KV: mockKv, JWT_SECRET: TEST_JWT_SECRET },
        get: (k: string) => (k === 'user' ? { id: 'USR_WAITER', role: 'waiter' } : undefined),
      };

      const res = await createOrderMobile(ctx);
      expect(res.status).toBe(201);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.total).toBe(125000);
      expect(mockDb.cafeTables.get('TBL_1')?.status).toBe('Occupied');
    });
  });

  describe('3. KDS Lifecycle: pending → preparing', () => {
    it('allows staff/kitchen to transition order from pending to preparing', async () => {
      const result = await executeKdsStatusTransition(mockDb as any, 'ORD_100', 'preparing', 'staff');
      expect(result.success).toBe(true);
      expect(result.order?.status).toBe('preparing');
      expect(mockDb.orders.get('ORD_100')?.status).toBe('preparing');
    });

    it('denies customer from transitioning order to preparing with 403', async () => {
      const result = await executeKdsStatusTransition(mockDb as any, 'ORD_100', 'preparing', 'customer');
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(403);
    });
  });

  describe('4. Admin Birthday Config Endpoints', () => {
    it('returns default birthday config and updates KV', async () => {
      const app = new Hono<{ Bindings: any }>();
      app.route('/api/admin/birthday', birthdayRouter);

      const getRes = await app.fetch(
        new Request('https://test.aura/api/admin/birthday/config', { method: 'GET' }),
        { AUTH_KV: mockKv }
      );
      expect(getRes.status).toBe(200);
      const config = await getRes.json() as any;
      expect(config.discountPercent).toBe(15);
      expect(config.freeItemEnabled).toBe(true);

      const putRes = await app.fetch(
        new Request('https://test.aura/api/admin/birthday/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discountPercent: 20, freeItemEnabled: false }),
        }),
        { AUTH_KV: mockKv }
      );
      expect(putRes.status).toBe(200);
      const updated = await putRes.json() as any;
      expect(updated.discountPercent).toBe(20);
      expect(updated.freeItemEnabled).toBe(false);

      const kvVal = JSON.parse((await mockKv.get('config:birthday')) || '{}');
      expect(kvVal.discountPercent).toBe(20);
    });
  });

  describe('5. Admin ERPNext Sync Endpoints', () => {
    it('returns sync status and supports sync-all and single entity sync', async () => {
      const app = new Hono<{ Bindings: any }>();
      erpnextSyncRoutes(app);

      const token = await generateJWT({ id: 'USR_OWNER', email: 'owner@aura.cafe', name: 'Owner', role: 'owner' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'},
        TEST_JWT_SECRET,
        3600
      );

      const statusRes = await app.fetch(
        new Request('https://test.aura/api/admin/erpnext-sync/status', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }),
        { AURA_DB: mockDb, JWT_SECRET: TEST_JWT_SECRET }
      );
      expect(statusRes.status).toBe(200);
      const statusData = await statusRes.json() as any;
      expect(statusData.status).toBe('pending');
      expect(statusData.pendingItems).toBe(2);

      const syncAllRes = await app.fetch(
        new Request('https://test.aura/api/admin/erpnext-sync/sync-all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
        { AURA_DB: mockDb, JWT_SECRET: TEST_JWT_SECRET }
      );
      expect(syncAllRes.status).toBe(200);
      const syncAllData = await syncAllRes.json() as any;
      expect(syncAllData.success).toBe(true);
      expect(syncAllData.entity).toBe('all');

      const syncOrdersRes = await app.fetch(
        new Request('https://test.aura/api/admin/erpnext-sync/orders', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
        { AURA_DB: mockDb, JWT_SECRET: TEST_JWT_SECRET }
      );
      expect(syncOrdersRes.status).toBe(200);
      const syncOrdersData = await syncOrdersRes.json() as any;
      expect(syncOrdersData.success).toBe(true);
      expect(syncOrdersData.entity).toBe('orders');
    });
  });
});
