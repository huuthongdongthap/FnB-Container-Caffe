// @vitest-environment node
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRefund } from '../../routes/refunds-handlers/mutation-handlers';
import { refundRequestSchema } from '../../routes/refunds-handlers/helpers';
import { manualReconcilePayment } from '../../routes/payment-reconcile-handlers/manual-reconcile';
import {
  hasPaymentReadRole,
  mapPaymentRecord,
  registerPaymentReadHandlers,
} from '../../routes/openapi-payments-handlers/read-handlers';
import {
  claimReconcileJob,
  reconcilePayOSPayment,
} from '../../../../packages/domain/payment/commands/payos-reconcile';
import {
  computeNextAttemptAtMs,
  runPaymentReconciliation,
} from '../../routes/cron-handlers/payment-reconcile';
import { handlePayosWebhook } from '../../routes/webhooks-handlers/payos';
import { paymentSqliteDB, signedPayOSResponse } from '../helpers/payment-sqlite-db';
import { createMockEnv, createMockKV } from '../test-utils';
import type { Env } from '../../types/env';

const CHECKSUM_KEY = 'at1-test-payos-checksum-key';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 47 Slice AT1 — Payment Reconcile, Refund Boundary, OpenAPI Payment Read RBAC & Referral Isolation', () => {
  describe('1. Refund JSON parsing boundary & schema validation', () => {
    it('returns 400 Invalid JSON body instead of 500 reconciliation required on malformed JSON', async () => {
      const sql = paymentSqliteDB();
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'u_owner', role: 'owner', tenantId: 'default' } as never);
        await next();
      });
      app.post('/refund', (c) => handleRefund(c));

      const malformedRes = await app.fetch(
        new Request('https://test.aura/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid json',
        }),
        { ...createMockEnv(), AURA_DB: sql.db } as unknown as Env,
      );
      expect(malformedRes.status).toBe(400);
      const malformedBody = (await malformedRes.json()) as { success: boolean; error: string };
      expect(malformedBody.error).toBe('Invalid JSON body');

      const arrayRes = await app.fetch(
        new Request('https://test.aura/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '[]',
        }),
        { ...createMockEnv(), AURA_DB: sql.db } as unknown as Env,
      );
      expect(arrayRes.status).toBe(400);
      expect(((await arrayRes.json()) as { error: string }).error).toBe('Invalid JSON body');
    });

    it('rejects whitespace-only reason and whitespace-only orderId/paymentId in refundRequestSchema and handleRefund', async () => {
      expect(
        refundRequestSchema.safeParse({
          orderId: 'ord_1',
          amount: 20000,
          reason: '   ',
        }).success,
      ).toBe(false);

      expect(
        refundRequestSchema.safeParse({
          orderId: '   ',
          amount: 20000,
          reason: 'Customer cancelled',
        }).success,
      ).toBe(false);

      expect(
        refundRequestSchema.safeParse({
          paymentId: 'pay_1',
          amount: 20000,
          reason: 'x'.repeat(501),
        }).success,
      ).toBe(false);

      const validParsed = refundRequestSchema.safeParse({
        orderId: '  ord_1  ',
        amount: 20000,
        reason: '  Duplicate charge  ',
      });
      expect(validParsed.success).toBe(true);
      if (validParsed.success) {
        expect(validParsed.data.orderId).toBe('ord_1');
        expect(validParsed.data.reason).toBe('Duplicate charge');
      }

      const sql = paymentSqliteDB();
      sql.order('ORD_1', 'default');
      sql.payment('ORD_1', 'completed');
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'u_owner', role: 'owner', tenantId: 'default' } as never);
        await next();
      });
      app.post('/refund', (c) => handleRefund(c));
      app.post('/openapi-refund', (c) => handleRefund(c, true));

      const wsRes = await app.fetch(
        new Request('https://test.aura/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: 'pay_ORD_1', amount: 20000, reason: '   ' }),
        }),
        { ...createMockEnv(), AURA_DB: sql.db } as unknown as Env,
      );
      expect(wsRes.status).toBe(400);

      const openApiWsRes = await app.fetch(
        new Request('https://test.aura/openapi-refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: 'pay_ORD_1', reason: '   ' }),
        }),
        { ...createMockEnv(), AURA_DB: sql.db } as unknown as Env,
      );
      expect(openApiWsRes.status).toBe(400);
    });
  });

  describe('2. Manual payment reconciliation RBAC, HQ wildcard guard & exponential backoff preservation', () => {
    it('enforces hasFinancialRole internally and blocks non-HQ wildcard tenant spoofing', async () => {
      const sql = paymentSqliteDB();
      sql.order('ORD_B', 'store-b');
      sql.payment('ORD_B', 'pending', '777888');

      const makeApp = (user: Record<string, unknown> | null, explicitTenantId?: string) => {
        const router = new Hono<{ Bindings: Env }>();
        router.use('*', async (c, next) => {
          if (user) c.set('user' as never, user as never);
          if (explicitTenantId) c.set('tenantId' as never, explicitTenantId as never);
          await next();
        });
        router.post('/reconcile/:id', manualReconcilePayment);
        return router;
      };

      const env = {
        ...createMockEnv(),
        AURA_DB: sql.db,
        AUTH_KV: createMockKV(),
        PAYOS_CLIENT_ID: 'cid',
        PAYOS_API_KEY: 'akey',
        PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
      } as unknown as Env;

      // Low-privilege staff roles rejected with 403 even if route middleware is bypassed
      for (const role of ['waiter', 'staff', 'kitchen', 'barista', 'shipper', 'customer']) {
        const res = await makeApp({ id: `u_${role}`, role, tenantId: 'store-b' }).fetch(
          new Request('https://test.aura/reconcile/pay_ORD_B', { method: 'POST' }),
          env,
        );
        expect(res.status).toBe(403);
      }

      // Non-HQ cashier with wildcard tenantId '*' cannot access store-b payment
      const spoofedWildcardRes = await makeApp(
        { id: 'u_cashier', role: 'cashier', tenantId: 'store-a' },
        '*',
      ).fetch(new Request('https://test.aura/reconcile/pay_ORD_B', { method: 'POST' }), env);
      expect(spoofedWildcardRes.status).toBe(404);
    });

    it('increments reconcile_attempts in catch block instead of resetting backoff to attempt 1', async () => {
      let releasedNextAttemptAt = 0;
      const nowMs = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async () => {
              if (sql.includes('reconcile_attempts')) {
                return {
                  id: 'pay_ERR',
                  order_id: 'ORD_ERR',
                  transaction_id: '999111',
                  reconcile_attempts: 3,
                  tenant_id: 'default',
                };
              }
              if (sql.includes('FROM payments p') && sql.includes('JOIN orders o')) {
                // Simulate unexpected DB error inside reconcilePayOSPayment after claim
                throw new Error('D1 transient failure during reconcile');
              }
              if (sql.includes('SELECT attempts FROM payment_reconciliation_jobs')) {
                return null;
              }
              return null;
            },
            run: async () => {
              if (sql.includes('SET lease_owner = NULL')) {
                releasedNextAttemptAt = Number(_args[2]);
              }
              return { success: true, meta: { changes: 1 } };
            },
          }),
        }),
      };

      const router = new Hono<{ Bindings: Env }>();
      router.use('*', async (c, next) => {
        c.set('user' as never, { id: 'u_mgr', role: 'manager', tenantId: 'default' } as never);
        await next();
      });
      router.post('/reconcile/:id', manualReconcilePayment);

      const res = await router.fetch(
        new Request('https://test.aura/reconcile/pay_ERR', { method: 'POST' }),
        {
          ...createMockEnv(),
          AURA_DB: mockDb,
          PAYOS_CLIENT_ID: 'cid',
          PAYOS_API_KEY: 'akey',
          PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
        } as unknown as Env,
      );

      expect(res.status).toBe(502);
      // Prior reconcile_attempts = 3 -> attempt 4 -> 5m * 2^3 = 40m backoff (not 5m for attempt 1)
      const expectedNextMs = computeNextAttemptAtMs('provider_error', 4, nowMs);
      expect(releasedNextAttemptAt).toBe(expectedNextMs);
      expect(releasedNextAttemptAt).toBeGreaterThan(computeNextAttemptAtMs('provider_error', 1, nowMs));
    });
  });

  describe('3. OpenAPI PaymentRoutes.list RBAC, paidAt mapping & ISO date filtering', () => {
    it('blocks non-financial staff roles on PaymentRoutes.list while allowing payment read roles', async () => {
      const sql = paymentSqliteDB();
      const prepareSpy = vi.spyOn(sql.db, 'prepare');
      sql.sqlite.exec(`
        INSERT INTO orders (id, tenant_id, customer_id, total, created_at)
        VALUES ('ORD_P1', 'default', 'cust_1', 35000, '2026-11-03T10:15:00Z');
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, created_at, updated_at)
        VALUES ('PAY_P1', 'ORD_P1', 'payos', 35000, 'paid', '555666', '2026-11-03T10:15:00Z', '2026-11-03T10:16:00Z');
      `);

      const makeOpenApiApp = (user: Record<string, unknown>) => {
        const router = new OpenAPIHono<{ Bindings: Env }>();
        router.use('*', async (c, next) => {
          c.set('user' as never, user as never);
          await next();
        });
        registerPaymentReadHandlers(router);
        return router;
      };

      const env = { ...createMockEnv(), AURA_DB: sql.db } as unknown as Env;

      for (const role of ['kitchen', 'barista', 'chef', 'shipper', 'waiter']) {
        expect(hasPaymentReadRole(role)).toBe(false);
        const res = await makeOpenApiApp({ id: `u_${role}`, role, tenantId: 'default' }).fetch(
          new Request('https://test.aura/api/payments'),
          env,
        );
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ success: false, error: 'Insufficient permissions' });
      }

      for (const role of ['owner', 'manager', 'supervisor', 'admin', 'cashier', 'staff']) {
        expect(hasPaymentReadRole(role)).toBe(true);
        const res = await makeOpenApiApp({ id: `u_${role}`, role, tenantId: 'default' }).fetch(
          new Request('https://test.aura/api/payments?dateFrom=2026-11-03&dateTo=2026-11-03'),
          env,
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          success: boolean;
          data: { payments: Array<{ id: string; paidAt: string | null }>; meta: { total: number } };
        };
        expect(body.data.meta.total).toBe(1);
        expect(body.data.payments[0].id).toBe('PAY_P1');
        expect(body.data.payments[0].paidAt).toBe('2026-11-03T10:16:00Z');
      }

      // Verify SQLite date(?) normalization handles full ISO timestamp bounds without lexicographic exclusion
      const isoDateRow = sql.sqlite
        .prepare(
          `SELECT COUNT(*) AS total FROM payments p
           WHERE date(p.created_at) >= date(?) AND date(p.created_at) <= date(?)`,
        )
        .get('2026-11-03T00:00:00Z', '2026-11-03T23:59:59Z') as { total: number };
      expect(isoDateRow.total).toBe(1);
      expect(
        prepareSpy.mock.calls.some(
          ([querySql]) =>
            querySql.includes('date(p.created_at) >= date(?)') &&
            querySql.includes('date(p.created_at) <= date(?)'),
        ),
      ).toBe(true);
    });

    it('maps paidAt for both completed and paid statuses in mapPaymentRecord', () => {
      const completed = mapPaymentRecord({
        id: 'p1',
        order_id: 'o1',
        amount: 20000,
        method: 'payos',
        status: 'completed',
        updated_at: '2026-11-03T12:00:00Z',
        created_at: '2026-11-03T11:55:00Z',
      });
      expect(completed.paidAt).toBe('2026-11-03T12:00:00Z');

      const paid = mapPaymentRecord({
        id: 'p2',
        order_id: 'o2',
        amount: 20000,
        method: 'payos',
        status: 'paid',
        updated_at: '2026-11-03T12:05:00Z',
        created_at: '2026-11-03T12:00:00Z',
      });
      expect(paid.paidAt).toBe('2026-11-03T12:05:00Z');

      const pending = mapPaymentRecord({
        id: 'p3',
        order_id: 'o3',
        amount: 20000,
        method: 'payos',
        status: 'pending',
        updated_at: '2026-11-03T12:05:00Z',
        created_at: '2026-11-03T12:00:00Z',
      });
      expect(pending.paidAt).toBeNull();
    });
  });

  describe('4. PayOS referral attribution tenant isolation & integer cast lease comparisons', () => {
    it('fails closed on non-default tenants when tenant-scoped customer lookup throws in reconcilePayOSPayment and handlePayosWebhook', async () => {
      const sql = paymentSqliteDB();
      const prepareSpy = vi.spyOn(sql.db, 'prepare');
      // Create legacy customers table WITHOUT tenant_id column so tenant-scoped query throws
      sql.sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          email TEXT,
          phone TEXT,
          name TEXT
        );
        INSERT INTO customers (id, email, phone, name)
        VALUES ('cust_tenant_a', 'shared@aura.vn', '0909123456', 'Tenant A Customer');
      `);

      // Seed non-default tenant order ('cafe-b') with no customer_id but matching phone/email
      sql.sqlite.exec(`
        INSERT INTO orders (id, tenant_id, customer_id, customer_phone, customer_email, total, payment_status, payment_method, status, created_at)
        VALUES ('ORD_B1', 'cafe-b', NULL, '0909123456', 'shared@aura.vn', 50000, 'unpaid', 'payos', 'pending', '2026-11-03T08:00:00Z');
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at)
        VALUES ('pay_ORD_B1', 'ORD_B1', 'payos', 50000, 'pending', '888111', 'https://pay.payos.vn/web/link_b1', '2026-11-03T08:00:00Z', '2026-11-03T08:00:00Z');
      `);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        signedPayOSResponse(
          {
            id: 'link_b1',
            orderCode: 888111,
            amount: 50000,
            amountPaid: 50000,
            amountRemaining: 0,
            status: 'PAID',
          },
          CHECKSUM_KEY,
        ),
      );

      const recRes = await reconcilePayOSPayment({
        db: sql.db,
        kv: createMockKV(),
        paymentId: 'pay_ORD_B1',
        tenantId: 'cafe-b',
        clientId: 'cid',
        apiKey: 'akey',
        checksumKey: CHECKSUM_KEY,
        source: 'manual',
      });
      expect(recRes.outcome).toBe('settled');

      // Also test handlePayosWebhook for another non-default tenant order ('cafe-b')
      sql.sqlite.exec(`
        INSERT INTO orders (id, tenant_id, customer_id, customer_phone, customer_email, total, payment_status, payment_method, status, created_at)
        VALUES ('ORD_B2', 'cafe-b', NULL, '0909123456', 'shared@aura.vn', 50000, 'unpaid', 'payos', 'pending', '2026-11-03T08:05:00Z');
        INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at)
        VALUES ('pay_ORD_B2', 'ORD_B2', 'payos', 50000, 'pending', '888222', 'https://pay.payos.vn/web/link_b2', '2026-11-03T08:05:00Z', '2026-11-03T08:05:00Z');
      `);

      const webhookApp = new Hono<{ Bindings: Env }>();
      webhookApp.post('/webhook/payos', (c) => handlePayosWebhook(c));
      const whData = { orderCode: 888222, amount: 50000, code: '00', description: 'Order B2' };
      const canonical = Object.keys(whData)
        .sort()
        .map((k) => `${k}=${whData[k as keyof typeof whData]}`)
        .join('&');
      const signature = createHmac('sha256', CHECKSUM_KEY).update(canonical).digest('hex');

      const whRes = await webhookApp.fetch(
        new Request('https://test.aura/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: '00', desc: 'success', success: true, data: whData, signature }),
        }),
        {
          ...createMockEnv(),
          AURA_DB: sql.db,
          AUTH_KV: createMockKV(),
          PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
        } as unknown as Env,
      );
      expect(whRes.status).toBe(200);

      // Verify the unscoped customer query was NEVER prepared/executed for non-default tenant 'cafe-b'
      const unscopedCustomerQueries = prepareSpy.mock.calls.filter(
        ([querySql]) =>
          querySql.includes('SELECT id FROM customers') &&
          !querySql.includes('tenant_id'),
      );
      expect(unscopedCustomerQueries).toHaveLength(0);
    });

    it('uses CAST(... AS INTEGER) for lease_until and next_attempt_at so 9-digit epochs compare numerically against 13-digit epochs', async () => {
      const sql = paymentSqliteDB();
      const createdAt = new Date(1_700_000_000_000 - 10 * 60 * 1000).toISOString();
      sql.order('ORD_CAST', 'default');
      sql.payment('ORD_CAST', 'pending', '333444');
      sql.sqlite
        .prepare('UPDATE orders SET payment_status = ?, status = ?, created_at = ? WHERE id = ?')
        .run('unpaid', 'pending', createdAt, 'ORD_CAST');
      sql.sqlite
        .prepare('UPDATE payments SET created_at = ?, updated_at = ?, payment_url = ? WHERE id = ?')
        .run(createdAt, createdAt, 'https://pay.payos.vn/web/link_cast', 'pay_ORD_CAST');

      // Seed 9-digit strings ('999999999') which are lexicographically > '1700000000000' but numerically < 1700000000000
      sql.sqlite
        .prepare(
          `INSERT INTO payment_reconciliation_jobs
           (payment_id, next_attempt_at, lease_until, lease_owner, attempts, updated_at)
           VALUES ('pay_ORD_CAST', '999999999', '999999999', 'stale-worker', 1, '999999999')`,
        )
        .run();

      const nowMs = 1_700_000_000_000;
      const claimed = await claimReconcileJob(sql.db, 'pay_ORD_CAST', 'fresh-worker', nowMs, false);
      expect(claimed).toBe(true);

      // Reset to 9-digit strings and verify cron candidate selection also casts to integer
      sql.sqlite
        .prepare(
          `UPDATE payment_reconciliation_jobs
           SET next_attempt_at = '999999999', lease_until = '999999999', lease_owner = 'stale-worker', last_outcome = 'pending'
           WHERE payment_id = 'pay_ORD_CAST'`,
        )
        .run();

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        signedPayOSResponse(
          {
            id: 'link_cast',
            orderCode: 333444,
            amount: 20000,
            amountPaid: 20000,
            amountRemaining: 0,
            status: 'PAID',
          },
          CHECKSUM_KEY,
        ),
      );

      const cronResult = await runPaymentReconciliation(
        {
          AURA_DB: sql.db,
          AUTH_KV: createMockKV(),
          PAYOS_CLIENT_ID: 'cid',
          PAYOS_API_KEY: 'akey',
          PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
        },
        { nowMs, tenantId: 'default' },
      );
      expect(cronResult.processed).toBe(1);
      expect(cronResult.outcomes['pay_ORD_CAST']).toBe('settled');
    });
  });
});
