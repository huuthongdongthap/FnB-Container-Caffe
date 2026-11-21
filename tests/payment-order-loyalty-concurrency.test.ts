// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

import { transitionOrderStatus, PAID_ORDER_CANCEL_ERROR } from '../packages/domain/order/policies/order-status-transition';
import { cancelOpenPayOSAttemptForOrder, getOrCreatePayOSAttempt } from '../packages/domain/payment/commands/payos-attempt';
import { placeOrder } from '../packages/domain/crm/commands/place-order';
import { reverseAccrual } from '../packages/domain/crm/commands/refund-reversal';
import type { LoyaltyPolicy } from '../packages/domain/crm/commands/loyalty-policy';
import { settlePayOS } from '../worker/src/routes/webhooks-handlers/payos-settlement';
import { handlePayosWebhook } from '../worker/src/routes/webhooks-handlers/payos';
import { handleRefund } from '../worker/src/routes/refunds-handlers/mutation-handlers';

function createTestSqliteDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../worker/db/migrations/20261121_01_refund_manual_transfer_ledger.sql', import.meta.url), 'utf8'));
  const runStatement = new WeakMap<object, () => any>();

  sqlite.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      tenant_id TEXT DEFAULT 'default',
      customer_id TEXT,
      table_id TEXT,
      total INTEGER DEFAULT 0,
      total_amount INTEGER DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      payment_method TEXT DEFAULT 'payos',
      status TEXT DEFAULT 'pending',
      items TEXT DEFAULT '[]',
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      customer_address TEXT,
      notes TEXT,
      is_cod INTEGER DEFAULT 0,
      shipping_fee INTEGER DEFAULT 0,
      discount INTEGER DEFAULT 0,
      tip INTEGER DEFAULT 0,
      order_type TEXT DEFAULT 'dine_in',
      points_earned INTEGER DEFAULT 0,
      cashback_earned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT,
      payment_url TEXT,
      provider_reference TEXT,
      refund_status TEXT,
      refund_amount INTEGER DEFAULT 0,
      refund_reason TEXT,
      refunded_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE order_creation_requests (
      scope_key TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      order_id TEXT NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      loyalty_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      loyalty_tier TEXT DEFAULT 'bronze',
      total_spent INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE loyalty_point_logs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      points_change INTEGER NOT NULL,
      reason TEXT,
      balance_after INTEGER NOT NULL,
      description TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE loyalty_redemptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      reward_id TEXT NOT NULL,
      code TEXT,
      points_spent INTEGER NOT NULL DEFAULT 0,
      order_id TEXT,
      status TEXT DEFAULT 'active',
      voucher_code TEXT,
      expires_at TEXT,
      redeemed_at TEXT DEFAULT (datetime('now')),
      used_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE loyalty_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      action TEXT NOT NULL,
      amount_vnd INTEGER,
      order_id TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE cashback_wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      actor_name TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      metadata TEXT,
      ip_address TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      available INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );

    CREATE TABLE promotions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      discount_type TEXT DEFAULT 'percentage',
      discount_value REAL DEFAULT 10,
      percent REAL DEFAULT 10,
      max_discount INTEGER,
      min_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      usage_limit INTEGER DEFAULT 0,
      max_uses INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      current_uses INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
    );

    CREATE TABLE promotion_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promotion_id TEXT,
      code TEXT NOT NULL,
      order_id TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      order_total INTEGER NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      redeemed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  function prepare(sql: string) {
    let args: any[] = [];
    const run = () => {
      const before = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      const result = sqlite.prepare(sql).run(...args);
      const after = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      return { success: true, meta: { changes: after - before, last_row_id: Number(result.lastInsertRowid) } };
    };
    const statement = {
      bind(...values: any[]) {
        args = values;
        return statement;
      },
      async first<T = unknown>() {
        return (sqlite.prepare(sql).get(...args) ?? null) as T;
      },
      async all<T = unknown>() {
        return { results: sqlite.prepare(sql).all(...args) as T[], success: true, meta: {} };
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
  } as unknown as D1Database;

  return { sqlite, db };
}

const mockLoyaltyPolicy: LoyaltyPolicy = {
  tiers: [
    { tierName: 'bronze', minPoints: 0, cashbackRate: 0.03, pointMultiplier: 1.0, expiryDays: 365 },
    { tierName: 'silver', minPoints: 500, cashbackRate: 0.05, pointMultiplier: 1.2, expiryDays: 365 },
    { tierName: 'gold', minPoints: 1000, cashbackRate: 0.08, pointMultiplier: 1.5, expiryDays: 365 },
  ],
  defaultTier: { tierName: 'bronze', minPoints: 0, cashbackRate: 0.03, pointMultiplier: 1.0, expiryDays: 365 },
  campaignMultiplier: 1,
  maxCapPerTx: 50000,
  campaignCode: null,
  expiresAt: null,
};

function createSignedWebhookPayload(data: Record<string, any>, checksumKey: string) {
  const canonical = Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      let value = data[key];
      if (Array.isArray(value)) {
        value = JSON.stringify(
          value.map((entry) =>
            entry && typeof entry === 'object'
              ? Object.fromEntries(Object.keys(entry).sort().map((f) => [f, entry[f]]))
              : entry,
          ),
        );
      }
      return `${key}=${[null, undefined, 'null', 'undefined'].includes(value) ? '' : value}`;
    })
    .join('&');
  const signature = createHmac('sha256', checksumKey).update(canonical).digest('hex');
  return { code: '00', desc: 'success', success: true, data, signature };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Payment, Order & Loyalty Concurrency Hardening', () => {
  describe('Paid order cancellation guard', () => {
    it('blocks cancelling an order when payment_status is paid with 409', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, status, payment_status) VALUES ('ord_paid_1', 'pending', 'paid')").run();

      const result = await transitionOrderStatus(db, 'ord_paid_1', 'cancelled', 'supervisor');
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.error).toBe(PAID_ORDER_CANCEL_ERROR);

      const row = sqlite.prepare("SELECT status FROM orders WHERE id = 'ord_paid_1'").get() as { status: string };
      expect(row.status).toBe('pending');
    });

    it('allows cancelling an unpaid order', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, status, payment_status) VALUES ('ord_unpaid_1', 'pending', 'unpaid')").run();

      const result = await transitionOrderStatus(db, 'ord_unpaid_1', 'cancelled', 'supervisor');
      expect(result.success).toBe(true);

      const row = sqlite.prepare("SELECT status FROM orders WHERE id = 'ord_unpaid_1'").get() as { status: string };
      expect(row.status).toBe('cancelled');
    });
  });

  describe('PayOS attempt lifecycle & link rotation', () => {
    it('rotates an expired PayOS attempt in place when order is unpaid', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, status, payment_status, total) VALUES ('ord_exp_1', 'pending', 'unpaid', 50000)").run();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url)
        VALUES ('payos:ord_exp_1', 'ord_exp_1', 'payos', 50000, 'expired', '10001', 'https://pay.payos.vn/web/oldlink')
      `).run();

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const signed = createSignedWebhookPayload({
          orderCode: body.orderCode,
          amount: body.amount,
          status: 'PENDING',
          paymentLinkId: 'newlink123',
          checkoutUrl: 'https://pay.payos.vn/web/newlink123',
        }, 'test_checksum');
        return new Response(JSON.stringify({ code: '00', data: signed.data, signature: signed.signature }));
      });

      const res = await getOrCreatePayOSAttempt({
        db,
        orderId: 'ord_exp_1',
        amount: 50000,
        clientId: 'client_id',
        apiKey: 'api_key',
        checksumKey: 'test_checksum',
        description: 'Order exp 1',
        returnUrl: 'https://aura.vn/success',
        cancelUrl: 'https://aura.vn/cancel',
        tenantId: 'default',
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.payment.status).toBe('pending');
        expect(res.payment.payment_url).toBe('https://pay.payos.vn/web/newlink123');
        expect(res.payment.transaction_id).not.toBe('10001');
      }
    });

    it('cancels open pending PayOS attempts for order and notifies provider', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url)
        VALUES ('payos:ord_cancel_1', 'ord_cancel_1', 'payos', 50000, 'pending', '99999', 'https://pay.payos.vn/web/link999')
      `).run();

      let providerCancelled = false;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        if (String(url).includes('/link999/cancel') && init?.method === 'POST') {
          providerCancelled = true;
          return new Response(JSON.stringify({ code: '00', desc: 'success' }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const res = await cancelOpenPayOSAttemptForOrder(
        db,
        { PAYOS_CLIENT_ID: 'cid', PAYOS_API_KEY: 'key' },
        'ord_cancel_1',
        'default',
      );

      expect(res.cancelled).toBe(1);
      expect(res.providerNotified).toBe(1);
      expect(providerCancelled).toBe(true);

      const payRow = sqlite.prepare("SELECT status FROM payments WHERE id = 'payos:ord_cancel_1'").get() as { status: string };
      expect(payRow.status).toBe('cancelled');
    });
  });

  describe('PayOS Webhook hardening', () => {
    it('acknowledges signed PayOS probe without mutating tables', async () => {
      const { sqlite, db } = createTestSqliteDb();
      const payload = createSignedWebhookPayload(
        { orderCode: 123, amount: 10000, description: 'Probe', returnUrl: 'https://aura.vn' },
        'secret_checksum',
      );

      const req = new Request('https://api.aura.vn/api/payments/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const mockCtx = {
        req: {
          json: async () => payload,
          header: () => undefined,
          raw: req,
        },
        env: {
          AURA_DB: db,
          PAYOS_CHECKSUM_KEY: 'secret_checksum',
        },
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any;

      const res = await handlePayosWebhook(mockCtx);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.data?.probe).toBe(true);

      // Verify zero records written to orders or payments
      const orderCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number };
      expect(orderCount.cnt).toBe(0);
    });

    it('rejects unsigned webhook with 401', async () => {
      const { db } = createTestSqliteDb();
      const payload = { code: '00', desc: 'fake', data: { orderCode: 12345, amount: 20000 } }; // Missing signature

      const req = new Request('https://api.aura.vn/api/payments/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const mockCtx = {
        req: {
          json: async () => payload,
          header: () => undefined,
          raw: req,
        },
        env: {
          AURA_DB: db,
          PAYOS_CHECKSUM_KEY: 'secret_checksum',
        },
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any;

      const res = await handlePayosWebhook(mockCtx);
      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant payment webhook (store-b vs default) with 409', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, tenant_id, total, status, payment_status) VALUES ('ord_store_b', 'store-b', 50000, 'pending', 'unpaid')").run();
      // Payment has NULL/empty tenant (normalized to 'default') while order is 'store-b'
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id)
        VALUES ('payos:ord_store_b', 'ord_store_b', 'payos', 50000, 'pending', '88888', 'https://pay.payos.vn/web/link888', '')
      `).run();

      const payload = createSignedWebhookPayload(
        { orderCode: 88888, amount: 50000, description: 'Order store-b', status: 'PAID', paymentLinkId: 'link888' },
        'secret_checksum',
      );

      const mockKv = {
        put: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        req: {
          json: async () => payload,
          header: () => undefined,
          raw: new Request('https://api.aura.vn/api/payments/webhook/payos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        },
        env: {
          AURA_DB: db,
          AUTH_KV: mockKv,
          PAYOS_CHECKSUM_KEY: 'secret_checksum',
        },
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any;

      const res = await handlePayosWebhook(mockCtx);
      expect(res.status).toBe(409);
      expect(mockKv.put).toHaveBeenCalled();
    });

    it('rejects webhook with paymentLinkId mismatch against stored payment_url with 400', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, tenant_id, total, status, payment_status) VALUES ('ord_link_1', 'default', 50000, 'pending', 'unpaid')").run();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id)
        VALUES ('payos:ord_link_1', 'ord_link_1', 'payos', 50000, 'pending', '77777', 'https://pay.payos.vn/web/legit_link_id', 'default')
      `).run();

      const payload = createSignedWebhookPayload(
        { orderCode: 77777, amount: 50000, description: 'Order link', status: 'PAID', paymentLinkId: 'forged_link_id' },
        'secret_checksum',
      );

      const mockKv = {
        put: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        req: {
          json: async () => payload,
          header: () => undefined,
          raw: new Request('https://api.aura.vn/api/payments/webhook/payos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        },
        env: {
          AURA_DB: db,
          AUTH_KV: mockKv,
          PAYOS_CHECKSUM_KEY: 'secret_checksum',
        },
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any;

      const res = await handlePayosWebhook(mockCtx);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.message).toContain('Payment link mismatch');
    });

    it('persists provider_reference into payments table on settlement', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method) VALUES ('ord_ref_1', 30000, 'pending', 'unpaid', 'payos')").run();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id)
        VALUES ('pay_ref_1', 'ord_ref_1', 'payos', 30000, 'pending', '55555')
      `).run();

      await settlePayOS(
        db,
        { id: 'pay_ref_1', order_id: 'ord_ref_1', amount: 30000, status: 'pending', transaction_id: '55555', tenant_id: 'default' },
        true,
        'PAID',
        new Date().toISOString(),
        'FT240019283921',
      );

      const paymentRow = sqlite.prepare("SELECT status, provider_reference FROM payments WHERE id = 'pay_ref_1'").get() as any;
      expect(paymentRow.status).toBe('completed');
      expect(paymentRow.provider_reference).toBe('FT240019283921');

      const orderRow = sqlite.prepare("SELECT payment_status FROM orders WHERE id = 'ord_ref_1'").get() as any;
      expect(orderRow.payment_status).toBe('paid');
    });
  });

  describe('D1 Batch Idempotency across PlaceOrder & Alternate Order Writers', () => {
    it('enforces D1 order_creation_requests idempotency in placeOrder', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO menu_items (id, name, price, available) VALUES ('item_caffe', 'Cafe Sua', 25000, 1)").run();

      const input = {
        customerId: 'cust_idem_1',
        customerPhone: '0901234567',
        customerName: 'Anh Nam',
        channel: 'pickup' as const,
        items: [{ menuItemId: 'item_caffe', quantity: 2 }],
        idempotencyKey: 'idem_key_uuid_123',
      };

      const first = await placeOrder(db, input);
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const orderCount1 = sqlite.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number };
      expect(orderCount1.cnt).toBe(1);

      // Replay with exact same idempotencyKey
      const second = await placeOrder(db, input);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.orderId).toBe(first.orderId);
      expect(second.replayed).toBe(true);

      const orderCount2 = sqlite.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number };
      expect(orderCount2.cnt).toBe(1);

      // Same idempotencyKey with DIFFERENT order items fails with 409 conflict
      const conflicting = await placeOrder(db, {
        ...input,
        items: [{ menuItemId: 'item_caffe', quantity: 5 }],
      });
      expect(conflicting.ok).toBe(false);
      expect((conflicting as any).status).toBe(409);
    });
  });

  describe('Loyalty Clawback & Voucher Revocation (Earn -> Redeem -> Refund)', () => {
    it('uses deterministic ptl_rev_orderId and revokes active vouchers when point deficit exists', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare(`
        INSERT INTO customers (id, name, loyalty_points, lifetime_points, loyalty_tier)
        VALUES ('cust_farm_1', 'Farmer', 20, 200, 'bronze')
      `).run();

      // Order originally earned 100 points
      sqlite.prepare(`
        INSERT INTO orders (id, customer_id, total, points_earned, status, payment_status)
        VALUES ('ord_claw_1', 'cust_farm_1', 100000, 100, 'completed', 'paid')
      `).run();

      // Customer redeemed 80 points for a voucher (leaving 20 points in balance)
      sqlite.prepare(`
        INSERT INTO loyalty_redemptions (id, customer_id, reward_id, points_spent, status, redeemed_at)
        VALUES ('vouch_farm_1', 'cust_farm_1', 'rew_coffee', 80, 'active', '2026-11-15 10:00:00')
      `).run();

      const reversalResult = await reverseAccrual(db, mockLoyaltyPolicy, {
        orderId: 'ord_claw_1',
        customerId: 'cust_farm_1',
        refundAmountVnd: 100000,
      });

      expect(reversalResult.ok).toBe(true);
      if (!reversalResult.ok) return;

      // Customer points should now be 0 (20 points deducted)
      const custRow = sqlite.prepare("SELECT loyalty_points FROM customers WHERE id = 'cust_farm_1'").get() as any;
      expect(custRow.loyalty_points).toBe(0);

      // Voucher must be atomically REVOKED to cover the 80 point deficit
      const voucherRow = sqlite.prepare("SELECT status FROM loyalty_redemptions WHERE id = 'vouch_farm_1'").get() as any;
      expect(voucherRow.status).toBe('revoked');

      // The log ID must be deterministic: ptl_rev_ord_claw_1
      const logRow = sqlite.prepare("SELECT id FROM loyalty_point_logs WHERE order_id = 'ord_claw_1'").get() as any;
      expect(logRow.id).toBe('ptl_rev_ord_claw_1');

      // Re-running reverseAccrual immediately returns already_reversed without double-clawback
      const secondReversal = await reverseAccrual(db, mockLoyaltyPolicy, {
        orderId: 'ord_claw_1',
        customerId: 'cust_farm_1',
        refundAmountVnd: 100000,
      });
      expect(secondReversal.ok).toBe(false);
      expect((secondReversal as any).reason).toBe('already_reversed');
    });
  });

  describe('Manual Refund Settlement Audit Path', () => {
    it('returns 422 REFUND_PROVIDER_UNAVAILABLE for automated PayOS refund without manual transfer ref', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status) VALUES ('ord_ref_test', 50000, 'completed', 'paid')").run();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id)
        VALUES ('pay_ref_test', 'ord_ref_test', 'payos', 50000, 'completed', '123456')
      `).run();

      const mockCtx = {
        req: {
          json: async () => ({
            paymentId: 'pay_ref_test',
            amount: 50000,
            reason: 'Customer request',
          }),
        },
        env: { AURA_DB: db },
        get: (key: string) => (key === 'user' ? { role: 'manager', id: 'mgr_1', name: 'Manager' } : undefined),
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any;

      const res = await handleRefund(mockCtx);
      expect(res.status).toBe(422);
      const data = await res.json() as any;
      expect(data.code).toBe('REFUND_PROVIDER_UNAVAILABLE');
    });

    it('settles manual bank-transfer refund when authorized manager supplies manual_transfer_ref', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, customer_id) VALUES ('ord_man_1', 60000, 'completed', 'paid', 'cust_man_1')").run();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, tenant_id)
        VALUES ('pay_man_1', 'ord_man_1', 'payos', 60000, 'completed', '987654', 'default')
      `).run();
      sqlite.prepare("INSERT INTO customers (id, name, loyalty_points, lifetime_points) VALUES ('cust_man_1', 'Khach', 60, 60)").run();

      const mockCtx = {
        req: {
          json: async () => ({
            paymentId: 'pay_man_1',
            amount: 60000,
            reason: 'Chuyen khoan tay hoan tien',
            manual_transfer_ref: 'MB-BANK-FT-998811',
          }),
        },
        env: { AURA_DB: db },
        get: (key: string) => (key === 'user' ? { role: 'manager', id: 'mgr_1', name: 'Manager Son' } : undefined),
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any;

      const res = await handleRefund(mockCtx);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.data.refund_status).toBe('completed');
      expect(data.data.manual_transfer_ref).toBe('MB-BANK-FT-998811');

      // Verify payment and order records updated
      const payRow = sqlite.prepare("SELECT status, refund_status, refund_reason FROM payments WHERE id = 'pay_man_1'").get() as any;
      expect(payRow.status).toBe('refunded');
      expect(payRow.refund_status).toBe('completed');

      const ordRow = sqlite.prepare("SELECT payment_status FROM orders WHERE id = 'ord_man_1'").get() as any;
      expect(ordRow.payment_status).toBe('refunded');

      // Verify audit_logs entry recorded
      const auditRow = sqlite.prepare("SELECT action, details FROM audit_logs WHERE action = 'manual_refund_settled'").get() as any;
      expect(auditRow).toBeDefined();
      expect(auditRow.details).toContain('MB-BANK-FT-998811');
    });

    it('rejects manual bank-transfer refund if user is not manager/owner (403)', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status) VALUES ('ord_man_2', 40000, 'completed', 'paid')").run();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id)
        VALUES ('pay_man_2', 'ord_man_2', 'payos', 40000, 'completed', '345678')
      `).run();

      const mockCtx = {
        req: {
          json: async () => ({
            paymentId: 'pay_man_2',
            amount: 40000,
            reason: 'Chuyen khoan tay hoan tien',
            manual_transfer_ref: 'MB-BANK-FT-112233',
          }),
        },
        env: { AURA_DB: db },
        // Cashier role has financial role to request refund, but NOT owner/manager to authorize manual transfer
        get: (key: string) => (key === 'user' ? { role: 'cashier', id: 'csh_1', name: 'Cashier' } : undefined),
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any;

      const res = await handleRefund(mockCtx);
      expect(res.status).toBe(403);
    });

    it('accumulates manual partial refund tranches and rejects amounts above the remaining balance', async () => {
      const { sqlite, db } = createTestSqliteDb();
      sqlite.prepare("INSERT INTO orders (id, total, status, payment_status) VALUES ('ord_man_3', 100000, 'completed', 'paid')").run();
      sqlite.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, tenant_id)
        VALUES ('pay_man_3', 'ord_man_3', 'payos', 100000, 'completed', '556677', 'default')
      `).run();

      const refund = (amount: number, ref: string) => handleRefund({
        req: { json: async () => ({ paymentId: 'pay_man_3', amount, reason: 'Hoan mot phan', manual_transfer_ref: ref }) },
        env: { AURA_DB: db },
        get: (key: string) => (key === 'user' ? { role: 'manager', id: 'mgr_1', name: 'Manager' } : undefined),
        json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }),
      } as any);

      const first = await refund(30000, 'FT-1');
      expect(first.status).toBe(200);
      expect(((await first.json()) as any).data.refund_status).toBe('partial');

      const overBalance = await refund(80000, 'FT-2');
      expect(overBalance.status).toBe(400);

      const second = await refund(70000, 'FT-3');
      expect(second.status).toBe(200);
      expect(((await second.json()) as any).data.refund_status).toBe('completed');

      const payRow = sqlite.prepare("SELECT status, refund_status, refund_amount FROM payments WHERE id = 'pay_man_3'").get() as any;
      expect(payRow).toMatchObject({ status: 'refunded', refund_status: 'completed', refund_amount: 100000 });
      const ordRow = sqlite.prepare("SELECT payment_status FROM orders WHERE id = 'ord_man_3'").get() as any;
      expect(ordRow.payment_status).toBe('refunded');

      const afterComplete = await refund(1000, 'FT-4');
      expect(afterComplete.status).toBe(400);
      expect(((await afterComplete.json()) as any).success).toBe(false);
    });
  });
});
