import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { customerAssistantRouter } from '../../routes/customer-assistant';
import { chatRouter } from '../../routes/chat';
import { registerCategoryReadHandlers } from '../../routes/openapi-categories-handlers/read-handlers';
import { registerProductReadHandlers } from '../../routes/openapi-products-handlers/read-handlers';
import { dynamicPricingRouter } from '../../routes/dynamic-pricing';
import { getOrdersMobile, createOrderMobile, getOrderDetail } from '../../routes/orders-mobile';
import { getTablesMobile, updateTableStatus } from '../../routes/tables-mobile';
import { getNotifications, markNotificationRead, subscribePush } from '../../routes/notifications-mobile';
import { loyaltyRouter } from '../../routes/loyalty';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { registerWithVerification } from '../../routes/auth-register';
import { registerUser } from '../../tree/auth/register';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession, type StaffAccount } from '../../lib/staff-session';

const TEST_SECRET = 'phase70-test-jwt-secret-key-32-chars!!';

function makeContext(opts: {
  user?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  tenantId?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  env?: Record<string, unknown>;
  url?: string;
}) {
  const vars = new Map<string, unknown>();
  if (opts.user) vars.set('user', opts.user);
  if (opts.customer) vars.set('customer', opts.customer);
  if (opts.tenantId) vars.set('tenantId', opts.tenantId);

  const queryMap = opts.query ?? {};
  const headerMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    headerMap[k.toLowerCase()] = v;
  }
  const paramMap = opts.params ?? {};

  const qs = new URLSearchParams(queryMap).toString();
  const fullUrl = opts.url ?? `http://localhost/test${qs ? `?${qs}` : ''}`;

  return {
    get: (key: string) => vars.get(key),
    set: (key: string, val: unknown) => vars.set(key, val),
    env: {
      JWT_SECRET: TEST_SECRET,
      AURA_DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        })),
      },
      ...(opts.env ?? {}),
    },
    req: {
      url: fullUrl,
      query: (k?: string) => (k ? queryMap[k] : queryMap),
      header: (k: string) => headerMap[k.toLowerCase()],
      param: (k: string) => paramMap[k],
      json: async () => opts.body ?? {},
      raw: new Request(fullUrl, { headers: opts.headers ?? {} }),
    },
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  } as any;
}

describe('Phase 70 Security Suite (BQ1..BQ4)', () => {
  describe('BQ1 — Customer Assistant & Chat Multi-Source Tenant Override Conflict Rejection', () => {
    it('rejects conflicting tenant_id and store_id overrides on customer-assistant with 403', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.route('/assistant', customerAssistantRouter);

      const res = await app.request(
        'http://localhost/assistant?tenant_id=store-a&store_id=store-b',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'menu hôm nay có gì?' }),
        },
        { AURA_DB: {} } as unknown as Env
      );
      expect(res.status).toBe(403);
    });

    it('rejects conflicting query and header store overrides on chat with 403', async () => {
      const staffAccount: StaffAccount = {
        id: 'staff-a',
        name: 'Staff A',
        phone: null,
        role: 'manager',
        tenant_id: 'store-a',
        is_active: 1,
        auth_version: 1,
      };
      const env = {
        JWT_SECRET: TEST_SECRET,
        PILOT_TENANT_ID: 'store-a',
        AURA_DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(staffAccount),
              all: vi.fn().mockResolvedValue({ results: [] }),
              run: vi.fn().mockResolvedValue({ success: true }),
            })),
          })),
        },
      } as unknown as Env;
      const { token } = await issueStaffSession(
        { JWT_SECRET: TEST_SECRET },
        staffAccount,
        { sessionType: 'staff-web' }
      );

      const app = new Hono<{ Bindings: Env }>();
      app.route('/chat', chatRouter);

      const res = await app.request(
        'http://localhost/chat/conversations?tenant_id=store-a',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Store-ID': 'store-b',
          },
        },
        env
      );
      expect(res.status).toBe(403);
    });
  });

  describe('BQ2 — OpenAPI Catalog Read Handlers & Dynamic Pricing Multi-Source Guard Parity', () => {
    it('rejects FORBIDDEN_TENANT_SENTINEL (hq, wildcard, or conflicting overrides) on openapi-categories read handlers with 403', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      registerCategoryReadHandlers(app);

      const env = {
        AURA_DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
          })),
        },
      } as unknown as Env;

      const listHq = await app.request('http://localhost/api/categories?tenant_id=hq', { method: 'GET' }, env);
      expect(listHq.status).toBe(403);

      const listConflict = await app.request(
        'http://localhost/api/categories?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        env
      );
      expect(listConflict.status).toBe(403);

      const byIdHq = await app.request('http://localhost/api/categories/cat-1?tenant_id=*', { method: 'GET' }, env);
      expect(byIdHq.status).toBe(403);

      const treeConflict = await app.request(
        'http://localhost/api/categories/tree?tenant_id=store-a',
        { method: 'GET', headers: { 'X-Store-ID': 'store-b' } },
        env
      );
      expect(treeConflict.status).toBe(403);
    });

    it('rejects FORBIDDEN_TENANT_SENTINEL (hq, wildcard, or conflicting overrides) on openapi-products read handlers with 403', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      registerProductReadHandlers(app);

      const env = {
        AURA_DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
          })),
        },
      } as unknown as Env;

      const listHq = await app.request('http://localhost/api/products?tenant_id=hq', { method: 'GET' }, env);
      expect(listHq.status).toBe(403);

      const byIdConflict = await app.request(
        'http://localhost/api/products/prod-1?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        env
      );
      expect(byIdConflict.status).toBe(403);

      const bySlugWildcard = await app.request(
        'http://localhost/api/products/slug/espresso?tenant_id=*',
        { method: 'GET' },
        env
      );
      expect(bySlugWildcard.status).toBe(403);
    });

    it('rejects conflicting multi-source tenant overrides on dynamic-pricing with 403', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('tenantId' as never, 'store-a' as never);
        c.set('user' as never, { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } as never);
        await next();
      });
      app.route('/pricing', dynamicPricingRouter);

      const res = await app.request(
        'http://localhost/pricing/active?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        { AURA_DB: {} } as unknown as Env
      );
      expect(res.status).toBe(403);
    });
  });

  describe('BQ3 — Mobile Staff Routes Multi-Source Override Conflict Rejection', () => {
    it('rejects conflicting query/header tenant overrides on orders-mobile with 403', async () => {
      const listRes = await getOrdersMobile(
        makeContext({
          user: { id: 'staff-a', role: 'waiter', tenantId: 'store-a' },
          tenantId: 'store-a',
          query: { tenant_id: 'store-a', store_id: 'store-b' },
        })
      );
      expect(listRes.status).toBe(403);

      const createRes = await createOrderMobile(
        makeContext({
          user: { id: 'staff-a', role: 'waiter', tenantId: 'store-a' },
          tenantId: 'store-a',
          query: { tenant_id: 'store-a' },
          headers: { 'X-Store-ID': 'store-b' },
          body: { table_id: 'tbl-1', items: [{ menu_item_id: 'item-1', quantity: 1 }] },
        })
      );
      expect(createRes.status).toBe(403);

      const detailRes = await getOrderDetail(
        makeContext({
          user: { id: 'hq-1', role: 'owner', tenantId: 'hq' },
          tenantId: '*',
          params: { id: 'ord-1' },
          query: { tenant_id: 'store-a', store_id: 'store-b' },
        })
      );
      expect(detailRes.status).toBe(403);
    });

    it('rejects conflicting query/header tenant overrides on tables-mobile with 403', async () => {
      const listRes = await getTablesMobile(
        makeContext({
          user: { id: 'staff-a', role: 'waiter', tenantId: 'store-a' },
          tenantId: 'store-a',
          query: { tenant_id: 'store-a', store_id: 'store-b' },
        })
      );
      expect(listRes.status).toBe(403);

      const updateRes = await updateTableStatus(
        makeContext({
          user: { id: 'staff-a', role: 'waiter', tenantId: 'store-a' },
          tenantId: 'store-a',
          params: { id: 'tbl-1' },
          query: { tenant_id: 'store-a' },
          headers: { 'X-Store-ID': 'store-b' },
          body: { status: 'occupied' },
        })
      );
      expect(updateRes.status).toBe(403);
    });

    it('rejects conflicting query/store-header overrides on notifications-mobile with 403', async () => {
      const listRes = await getNotifications(
        makeContext({
          user: { id: 'staff-a', role: 'staff', tenantId: 'store-a' },
          tenantId: 'store-a',
          query: { tenant_id: 'store-a', store_id: 'store-b' },
        })
      );
      expect(listRes.status).toBe(403);

      const readRes = await markNotificationRead(
        makeContext({
          user: { id: 'staff-a', role: 'staff', tenantId: 'store-a' },
          tenantId: 'store-a',
          params: { id: 'notif-1' },
          query: { tenant_id: 'store-a' },
          headers: { 'X-Store-ID': 'store-b' },
        })
      );
      expect(readRes.status).toBe(403);

      const subRes = await subscribePush(
        makeContext({
          user: { id: 'hq-1', role: 'owner', tenantId: 'hq' },
          tenantId: 'hq',
          query: { tenant_id: 'store-a', store_id: 'store-b' },
          body: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
            keys: { p256dh: 'key1', auth: 'key2' },
          },
        })
      );
      expect(subRes.status).toBe(403);
    });
  });

  describe('BQ4 — Loyalty Legacy Null Tenant Isolation & Auth Registration Tenant Guardrails', () => {
    it('prevents legacy tenant_id=null point logs and redemptions from leaking into non-default customer tenants', async () => {
      const token = await generateJWT(
        { id: 'cust-b', email: 'custb@example.com', role: 'customer', tenantId: 'store-b' },
        TEST_SECRET
      );

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => {
              if (sql.includes('FROM customers')) {
                return {
                  id: 'cust-b',
                  email: 'custb@example.com',
                  name: 'Cust B',
                  loyalty_points: 100,
                  lifetime_points: 100,
                  loyalty_tier: 'bronze',
                  tenant_id: 'store-b',
                };
              }
              return null;
            }),
            all: vi.fn(async () => {
              if (sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") || sql.includes("COALESCE(NULLIF(TRIM(ur.tenant_id), ''), 'default') = ?")) {
                throw new Error('forced fallback to legacy query');
              }
              if (sql.includes('FROM loyalty_point_logs')) {
                return {
                  results: [
                    { id: 'log-default-null', points_change: 50, tenant_id: null },
                    { id: 'log-store-b', points_change: 25, tenant_id: 'store-b' },
                  ],
                };
              }
              if (sql.includes('FROM user_rewards')) {
                return {
                  results: [
                    { id: 'red-default-null', title: 'Legacy Default', tenant_id: null },
                    { id: 'red-store-b', title: 'Store B Reward', tenant_id: 'store-b' },
                  ],
                };
              }
              return { results: [] };
            }),
          })),
        })),
      };

      const env = { JWT_SECRET: TEST_SECRET, AURA_DB: mockDb } as unknown as Env;

      const pointsRes = await loyaltyRouter.request(
        'http://localhost/points',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(pointsRes.status).toBe(200);
      const pointsBody = (await pointsRes.json()) as { data: Array<{ id: string }> };
      expect(pointsBody.data.map((r) => r.id)).toEqual(['log-store-b']);

      const rewardsRes = await loyaltyRouter.request(
        'http://localhost/my-rewards',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(rewardsRes.status).toBe(200);
      const rewardsBody = (await rewardsRes.json()) as { data: Array<{ id: string }> };
      expect(rewardsBody.data.map((r) => r.id)).toEqual(['red-store-b']);
    });

    it('rejects conflicting overrides and hq/wildcard overrides on /loyalty/active-campaign and /loyalty/tiers with 403', async () => {
      const env = { JWT_SECRET: TEST_SECRET, AURA_DB: {} } as unknown as Env;

      const campaignConflict = await loyaltyRouter.request(
        'http://localhost/active-campaign?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        env
      );
      expect(campaignConflict.status).toBe(403);

      const tiersHq = await loyaltyRouter.request(
        'http://localhost/tiers?tenant_id=hq',
        { method: 'GET' },
        env
      );
      expect(tiersHq.status).toBe(403);

      const tiersConflict = await loyaltyRouter.request(
        'http://localhost/tiers?tenant_id=store-a',
        { method: 'GET', headers: { 'X-Store-ID': 'store-b' } },
        env
      );
      expect(tiersConflict.status).toBe(403);
    });

    it('rejects conflicting multi-source tenant overrides on admin-loyalty even for HQ super-admin', async () => {
      const hqAccount: StaffAccount = {
        id: 'hq-1',
        name: 'HQ Owner',
        phone: null,
        role: 'owner',
        tenant_id: 'hq',
        is_active: 1,
        auth_version: 1,
      };
      const env = {
        JWT_SECRET: TEST_SECRET,
        AURA_DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(hqAccount),
              all: vi.fn().mockResolvedValue({ results: [] }),
              run: vi.fn().mockResolvedValue({ success: true }),
            })),
          })),
        },
      } as unknown as Env;
      const { token: hqToken } = await issueStaffSession(
        { JWT_SECRET: TEST_SECRET },
        hqAccount,
        { sessionType: 'staff-web' }
      );

      const app = new Hono<{ Bindings: Env }>();
      app.route('/admin/loyalty', adminLoyaltyRouter);

      const res = await app.request(
        'http://localhost/admin/loyalty/campaigns?tenant_id=store-a&store_id=store-b',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${hqToken}` },
        },
        env
      );
      expect(res.status).toBe(403);
    });

    it('rejects conflicting or reserved hq/wildcard tenant overrides on auth-register and sanitizes hq in registerUser', async () => {
      const authKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };
      const boundCustomerArgs: unknown[][] = [];
      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: unknown[]) => {
            if (sql.includes('INSERT OR IGNORE INTO customers')) {
              boundCustomerArgs.push(args);
            }
            return {
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }),
        })),
      };

      const conflictReq = new Request('http://localhost/auth/register?tenant_id=store-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-a' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'Password123!',
          name: 'New User',
        }),
      });
      const conflictRes = await registerWithVerification(conflictReq, {
        AUTH_KV: authKV,
        AURA_DB: mockDb,
      });
      expect(conflictRes.status).toBe(403);

      const hqReq = new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'hq' },
        body: JSON.stringify({
          email: 'newuser2@example.com',
          password: 'Password123!',
          name: 'New User 2',
        }),
      });
      const hqRes = await registerWithVerification(hqReq, {
        AUTH_KV: authKV,
        AURA_DB: mockDb,
      });
      expect(hqRes.status).toBe(403);

      const treeReq = new Request('http://localhost/auth/register-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'HQ' },
        body: JSON.stringify({
          email: 'legacy@example.com',
          password: 'Password123!',
          name: 'Legacy User',
        }),
      });
      const treeRes = await registerUser(treeReq, {
        AUTH_KV: authKV,
        AURA_DB: mockDb,
        JWT_SECRET: TEST_SECRET,
      });
      expect(treeRes.status).toBe(201);
      expect(boundCustomerArgs.length).toBeGreaterThan(0);
      expect(boundCustomerArgs[0][4]).toBe('default');
    });
  });
});
