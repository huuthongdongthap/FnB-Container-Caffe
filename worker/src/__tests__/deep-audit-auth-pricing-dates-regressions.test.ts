// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { dynamicPricingRouter } from '../routes/dynamic-pricing';
import { birthdayRouter } from '../routes/birthday';
import { listInvoices } from '../tree/subscriptions/invoice-handlers';
import { getStatsHandler } from '../tree/subscriptions/sub-handlers';
import { updateMRRSnapshot } from '../tree/subscriptions/mrr-calculator';
import { registerQueryHandler } from '../routes/admin-audit-logs-handlers/query-handler';
import { registerExportHandler } from '../routes/admin-audit-logs-handlers/export-handler';
import { createMockEnv } from './test-utils';
import type { Env } from '../types/env';

function createSqliteD1Adapter(
  sqlite: DatabaseSync,
  onBind?: (sql: string, args: unknown[]) => void
): D1Database {
  const prepare = (sql: string) => {
    const runFirst = async (bound: unknown[]) => {
      onBind?.(sql, bound);
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
        const rows = stmt.all(...(bound as never[])) as Record<string, unknown>[];
        return rows[0] ?? null;
      }
      stmt.run(...(bound as never[]));
      return null;
    };
    const runAll = async (bound: unknown[]) => {
      onBind?.(sql, bound);
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
        return { results: stmt.all(...(bound as never[])) as Record<string, unknown>[], success: true };
      }
      stmt.run(...(bound as never[]));
      return { results: [], success: true };
    };
    const runExec = async (bound: unknown[]) => {
      onBind?.(sql, bound);
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...(bound as never[]));
      return { success: true, meta: { changes: Number(info.changes ?? 0) } };
    };
    return {
      bind: (...args: unknown[]) => ({
        first: () => runFirst(args),
        all: () => runAll(args),
        run: () => runExec(args),
      }),
      first: () => runFirst([]),
      all: () => runAll([]),
      run: () => runExec([]),
    };
  };
  return { prepare } as unknown as D1Database;
}

describe('Deep Audit Regressions (#9-#13): Auth, Dynamic Pricing, ICT Month Boundary, Audit Dates', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('#9 Dynamic Pricing D1 100-param limit & cost_price fallback', () => {
    it('chunks 100-item product lookup into batches of <= 90 so D1 100-param limit is never exceeded', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE dynamic_pricing_rules (
          id TEXT PRIMARY KEY,
          name TEXT,
          rule_type TEXT,
          discount_percent REAL,
          target_category TEXT,
          target_product_id TEXT,
          min_margin_percent REAL,
          days_of_week TEXT,
          start_time TEXT,
          end_time TEXT,
          is_active INTEGER,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          price REAL,
          cost_price REAL,
          category TEXT,
          category_id TEXT,
          name TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.exec(`
        INSERT INTO dynamic_pricing_rules (
          id, name, rule_type, discount_percent, target_category, min_margin_percent,
          days_of_week, start_time, end_time, is_active, tenant_id
        ) VALUES (
          'rule-hh', 'Happy Hour', 'happy_hour', 20, 'coffee', 10,
          '0,1,2,3,4,5,6', '00:00', '23:59', 1, 'default'
        );
      `);

      const insertProd = sqlite.prepare(
        'INSERT INTO products (id, price, cost_price, category, category_id, name, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const items = [];
      for (let i = 1; i <= 100; i++) {
        const id = `prod-${i}`;
        insertProd.run(id, 50000, 20000, 'coffee', 'coffee', `Coffee ${i}`, 'default');
        items.push({ product_id: id, price: 50000, category: 'coffee', quantity: 1 });
      }

      let maxBindCount = 0;
      const db = createSqliteD1Adapter(sqlite, (_sql, args) => {
        if (args.length > maxBindCount) {
          maxBindCount = args.length;
        }
        if (args.length > 100) {
          throw new Error(`D1_ERROR: too many SQL variables (${args.length} > 100)`);
        }
      });

      const app = new Hono<{ Bindings: Env }>();
      app.route('/pricing', dynamicPricingRouter);
      const env = createMockEnv({ AURA_DB: db });

      const res = await app.request(
        'http://localhost/pricing/calculate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, timestamp: '2026-05-01T08:00:00.000Z' }),
        },
        env
      );

      expect(res.status).toBe(200);
      expect(maxBindCount).toBeLessThanOrEqual(92); // 90 ids + 2 tenantId params
      const json = (await res.json()) as {
        success: boolean;
        data: { items: Array<{ product_id: string; final_price: number }> };
      };
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(100);
      expect(json.data.items[99]?.final_price).toBe(40000);
    });

    it('fetches cost_price in unscoped fallback query so margin floor is still enforced', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE dynamic_pricing_rules (
          id TEXT PRIMARY KEY,
          name TEXT,
          rule_type TEXT,
          discount_percent REAL,
          target_category TEXT,
          target_product_id TEXT,
          min_margin_percent REAL,
          days_of_week TEXT,
          start_time TEXT,
          end_time TEXT,
          is_active INTEGER,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          price REAL,
          cost_price REAL,
          category TEXT,
          category_id TEXT,
          name TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.exec(`
        INSERT INTO dynamic_pricing_rules (
          id, name, rule_type, discount_percent, target_category, min_margin_percent,
          days_of_week, start_time, end_time, is_active, tenant_id
        ) VALUES (
          'rule-50', 'Big Discount', 'happy_hour', 50, 'coffee', 30,
          '0,1,2,3,4,5,6', '00:00', '23:59', 1, 'default'
        );
        INSERT INTO products (id, price, cost_price, category, category_id, name, tenant_id)
        VALUES ('p-margin', 100000, 60000, 'coffee', 'coffee', 'Specialty Latte', 'default');
      `);

      // Simulate scoped products query failing so unscoped fallback query runs
      const db = createSqliteD1Adapter(sqlite, (sql) => {
        if (sql.includes('FROM products') && sql.includes('COALESCE(NULLIF(TRIM(tenant_id)')) {
          throw new Error('simulated scoped query error');
        }
      });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/pricing', dynamicPricingRouter);
      const env = createMockEnv({ AURA_DB: db });

      const res = await app.request(
        'http://localhost/pricing/calculate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ product_id: 'p-margin', price: 100000, category: 'coffee', quantity: 1 }],
            timestamp: '2026-05-01T08:00:00.000Z',
          }),
        },
        env
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { items: Array<{ product_id: string; final_price: number }> };
      };
      expect(json.success).toBe(true);
      // 50% off would be 50000, but 30% margin floor on cost 60000 keeps final_price = 78000 (60000 * 1.3)
      expect(json.data.items[0]?.final_price).toBe(78000);
    });
  });

  describe('#10 Birthday Config fail-closed auth when JWT_SECRET is missing', () => {
    it('fails closed on GET /config and PUT /config without JWT_SECRET or Authorization', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.route('/birthday', birthdayRouter);
      const env = createMockEnv({ JWT_SECRET: '' });

      const getRes = await app.request('http://localhost/birthday/config', { method: 'GET' }, env);
      expect([401, 500]).toContain(getRes.status);

      const putRes = await app.request(
        'http://localhost/birthday/config',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discountPercent: 15 }),
        },
        env
      );
      expect([401, 500]).toContain(putRes.status);
    });
  });

  describe('#11 Subscriptions listInvoices fail-closed auth when JWT_SECRET is missing', () => {
    it('returns 401 on listInvoices when JWT_SECRET is empty and no authUser is set', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.get('/invoices', (c) => listInvoices(c));
      const env = createMockEnv({ JWT_SECRET: '' });

      const res = await app.request('http://localhost/invoices', { method: 'GET' }, env);
      expect(res.status).toBe(401);
    });
  });

  describe('#12 Subscriptions & MRR ICT (+07:00) month boundary', () => {
    it('uses Asia/Saigon (+07:00) month start in calculateMRR and getSubscriptionAnalytics', async () => {
      // 2026-05-01 00:30:00 ICT == 2026-04-30 17:30:00 UTC
      // Start of May 2026 in ICT == 2026-04-30T17:00:00.000Z
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-30T17:30:00.000Z'));

      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE subscription_plans (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE subscriptions (
          id TEXT PRIMARY KEY,
          plan_id TEXT,
          status TEXT,
          amount_vnd REAL,
          billing_cycle TEXT DEFAULT 'monthly',
          zone TEXT DEFAULT 'A',
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE mrr_snapshots (
          id TEXT PRIMARY KEY,
          snapshot_date TEXT UNIQUE,
          mrr_vnd REAL,
          arr_vnd REAL,
          active_subscriptions INTEGER,
          new_subscriptions_month INTEGER,
          churned_subscriptions_month INTEGER,
          churn_rate_pct REAL,
          avg_contract_value_vnd REAL,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        INSERT INTO subscription_plans (id, name, slug, tenant_id)
        VALUES ('plan-1', 'Pro', 'pro', 'default');
        -- Created at 2026-04-30 23:30 ICT (2026-04-30T16:30:00.000Z) -> April in ICT, NOT May
        INSERT INTO subscriptions (id, plan_id, status, amount_vnd, billing_cycle, created_at, updated_at, tenant_id)
        VALUES ('sub-april', 'plan-1', 'active', 1000000, 'monthly', '2026-04-30T16:30:00.000Z', '2026-04-30T16:30:00.000Z', 'default');
        -- Created at 2026-05-01 00:15 ICT (2026-04-30T17:15:00.000Z) -> May in ICT
        INSERT INTO subscriptions (id, plan_id, status, amount_vnd, billing_cycle, created_at, updated_at, tenant_id)
        VALUES ('sub-may', 'plan-1', 'active', 2000000, 'monthly', '2026-04-30T17:15:00.000Z', '2026-04-30T17:15:00.000Z', 'default');
      `);

      const db = createSqliteD1Adapter(sqlite);
      await updateMRRSnapshot(db, 'default');
      const snap = sqlite
        .prepare('SELECT new_subscriptions_month FROM mrr_snapshots WHERE tenant_id = ?')
        .get('default') as { new_subscriptions_month: number } | undefined;
      expect(snap?.new_subscriptions_month).toBe(1);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'u-admin', role: 'admin', tenantId: 'default' } as never);
        await next();
      });
      app.get('/analytics', (c) => getStatsHandler(c));
      const env = createMockEnv({ AURA_DB: db });

      const res = await app.request('http://localhost/analytics', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: { new_this_month: number } };
      expect(body.success).toBe(true);
      expect(body.data.new_this_month).toBe(1);
    });
  });

  describe('#13 Audit logs date normalization consistency between query and export', () => {
    it('returns identical matching records for YYYY-MM-DD date_from/date_to across query and export', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id TEXT,
          actor_name TEXT,
          action TEXT,
          resource_type TEXT,
          resource_id TEXT,
          details TEXT,
          ip_address TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, ip_address, tenant_id, created_at)
        VALUES
          ('u1', 'Alice', 'orders.post', 'order', 'o1', '{}', '127.0.0.1', 'default', '2026-05-01 00:00:00'),
          ('u1', 'Alice', 'orders.post', 'order', 'o2', '{}', '127.0.0.1', 'default', '2026-05-01T23:59:59.999Z'),
          ('u1', 'Alice', 'orders.post', 'order', 'o3', '{}', '127.0.0.1', 'default', '2026-05-02 00:00:00');
      `);

      const db = createSqliteD1Adapter(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'u1', role: 'owner', tenantId: 'default' } as never);
        await next();
      });
      registerQueryHandler(app);
      registerExportHandler(app);

      const env = createMockEnv({ AURA_DB: db });
      const queryRes = await app.request(
        'http://localhost/?date_from=2026-05-01&date_to=2026-05-01',
        { method: 'GET' },
        env
      );
      expect(queryRes.status).toBe(200);
      const queryJson = (await queryRes.json()) as { rows: Array<{ resource_id: string }> };
      expect(queryJson.rows.map((r) => r.resource_id)).toEqual(['o2', 'o1']);

      const exportRes = await app.request(
        'http://localhost/export?date_from=2026-05-01&date_to=2026-05-01',
        { method: 'GET' },
        env
      );
      expect(exportRes.status).toBe(200);
      const csv = await exportRes.text();
      expect(csv).toContain('o1');
      expect(csv).toContain('o2');
      expect(csv).not.toContain('o3');
    });
  });
});
