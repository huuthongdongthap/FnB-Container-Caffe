// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { checkOverdueOrders, expireUnpaidOnlineOrders } from '../routes/cron-handlers/order-checks';
import { settlePayOS } from '../routes/webhooks-handlers/payos-settlement';
import { handleGetRefundReadiness, handleReconcileRefundReadiness } from '../routes/refunds-handlers/readiness-handlers';
import { retryPendingRefundLoyaltyWork } from '../routes/refunds-handlers/loyalty-work';
import type { Context } from 'hono';
import type { Env } from '../types/env';

function createSqliteD1(db: DatabaseSync) {
  const prepare = (sql: string) => {
    const stmt = db.prepare(sql);
    let params: unknown[] = [];
    const bound = {
      bind(...args: unknown[]) {
        params = args;
        return bound;
      },
      async first<T = Record<string, unknown>>() {
        const row = stmt.get(...(params as never[])) as T | undefined;
        return row ?? null;
      },
      async all<T = Record<string, unknown>>() {
        const results = stmt.all(...(params as never[])) as T[];
        return { results, success: true };
      },
      async run() {
        const res = stmt.run(...(params as never[]));
        return { success: true, meta: { changes: Number(res.changes ?? 0) } };
      },
    };
    return bound;
  };
  return {
    prepare,
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const s of stmts) {
        results.push(await s.run());
      }
      return results;
    },
  };
}

describe('Cluster 6 Worker Regressions (#183)', () => {
  let rawDb: DatabaseSync;
  let env: Env;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        customer_name TEXT,
        status TEXT NOT NULL,
        payment_method TEXT,
        payment_status TEXT,
        order_type TEXT,
        total INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        provider TEXT,
        provider_tx_id TEXT,
        amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        metadata TEXT,
        paid_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE alerts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        type TEXT,
        severity TEXT,
        title TEXT,
        message TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
      );
    `);
    const d1 = createSqliteD1(rawDb);
    env = { DB: d1, AURA_DB: d1 } as unknown as Env;
  });

  it('checkOverdueOrders ignores held unpaid online orders and does not mutate orders.notes', async () => {
    rawDb.exec(`
      INSERT INTO orders (id, tenant_id, customer_name, status, payment_method, payment_status, order_type, total, notes, created_at, updated_at)
      VALUES
        ('ord-held-online', 'default', 'Khách A', 'pending', 'payos', 'unpaid', 'delivery', 50000, 'Ghi chú khách', datetime('now', '-60 minutes'), datetime('now', '-60 minutes')),
        ('ord-overdue-cod', 'default', 'Khách B', 'preparing', 'cod', 'unpaid', 'dine_in', 45000, 'Ít đá', datetime('now', '-60 minutes'), datetime('now', '-60 minutes'));
    `);

    await checkOverdueOrders(env, 'default');

    const codRow = rawDb.prepare(`SELECT notes FROM orders WHERE id = 'ord-overdue-cod'`).get() as { notes: string };
    expect(codRow.notes).toBe('Ít đá');
    expect(codRow.notes).not.toContain('[OVERDUE]');
  });

  it('expireUnpaidOnlineOrders expires stale unpaid online pending orders', async () => {
    rawDb.exec(`
      INSERT INTO orders (id, tenant_id, customer_name, status, payment_method, payment_status, order_type, total, notes, created_at, updated_at)
      VALUES
        ('ord-stale', 'default', 'Khách C', 'pending', 'payos', 'unpaid', 'delivery', 60000, '', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('ord-fresh', 'default', 'Khách D', 'pending', 'payos', 'unpaid', 'delivery', 60000, '', datetime('now', '-5 minutes'), datetime('now', '-5 minutes'));
    `);

    const result = await expireUnpaidOnlineOrders(env, 'default');
    expect(result).toBeGreaterThanOrEqual(1);

    const stale = rawDb.prepare(`SELECT status FROM orders WHERE id = 'ord-stale'`).get() as { status: string };
    const fresh = rawDb.prepare(`SELECT status FROM orders WHERE id = 'ord-fresh'`).get() as { status: string };
    expect(stale.status).toBe('expired');
    expect(fresh.status).toBe('pending');
  });

  it('settlePayOS marks unpaid pending order as expired when PayOS payment expires', async () => {
    rawDb.exec(`
      INSERT INTO orders (id, tenant_id, customer_name, status, payment_method, payment_status, order_type, total, notes, created_at, updated_at)
      VALUES ('ord-payos-exp', 'default', 'Khách E', 'pending', 'payos', 'unpaid', 'delivery', 70000, '', datetime('now', '-20 minutes'), datetime('now', '-20 minutes'));
      INSERT INTO payments (id, tenant_id, order_id, provider, provider_tx_id, amount, status, created_at, updated_at)
      VALUES ('pay-1', 'default', 'ord-payos-exp', 'payos', '123456', 70000, 'pending', datetime('now', '-20 minutes'), datetime('now', '-20 minutes'));
    `);

    const res = await settlePayOS(
      env.AURA_DB,
      { id: 'pay-1', order_id: 'ord-payos-exp', amount: 70000, status: 'pending', method: 'payos' },
      false,
      'expired',
      new Date().toISOString(),
      '123456',
    );
    expect(res.paymentChanged).toBe(true);
    expect(res.orderChanged).toBe(true);

    const order = rawDb.prepare(`SELECT status FROM orders WHERE id = 'ord-payos-exp'`).get() as { status: string };
    expect(order.status).toBe('expired');
  });

  it('readiness handlers reject wildcard HQ scope with 400 and isolate tenants', async () => {
    rawDb.exec(`
      CREATE TABLE refund_tenant_readiness (
        tenant_id TEXT PRIMARY KEY,
        reconciled_at TEXT NOT NULL,
        reconciled_by TEXT NOT NULL,
        evidence TEXT NOT NULL
      );
      CREATE TABLE payment_refund_transfers (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL
      );
    `);

    const makeContext = (role: string, tenantId: string, body: Record<string, unknown> = {}) => {
      const url = `https://example.test/api/payments/refund-readiness`;
      return {
        env,
        req: {
          url,
          header: () => undefined,
          query: () => undefined,
          json: async () => body,
        },
        get: (key: string) => {
          if (key === 'user') return { id: 'u1', role, tenantId, tenant_id: tenantId };
          if (key === 'tenantId') return tenantId;
          if (key === 'isSuperAdmin') return role === 'super_admin';
          return undefined;
        },
        json: (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
      } as unknown as Context<{ Bindings: Env }>;
    };

    const wildcardGet = await handleGetRefundReadiness(makeContext('owner', 'hq'));
    expect(wildcardGet.status).toBe(400);

    const wildcardPost = await handleReconcileRefundReadiness(makeContext('owner', 'hq', { acknowledgeLegacy: true }));
    expect(wildcardPost.status).toBe(400);

    const tenantPost = await handleReconcileRefundReadiness(makeContext('owner', 'tenant-a', { acknowledgeLegacy: true }));
    expect(tenantPost.status).toBe(200);

    const tenantAGet = await handleGetRefundReadiness(makeContext('owner', 'tenant-a'));
    const tenantABody = (await tenantAGet.json()) as { success: boolean; data: { ready: boolean; tenantId: string } };
    expect(tenantABody.success).toBe(true);
    expect(tenantABody.data.ready).toBe(true);
    expect(tenantABody.data.tenantId).toBe('tenant-a');

    const tenantBGet = await handleGetRefundReadiness(makeContext('owner', 'tenant-b'));
    const tenantBBody = (await tenantBGet.json()) as { success: boolean; data: { ready: boolean; tenantId: string } };
    expect(tenantBBody.success).toBe(true);
    expect(tenantBBody.data.ready).toBe(false);
  });

  it('retryPendingRefundLoyaltyWork completes zero-accrual rows and rotates failing rows to avoid starvation', async () => {
    rawDb.exec(`
      ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0;
      ALTER TABLE orders ADD COLUMN cashback_earned INTEGER DEFAULT 0;
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        customer_id TEXT,
        type TEXT,
        amount INTEGER DEFAULT 0,
        tenant_id TEXT
      );
      CREATE TABLE loyalty_point_logs (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        customer_id TEXT,
        points_change INTEGER DEFAULT 0,
        reason TEXT,
        tenant_id TEXT
      );
      CREATE TABLE refund_loyalty_work (
        tenant_id TEXT NOT NULL,
        reversal_key TEXT NOT NULL,
        payment_id TEXT,
        order_id TEXT NOT NULL,
        customer_id TEXT,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        PRIMARY KEY (tenant_id, reversal_key)
      );
      INSERT INTO orders (id, tenant_id, customer_name, status, payment_method, payment_status, order_type, total, notes, created_at, updated_at, points_earned, cashback_earned)
      VALUES
        ('ord-fail', 'default', 'Guest', 'completed', 'payos', 'refunded', 'takeaway', 50000, '', datetime('now'), datetime('now'), 10, 0),
        ('ord-zero', 'default', 'Guest', 'completed', 'payos', 'refunded', 'takeaway', 50000, '', datetime('now'), datetime('now'), 0, 0);
      INSERT INTO refund_loyalty_work (tenant_id, reversal_key, payment_id, order_id, customer_id, amount, status, created_at)
      VALUES
        ('default', 'ref-fail', 'pay-fail', 'ord-fail', NULL, 50000, 'pending', '2026-01-01T00:00:00Z'),
        ('default', 'ref-zero', 'pay-zero', 'ord-zero', NULL, 50000, 'pending', '2026-01-01T00:05:00Z');
    `);

    const firstRun = await retryPendingRefundLoyaltyWork(env, 1);
    expect(firstRun.processed).toBe(1);
    expect(firstRun.succeeded).toBe(0);
    expect(firstRun.failed).toBe(1);

    const failedRow = rawDb
      .prepare(`SELECT status, completed_at FROM refund_loyalty_work WHERE reversal_key = 'ref-fail'`)
      .get() as { status: string; completed_at: string | null };
    expect(failedRow.status).toBe('pending');
    expect(failedRow.completed_at).not.toBeNull();

    const secondRun = await retryPendingRefundLoyaltyWork(env, 1);
    expect(secondRun.processed).toBe(1);
    expect(secondRun.succeeded).toBe(1);
    expect(secondRun.failed).toBe(0);

    const zeroRow = rawDb
      .prepare(`SELECT status FROM refund_loyalty_work WHERE reversal_key = 'ref-zero'`)
      .get() as { status: string };
    expect(zeroRow.status).toBe('completed');
  });
});
