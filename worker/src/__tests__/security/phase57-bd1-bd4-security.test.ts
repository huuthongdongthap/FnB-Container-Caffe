// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
// @ts-expect-error node:sqlite is built into Node 22+ runtime
import { DatabaseSync } from 'node:sqlite';
import type { Env } from '../../types/env';
import {
  listSubscriptions,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  deleteSubscription,
  deletePlan,
} from '../../tree/subscriptions/sub-handlers';
import { listInvoices, payInvoice, generateInvoices } from '../../tree/subscriptions/invoice-handlers';
import { requireAdmin, requireVendor } from '../../tree/subscriptions/middleware';
import { getInvoiceReceipt } from '../../routes/subscription-receipt';
import { birthdayRouter } from '../../routes/birthday';
import { posCustomerRouter } from '../../routes/pos-customer';
import { demandForecastRouter } from '../../routes/demand-forecast';
import { dynamicPricingRouter } from '../../routes/dynamic-pricing';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';

const JWT_SECRET = 'test-secret-phase57-bd1-bd4-32chars!';

function createSqliteD1(sqlite: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              const stmt = sqlite.prepare(sql);
              const row = stmt.get(...params) as T | undefined;
              return row ? ({ ...row } as T) : null;
            },
            async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
              const stmt = sqlite.prepare(sql);
              const rows = (stmt.all(...params) as T[]).map((r) => ({ ...r }));
              return { results: rows };
            },
            async run() {
              const stmt = sqlite.prepare(sql);
              const info = stmt.run(...params);
              return { success: true, meta: { changes: Number(info.changes ?? 0) } };
            },
          };
        },
        async first<T = Record<string, unknown>>(): Promise<T | null> {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get() as T | undefined;
          return row ? ({ ...row } as T) : null;
        },
        async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
          const stmt = sqlite.prepare(sql);
          const rows = (stmt.all() as T[]).map((r) => ({ ...r }));
          return { results: rows };
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run();
          return { success: true, meta: { changes: Number(info.changes ?? 0) } };
        },
      };
    },
  };
}

describe('Phase 57 Security (BD1–BD4)', () => {
  describe('BD1: Subscription & Invoice D1 Mutation Fail-Closed Enforcement', () => {
    it('fails closed (500) on createSubscription for non-default tenant when tenant-scoped INSERT fails', async () => {
      const executedSqls: string[] = [];
      const db = {
        prepare(sql: string) {
          return {
            bind(..._args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM subscription_plans')) {
                    return {
                      id: 'plan-1',
                      name: 'Starter Container',
                      price_vnd: 5000000,
                      container_type: 'standard_20ft',
                      tenant_id: 'store-a',
                    };
                  }
                  return null;
                },
                async run() {
                  executedSqls.push(sql);
                  if (sql.includes('INSERT INTO subscriptions') && sql.includes('tenant_id')) {
                    throw new Error('D1 constraint error on tenant_id');
                  }
                  return { success: true, meta: { changes: 1 } };
                },
              };
            },
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
          id: 'mgr-a',
          role: 'manager',
          tenant_id: 'store-a',
        });
        await next();
      });
      app.post('/subscriptions', createSubscription);

      const res = await app.request(
        '/subscriptions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Cafe Partner A',
            customer_email: 'partner@store-a.vn',
            plan_id: 'plan-1',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );

      expect(res.status).toBe(500);
      const unscopedInsert = executedSqls.find(
        (s) => s.includes('INSERT INTO subscriptions') && !s.includes('tenant_id')
      );
      expect(unscopedInsert).toBeUndefined();
    });

    it('fails closed (500) on lifecycle mutations (update, cancel, pause, resume, delete, deletePlan) for non-default tenant when tenant-scoped SQL fails', async () => {
      const unscopedMutations: string[] = [];
      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM subscriptions')) {
                    const idArg = String(args[0] || '');
                    return {
                      id: idArg || 'sub-a',
                      customer_id: 'cust-a',
                      customer_email: 'cust@store-a.vn',
                      status:
                        idArg === 'sub-paused'
                          ? 'paused'
                          : idArg === 'sub-cancelled'
                            ? 'cancelled'
                            : 'active',
                      current_period_end: '2026-12-01',
                      tenant_id: 'store-a',
                    };
                  }
                  if (sql.includes('FROM subscription_plans')) {
                    return {
                      id: 'plan-a',
                      name: 'Plan A',
                      tenant_id: 'store-a',
                    };
                  }
                  if (sql.includes('COUNT(*) as cnt')) {
                    return { cnt: 0 };
                  }
                  return null;
                },
                async run() {
                  if (
                    (sql.includes('UPDATE subscriptions') ||
                      sql.includes('DELETE FROM subscriptions') ||
                      sql.includes('DELETE FROM subscription_plans') ||
                      sql.includes('DELETE FROM subscription_invoices')) &&
                    sql.includes('tenant_id')
                  ) {
                    throw new Error('Simulated D1 error on tenant-scoped mutation');
                  }
                  if (
                    sql.includes('UPDATE subscriptions') ||
                    sql.includes('DELETE FROM subscriptions') ||
                    sql.includes('DELETE FROM subscription_plans')
                  ) {
                    unscopedMutations.push(sql);
                  }
                  return { success: true, meta: { changes: 1 } };
                },
              };
            },
          };
        },
      };

      const adminToken = await generateJWT(
        { sub: 'mgr-a', role: 'manager', tenant_id: 'store-a' },
        JWT_SECRET
      );
      const authHeaders = {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
          id: 'mgr-a',
          role: 'manager',
          tenant_id: 'store-a',
        });
        await next();
      });
      app.put('/subscriptions/:id', updateSubscription);
      app.post('/subscriptions/:id/cancel', cancelSubscription);
      app.post('/subscriptions/:id/pause', pauseSubscription);
      app.post('/subscriptions/:id/resume', resumeSubscription);
      app.delete('/subscriptions/:id', deleteSubscription);
      app.delete('/plans/:id', deletePlan);

      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      const r1 = await app.request(
        '/subscriptions/sub-a',
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ notes: 'Updated notes' }),
        },
        env
      );
      expect(r1.status).toBe(500);

      const r2 = await app.request(
        '/subscriptions/sub-a/cancel',
        { method: 'POST', headers: authHeaders },
        env
      );
      expect(r2.status).toBe(500);

      const r3 = await app.request(
        '/subscriptions/sub-a/pause',
        { method: 'POST', headers: authHeaders },
        env
      );
      expect(r3.status).toBe(500);

      const r4 = await app.request(
        '/subscriptions/sub-paused/resume',
        { method: 'POST', headers: authHeaders },
        env
      );
      expect(r4.status).toBe(500);

      const r5 = await app.request(
        '/subscriptions/sub-cancelled',
        { method: 'DELETE', headers: authHeaders },
        env
      );
      expect(r5.status).toBe(500);

      const r6 = await app.request(
        '/plans/plan-a',
        { method: 'DELETE', headers: authHeaders },
        env
      );
      expect(r6.status).toBe(500);

      expect(unscopedMutations).toHaveLength(0);
    });

    it('fails closed on payInvoice and generateInvoices for non-default tenant when tenant-scoped SQL fails', async () => {
      const unscopedInvoiceWrites: string[] = [];
      const db = {
        prepare(sql: string) {
          return {
            bind(..._args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('SELECT * FROM subscription_invoices WHERE id = ?')) {
                    return {
                      id: 'inv-a',
                      subscription_id: 'sub-a',
                      amount_vnd: 5000000,
                      status: 'pending',
                      tenant_id: 'store-a',
                    };
                  }
                  if (sql.includes('SELECT * FROM subscriptions WHERE id = ?')) {
                    return {
                      id: 'sub-a',
                      plan_id: 'plan-a',
                      status: 'active',
                      tenant_id: 'store-a',
                    };
                  }
                  if (sql.includes('SELECT id FROM subscription_invoices WHERE subscription_id')) {
                    return null;
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("FROM subscriptions WHERE status = 'active'")) {
                    return {
                      results: [
                        {
                          id: 'sub-a',
                          plan_id: 'plan-a',
                          amount_vnd: 5000000,
                          current_period_end: '2026-10-01',
                          tenant_id: 'store-a',
                        },
                      ],
                    };
                  }
                  return { results: [] };
                },
                async run() {
                  if (sql.includes('subscription_invoices') && sql.includes('tenant_id')) {
                    throw new Error('Simulated tenant_id failure on subscription_invoices');
                  }
                  if (sql.includes('subscription_invoices')) {
                    unscopedInvoiceWrites.push(sql);
                  }
                  return { success: true, meta: { changes: 1 } };
                },
              };
            },
          };
        },
      };

      const adminToken = await generateJWT(
        { sub: 'mgr-a', role: 'manager', tenant_id: 'store-a' },
        JWT_SECRET
      );
      const authHeaders = {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
          id: 'mgr-a',
          role: 'manager',
          tenant_id: 'store-a',
        });
        await next();
      });
      app.post('/invoices/:id/pay', payInvoice);
      app.post('/invoices/generate', generateInvoices);

      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      const payRes = await app.request(
        '/invoices/inv-a/pay',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ payment_method: 'bank_transfer' }),
        },
        env
      );
      expect(payRes.status).toBe(500);

      const genRes = await app.request(
        '/invoices/generate',
        { method: 'POST', headers: authHeaders },
        env
      );
      expect(genRes.status).toBe(200);
      const genBody = (await genRes.json()) as { generated_count?: number };
      expect(genBody.generated_count).toBe(0);
      expect(unscopedInvoiceWrites).toHaveLength(0);
    });
  });

  describe('BD2: Subscription Middleware, List & Receipt Cross-Tenant Override Rejection', () => {
    it('rejects cross-tenant header/query overrides in requireAdmin and requireVendor with 403', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.get('/admin-check', async (c) => {
        const denied = await requireAdmin(c);
        if (denied) return denied;
        return c.json({ ok: true });
      });
      app.get('/vendor-check', async (c) => {
        const denied = await requireVendor(c);
        if (denied) return denied;
        return c.json({ ok: true });
      });

      const storeAdminToken = await generateJWT(
        { sub: 'admin-store-a', role: 'admin', tenant_id: 'store-a' },
        JWT_SECRET
      );
      const vendorToken = await generateJWT(
        { sub: 'vendor-a', role: 'vendor', tenant_id: 'store-a' },
        JWT_SECRET
      );
      const env = { JWT_SECRET } as unknown as Env;

      const r1 = await app.request(
        '/admin-check?tenant_id=store-b',
        { headers: { Authorization: `Bearer ${storeAdminToken}` } },
        env
      );
      expect(r1.status).toBe(403);

      const r2 = await app.request(
        '/admin-check',
        { headers: { Authorization: `Bearer ${storeAdminToken}`, 'X-Tenant-ID': '*' } },
        env
      );
      expect(r2.status).toBe(403);

      const r3 = await app.request(
        '/vendor-check?tenant_id=default',
        { headers: { Authorization: `Bearer ${vendorToken}` } },
        env
      );
      expect(r3.status).toBe(403);

      const r4 = await app.request(
        '/vendor-check?tenant_id=store-a',
        { headers: { Authorization: `Bearer ${vendorToken}` } },
        env
      );
      expect(r4.status).toBe(200);
    });

    it('rejects cross-tenant overrides on listSubscriptions, listInvoices, and getInvoiceReceipt with 403', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT);
        CREATE TABLE subscriptions (id TEXT PRIMARY KEY, plan_id TEXT, customer_id TEXT, customer_name TEXT, customer_email TEXT, status TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE subscription_invoices (id TEXT PRIMARY KEY, subscription_id TEXT, invoice_number TEXT, amount_vnd INTEGER, status TEXT, tenant_id TEXT, created_at TEXT);
      `);
      const db = createSqliteD1(sqlite);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
          id: 'mgr-a',
          role: 'manager',
          tenant_id: 'store-a',
        });
        await next();
      });
      app.get('/subscriptions', listSubscriptions);
      app.get('/invoices', listInvoices);
      app.get('/invoices/:id/receipt', getInvoiceReceipt);

      const env = { AURA_DB: db } as unknown as Env;

      const subRes = await app.request('/subscriptions?tenant_id=store-b', {}, env);
      expect(subRes.status).toBe(403);

      const invRes = await app.request(
        '/invoices',
        { headers: { 'X-Tenant-ID': 'store-b' } },
        env
      );
      expect(invRes.status).toBe(403);

      const recRes = await app.request('/invoices/inv-1/receipt?tenant_id=default', {}, env);
      expect(recRes.status).toBe(403);
    });
  });

  describe('BD3: Birthday Cross-Tenant Override, Refunded/Rejected Order Exclusion & Fail-Closed Redemption', () => {
    it('rejects cross-tenant overrides on birthday routes and blocks redeeming against rejected or refunded orders', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const todayMmDd = new Date().toISOString().slice(5, 10);
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        CREATE TABLE settings (key TEXT, value TEXT, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, date_of_birth TEXT, loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE birthday_redemptions (id TEXT PRIMARY KEY, customer_id TEXT, year INTEGER, order_id TEXT, discount_applied INTEGER, gift_item TEXT, bonus_points INTEGER, redeemed_at TEXT, tenant_id TEXT);
        CREATE TABLE orders (id TEXT PRIMARY KEY, customer_id TEXT, customer_phone TEXT, status TEXT, payment_status TEXT, tenant_id TEXT);
      `);
      sqlite
        .prepare(
          'INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('mgr-a', 'Manager A', '0900000001', 'manager', 'store-a', 1, 1);
      sqlite
        .prepare(
          'INSERT INTO customers (id, name, phone, date_of_birth, loyalty_points, lifetime_points, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('cust-a', 'Nguyen Van A', '0901234567', `1995-${todayMmDd}`, 100, 100, 'store-a');
      sqlite
        .prepare(
          'INSERT INTO orders (id, customer_id, customer_phone, status, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('ord-rejected', 'cust-a', '0901234567', 'rejected', 'pending', 'store-a');
      sqlite
        .prepare(
          'INSERT INTO orders (id, customer_id, customer_phone, status, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('ord-refunded-pay', 'cust-a', '0901234567', 'completed', 'refunded', 'store-a');

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/loyalty/birthday', birthdayRouter);

      const mgrSession = await issueStaffSession(
        { JWT_SECRET },
        { id: 'mgr-a', name: 'Manager A', phone: '0900000001', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { email: 'mgr-a@aura.vn', sessionType: 'staff-web' }
      );
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      // Cross-tenant override rejected with 403
      const cfgCross = await app.request(
        '/api/loyalty/birthday/config?tenant_id=store-b',
        { headers: { Authorization: `Bearer ${mgrSession.token}` } },
        env
      );
      expect(cfgCross.status).toBe(403);

      const checkCross = await app.request(
        '/api/loyalty/birthday/check?customer_id=cust-a&tenant_id=default',
        { headers: { Authorization: `Bearer ${mgrSession.token}` } },
        env
      );
      expect(checkCross.status).toBe(403);

      // Redeeming with a rejected order -> 400
      const redeemRejected = await app.request(
        '/api/loyalty/birthday/redeem',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrSession.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customer_id: 'cust-a', order_id: 'ord-rejected' }),
        },
        env
      );
      expect(redeemRejected.status).toBe(400);

      // Redeeming with a payment_status = 'refunded' order -> 400
      const redeemRefunded = await app.request(
        '/api/loyalty/birthday/redeem',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrSession.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customer_id: 'cust-a', order_id: 'ord-refunded-pay' }),
        },
        env
      );
      expect(redeemRefunded.status).toBe(400);
    });

    it('fails closed (500) on birthday redeem for non-default tenant when tenant-scoped INSERT fails', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const todayMmDd = new Date().toISOString().slice(5, 10);
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        CREATE TABLE settings (key TEXT, value TEXT, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, date_of_birth TEXT, loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE birthday_redemptions (id TEXT PRIMARY KEY, customer_id TEXT, year INTEGER, order_id TEXT, discount_applied INTEGER, gift_item TEXT, bonus_points INTEGER, redeemed_at TEXT);
      `);
      sqlite
        .prepare(
          'INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('mgr-a', 'Manager A', '0900000001', 'manager', 'store-a', 1, 1);
      sqlite
        .prepare(
          'INSERT INTO customers (id, name, phone, date_of_birth, loyalty_points, lifetime_points, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('cust-a', 'Nguyen Van A', '0901234567', `1995-${todayMmDd}`, 100, 100, 'store-a');

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/loyalty/birthday', birthdayRouter);

      const mgrSession = await issueStaffSession(
        { JWT_SECRET },
        { id: 'mgr-a', name: 'Manager A', phone: '0900000001', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { email: 'mgr-a@aura.vn', sessionType: 'staff-web' }
      );
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      const res = await app.request(
        '/api/loyalty/birthday/redeem',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrSession.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customer_id: 'cust-a' }),
        },
        env
      );
      expect(res.status).toBe(500);
      const count = sqlite.prepare('SELECT COUNT(*) as cnt FROM birthday_redemptions').get() as {
        cnt: number;
      };
      expect(count.cnt).toBe(0);
    });
  });

  describe('BD4: POS Customer Lookup & Analytics/Pricing Cross-Tenant Override Guards', () => {
    it('rejects cross-tenant overrides on POS customer lookup and excludes rejected/refunded orders from visit_count', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        CREATE TABLE customers (
          id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT,
          loyalty_tier TEXT, loyalty_points INTEGER, lifetime_points INTEGER,
          created_at TEXT, tenant_id TEXT
        );
        CREATE TABLE cashback_wallets (
          customer_id TEXT, balance INTEGER, total_earned INTEGER, total_spent INTEGER, tenant_id TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY, order_number TEXT, customer_id TEXT, customer_phone TEXT,
          total INTEGER, status TEXT, payment_status TEXT, payment_method TEXT, created_at TEXT, tenant_id TEXT
        );
      `);
      sqlite
        .prepare(
          'INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('cashier-a', 'Cashier A', '0900000002', 'cashier', 'store-a', 1, 1);
      sqlite
        .prepare(
          'INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('cust-a', 'Le Thi B', '0912345678', 'b@store-a.vn', 'gold', 250, 500, '2026-01-01', 'store-a');
      sqlite
        .prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('o-valid', 'ORD-1', 'cust-a', '0912345678', 55000, 'completed', 'paid', 'cash', '2026-10-01', 'store-a');
      sqlite
        .prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('o-rejected', 'ORD-2', 'cust-a', '0912345678', 65000, 'rejected', 'pending', 'cash', '2026-10-02', 'store-a');
      sqlite
        .prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('o-refunded-status', 'ORD-3', 'cust-a', '0912345678', 75000, 'refunded', 'paid', 'cash', '2026-10-03', 'store-a');
      sqlite
        .prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('o-refunded-pay', 'ORD-4', 'cust-a', '0912345678', 85000, 'completed', 'refunded', 'cash', '2026-10-04', 'store-a');

      const db = createSqliteD1(sqlite);
      const cashierSession = await issueStaffSession(
        { JWT_SECRET },
        { id: 'cashier-a', name: 'Cashier A', phone: '0900000002', role: 'cashier', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { email: 'cashier-a@aura.vn', sessionType: 'staff-web' }
      );
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/pos/customer', posCustomerRouter);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      const crossRes = await app.request(
        '/api/pos/customer?phone=0912345678&tenant_id=store-b',
        { headers: { Authorization: `Bearer ${cashierSession.token}` } },
        env
      );
      expect(crossRes.status).toBe(403);

      const wildcardRes = await app.request(
        '/api/pos/customer?phone=0912345678',
        { headers: { Authorization: `Bearer ${cashierSession.token}`, 'X-Tenant-ID': '*' } },
        env
      );
      expect(wildcardRes.status).toBe(403);

      const validRes = await app.request(
        '/api/pos/customer?phone=0912345678',
        { headers: { Authorization: `Bearer ${cashierSession.token}` } },
        env
      );
      expect(validRes.status).toBe(200);
      const body = (await validRes.json()) as {
        found: boolean;
        customer: { visit_count: number };
      };
      expect(body.found).toBe(true);
      expect(body.customer.visit_count).toBe(1);
    });

    it('rejects ?tenant_id=default and wildcard overrides for non-default store staff on demandForecastRouter and dynamicPricingRouter', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        CREATE TABLE orders (
          id TEXT PRIMARY KEY, total INTEGER, status TEXT, payment_status TEXT, tenant_id TEXT, created_at TEXT
        );
        CREATE TABLE settings (key TEXT, value TEXT, tenant_id TEXT, updated_at TEXT);
      `);
      sqlite
        .prepare(
          'INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('mgr-a', 'Manager A', '0900000001', 'manager', 'store-a', 1, 1);
      const db = createSqliteD1(sqlite);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/admin/metrics', demandForecastRouter);
      app.route('/api/admin/pricing', dynamicPricingRouter);

      const mgrSession = await issueStaffSession(
        { JWT_SECRET },
        { id: 'mgr-a', name: 'Manager A', phone: '0900000001', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { email: 'mgr-a@aura.vn', sessionType: 'staff-web' }
      );
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      const forecastDefaultOverride = await app.request(
        '/api/admin/metrics/forecast?tenant_id=default',
        { headers: { Authorization: `Bearer ${mgrSession.token}` } },
        env
      );
      expect(forecastDefaultOverride.status).toBe(403);

      const pricingDefaultOverride = await app.request(
        '/api/admin/pricing/rules?tenant_id=default',
        { headers: { Authorization: `Bearer ${mgrSession.token}` } },
        env
      );
      expect(pricingDefaultOverride.status).toBe(403);
    });
  });
});
