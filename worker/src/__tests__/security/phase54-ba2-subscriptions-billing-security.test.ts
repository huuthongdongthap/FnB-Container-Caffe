// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { listPlans, getPlan } from '../../tree/subscriptions/plan-handlers';
import { pauseSubscription, deletePlan, getStatsHandler } from '../../tree/subscriptions/sub-handlers';
import { getInvoiceReceipt } from '../../routes/subscription-receipt';
import { generateJWT } from '../../lib/jwt';

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

function createSubSchema(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT,
      monthly_price_vnd REAL DEFAULT 0,
      price_vnd REAL DEFAULT 0,
      deposit_vnd REAL DEFAULT 0,
      features TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE subscriptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      plan_id TEXT,
      container_number TEXT,
      zone TEXT DEFAULT 'Zone A',
      status TEXT DEFAULT 'active',
      amount_vnd REAL DEFAULT 0,
      billing_cycle TEXT DEFAULT 'monthly',
      deposit_paid INTEGER DEFAULT 0,
      deposit_vnd REAL DEFAULT 0,
      current_period_start TEXT,
      current_period_end TEXT,
      next_billing_date TEXT,
      paused_at TEXT,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE subscription_invoices (
      id TEXT PRIMARY KEY,
      subscription_id TEXT,
      amount_vnd REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      period_start TEXT,
      period_end TEXT,
      invoice_number TEXT,
      paid_at TEXT,
      payment_method TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE mrr_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_date TEXT,
      total_mrr REAL DEFAULT 0,
      active_subscriptions INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return sqlite;
}

const TEST_ENV = {
  JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
  ENVIRONMENT: 'test',
} as unknown as Env;

describe('Phase 54 Slice BA2: Subscriptions, Billing Cycles, Invoices & MRR Security', () => {
  describe('BA2-1 & BA2-6: Billing Cycle Normalization & Plan Catalog Isolation', () => {
    it('does not leak default tenant plans to store-b when store-b has no plans', async () => {
      const sqlite = createSubSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO subscription_plans (id, name, slug, monthly_price_vnd, is_active, tenant_id) VALUES ('plan-def', 'Default Plan', 'def', 500000, 1, 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.get('/api/saas/plans', listPlans);

      const res = await app.request(
        'http://localhost/api/saas/plans?tenant_id=store-b',
        { method: 'GET' },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(200);
      const json = await res.json() as { success: boolean; data: Array<{ id: string }> };
      expect(json.data).toHaveLength(0);
    });

    it('rejects cross-tenant getPlan when plan belongs to another tenant', async () => {
      const sqlite = createSubSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO subscription_plans (id, name, slug, monthly_price_vnd, is_active, tenant_id) VALUES ('plan-a', 'Plan A', 'a', 500000, 1, 'store-a')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.get('/api/saas/plans/:id', getPlan);

      const res = await app.request(
        'http://localhost/api/saas/plans/plan-a?tenant_id=store-b',
        { method: 'GET' },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(404);
    });
  });

  describe('BA2-2: Subscription State Guards', () => {
    it('blocks pausing a non-active subscription with 409', async () => {
      const sqlite = createSubSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO subscriptions (id, status, tenant_id) VALUES ('sub-cancelled', 'cancelled', 'default')").run();

      const adminToken = await generateJWT(
        { id: 'admin-1', role: 'admin', tenantId: 'default' },
        'test-secret-at-least-32-chars-long-12345'
      );

      const app = new Hono<{ Bindings: Env }>();
      app.post('/api/saas/subscriptions/:id/pause', pauseSubscription);

      const res = await app.request(
        'http://localhost/api/saas/subscriptions/sub-cancelled/pause',
        { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(409);
    });

    it('blocks deleting a plan that has active subscriptions with 409', async () => {
      const sqlite = createSubSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO subscription_plans (id, name, tenant_id) VALUES ('plan-active', 'Active Plan', 'default')").run();
      sqlite.prepare("INSERT INTO subscriptions (id, plan_id, status, tenant_id) VALUES ('sub-1', 'plan-active', 'active', 'default')").run();

      const adminToken = await generateJWT(
        { id: 'admin-1', role: 'admin', tenantId: 'default' },
        'test-secret-at-least-32-chars-long-12345'
      );

      const app = new Hono<{ Bindings: Env }>();
      app.delete('/api/saas/plans/:id', deletePlan);

      const res = await app.request(
        'http://localhost/api/saas/plans/plan-active',
        { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(409);
    });
  });

  describe('BA2-5: Subscription Receipt Authentication & Access Control', () => {
    it('blocks unauthenticated callers from downloading receipts with 401', async () => {
      const sqlite = createSubSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, tenant_id) VALUES ('inv-1', 'sub-1', 500000, 'paid', 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.get('/api/saas/invoices/:id/receipt', getInvoiceReceipt);

      const res = await app.request(
        'http://localhost/api/saas/invoices/inv-1/receipt',
        { method: 'GET' },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(401);
    });

    it('blocks customer from viewing another customer invoice receipt with 403', async () => {
      const sqlite = createSubSchema();
      const db = createSqliteD1(sqlite);
      sqlite.prepare("INSERT INTO subscription_plans (id, name, tenant_id) VALUES ('p1', 'Plan', 'default')").run();
      sqlite.prepare("INSERT INTO subscriptions (id, customer_id, plan_id, tenant_id) VALUES ('sub-1', 'cust-victim', 'p1', 'default')").run();
      sqlite.prepare("INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, tenant_id) VALUES ('inv-1', 'sub-1', 500000, 'paid', 'default')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'cust-attacker', role: 'customer', tenantId: 'default' } as never);
        await next();
      });
      app.get('/api/saas/invoices/:id/receipt', getInvoiceReceipt);

      const res = await app.request(
        'http://localhost/api/saas/invoices/inv-1/receipt',
        { method: 'GET' },
        { ...TEST_ENV, AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(403);
    });
  });
});
