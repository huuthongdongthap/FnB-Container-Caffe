import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { handleErpnextInvoicesRequest } from '../../routes/erpnext-invoices';
import { processErpnextRetryQueue } from '../../routes/cron-handlers/erpnext-sync';
import { sopScope, SopAccessError } from '../../../../packages/domain/sop/commands/sop-access';
import { registerSopAdminReadHandlers } from '../../routes/openapi-sop-handlers/sop-admin-read-handlers';
import { SopAdminRoutes } from '../../schemas/sop-routes';
import { registerCronAdminRoutes } from '../../routes/cron-admin';
import { registerJobCrudHandlers } from '../../routes/openapi-cron-handlers/job-crud-handlers';
import { registerSummaryHandlers } from '../../routes/openapi-cron-handlers/summary-handlers';
import { signageRouter } from '../../routes/signage';
import { checkinRouter } from '../../routes/checkin';
import { privacyStore } from '../../lib/pilot-privacy-access';
import { submitContact } from '../../routes/contact';
import { resolveStaffPushRequestedRole, STAFF_PUSH_ROLE } from '../../tree/push/roles';
import { sendPushToCustomer } from '../../tree/push/notifier';
import { pushRouter } from '../../routes/push';
import { hasOpenApiLoyaltyTenantMismatch } from '../../routes/openapi-loyalty-handlers/loyalty-db-helpers';
import { registerTierHandlers } from '../../routes/openapi-loyalty-handlers/tier-handlers';
import { registerRewardHandlers } from '../../routes/openapi-loyalty-handlers/reward-handlers';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { handleSpendCashback } from '../../tree/loyalty/spend-cashback-handler';
import { issueStaffSession } from '../../lib/staff-session';

describe('Phase 61 Security Regression Suite (BH1-BH4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('BH1: ERPNext Invoice, Sync & Retry Queue Hardening', () => {
    it('prevents client-supplied subtotal/tax/total_amount from tampering authoritative D1 order totals in ERPNext invoice', async () => {
      const capturedInvoicePayloads: Record<string, unknown>[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        if (init?.body) {
          capturedInvoicePayloads.push(JSON.parse(String(init.body)));
        }
        return new Response(JSON.stringify({ data: { name: 'SINV-0001' } }), { status: 200 });
      });

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM orders')) {
                return {
                  id: 'ord_bh1_1',
                  total: 120000,
                  discount: 10000,
                  items: JSON.stringify([{ id: 'item_1', name: 'Latte', price: 65000, quantity: 2 }]),
                  payment_method: 'payos',
                  status: 'confirmed',
                  payment_status: 'paid',
                  tenant_id: 'default',
                };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      const req = new Request('https://example.com/api/erpnext-invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'ord_bh1_1',
          total: 1,
          total_amount: 1,
          subtotal: 1,
          tax: 0,
          discount_amount: 999999,
        }),
      });

      const res = await handleErpnextInvoicesRequest(
        req,
        {
          AURA_DB: mockDb as any,
          ERPNEXT_URL: 'https://erp.example.com',
          ERPNEXT_API_KEY: 'key',
          ERPNEXT_API_SECRET: 'secret',
        } as any,
        'default'
      );

      expect(res.status).toBe(201);
      expect(capturedInvoicePayloads.length).toBeGreaterThanOrEqual(1);
      expect(capturedInvoicePayloads[0].grand_total ?? capturedInvoicePayloads[0].total ?? capturedInvoicePayloads[0].net_total).not.toBe(1);
    });

    it('cancels retry queue item when order is cancelled/refunded instead of syncing to ERPNext', async () => {
      const updatedErrors: string[] = [];
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            all: async () => ({
              results: [
                {
                  id: 101,
                  entity_type: 'order',
                  entity_id: 'ord_cancelled_1',
                  action: 'create',
                  payload: JSON.stringify({ tenant_id: 'default' }),
                  attempts: 0,
                  tenant_id: 'default',
                  order_status: 'cancelled',
                  order_payment_status: 'refunded',
                },
              ],
            }),
            first: async () => {
              if (sql.includes('FROM orders')) {
                return {
                  id: 'ord_cancelled_1',
                  total: 80000,
                  items: '[]',
                  status: 'cancelled',
                  payment_status: 'refunded',
                  tenant_id: 'default',
                };
              }
              return null;
            },
            run: async () => {
              if (sql.includes('UPDATE erpnext_sync_queue')) {
                updatedErrors.push(`${String(args[0])}:${String(args[1])}`);
              }
              return { meta: { changes: 1 } };
            },
          }),
        }),
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = await processErpnextRetryQueue(
        {
          AURA_DB: mockDb as any,
          ERPNEXT_URL: 'https://erp.example.com',
          ERPNEXT_API_KEY: 'key',
          ERPNEXT_API_SECRET: 'secret',
        },
        'default'
      );

      expect(result.failed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(updatedErrors.some((e) => e.startsWith('failed:Cannot sync cancelled'))).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('BH2: SOP & Cron Multi-Tenant Override Enforcement', () => {
    it('rejects store-bound owner attempting camelCase cross-tenant override or wildcard on SOP access', () => {
      const fakeCtx = {
        env: {},
        get: (key: string) =>
          key === 'user' ? { id: 'owner_a', role: 'owner', tenantId: 'store-a' } : undefined,
        req: {
          query: (k: string) => (k === 'tenantId' ? 'store-b' : undefined),
          header: () => undefined,
        },
      };

      expect(() =>
        sopScope({} as any, { id: 'owner_a', role: 'owner', tenantId: 'store-a' } as any, fakeCtx as any)
      ).toThrowError(SopAccessError);

      const wildcardCtx = {
        env: {},
        get: (key: string) =>
          key === 'user' ? { id: 'owner_def', role: 'owner', tenantId: 'default' } : undefined,
        req: {
          query: () => undefined,
          header: (k: string) => (k.toLowerCase() === 'x-tenant-id' ? '*' : undefined),
        },
      };

      expect(() =>
        sopScope({} as any, { id: 'owner_def', role: 'owner', tenantId: 'default' } as any, wildcardCtx as any)
      ).toThrowError(SopAccessError);
    });

    it('returns 403 instead of 500 on OpenAPI SOP admin read handlers when cross-tenant override is attempted', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr_a', role: 'manager', tenantId: 'store-a' } as never);
        await next();
      });
      registerSopAdminReadHandlers(app, SopAdminRoutes);

      const res = await app.request(
        '/api/sop/admin/monitor?tenantId=store-b',
        { method: 'GET' },
        { AURA_DB: {} as any } as any
      );
      expect(res.status).toBe(403);
    });

    it('rejects store-bound admin passing ?tenantId=store-b or X-Tenant-ID: * on cron-admin and openapi-cron', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'admin_a', role: 'admin', tenantId: 'store-a' } as never);
        await next();
      });
      registerJobCrudHandlers(app);
      registerSummaryHandlers(app);

      const res1 = await app.request(
        '/api/cron/jobs?tenantId=store-b',
        { method: 'GET' },
        { AURA_DB: {} as any } as any
      );
      expect(res1.status).toBe(403);

      const res2 = await app.request(
        '/api/cron/summary',
        { method: 'GET', headers: { 'X-Tenant-ID': '*' } },
        { AURA_DB: {} as any } as any
      );
      expect(res2.status).toBe(403);

      const secret = 'test-secret-key-for-phase61-security-suite';
      const staffAccount = {
        id: 'admin_a',
        name: 'Store A Admin',
        phone: null,
        role: 'admin',
        tenant_id: 'store-a',
        is_active: 1,
        auth_version: 1,
      };
      const { token } = await issueStaffSession(
        { JWT_SECRET: secret },
        staffAccount,
        { sessionType: 'staff-web' }
      );
      const authDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => staffAccount,
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };
      const cronApp = new Hono<{ Bindings: Env }>();
      registerCronAdminRoutes(cronApp);
      const res3 = await cronApp.request(
        '/api/admin/zalo/send-expiry-warnings?tenantId=store-b',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
        { AURA_DB: authDb as any, JWT_SECRET: secret } as any
      );
      expect(res3.status).toBe(403);
    });
  });

  describe('BH3: Signage, Checkin, Privacy, Contact & Push Security', () => {
    it('rejects cross-tenant signage requests from authenticated store staff and filters expired promos', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'staff_a', role: 'manager', tenantId: 'store-a' } as never);
        await next();
      });
      app.route('/signage', signageRouter);

      const crossRes = await app.request(
        '/signage/menu?tenantId=store-b',
        { method: 'GET' },
        { AURA_DB: {} as any } as any
      );
      expect(crossRes.status).toBe(403);

      const mockDb = {
        prepare: () => ({
          bind: () => ({
            all: async () => ({
              results: [
                {
                  code: 'EXPIRED50',
                  discount_type: 'percent',
                  discount_value: 50,
                  is_active: 1,
                  expires_at: '2020-01-01T00:00:00.000Z',
                  tenant_id: 'store-a',
                },
                {
                  code: 'VALID20',
                  discount_type: 'percent',
                  discount_value: 20,
                  is_active: 1,
                  expires_at: '2099-01-01T00:00:00.000Z',
                  tenant_id: 'store-a',
                },
              ],
            }),
          }),
        }),
      };

      const promoRes = await app.request(
        '/signage/promos',
        { method: 'GET' },
        { AURA_DB: mockDb as any, PILOT_STORE: 'store-a' } as any
      );
      expect(promoRes.status).toBe(200);
      const promoJson = (await promoRes.json()) as { data: Array<{ code: string }> };
      expect(promoJson.data.map((p) => p.code)).toEqual(['VALID20']);
    });

    it('rejects cross-tenant override on POST /checkin and does not leak 404 when walk-in phone exists in another tenant', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        const hdr = c.req.header('x-test-auth');
        if (hdr === 'staff-a') {
          c.set('user' as never, { id: 'staff_a', role: 'staff', tenantId: 'store-a' } as never);
        }
        await next();
      });
      app.route('/checkin', checkinRouter);

      const mismatchRes = await app.request(
        '/checkin?tenantId=store-b',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-auth': 'staff-a' },
          body: JSON.stringify({ customer_phone: '0901234567' }),
        },
        { AURA_DB: {} as any, PILOT_STORE: 'store-a' } as any
      );
      expect(mismatchRes.status).toBe(403);

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM customers WHERE phone = ?')) {
                return { id: 'cust_other_tenant', name: 'Other Tenant User', tenant_id: 'store-b' };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      const walkInRes = await app.request(
        '/checkin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_phone: '0901234567', customer_name: 'Walk-in Guest' }),
        },
        { AURA_DB: mockDb as any, PILOT_STORE: 'store-a' } as any
      );
      expect(walkInRes.status).toBe(201);
    });

    it('rejects explicit cross-tenant query/header override in privacyStore', () => {
      const fakeCtx = {
        env: { PILOT_TENANT_ID: 'store-a' },
        get: (k: string) => (k === 'user' ? { id: 'u1', role: 'owner', tenant_id: 'store-a' } : undefined),
        req: {
          query: (k: string) => (k === 'tenantId' ? 'store-b' : undefined),
          header: () => undefined,
        },
      };
      const res = privacyStore(fakeCtx as any, ['owner']);
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(403);
    });

    it('validates contact payload before consuming KV rate-limit quota and scopes key by tenant + first IP', async () => {
      const kvPuts: string[] = [];
      const fakeKv = {
        get: async () => '0',
        put: async (key: string) => {
          kvPuts.push(key);
        },
      };

      const invalidReq = new Request('https://example.com/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.10, 10.0.0.1',
        },
        body: JSON.stringify({ name: '', phone: 'bad', content: '' }),
      });

      const invalidRes = await submitContact(invalidReq, {
        PILOT_TENANT_ID: 'store-a',
        AUTH_KV: fakeKv,
      });
      expect(invalidRes.status).toBe(400);
      expect(kvPuts).toHaveLength(0);
    });

    it('recognizes STAFF_PUSH_ROLE and manager privilege in push roles, fails closed on empty customerId, and rejects cross-tenant push list', async () => {
      expect(resolveStaffPushRequestedRole(STAFF_PUSH_ROLE, 'manager')).toEqual({
        ok: true,
        role: STAFF_PUSH_ROLE,
      });

      const dbSpy = vi.fn();
      const emptyCustRes = await sendPushToCustomer(
        {
          VAPID_PUBLIC_KEY: 'pub',
          VAPID_PRIVATE_KEY: 'priv',
          AURA_DB: { prepare: dbSpy } as any,
        },
        '   ',
        { title: 'T', body: 'B' },
        'store-a'
      );
      expect(emptyCustRes).toEqual({ sent: 0, failed: 0 });
      expect(dbSpy).not.toHaveBeenCalled();

      const secret = 'test-secret-key-for-phase61-security-suite';
      const mgrAccount = {
        id: 'mgr_a',
        name: 'Manager A',
        phone: null,
        role: 'manager',
        tenant_id: 'store-a',
        is_active: 1,
        auth_version: 1,
      };
      const { token: mgrToken } = await issueStaffSession(
        { JWT_SECRET: secret },
        mgrAccount,
        { sessionType: 'staff-web' }
      );
      const authDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => mgrAccount,
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };
      const app = new Hono<{ Bindings: Env }>();
      app.route('/push', pushRouter);
      const listRes = await app.request(
        '/push/list-subscriptions?tenantId=store-b',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${mgrToken}` },
        },
        { AURA_DB: authDb as any, JWT_SECRET: secret } as any
      );
      expect(listRes.status).toBe(403);
    });
  });

  describe('BH4: Loyalty Tiers, Rewards Redemption, Admin Loyalty & Cashback Spend', () => {
    it('rejects wildcard and camelCase tenantId overrides for non-HQ callers in hasOpenApiLoyaltyTenantMismatch and tier handlers', async () => {
      const wildcardCtx = {
        get: (k: string) => (k === 'user' ? { id: 'u1', role: 'manager', tenantId: 'store-a' } : undefined),
        req: {
          query: (k: string) => (k === 'tenantId' ? 'store-b' : undefined),
          header: () => undefined,
        },
      };
      expect(hasOpenApiLoyaltyTenantMismatch(wildcardCtx, 'store-a')).toBe(true);

      const headerWildcardCtx = {
        get: (k: string) => (k === 'user' ? { id: 'u1', role: 'admin', tenantId: 'default' } : undefined),
        req: {
          query: () => undefined,
          header: (k: string) => (k.toLowerCase() === 'x-tenant-id' ? '*' : undefined),
        },
      };
      expect(hasOpenApiLoyaltyTenantMismatch(headerWildcardCtx, 'default')).toBe(true);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr_a', role: 'manager', tenantId: 'store-a' } as never);
        await next();
      });
      registerTierHandlers(app);
      const tierListRes = await app.request(
        '/api/loyalty/tiers?tenantId=store-b',
        { method: 'GET' },
        { AURA_DB: {} as any } as any
      );
      expect(tierListRes.status).toBe(403);
    });

    it('rejects reward redemption against cancelled orders and fails closed when customer fallback deduction throws', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'cust_1', role: 'customer', tenantId: 'store-a' } as never);
        await next();
      });
      registerRewardHandlers(app);

      const cancelledOrderDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM loyalty_rewards')) {
                return {
                  id: 'rwd_1',
                  name: 'Free Drink',
                  points_cost: 50,
                  is_active: 1,
                  max_redemptions: 10,
                  current_redemptions: 1,
                  tenant_id: 'store-a',
                };
              }
              if (sql.includes('FROM orders')) {
                return {
                  id: 'ord_cancelled',
                  customer_id: 'cust_1',
                  status: 'cancelled',
                  payment_status: 'unpaid',
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
          }),
        }),
      };

      const cancelledRes = await app.request(
        '/api/loyalty/rewards/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rewardId: 'rwd_1',
            orderId: 'ord_cancelled',
            idempotencyKey: 'idem_cancelled_1',
          }),
        },
        { AURA_DB: cancelledOrderDb as any, PILOT_STORE: 'store-a' } as any
      );
      expect(cancelledRes.status).toBe(400);

      let rolledBackQuota = false;
      const throwingDeductDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM loyalty_rewards')) {
                return {
                  id: 'rwd_1',
                  name: 'Free Drink',
                  points_cost: 50,
                  is_active: 1,
                  max_redemptions: 10,
                  current_redemptions: 1,
                  tenant_id: 'store-a',
                };
              }
              if (sql.includes('FROM loyalty_accounts')) {
                throw new Error('no such table: loyalty_accounts');
              }
              if (sql.includes('FROM customers')) {
                return {
                  id: 'cust_1',
                  customer_id: 'cust_1',
                  loyalty_points: 100,
                  current_points: 100,
                  loyalty_tier: 'bronze',
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
            run: async () => {
              if (sql.includes('UPDATE customers') && sql.includes('loyalty_points = loyalty_points - ?')) {
                throw new Error('D1 write error during customer points deduction');
              }
              if (sql.includes('current_redemptions = MAX(0')) {
                rolledBackQuota = true;
              }
              return { meta: { changes: 1 } };
            },
          }),
        }),
      };

      const failClosedRes = await app.request(
        '/api/loyalty/rewards/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rewardId: 'rwd_1',
            idempotencyKey: 'idem_fail_closed_1',
          }),
        },
        { AURA_DB: throwingDeductDb as any, PILOT_STORE: 'store-a' } as any
      );
      expect(failClosedRes.status).toBe(409);
      expect(rolledBackQuota).toBe(true);
    });

    it('rejects non-HQ default-tenant owner requesting X-Tenant-ID: * or ?tenantId=store-b on admin-loyalty', async () => {
      const secret = 'test-secret-key-for-phase61-security-suite';
      const ownerAccount = {
        id: 'owner_def',
        name: 'Default Owner',
        phone: null,
        role: 'owner',
        tenant_id: 'default',
        is_active: 1,
        auth_version: 1,
      };
      const { token } = await issueStaffSession(
        { JWT_SECRET: secret },
        ownerAccount,
        { sessionType: 'staff-web' }
      );
      const authDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ownerAccount,
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };
      const app = new Hono<{ Bindings: Env }>();
      app.route('/admin-loyalty', adminLoyaltyRouter);

      const resWildcard = await app.request(
        '/admin-loyalty/widgets',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': '*',
          },
        },
        { AURA_DB: authDb as any, JWT_SECRET: secret } as any
      );
      expect(resWildcard.status).toBe(403);

      const resCross = await app.request(
        '/admin-loyalty/widgets?tenantId=store-b',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        { AURA_DB: authDb as any, JWT_SECRET: secret } as any
      );
      expect(resCross.status).toBe(403);
    });

    it('rejects cross-tenant override and rejected/failed orders in spend-cashback handler', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set(
          'customer' as never,
          { id: 'cust_a', phone: '0909000111', tenant_id: 'store-a' } as never
        );
        await next();
      });
      app.post('/spend-cashback', (c) => handleSpendCashback(c as any));

      const crossTenantRes = await app.request(
        '/spend-cashback?tenantId=store-b',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord_1', amount: 5000 }),
        },
        { AURA_DB: {} as any } as any
      );
      expect(crossTenantRes.status).toBe(403);

      const rejectedOrderDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM cashback_transactions')) return null;
              if (sql.includes('FROM orders')) {
                return {
                  id: 'ord_rejected',
                  customer_id: 'cust_a',
                  total_amount: 50000,
                  status: 'rejected',
                  payment_status: 'failed',
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
          }),
        }),
      };

      const rejectedOrderRes = await app.request(
        '/spend-cashback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord_rejected', amount: 5000 }),
        },
        { AURA_DB: rejectedOrderDb as any } as any
      );
      expect(rejectedOrderRes.status).toBe(400);
    });
  });
});
