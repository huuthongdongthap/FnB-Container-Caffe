// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { checkOverdueOrders, expireUnpaidOnlineOrders } from '../routes/cron-handlers/order-checks';
import { settlePayOS } from '../routes/webhooks-handlers/payos-settlement';
import { handleGetRefundReadiness, handleReconcileRefundReadiness } from '../routes/refunds-handlers/readiness-handlers';
import { MAX_LOYALTY_WORK_ATTEMPTS, retryPendingRefundLoyaltyWork } from '../routes/refunds-handlers/loyalty-work';
import { getAdminOrders } from '../../../packages/domain/order/queries/admin-orders';
import { signPayOSData } from '../../../packages/domain/payment/policies/payos-signature';
import type { Context } from 'hono';
import type { Env } from '../types/env';

function createSqliteD1(db: DatabaseSync) {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const bound = {
      bind(...args: unknown[]) {
        params = args;
        return bound;
      },
      async first<T = Record<string, unknown>>() {
        const row = db.prepare(sql).get(...(params as never[])) as T | undefined;
        return row ?? null;
      },
      async all<T = Record<string, unknown>>() {
        const results = db.prepare(sql).all(...(params as never[])) as T[];
        return { results, success: true };
      },
      async run() {
        const res = db.prepare(sql).run(...(params as never[]));
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('expireUnpaidOnlineOrders expires stale PayOS orders across all tenants while skipping manual bank_transfer and qr', async () => {
    rawDb.exec(`
      INSERT INTO orders (id, tenant_id, customer_name, status, payment_method, payment_status, order_type, total, notes, created_at, updated_at)
      VALUES
        ('ord-stale-a', 'default', 'Khách C', 'pending', 'payos', 'unpaid', 'delivery', 60000, '', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('ord-stale-b', 'tenant-b', 'Khách T', 'pending', 'payos', 'unpaid', 'delivery', 55000, '', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('ord-fresh', 'default', 'Khách D', 'pending', 'payos', 'unpaid', 'delivery', 60000, '', datetime('now', '-5 minutes'), datetime('now', '-5 minutes')),
        ('ord-manual-bank', 'default', 'Khách B', 'pending', 'bank_transfer', 'unpaid', 'delivery', 60000, '', datetime('now', '-60 minutes'), datetime('now', '-60 minutes')),
        ('ord-manual-qr', 'tenant-b', 'Khách Q', 'pending', 'qr', 'unpaid', 'takeaway', 60000, '', datetime('now', '-60 minutes'), datetime('now', '-60 minutes'));
      INSERT INTO payments (id, tenant_id, order_id, provider, provider_tx_id, amount, status, created_at, updated_at)
      VALUES
        ('pay-stale-a', 'default', 'ord-stale-a', 'payos', NULL, 60000, 'pending', datetime('now', '-45 minutes'), datetime('now', '-45 minutes'));
    `);

    const result = await expireUnpaidOnlineOrders(env);
    expect(result).toBe(2);

    const statusOf = (id: string) =>
      (rawDb.prepare(`SELECT status FROM orders WHERE id = ?`).get(id) as { status: string }).status;
    expect(statusOf('ord-stale-a')).toBe('expired');
    expect(statusOf('ord-stale-b')).toBe('expired');
    expect(statusOf('ord-fresh')).toBe('pending');
    expect(statusOf('ord-manual-bank')).toBe('pending');
    expect(statusOf('ord-manual-qr')).toBe('pending');

    const payRow = rawDb.prepare(`SELECT status FROM payments WHERE id = 'pay-stale-a'`).get() as { status: string };
    expect(payRow.status).toBe('expired');
  });

  it('expireUnpaidOnlineOrders reconciles PAID upstream PayOS links, cancels PENDING links before expiring, and fails closed when cancel fails or creds are missing', async () => {
    rawDb.exec(`
      DROP TABLE payments;
      CREATE TABLE payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        method TEXT,
        amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        transaction_id TEXT,
        payment_url TEXT,
        refund_status TEXT,
        paid_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE saas_tenants (id TEXT PRIMARY KEY);
      INSERT INTO saas_tenants (id) VALUES ('tenant-nocreds');
      INSERT INTO orders (id, tenant_id, customer_name, status, payment_method, payment_status, order_type, total, notes, created_at, updated_at)
      VALUES
        ('ord-up-paid', 'default', 'Paid Online', 'pending', 'payos', 'unpaid', 'delivery', 70000, '', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('ord-up-pending-ok', 'default', 'Cancel OK', 'pending', 'payos', 'unpaid', 'delivery', 50000, '', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('ord-up-pending-fail', 'default', 'Cancel Fail', 'pending', 'payos', 'unpaid', 'delivery', 40000, '', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('ord-no-creds', 'tenant-nocreds', 'No Creds', 'pending', 'payos', 'unpaid', 'delivery', 45000, '', datetime('now', '-45 minutes'), datetime('now', '-45 minutes'));
      INSERT INTO payments (id, tenant_id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at)
      VALUES
        ('pay-up-paid', 'default', 'ord-up-paid', 'payos', 70000, 'pending', '100001', 'https://pay.payos.vn/web/linkPaid1', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('pay-up-ok', 'default', 'ord-up-pending-ok', 'payos', 50000, 'pending', '100002', 'https://pay.payos.vn/web/linkOk2', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('pay-up-fail', 'default', 'ord-up-pending-fail', 'payos', 40000, 'pending', '100003', 'https://pay.payos.vn/web/linkFail3', datetime('now', '-45 minutes'), datetime('now', '-45 minutes')),
        ('pay-no-creds', 'tenant-nocreds', 'ord-no-creds', 'payos', 45000, 'pending', '100004', 'https://pay.payos.vn/web/linkNoCred4', datetime('now', '-45 minutes'), datetime('now', '-45 minutes'));
    `);

    const checksumKey = 'test-checksum-key';
    const makeSignedResponse = async (data: Record<string, unknown>) => {
      const signature = await signPayOSData(data, checksumKey);
      return new Response(JSON.stringify({ code: '00', data, signature }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const cancelCalls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/100001')) {
        return makeSignedResponse({
          id: 'linkPaid1',
          orderCode: 100001,
          amount: 70000,
          amountPaid: 70000,
          amountRemaining: 0,
          status: 'PAID',
        });
      }
      if (url.endsWith('/100002') && (!init?.method || init.method === 'GET')) {
        return makeSignedResponse({
          id: 'linkOk2',
          orderCode: 100002,
          amount: 50000,
          amountPaid: 0,
          amountRemaining: 50000,
          status: 'PENDING',
        });
      }
      if (url.endsWith('/100002/cancel') && init?.method === 'POST') {
        cancelCalls.push('100002');
        return new Response(JSON.stringify({ code: '00', data: { status: 'CANCELLED' } }), { status: 200 });
      }
      if (url.endsWith('/100003') && (!init?.method || init.method === 'GET')) {
        return makeSignedResponse({
          id: 'linkFail3',
          orderCode: 100003,
          amount: 40000,
          amountPaid: 0,
          amountRemaining: 40000,
          status: 'PENDING',
        });
      }
      if (url.endsWith('/100003/cancel') && init?.method === 'POST') {
        cancelCalls.push('100003');
        return new Response(JSON.stringify({ code: '500', desc: 'upstream error' }), { status: 502 });
      }
      return new Response('not found', { status: 404 });
    });

    const payosEnv = {
      ...env,
      PAYOS_CLIENT_ID: 'cid',
      PAYOS_API_KEY: 'akey',
      PAYOS_CHECKSUM_KEY: checksumKey,
    } as unknown as Record<string, unknown>;

    const expired = await expireUnpaidOnlineOrders(payosEnv);
    expect(expired).toBe(1);
    expect(cancelCalls).toEqual(['100002', '100003']);

    const orderRow = (id: string) =>
      rawDb.prepare(`SELECT status, payment_status FROM orders WHERE id = ?`).get(id) as {
        status: string;
        payment_status: string;
      };
    const payRow = (id: string) =>
      rawDb.prepare(`SELECT status FROM payments WHERE id = ?`).get(id) as { status: string };

    // Upstream PAID link was reconciled to paid rather than expired
    expect(orderRow('ord-up-paid').payment_status).toBe('paid');
    expect(orderRow('ord-up-paid').status).not.toBe('expired');
    expect(payRow('pay-up-paid').status).toBe('completed');

    // Upstream PENDING link cancelled cleanly -> both payment and order marked expired atomically
    expect(orderRow('ord-up-pending-ok').status).toBe('expired');
    expect(payRow('pay-up-ok').status).toBe('expired');

    // Upstream cancel failed -> failed closed, order + payment stay pending for retry
    expect(orderRow('ord-up-pending-fail').status).toBe('pending');
    expect(payRow('pay-up-fail').status).toBe('pending');

    // Missing non-default tenant credentials -> failed closed, never expires live link blind
    expect(orderRow('ord-no-creds').status).toBe('pending');
    expect(payRow('pay-no-creds').status).toBe('pending');
  });

  it('settlePayOS marks a failed/expired PayOS payment attempt without expiring the parent order', async () => {
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
    expect(res.orderChanged).toBe(false);

    const payment = rawDb.prepare(`SELECT status FROM payments WHERE id = 'pay-1'`).get() as { status: string };
    const order = rawDb.prepare(`SELECT status FROM orders WHERE id = 'ord-payos-exp'`).get() as { status: string };
    expect(payment.status).toBe('expired');
    expect(order.status).toBe('pending');
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

  it('retryPendingRefundLoyaltyWork completes zero-accrual rows, tracks attempts without corrupting completed_at, and stops after max attempts', async () => {
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
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
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

    const afterFirstFail = rawDb
      .prepare(`SELECT status, attempts, last_error, updated_at, completed_at FROM refund_loyalty_work WHERE reversal_key = 'ref-fail'`)
      .get() as { status: string; attempts: number; last_error: string | null; updated_at: string | null; completed_at: string | null };
    expect(afterFirstFail.status).toBe('pending');
    expect(afterFirstFail.attempts).toBe(1);
    expect(afterFirstFail.last_error).toBe('accrual_recipient_missing');
    expect(afterFirstFail.updated_at).not.toBeNull();
    expect(afterFirstFail.completed_at).toBeNull();

    const secondRun = await retryPendingRefundLoyaltyWork(env, 1);
    expect(secondRun.processed).toBe(1);
    expect(secondRun.succeeded).toBe(1);
    expect(secondRun.failed).toBe(0);

    const zeroRow = rawDb
      .prepare(`SELECT status, completed_at FROM refund_loyalty_work WHERE reversal_key = 'ref-zero'`)
      .get() as { status: string; completed_at: string | null };
    expect(zeroRow.status).toBe('completed');
    expect(zeroRow.completed_at).not.toBeNull();

    // Exhaust remaining automated attempts -> row becomes terminal 'failed' with completed_at still NULL
    for (let i = 1; i < MAX_LOYALTY_WORK_ATTEMPTS; i++) {
      const tick = await retryPendingRefundLoyaltyWork(env, 5);
      expect(tick.processed).toBe(1);
      expect(tick.failed).toBe(1);
    }

    const exhaustedRow = rawDb
      .prepare(`SELECT status, attempts, completed_at FROM refund_loyalty_work WHERE reversal_key = 'ref-fail'`)
      .get() as { status: string; attempts: number; completed_at: string | null };
    expect(exhaustedRow.status).toBe('failed');
    expect(exhaustedRow.attempts).toBe(MAX_LOYALTY_WORK_ATTEMPTS);
    expect(exhaustedRow.completed_at).toBeNull();

    // Subsequent automated ticks do not re-process exhausted rows
    const postExhaustion = await retryPendingRefundLoyaltyWork(env, 5);
    expect(postExhaustion).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it('getAdminOrders never leaks guest/order secret columns on legacy fallback and projects pending_loyalty_refund_amount', async () => {
    const legacyDb = new DatabaseSync(':memory:');
    // Minimal legacy orders table (missing cafe_tables & order_type/delivery_time) containing secret columns
    legacyDb.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        status TEXT NOT NULL,
        total INTEGER NOT NULL,
        payment_status TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        items TEXT,
        guest_token_hash TEXT,
        order_token TEXT,
        guest_token TEXT,
        payment_secret TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE refund_loyalty_work (
        tenant_id TEXT NOT NULL,
        reversal_key TEXT NOT NULL,
        order_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, reversal_key)
      );
      INSERT INTO orders (id, tenant_id, status, total, payment_status, customer_name, customer_phone, items, guest_token_hash, order_token, guest_token, payment_secret, created_at)
      VALUES ('ord-secret', 'default', 'completed', 100000, 'partially_refunded', 'Alice', '0900000001', '[]', 'hash-secret', 'tok-secret', 'guest-secret', 'pay-secret', '2026-11-24T10:00:00Z');
      INSERT INTO refund_loyalty_work (tenant_id, reversal_key, order_id, amount, status, created_at)
      VALUES ('default', 'BANK-TRANCHE-2', 'ord-secret', 25000, 'failed', '2026-11-24T10:05:00Z');
    `);

    const d1 = createSqliteD1(legacyDb);
    const response = await getAdminOrders(
      new Request('https://example.test/api/orders?limit=20&offset=0'),
      { AURA_DB: d1 },
      'default',
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { orders: Array<Record<string, unknown>> };

    expect(result.orders).toHaveLength(1);
    const row = result.orders[0]!;
    expect(row.id).toBe('ord-secret');
    expect(row.pending_loyalty_reversal).toBe(true);
    expect(row.pending_loyalty_transfer_ref).toBe('BANK-TRANCHE-2');
    expect(row.pending_loyalty_refund_amount).toBe(25000);
    expect(row).not.toHaveProperty('guest_token_hash');
    expect(row).not.toHaveProperty('order_token');
    expect(row).not.toHaveProperty('guest_token');
    expect(row).not.toHaveProperty('payment_secret');
  });
});
