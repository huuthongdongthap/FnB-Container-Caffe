import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { createMockEnv } from '../test-utils';
import { adminSalesRouter } from '../../routes/admin-sales';
import adminMetrics from '../../routes/admin-metrics';
import { registerQueryHandler } from '../../routes/admin-audit-logs-handlers/query-handler';
import { registerExportHandler } from '../../routes/admin-audit-logs-handlers/export-handler';
import { escapeCsv } from '../../routes/admin-audit-logs-handlers/csv-helper';
import { checkinRouter } from '../../routes/checkin';
import { getTablesMobile, updateTableStatus } from '../../routes/tables-mobile';
import { getOrdersMobile, getOrderDetail } from '../../routes/orders-mobile';
import { registerVitalsRoute } from '../../routes/vitals';

function createStatefulSqlMock(options?: {
  salesRows?: Array<Record<string, unknown>>;
  auditRows?: Array<Record<string, unknown>>;
  checkins?: Array<Record<string, unknown>>;
  customers?: Array<Record<string, unknown>>;
  wallets?: Array<Record<string, unknown>>;
  tables?: Array<Record<string, unknown>>;
  tableSessions?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
  throwOnMetricsQuery?: boolean;
}) {
  const executedQueries: Array<{ sql: string; args: unknown[] }> = [];
  const salesRows = options?.salesRows ?? [];
  const auditRows = options?.auditRows ?? [];
  const checkins = options?.checkins ?? [];
  const customers = options?.customers ?? [];
  const wallets = options?.wallets ?? [];
  const tables = options?.tables ?? [];
  const tableSessions = options?.tableSessions ?? [];
  const orders = options?.orders ?? [];

  const makeStmt = (sql: string, args: unknown[] = []) => ({
    bind: vi.fn((...boundArgs: unknown[]) => makeStmt(sql, boundArgs)),
    all: vi.fn(async () => {
      executedQueries.push({ sql, args });
      if (options?.throwOnMetricsQuery && sql.includes('_metrics')) {
        throw new Error('D1_ERROR: json_extract failure');
      }
      if (sql.includes('FROM orders') && sql.includes('customer_name')) {
        const startBound = String(args[3] ?? '');
        const endBound = String(args[4] ?? '');
        const filtered = salesRows.filter((r) => {
          const created = String(r.created_at ?? '');
          return (!startBound || created >= startBound) && (!endBound || created <= endBound);
        });
        return { results: filtered };
      }
      if (sql.includes('FROM orders')) {
        return { results: orders };
      }
      if (sql.includes('FROM audit_log') || sql.includes('FROM audit_logs') || sql.includes('FROM admin_audit_logs')) {
        return { results: auditRows };
      }
      if (sql.includes('FROM checkins')) {
        return { results: checkins };
      }
      if (sql.includes('FROM cafe_tables')) {
        return { results: tables };
      }
      return { results: [] };
    }),
    first: vi.fn(async () => {
      executedQueries.push({ sql, args });
      if (options?.throwOnMetricsQuery && sql.includes('_metrics')) {
        throw new Error('D1_ERROR: json_extract failure');
      }
      if (sql.includes('FROM _metrics')) {
        return { total: 10 };
      }
      if (sql.includes('FROM checkins WHERE customer_id = ? AND checkin_date = ?')) {
        const cid = String(args[0] ?? '');
        const dt = String(args[1] ?? '');
        return checkins.find((c) => c.customer_id === cid && c.checkin_date === dt) ?? null;
      }
      if (sql.includes('FROM checkins WHERE id = ?')) {
        return checkins.find((c) => c.id === args[0]) ?? null;
      }
      if (sql.includes("SELECT id FROM customers WHERE id = ? AND COALESCE(tenant_id, 'default') = ?")) {
        const cid = String(args[0] ?? '');
        const tid = String(args[1] ?? 'default');
        return (
          customers.find(
            (c) => c.id === cid && (String(c.tenant_id ?? '').trim() || 'default') === tid
          ) ?? null
        );
      }
      if (sql.includes('FROM customers WHERE id = ?')) {
        return customers.find((c) => c.id === args[0]) ?? null;
      }
      if (sql.includes('FROM cashback_wallets WHERE customer_id = ?')) {
        const cid = String(args[0] ?? '');
        const tid = args[1] ? String(args[1]) : undefined;
        return (
          wallets.find(
            (w) =>
              w.customer_id === cid &&
              (!tid || (String(w.tenant_id ?? '').trim() || 'default') === tid)
          ) ?? null
        );
      }
      if (sql.includes('FROM cafe_tables WHERE id = ?')) {
        return tables.find((t) => t.id === args[0]) ?? null;
      }
      if (sql.includes('FROM orders WHERE id = ?')) {
        return orders.find((o) => o.id === args[0]) ?? null;
      }
      return null;
    }),
    run: vi.fn(async () => {
      executedQueries.push({ sql, args });
      if (sql.includes('INSERT INTO checkins')) {
        checkins.push({
          id: args[0],
          customer_id: args[1],
          customer_name: args[2],
          checkin_date: args[3],
          checkin_time: args[4],
          reward_amount: args[5],
          status: args[6],
          created_at: args[7],
        });
      }
      if (sql.includes('UPDATE checkins SET tenant_id = ? WHERE id = ?')) {
        const row = checkins.find((c) => c.id === args[1]);
        if (row) row.tenant_id = args[0];
      }
      if (sql.includes("UPDATE table_sessions SET status = 'closed'")) {
        const tableId = String(args[2] ?? '');
        const tenantArg = args[3] ? String(args[3]) : undefined;
        for (const sess of tableSessions) {
          const sessTenant = String(sess.tenant_id ?? '').trim() || 'default';
          if (
            sess.table_id === tableId &&
            ['active', 'ordering'].includes(String(sess.status)) &&
            (!tenantArg || sessTenant === tenantArg)
          ) {
            sess.status = 'closed';
          }
        }
      }
      return { success: true, meta: { changes: 1 } };
    }),
  });

  return {
    db: {
      prepare: vi.fn((sql: string) => makeStmt(sql, [])),
    },
    executedQueries,
  };
}

describe('Phase 49 Slice AV2 — Mobile POS, Check-in, Admin Sales/Metrics/Audit-Logs & Vitals Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. admin-sales.ts hardening', () => {
    it('rejects supervisor and staff roles on GET /api/admin/sales/csv with 403', async () => {
      for (const role of ['supervisor', 'staff', 'waiter', 'cashier']) {
        const app = new Hono<{ Bindings: Env }>();
        app.use('*', async (c, next) => {
          c.set('user' as never, { id: `u-${role}`, role, tenantId: 'store-a' } as never);
          c.set('tenantId' as never, 'store-a' as never);
          await next();
        });
        app.route('/api/admin/sales', adminSalesRouter);

        const { db } = createStatefulSqlMock();
        const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };
        const res = await app.fetch(new Request('https://test.aura/api/admin/sales/csv?range=7d'), env);
        expect(res.status).toBe(403);
      }
    });

    it('rejects cross-tenant manager (user.tenantId !== getTenantId(c) or header override) with 403', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      app.route('/api/admin/sales', adminSalesRouter);

      const { db } = createStatefulSqlMock();
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };
      const res = await app.fetch(
        new Request('https://test.aura/api/admin/sales/csv?range=7d', {
          headers: { 'X-Tenant-ID': 'store-b' },
        }),
        env
      );
      expect(res.status).toBe(403);
    });

    it('includes same-day orders on endDate (YYYY-MM-DDT23:59:59.999Z), excludes cancelled/refunded/failed/expired orders, and neutralizes | and multiline formula payloads', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.route('/api/admin/sales', adminSalesRouter);

      const { db, executedQueries } = createStatefulSqlMock({
        salesRows: [
          {
            id: 'ord-valid-same-day',
            customer_name: "|calc.exe\n=SUM(A1:A9)",
            items: JSON.stringify([{ name: 'Cà phê sữa' }]),
            total: 45000,
            payment_method: 'vietqr',
            status: 'completed',
            payment_status: 'paid',
            created_at: '2026-11-03T15:45:00.000Z',
          },
          {
            id: 'ord-cancelled',
            customer_name: 'Cancelled Guest',
            items: '[]',
            total: 99000,
            payment_method: 'cod',
            status: 'cancelled',
            payment_status: 'pending',
            created_at: '2026-11-03T10:00:00.000Z',
          },
          {
            id: 'ord-refunded-pay',
            customer_name: 'Refunded Guest',
            items: '[]',
            total: 88000,
            payment_method: 'payos',
            status: 'completed',
            payment_status: 'refunded',
            created_at: '2026-11-03T11:00:00.000Z',
          },
        ],
      });

      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };
      const res = await app.fetch(
        new Request('https://test.aura/api/admin/sales/csv?start=2026-11-01&end=2026-11-03'),
        env
      );
      expect(res.status).toBe(200);

      const selectQuery = executedQueries.find((q) => q.sql.includes('FROM orders'));
      expect(selectQuery).toBeDefined();
      expect(selectQuery?.sql).toContain("NOT IN ('cancelled', 'refunded', 'failed', 'expired')");
      expect(selectQuery?.args).toContain('2026-11-03T23:59:59.999Z');

      const csvText = await res.text();
      expect(csvText).toContain('ord-valid-same-day');
      expect(csvText).not.toContain('ord-cancelled');
      expect(csvText).not.toContain('ord-refunded-pay');
      expect(csvText).toContain("'|calc.exe\n'=SUM(A1:A9)");
    });
  });

  describe('2. admin-metrics.ts hardening', () => {
    it('rejects unauthenticated (401), staff/supervisor (403), and cross-tenant manager (403) on GET /api/admin/metrics', async () => {
      const { db } = createStatefulSqlMock();
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      // 1. Unauthenticated -> 401
      const unauthApp = new Hono<{ Bindings: Env }>();
      unauthApp.route('/api/admin/metrics', adminMetrics);
      const unauthRes = await unauthApp.fetch(new Request('https://test.aura/api/admin/metrics'), env);
      expect(unauthRes.status).toBe(401);

      // 2. staff and supervisor -> 403
      for (const role of ['staff', 'supervisor', 'waiter']) {
        const roleApp = new Hono<{ Bindings: Env }>();
        roleApp.use('*', async (c, next) => {
          c.set('user' as never, { id: `u-${role}`, role, tenantId: 'store-a' } as never);
          c.set('tenantId' as never, 'store-a' as never);
          await next();
        });
        roleApp.route('/api/admin/metrics', adminMetrics);
        const roleRes = await roleApp.fetch(new Request('https://test.aura/api/admin/metrics'), env);
        expect(roleRes.status).toBe(403);
      }

      // 3. Cross-tenant manager -> 403
      const crossApp = new Hono<{ Bindings: Env }>();
      crossApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      crossApp.route('/api/admin/metrics', adminMetrics);
      const crossRes = await crossApp.fetch(
        new Request('https://test.aura/api/admin/metrics?tenant_id=store-b'),
        env
      );
      expect(crossRes.status).toBe(403);
    });

    it('does not fall back to unscoped queries when tenantId !== default and SQL throws, and caps latency queries with LIMIT 5000', async () => {
      const { db: throwingDb, executedQueries: throwingQueries } = createStatefulSqlMock({
        throwOnMetricsQuery: true,
      });
      const env = { ...createMockEnv(), AURA_DB: throwingDb as unknown as D1Database };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-b', role: 'manager', tenantId: 'store-b' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      app.route('/api/admin/metrics', adminMetrics);

      const res = await app.fetch(new Request('https://test.aura/api/admin/metrics?range=24h'), env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        requests: { total: number };
        revenue: { total: number };
        topPaths: unknown[];
      };
      expect(body.requests.total).toBe(0);
      expect(body.revenue.total).toBe(0);
      expect(body.topPaths).toEqual([]);

      // Every attempted _metrics query for store-b MUST contain the tenant predicate (never unscoped fallback)
      for (const q of throwingQueries) {
        expect(q.sql).toContain("tags ->> '$.tenant_id'");
      }

      // Verify LIMIT 5000 on latency sample queries
      const { db: okDb, executedQueries: okQueries } = createStatefulSqlMock();
      const okEnv = { ...createMockEnv(), AURA_DB: okDb as unknown as D1Database };
      const okRes = await app.fetch(new Request('https://test.aura/api/admin/metrics?range=24h'), okEnv);
      expect(okRes.status).toBe(200);
      const latencyQuery = okQueries.find((q) => q.sql.includes('ORDER BY duration'));
      expect(latencyQuery?.sql).toContain('LIMIT 5000');
    });
  });

  describe('3. admin-audit-logs-handlers hardening', () => {
    it('rejects supervisor on /export (403) while allowing manager/owner, and rejects cross-tenant staff on / and /export (403)', async () => {
      const { db } = createStatefulSqlMock();
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      const supApp = new Hono<{ Bindings: Env }>();
      supApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'sup-1', role: 'supervisor', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerExportHandler(supApp);
      const supExportRes = await supApp.fetch(new Request('https://test.aura/export'), env);
      expect(supExportRes.status).toBe(403);

      const mgrApp = new Hono<{ Bindings: Env }>();
      mgrApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerExportHandler(mgrApp);
      const mgrExportRes = await mgrApp.fetch(new Request('https://test.aura/export'), env);
      expect(mgrExportRes.status).toBe(200);

      // Cross-tenant on / and /export -> 403
      const crossApp = new Hono<{ Bindings: Env }>();
      crossApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      registerQueryHandler(crossApp);
      registerExportHandler(crossApp);

      const crossQueryRes = await crossApp.fetch(new Request('https://test.aura/?tenant_id=store-b'), env);
      expect(crossQueryRes.status).toBe(403);
      const crossExportRes = await crossApp.fetch(new Request('https://test.aura/export?tenant_id=store-b'), env);
      expect(crossExportRes.status).toBe(403);
    });

    it('clamps page (<= 1000) and batchSize (<= 2500), normalizes YYYY-MM-DD dateTo to end-of-day, and neutralizes | and multiline formulas in escapeCsv', async () => {
      const { db, executedQueries } = createStatefulSqlMock({
        auditRows: [
          {
            id: 'aud-1',
            actor_id: 'mgr-1',
            action: 'order.update',
            target_id: 'ord-1',
            payload: '{"status":"completed"}',
            tenant_id: 'store-a',
            created_at: '2026-11-03T18:30:00.000Z',
          },
        ],
      });
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerQueryHandler(app);

      const res = await app.fetch(
        new Request('https://test.aura/?page=999999&limit=100&dateTo=2026-11-03'),
        env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { page: number };
      expect(body.page).toBe(1000);

      const auditQuery = executedQueries.find(
        (q) => q.sql.includes('SELECT * FROM audit_logs') || q.sql.includes('SELECT * FROM audit_log')
      );
      expect(auditQuery).toBeDefined();
      expect(auditQuery?.args).toContain(2500);
      expect(auditQuery?.args).toContain('2026-11-03T23:59:59.999Z');

      // CSV helper formula injection hardening
      expect(escapeCsv('|/bin/sh')).toBe("\"'|/bin/sh\"");
      expect(escapeCsv('  |calc')).toBe("\"'  |calc\"");
      expect(escapeCsv('safe line\n=CMD()')).toBe('"safe line\n\'=CMD()"');
      expect(escapeCsv('safe line\r\n  |pipe')).toBe('"safe line\r\n\'  |pipe"');
    });
  });

  describe('4. checkin.ts hardening', () => {
    it('rejects unauthenticated GET /, POST /:id/approve, and POST /:id/reject with 401', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/checkin', checkinRouter);
      const { db } = createStatefulSqlMock();
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      const getRes = await app.fetch(new Request('https://test.aura/api/checkin'), env);
      expect(getRes.status).toBe(401);

      const approveRes = await app.fetch(
        new Request('https://test.aura/api/checkin/ci-1/approve', { method: 'POST' }),
        env
      );
      expect(approveRes.status).toBe(401);

      const rejectRes = await app.fetch(
        new Request('https://test.aura/api/checkin/ci-1/reject', { method: 'POST' }),
        env
      );
      expect(rejectRes.status).toBe(401);
    });

    it('rejects cross-tenant staff on GET / and POST /:id/approve with 403', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      app.route('/api/checkin', checkinRouter);

      const { db } = createStatefulSqlMock();
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      const listRes = await app.fetch(
        new Request('https://test.aura/api/checkin?tenant_id=store-b'),
        env
      );
      expect(listRes.status).toBe(403);

      const approveRes = await app.fetch(
        new Request('https://test.aura/api/checkin/ci-1/approve?tenant_id=store-b', {
          method: 'POST',
        }),
        env
      );
      expect(approveRes.status).toBe(403);
    });

    it('masks customer_phone in GET / for waiter/staff role while preserving it for manager', async () => {
      const checkinRows = [
        {
          id: 'ci-mask-1',
          customer_id: 'cust-1',
          customer_name: 'Nguyen Van B',
          customer_phone: '0909123456',
          checkin_date: '2026-11-03',
          checkin_time: '2026-11-03T08:00:00Z',
          reward_amount: 5000,
          status: 'pending',
          tenant_id: 'store-a',
          customer_tenant_id: 'store-a',
          created_at: '2026-11-03T08:00:00Z',
        },
      ];

      // 1. Waiter gets masked phone
      const waiterApp = new Hono<{ Bindings: Env }>();
      waiterApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'waiter-1', role: 'waiter', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      waiterApp.route('/api/checkin', checkinRouter);
      const { db: waiterDb } = createStatefulSqlMock({ checkins: checkinRows });
      const waiterEnv = { ...createMockEnv(), AURA_DB: waiterDb as unknown as D1Database };
      const waiterRes = await waiterApp.fetch(new Request('https://test.aura/api/checkin'), waiterEnv);
      expect(waiterRes.status).toBe(200);
      const waiterBody = (await waiterRes.json()) as {
        data: Array<{ customer_phone: string | null; memberPhone: string }>;
      };
      expect(waiterBody.data[0].customer_phone).toBeNull();
      expect(waiterBody.data[0].memberPhone).toBe('***456');

      // 2. Manager sees full customer_phone
      const mgrApp = new Hono<{ Bindings: Env }>();
      mgrApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      mgrApp.route('/api/checkin', checkinRouter);
      const { db: mgrDb } = createStatefulSqlMock({ checkins: checkinRows });
      const mgrEnv = { ...createMockEnv(), AURA_DB: mgrDb as unknown as D1Database };
      const mgrRes = await mgrApp.fetch(new Request('https://test.aura/api/checkin'), mgrEnv);
      expect(mgrRes.status).toBe(200);
      const mgrBody = (await mgrRes.json()) as {
        data: Array<{ customer_phone: string | null; memberPhone: string }>;
      };
      expect(mgrBody.data[0].customer_phone).toBe('0909123456');
      expect(mgrBody.data[0].memberPhone).toBe('0909123456');
    });

    it('uses UTC+7 (Asia/Ho_Chi_Minh) date when checking/inserting checkin_date and scopes UPDATE checkins & UPDATE cashback_wallets by tenant on /:id/approve', async () => {
      // Set system clock to 2026-11-03T18:30:00Z -> which is 2026-11-04T01:30:00+07:00 in Vietnam
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-03T18:30:00.000Z'));

      const { db, executedQueries } = createStatefulSqlMock({
        customers: [{ id: 'cust-vn-1', name: 'VN Customer', tenant_id: 'store-a' }],
        wallets: [{ id: 'wal-vn-1', customer_id: 'cust-vn-1', balance: 10000, tenant_id: 'store-a' }],
        checkins: [],
      });
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        if (c.req.header('X-Staff-Auth') === 'true') {
          c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        } else {
          c.set('user' as never, { id: 'cust-vn-1', role: 'customer', tenantId: 'store-a' } as never);
        }
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.route('/api/checkin', checkinRouter);

      const postRes = await app.fetch(
        new Request('https://test.aura/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
          body: JSON.stringify({ customer_id: 'cust-vn-1', customer_name: 'VN Customer' }),
        }),
        env
      );
      expect(postRes.status).toBe(201);
      const postBody = (await postRes.json()) as { data: { id: string; checkin_date: string } };
      expect(postBody.data.checkin_date).toBe('2026-11-04');

      const approveRes = await app.fetch(
        new Request(`https://test.aura/api/checkin/${postBody.data.id}/approve`, {
          method: 'POST',
          headers: { 'X-Staff-Auth': 'true', 'X-Tenant-ID': 'store-a' },
        }),
        env
      );
      expect(approveRes.status).toBe(200);

      const custVerifyQuery = executedQueries.find(
        (q) =>
          q.sql.includes('SELECT id FROM customers WHERE id = ?') &&
          q.sql.includes("COALESCE(tenant_id, 'default') = ?")
      );
      expect(custVerifyQuery).toBeDefined();
      expect(custVerifyQuery?.args).toEqual(['cust-vn-1', 'store-a']);

      const updateCheckinQuery = executedQueries.find(
        (q) => q.sql.includes('UPDATE checkins SET status = ?') && q.sql.includes("COALESCE(tenant_id, 'default') = ?")
      );
      expect(updateCheckinQuery).toBeDefined();
      expect(updateCheckinQuery?.args).toContain('store-a');

      const updateWalletQuery = executedQueries.find(
        (q) =>
          q.sql.includes('UPDATE cashback_wallets SET balance = balance + ?') &&
          q.sql.includes("COALESCE(tenant_id, 'default') = ?")
      );
      expect(updateWalletQuery).toBeDefined();
      expect(updateWalletQuery?.args).toContain('store-a');
    });
  });

  describe('5. tables-mobile.ts & orders-mobile.ts hardening', () => {
    it('rejects cross-tenant staff on tables-mobile and orders-mobile with 403', async () => {
      const { db } = createStatefulSqlMock();
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'waiter-a', role: 'waiter', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-b' as never);
        await next();
      });
      app.get('/mobile/tables', getTablesMobile);
      app.patch('/mobile/tables/:id', updateTableStatus);
      app.get('/mobile/orders', getOrdersMobile);
      app.get('/mobile/orders/:id', getOrderDetail);

      expect((await app.fetch(new Request('https://test.aura/mobile/tables?tenant_id=store-b'), env)).status).toBe(403);
      expect(
        (
          await app.fetch(
            new Request('https://test.aura/mobile/tables/t-1?tenant_id=store-b', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'free' }),
            }),
            env
          )
        ).status
      ).toBe(403);
      expect((await app.fetch(new Request('https://test.aura/mobile/orders?tenant_id=store-b'), env)).status).toBe(403);
      expect((await app.fetch(new Request('https://test.aura/mobile/orders/ord-1?tenant_id=store-b'), env)).status).toBe(403);
    });

    it('closes only active/ordering table_sessions for that tenant when setting table to free (preserving paying/paid)', async () => {
      const tableSessions = [
        { id: 'sess-active', table_id: 'tbl-1', status: 'active', tenant_id: 'store-a' },
        { id: 'sess-ordering', table_id: 'tbl-1', status: 'ordering', tenant_id: 'store-a' },
        { id: 'sess-paying', table_id: 'tbl-1', status: 'paying', tenant_id: 'store-a' },
        { id: 'sess-paid', table_id: 'tbl-1', status: 'paid', tenant_id: 'store-a' },
        { id: 'sess-other-tenant', table_id: 'tbl-1', status: 'active', tenant_id: 'store-b' },
      ];
      const { db, executedQueries } = createStatefulSqlMock({
        tables: [{ id: 'tbl-1', table_number: 1, status: 'Occupied', tenant_id: 'store-a' }],
        tableSessions,
      });
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'waiter-a', role: 'waiter', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.patch('/mobile/tables/:id', updateTableStatus);

      const res = await app.fetch(
        new Request('https://test.aura/mobile/tables/tbl-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'free' }),
        }),
        env
      );
      expect(res.status).toBe(200);

      const closeSessQuery = executedQueries.find((q) => q.sql.includes('UPDATE table_sessions'));
      expect(closeSessQuery?.sql).toContain("status IN ('active', 'ordering')");
      expect(closeSessQuery?.sql).toContain("COALESCE(tenant_id, 'default') = ?");

      expect(tableSessions.find((s) => s.id === 'sess-active')?.status).toBe('closed');
      expect(tableSessions.find((s) => s.id === 'sess-ordering')?.status).toBe('closed');
      expect(tableSessions.find((s) => s.id === 'sess-paying')?.status).toBe('paying');
      expect(tableSessions.find((s) => s.id === 'sess-paid')?.status).toBe('paid');
      expect(tableSessions.find((s) => s.id === 'sess-other-tenant')?.status).toBe('active');
    });

    it('masks customer_phone, customer_email, and delivery_address on getOrdersMobile and getOrderDetail for kitchen, barista, and chef roles while preserving for waiter/manager', async () => {
      const sampleOrder = {
        id: 'ord-pii-1',
        table_id: 'tbl-1',
        customer_name: 'Tran Thi C',
        customer_phone: '0912345678',
        customer_email: 'tranthic@example.com',
        delivery_address: '123 Nguyen Hue, Q1',
        items: JSON.stringify([{ name: 'Matcha Latte', qty: 1, price: 55000 }]),
        total: 55000,
        status: 'preparing',
        tenant_id: 'store-a',
      };

      for (const maskedRole of ['kitchen', 'barista', 'chef']) {
        const { db } = createStatefulSqlMock({ orders: [sampleOrder] });
        const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };
        const app = new Hono<{ Bindings: Env }>();
        app.use('*', async (c, next) => {
          c.set('user' as never, { id: `u-${maskedRole}`, role: maskedRole, tenantId: 'store-a' } as never);
          c.set('tenantId' as never, 'store-a' as never);
          await next();
        });
        app.get('/mobile/orders', getOrdersMobile);
        app.get('/mobile/orders/:id', getOrderDetail);

        const listRes = await app.fetch(new Request('https://test.aura/mobile/orders'), env);
        expect(listRes.status).toBe(200);
        const listBody = (await listRes.json()) as { orders: Array<Record<string, unknown>> };
        expect(listBody.orders[0].customer_phone).toBeNull();
        expect(listBody.orders[0].customer_email).toBeNull();
        expect(listBody.orders[0].delivery_address).toBeNull();

        const detailRes = await app.fetch(new Request('https://test.aura/mobile/orders/ord-pii-1'), env);
        expect(detailRes.status).toBe(200);
        const detailBody = (await detailRes.json()) as { order: Record<string, unknown> };
        expect(detailBody.order.customer_phone).toBeNull();
        expect(detailBody.order.customer_email).toBeNull();
        expect(detailBody.order.delivery_address).toBeNull();
      }

      for (const fullRole of ['shipper', 'manager']) {
        const { db } = createStatefulSqlMock({ orders: [sampleOrder] });
        const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };
        const app = new Hono<{ Bindings: Env }>();
        app.use('*', async (c, next) => {
          c.set('user' as never, { id: `u-${fullRole}`, role: fullRole, tenantId: 'store-a' } as never);
          c.set('tenantId' as never, 'store-a' as never);
          await next();
        });
        app.get('/mobile/orders', getOrdersMobile);
        app.get('/mobile/orders/:id', getOrderDetail);

        const detailRes = await app.fetch(new Request('https://test.aura/mobile/orders/ord-pii-1'), env);
        expect(detailRes.status).toBe(200);
        const detailBody = (await detailRes.json()) as { order: Record<string, unknown> };
        expect(detailBody.order.customer_phone).toBe('0912345678');
        expect(detailBody.order.customer_email).toBe('tranthic@example.com');
        expect(detailBody.order.delivery_address).toBe('123 Nguyen Hue, Q1');
      }
    });
  });

  describe('6. vitals.ts hardening', () => {
    it('scopes web_vitals inserts by tenant and returns 429 when per-IP/tenant rate limit is exceeded on POST /api/vitals', async () => {
      const app = new Hono<{ Bindings: Env }>();
      registerVitalsRoute(app);

      const { db, executedQueries } = createStatefulSqlMock();
      const env = { ...createMockEnv(), AURA_DB: db as unknown as D1Database };

      // 60 requests from the same IP + tenant succeed with 204
      for (let i = 0; i < 60; i++) {
        const res = await app.fetch(
          new Request('https://test.aura/api/vitals', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CF-Connecting-IP': '203.0.113.77',
              'X-Tenant-ID': 'store-vitals-1',
            },
            body: JSON.stringify({ name: 'LCP', value: 1200 + i, rating: 'good' }),
          }),
          env
        );
        expect(res.status).toBe(204);
      }

      // Verify tenant_id is persisted inside _metrics tags JSON
      const insertMetric = executedQueries.find((q) => q.sql.includes('INSERT INTO _metrics'));
      expect(insertMetric).toBeDefined();
      expect(String(insertMetric?.args[2] ?? '')).toContain('"tenant_id":"store-vitals-1"');

      // 61st request within the same minute from same IP + tenant returns 429
      const blockedRes = await app.fetch(
        new Request('https://test.aura/api/vitals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.77',
            'X-Tenant-ID': 'store-vitals-1',
          },
          body: JSON.stringify({ name: 'LCP', value: 1900, rating: 'good' }),
        }),
        env
      );
      expect(blockedRes.status).toBe(429);
    });
  });
});
