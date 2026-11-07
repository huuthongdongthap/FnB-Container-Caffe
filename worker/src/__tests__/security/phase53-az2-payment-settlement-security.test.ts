// @vitest-environment node
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canAccessPaymentOrder,
  hasFinancialRole,
  paymentTenantScope,
  resolvePaymentTenantScope,
} from '../../../../packages/domain/payment/policies/payment-access';
import { handleCreateLink } from '../../../../packages/domain/payment/commands/payos-create-link';
import { reconcilePayOSPayment } from '../../../../packages/domain/payment/commands/payos-reconcile';
import { processNowPaymentsIpn } from '../../../../packages/domain/payment/commands/nowpayments-ipn';
import { settlePayOS } from '../../routes/webhooks-handlers/payos-settlement';
import { handlePayosWebhook } from '../../routes/webhooks-handlers/payos';
import { handleCreatePayment } from '../../routes/openapi-payments-handlers/mutation-handlers';
import { handleRefund } from '../../routes/refunds-handlers/mutation-handlers';
import { paymentSqliteDB, signedPayOSResponse, payosCheckoutResponse } from '../helpers/payment-sqlite-db';
import { createMockKV, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';
import type { Env } from '../../types/env';

const CHECKSUM_KEY = 'az2-test-checksum-key-123456789';

describe('Phase 53 Slice AZ2 — Payment Access, Settlement State Machine & IPN Guardrails', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AZ2-F1: Payment Access Control & Order Token Enforcement', () => {
    it('confines non-HQ caller to user.tenantId and rejects cross-tenant header overrides', () => {
      const ctx = {
        get: (k: string) => {
          if (k === 'user') return { id: 'u1', role: 'cashier', tenantId: 'store-a' };
          if (k === 'tenantId') return 'store-b';
          return undefined;
        },
        req: {
          query: (k: string) => (k === 'tenant_id' ? 'store-b' : undefined),
          header: (k: string) => (k.toLowerCase() === 'x-tenant-id' ? 'store-b' : undefined),
        },
      };

      const scope = resolvePaymentTenantScope(ctx, false);
      expect(scope).toBeNull();

      const canAccess = canAccessPaymentOrder(ctx, { tenant_id: 'store-a' });
      expect(canAccess).toBe(false);
    });

    it('requires a matching X-Order-Token when order.order_token is set on guest orders', () => {
      const order = {
        tenant_id: 'default',
        customer_id: null,
        order_token: 'valid-secret-token-12345',
      };

      // Guest without token
      const ctxNoToken = {
        get: () => undefined,
        req: { query: () => undefined, header: () => undefined },
      };
      expect(canAccessPaymentOrder(ctxNoToken, order, true)).toBe(false);

      // Guest with incorrect token
      const ctxWrongToken = {
        get: () => undefined,
        req: {
          query: () => undefined,
          header: (k: string) => (k.toLowerCase() === 'x-order-token' ? 'wrong-token' : undefined),
        },
      };
      expect(canAccessPaymentOrder(ctxWrongToken, order, true)).toBe(false);

      // Guest with matching token
      const ctxValidToken = {
        get: () => undefined,
        req: {
          query: () => undefined,
          header: (k: string) => (k.toLowerCase() === 'x-order-token' ? 'valid-secret-token-12345' : undefined),
        },
      };
      expect(canAccessPaymentOrder(ctxValidToken, order, true)).toBe(true);
    });

    it('allows valid X-Order-Token holder to access order even when customer_id is assigned or caller is logged in', () => {
      const order = {
        tenant_id: 'default',
        customer_id: 'cust-owner-id',
        order_token: 'table-session-token-999',
      };

      // Another customer holding the physical order token (e.g. companion dining at table)
      const ctxOtherCustomer = {
        get: (k: string) => (k === 'user' ? { id: 'cust-companion-id', role: 'customer', tenantId: 'default' } : undefined),
        req: {
          query: () => undefined,
          header: (k: string) => (k.toLowerCase() === 'x-order-token' ? 'table-session-token-999' : undefined),
        },
      };
      expect(canAccessPaymentOrder(ctxOtherCustomer, order, false)).toBe(true);
    });
  });

  describe('AZ2-F1 & AZ2-F6: PayOS Create Link Gateways', () => {
    it('rejects terminal orders (cancelled, rejected, refunded, expired, failed) with 409', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method) VALUES ('ord-rejected', 50000, 'rejected', 'unpaid', 'payos')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.post('/create-link', (c) => handleCreateLink(c));

      const res = await app.fetch(
        new Request('https://test.aura/create-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-rejected' }),
        }),
        {
          AURA_DB: db as any,
          PAYOS_CLIENT_ID: 'client_id',
          PAYOS_API_KEY: 'api_key',
          PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
        } as unknown as Env
      );

      expect(res.status).toBe(409);
      const json = await res.json() as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toContain('Cannot pay for rejected order');
    });

    it('selects COALESCE(total, total_amount) when canonical total is NULL and total_amount is present', async () => {
      const fixture = paymentSqliteDB();
      fixture.sqlite.exec('ALTER TABLE orders ADD COLUMN total_amount INTEGER');
      fixture.sqlite.prepare("INSERT INTO orders (id, total, total_amount, status, payment_status, payment_method) VALUES ('ord-legacy-amt', NULL, 75000, 'pending', 'unpaid', 'payos')").run();
      const db = fixture.db;

      const app = new Hono<{ Bindings: Env }>();
      app.post('/create-link', (c) => handleCreateLink(c));

      // Mock PayOS fetch with properly signed response
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (info, init) => {
        const reqBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        return payosCheckoutResponse({ orderCode: reqBody.orderCode ?? 123456, amount: 75000 }, CHECKSUM_KEY, 'plink_legacy');
      });

      const res = await app.fetch(
        new Request('https://test.aura/create-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-legacy-amt' }),
        }),
        {
          AURA_DB: db as any,
          AUTH_KV: createMockKV() as any,
          PAYOS_CLIENT_ID: 'client_id',
          PAYOS_API_KEY: 'api_key',
          PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
          FE_BASE_URL: 'https://auraspace.cafe',
        } as unknown as Env
      );

      expect(res.status).toBe(200);
      const json = await res.json() as { success: boolean; checkoutUrl: string };
      expect(json.success).toBe(true);
      expect(json.checkoutUrl).toBe('https://pay.payos.vn/web/plink_legacy');
    });
  });

  describe('AZ2-F2: settlePayOS & Webhook Terminal Order Isolation', () => {
    it('settlePayOS guards UPDATE orders SET payment_status = "paid" against terminal orders', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method) VALUES ('ord-term-1', 40000, 'cancelled', 'unpaid', 'payos')").run();
      fixture.sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id) VALUES ('pay-term-1', 'ord-term-1', 'payos', 40000, 'pending', '777888')").run();

      const now = new Date().toISOString();
      const res = await settlePayOS(db as any, {
        id: 'pay-term-1',
        order_id: 'ord-term-1',
        status: 'pending',
        amount: 40000,
        method: 'payos',
      }, true, 'completed', now);

      expect(res.paymentChanged).toBe(true);
      expect(res.orderChanged).toBe(false);

      const paymentRow = fixture.sqlite.prepare("SELECT status FROM payments WHERE id = 'pay-term-1'").get() as { status: string };
      const orderRow = fixture.sqlite.prepare("SELECT status, payment_status FROM orders WHERE id = 'ord-term-1'").get() as { status: string; payment_status: string };
      expect(paymentRow.status).toBe('completed');
      expect(orderRow.status).toBe('cancelled');
      expect(orderRow.payment_status).toBe('unpaid');
    });

    it('handlePayosWebhook appends [PAID_ON_CANCELLED_ORDER_REQUIRES_REVIEW] to notes and suppresses notifications on terminal orders', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      const kv = createMockKV();
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method, notes) VALUES ('ord-cancel-wh', 35000, 'cancelled', 'unpaid', 'payos', 'Customer changed mind')").run();
      fixture.sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id) VALUES ('pay-cancel-wh', 'ord-cancel-wh', 'payos', 35000, 'pending', '998877')").run();

      const webhookData = { orderCode: 998877, amount: 35000, code: '00', description: 'Order cancel' };
      const canonical = Object.keys(webhookData).sort().map((k) => `${k}=${webhookData[k as keyof typeof webhookData]}`).join('&');
      const signature = createHmac('sha256', CHECKSUM_KEY).update(canonical).digest('hex');

      const app = new Hono<{ Bindings: Env }>();
      app.post('/webhook/payos', (c) => handlePayosWebhook(c));

      const res = await app.fetch(
        new Request('https://test.aura/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: '00', desc: 'success', success: true, data: webhookData, signature }),
        }),
        {
          AURA_DB: db as any,
          AUTH_KV: kv as any,
          PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
        } as unknown as Env
      );

      expect(res.status).toBe(200);

      const orderRow = fixture.sqlite.prepare("SELECT notes, payment_status, status FROM orders WHERE id = 'ord-cancel-wh'").get() as { notes: string; payment_status: string; status: string };
      expect(orderRow.status).toBe('cancelled');
      expect(orderRow.payment_status).toBe('unpaid');
      expect(orderRow.notes).toContain('[PAID_ON_CANCELLED_ORDER_REQUIRES_REVIEW]');

      const marker = await kv.get('payment:review:pay-cancel-wh');
      expect(marker).toBeTruthy();
      expect(JSON.parse(marker!)).toMatchObject({
        stage: 'cancelled_order_paid',
        errorCode: 'PAID_ON_CANCELLED_ORDER',
      });
    });
  });

  describe('AZ2-F3: PayOS Reconcile Command Determinism', () => {
    it('settles payment row on terminal rejected order without marking order paid and without raising CAS error', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      const kv = createMockKV();
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method) VALUES ('ord-rejected-rec', 60000, 'rejected', 'unpaid', 'payos')").run();
      fixture.sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url) VALUES ('pay-rejected-rec', 'ord-rejected-rec', 'payos', 60000, 'pending', '555444', 'https://pay.payos.vn/web/test-rej')").run();

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        signedPayOSResponse({ id: 'test-rej', orderCode: 555444, amount: 60000, amountPaid: 60000, amountRemaining: 0, status: 'PAID' }, CHECKSUM_KEY)
      );

      const res = await reconcilePayOSPayment({
        db: db as any,
        kv: kv as any,
        paymentId: 'pay-rejected-rec',
        clientId: 'test-client',
        apiKey: 'test-key',
        checksumKey: CHECKSUM_KEY,
        source: 'cron',
      });

      expect(res.ok).toBe(true);
      expect(res.outcome).toBe('settled');

      const paymentRow = fixture.sqlite.prepare("SELECT status FROM payments WHERE id = 'pay-rejected-rec'").get() as { status: string };
      const orderRow = fixture.sqlite.prepare("SELECT status, payment_status, notes FROM orders WHERE id = 'ord-rejected-rec'").get() as { status: string; payment_status: string; notes: string };
      expect(paymentRow.status).toBe('completed');
      expect(orderRow.status).toBe('rejected');
      expect(orderRow.payment_status).toBe('unpaid');
      expect(orderRow.notes).toContain('[PAID_ON_CANCELLED_ORDER_REQUIRES_REVIEW]');
    });
  });

  describe('AZ2-F4: Refunds Mutation Handler Security', () => {
    it('enforces tenant confinement at entry and rejects cross-tenant spoofing with 403', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'cashier-1', role: 'cashier', tenantId: 'store-alpha' } as never);
        await next();
      });
      app.post('/refund', (c) => handleRefund(c));

      const res = await app.fetch(
        new Request('https://test.aura/refund?tenant_id=store-beta', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'store-beta',
          },
          body: JSON.stringify({ paymentId: 'pay-1', amount: 10000, reason: 'Wrong order' }),
        }),
        { AURA_DB: db as any } as unknown as Env
      );

      expect(res.status).toBe(403);
    });

    it('rejects mismatched paymentId and orderId pairs with 400', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method, tenant_id) VALUES ('ord-real', 50000, 'completed', 'paid', 'payos', 'default')").run();
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method, tenant_id) VALUES ('ord-other', 50000, 'completed', 'paid', 'payos', 'default')").run();
      fixture.sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id) VALUES ('pay-real', 'ord-real', 'payos', 50000, 'completed', '12345')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'default' } as never);
        await next();
      });
      app.post('/refund', (c) => handleRefund(c));

      const res = await app.fetch(
        new Request('https://test.aura/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: 'pay-real',
            orderId: 'ord-other',
            amount: 50000,
            reason: 'Wrong charge',
          }),
        }),
        { AURA_DB: db as any } as unknown as Env
      );

      expect(res.status).toBe(400);
      const json = await res.json() as { success: boolean; error: string };
      expect(json.error).toContain('paymentId does not belong to the specified orderId');
    });

    it('orders payment lookup by status paid/completed when searching by orderId', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method, tenant_id) VALUES ('ord-multi-pay', 30000, 'completed', 'paid', 'payos', 'default')").run();
      // An older completed payment and a newer failed attempt
      fixture.sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id, created_at) VALUES ('pay-old-completed', 'ord-multi-pay', 'payos', 30000, 'completed', '111111', '2026-11-01T10:00:00Z')").run();
      fixture.sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id, created_at) VALUES ('pay-new-failed', 'ord-multi-pay', 'payos', 30000, 'failed', '222222', '2026-11-01T11:00:00Z')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'default' } as never);
        await next();
      });
      app.post('/refund', (c) => handleRefund(c));

      const res = await app.fetch(
        new Request('https://test.aura/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: 'ord-multi-pay',
            amount: 30000,
            reason: 'Refund customer',
          }),
        }),
        { AURA_DB: db as any } as unknown as Env
      );

      // The refund handler reaches the PayOS provider check on the completed payment (returns 422 REFUND_PROVIDER_UNAVAILABLE)
      // rather than 400 PAYMENT_NOT_PAID on the failed attempt
      expect(res.status).toBe(422);
      const json = await res.json() as { code: string };
      expect(json.code).toBe('REFUND_PROVIDER_UNAVAILABLE');
    });
  });

  describe('AZ2-F5: NowPayments IPN Validation & Subscription Binding', () => {
    it('rejects mismatched payment_id and order_id invoice references with 400', async () => {
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('WHERE payment_ref = ?')) {
                return {
                  id: 'inv-actual-1',
                  subscription_id: 'sub-1',
                  status: 'pending',
                  amount_vnd: 250000,
                  tenant_id: 'default',
                };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        })),
      };

      const res = await processNowPaymentsIpn(db, {
        payment_id: 'pay-bound-1',
        order_id: 'invoice_inv-spoofed-2',
        payment_status: 'finished',
        price_amount: 250000,
        price_currency: 'vnd',
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.error).toContain('Payment reference and order invoice mismatch');
    });

    it('rejects non-positive invoice amounts with 400', async () => {
      const db = {
        prepare: vi.fn(() => ({
          bind: () => ({
            first: async () => ({
              id: 'inv-free-0',
              subscription_id: 'sub-free',
              status: 'pending',
              amount_vnd: 0,
              tenant_id: 'default',
            }),
            run: async () => ({ meta: { changes: 1 } }),
          }),
        })),
      };

      const res = await processNowPaymentsIpn(db, {
        payment_id: 'pay-free-1',
        order_id: 'invoice_inv-free-0',
        payment_status: 'finished',
        price_amount: 0,
        price_currency: 'vnd',
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.error).toBe('Invalid invoice amount');
    });

    it('rejects subscription tenant mismatch with 400', async () => {
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM subscription_invoices')) {
                return {
                  id: 'inv-store-a',
                  subscription_id: 'sub-store-b',
                  status: 'pending',
                  amount_vnd: 500000,
                  tenant_id: 'store-a',
                };
              }
              if (sql.includes('FROM subscriptions')) {
                return {
                  id: 'sub-store-b',
                  tenant_id: 'store-b',
                };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        })),
      };

      const res = await processNowPaymentsIpn(db, {
        payment_id: 'pay-x-1',
        order_id: 'invoice_inv-store-a',
        payment_status: 'finished',
        price_amount: 500000,
        price_currency: 'vnd',
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.error).toContain('Subscription tenant mismatch');
    });

    it('does not cancel subscription when receiving refunded status for an unpaid invoice', async () => {
      const executedUpdates: string[] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: () => ({
            first: async () => ({
              id: 'inv-unpaid-1',
              subscription_id: 'sub-active-1',
              status: 'pending',
              amount_vnd: 500000,
              payment_ref: 'pay-unpaid-1',
              tenant_id: 'default',
            }),
            run: async () => {
              executedUpdates.push(sql);
              return { meta: { changes: 1 } };
            },
          }),
        })),
      };

      const res = await processNowPaymentsIpn(db, {
        payment_id: 'pay-unpaid-1',
        order_id: 'invoice_inv-unpaid-1',
        payment_status: 'refunded',
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(executedUpdates.some((s) => s.includes("UPDATE subscriptions SET status = 'cancelled'"))).toBe(false);
    });
  });

  describe('AZ2-F6: OpenAPI Payments Mutation Handlers', () => {
    it('rejects payment creation for terminal orders and non-positive amounts with 400', async () => {
      const fixture = paymentSqliteDB();
      const db = fixture.db;
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method) VALUES ('ord-expired-cod', 45000, 'expired', 'unpaid', 'cod')").run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'cashier-1', role: 'cashier', tenantId: 'default' } as never);
        await next();
      });
      app.post('/api/payments', async (c) => {
        const json = await c.req.json();
        (c.req as any).valid = () => json;
        return handleCreatePayment(c);
      });

      // Terminal order
      const termRes = await app.fetch(
        new Request('https://test.aura/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: 'ord-expired-cod', method: 'cod' }),
        }),
        { AURA_DB: db as any } as unknown as Env
      );
      expect(termRes.status).toBe(400);

      // Amount <= 0
      fixture.sqlite.prepare("INSERT INTO orders (id, total, status, payment_status, payment_method) VALUES ('ord-zero-cod', 0, 'pending', 'unpaid', 'cod')").run();
      const zeroRes = await app.fetch(
        new Request('https://test.aura/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: 'ord-zero-cod', method: 'cod' }),
        }),
        { AURA_DB: db as any } as unknown as Env
      );
      expect(zeroRes.status).toBe(400);
    });
  });
});
