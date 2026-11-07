import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { issueStaffSession } from '../../lib/staff-session';
import { handleErpnextRequest } from '../../routes/erpnext';
import { handleErpnextInvoicesRequest } from '../../routes/erpnext-invoices';
import { createErpnextAccountingClientWithKv } from '../../clients/erpnext-accounting-client';
import { createErpnextProductClientWithKv } from '../../clients/erpnext-product-client';
import { registerEventHandlers } from '../../routes/pretix-handlers/event-handlers';
import { registerWebhookHandler } from '../../routes/pretix-handlers/webhook-handler';
import { resolveTemplate } from '../../tree/mixpost/template-resolver';
import { handleMixpostRequest } from '../../tree/mixpost/legacy-handler';
import { isAlreadyEnrolled } from '../../tree/mautic/enrollment-tracker';
import { toMauticContact } from '../../tree/mautic/contact-mapper';
import { getAdminCustomers, updateAdminCustomer, deleteAdminCustomer } from '../../routes/admin-handlers';
import { getPricing } from '../../routes/saas-pricing';
import { recommendationsRouter } from '../../routes/recommendations';
import { inventoryForecastingRouter } from '../../routes/inventory-forecasting';
import { createWifiRoutes } from '../../routes/wifi';
import { loginWifiGuest, authorizeWifiOverride } from '../../tree/wifi/session';
import { staffTipsRouter } from '../../../../packages/domain/staff/commands/staff-tips';
import type { Env } from '../../types/env';

describe('ERPNext/Pretix/Mixpost/Mautic Isolation, Admin/Pricing/Forecasting/WiFi Guards & Staff Tips Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prevents non-default tenant fallback to global ERPNext CRM/Accounting/Product credentials and enforces local customer/invoice ownership', async () => {
    const baseEnv = {
      ERPNEXT_URL: 'https://erp-default.aura.vn',
      ERPNEXT_API_KEY: 'key_default',
      ERPNEXT_API_SECRET: 'sec_default',
      AUTH_KV: {
        get: vi.fn().mockResolvedValue(null),
      } as unknown as KVNamespace,
    };

    const prodClient = await createErpnextProductClientWithKv(baseEnv, 'store-a');
    expect(prodClient).toBeNull();

    const accClient = await createErpnextAccountingClientWithKv(baseEnv, 'store-a');
    expect(accClient).toBeNull();

    const crmFallbackRes = await handleErpnextRequest(
      new Request('https://api.test/api/erpnext/customer/CUS-1'),
      baseEnv as unknown as Env,
      'store-a'
    );
    expect(crmFallbackRes.status).toBe(503);

    const storeAKv = {
      get: vi.fn().mockResolvedValue(
        JSON.stringify({ url: 'https://erp-a.aura.vn', apiKey: 'key_a', apiSecret: 'sec_a' })
      ),
    } as unknown as KVNamespace;

    const crossTenantDb = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM customers')) {
              return { id: String(args[0]), tenant_id: 'store-b' };
            }
            if (sql.includes('FROM orders')) {
              return null;
            }
            return null;
          },
          all: async () => ({ results: [] }),
        }),
      }),
    } as unknown as D1Database;

    const idorGetRes = await handleErpnextRequest(
      new Request('https://api.test/api/erpnext/customer/CUS-B1'),
      { ...baseEnv, AUTH_KV: storeAKv, AURA_DB: crossTenantDb } as unknown as Env,
      'store-a'
    );
    expect(idorGetRes.status).toBe(404);

    const idorTagRes = await handleErpnextRequest(
      new Request('https://api.test/api/erpnext/customer/CUS-B1/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: 'VIP' }),
      }),
      { ...baseEnv, AUTH_KV: storeAKv, AURA_DB: crossTenantDb } as unknown as Env,
      'store-a'
    );
    expect(idorTagRes.status).toBe(404);

    const invIdorRes = await handleErpnextInvoicesRequest(
      new Request('https://api.test/api/erpnext/invoices?customer_id=CUS-B1'),
      { ...baseEnv, AUTH_KV: storeAKv, AURA_DB: crossTenantDb } as unknown as Env,
      'store-a'
    );
    expect(invIdorRes.status).toBe(404);

    const invNonDefaultNoKvRes = await handleErpnextInvoicesRequest(
      new Request('https://api.test/api/erpnext/invoices'),
      {
        ERPNEXT_URL: 'https://erp-default.aura.vn',
        ERPNEXT_API_KEY: 'key_default',
        ERPNEXT_API_SECRET: 'sec_default',
      } as unknown as Env,
      'store-a'
    );
    expect(invNonDefaultNoKvRes.status).toBe(503);
  });

  it('enforces Pretix tenant organizer resolution, action-scoped webhook dedup, Mixpost order status filtering, and Mautic fail-closed enrollment & tier normalization', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ slug: 'coffee-fest', results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const pretixApp = new Hono<{ Bindings: Env }>();
    pretixApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    registerEventHandlers(pretixApp as unknown as Hono);
    registerWebhookHandler(pretixApp as unknown as Hono);

    const pretixEnv = {
      PRETIX_API_URL: 'https://pretix-default.aura.vn',
      PRETIX_API_TOKEN: 'tok_default',
      PRETIX_ORGANIZER: 'org_default',
    } as unknown as Env;

    const evDetailRes = await pretixApp.fetch(
      new Request('https://api.test/events/coffee-fest'),
      pretixEnv
    );
    expect(evDetailRes.status).toBe(200);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('/organizers/store-a/events/coffee-fest/');

    const crossOrgRes = await pretixApp.fetch(
      new Request('https://api.test/orders?organizer=store-b&event=coffee-fest'),
      pretixEnv
    );
    expect(crossOrgRes.status).toBe(403);

    // Action-scoped webhook dedup: order.placed then order.paid with same code both execute
    const webhookLogs: Array<Record<string, unknown>> = [];
    const whDb = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('SELECT code FROM pretix_webhook_log')) {
              const [code, action, organizer, event, tenant] = args;
              return (
                webhookLogs.find(
                  (r) =>
                    r.code === code &&
                    r.action === action &&
                    r.organizer === organizer &&
                    r.event === event &&
                    r.tenant_id === tenant
                ) ?? null
              );
            }
            return null;
          },
          run: async () => {
            if (sql.includes('INSERT INTO pretix_webhook_log')) {
              webhookLogs.push({
                notification_id: args[0],
                organizer: args[1],
                event: args[2],
                code: args[3],
                action: args[4],
                tenant_id: args[6],
              });
            }
            return { success: true };
          },
        }),
      }),
    } as unknown as D1Database;

    const whApp = new Hono<{ Bindings: Env }>();
    registerWebhookHandler(whApp as unknown as Hono);
    const whSecret = 'pretix_wh_secret_32_bytes_phase56!';
    const signPayload = async (payload: string) => {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(whSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(sigBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    };
    const whEnv = {
      ENVIRONMENT: 'development',
      PILOT_TENANT_ID: 'store-a',
      PRETIX_WEBHOOK_SECRET: whSecret,
      AURA_DB: whDb,
    } as unknown as Env;

    const placedBodyStr = JSON.stringify({
      action: 'pretix.event.order.placed',
      organizer: 'store-a',
      event: 'ev',
      code: 'CODE99',
    });
    const placedSig = await signPayload(placedBodyStr);

    const placedRes = await whApp.fetch(
      new Request('https://api.test/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'store-a',
          'X-pretix-Signature': placedSig,
        },
        body: placedBodyStr,
      }),
      whEnv
    );
    expect(placedRes.status).toBe(200);

    const dupPlacedRes = await whApp.fetch(
      new Request('https://api.test/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'store-a',
          'X-pretix-Signature': placedSig,
        },
        body: placedBodyStr,
      }),
      whEnv
    );
    const dupPlacedBody = (await dupPlacedRes.json()) as { duplicate?: boolean };
    expect(dupPlacedBody.duplicate).toBe(true);

    const paidBodyStr = JSON.stringify({
      action: 'pretix.event.order.paid',
      organizer: 'store-a',
      event: 'ev',
      code: 'CODE99',
    });
    const paidSig = await signPayload(paidBodyStr);
    const paidRes = await whApp.fetch(
      new Request('https://api.test/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'store-a',
          'X-pretix-Signature': paidSig,
        },
        body: paidBodyStr,
      }),
      whEnv
    );
    const paidBody = (await paidRes.json()) as { duplicate?: boolean };
    expect(paidBody.duplicate).toBeUndefined();

    // Mixpost template resolver excludes canceled/refunded/failed orders in {{today_orders}}
    const executedMixpostSql: string[] = [];
    const mixpostDb = {
      prepare: (sql: string) => {
        executedMixpostSql.push(sql);
        return {
          bind: () => ({
            all: async () => ({ results: [{ tenant_id: 'store-a' }] }),
          }),
        };
      },
    } as unknown as D1Database;
    const tpl = await resolveTemplate(
      'Today orders: {{today_orders}}',
      { AURA_DB: mixpostDb } as unknown as Env,
      'store-a'
    );
    expect(tpl).toBe('Today orders: 1');
    expect(
      executedMixpostSql.some((s) =>
        s.includes("NOT IN ('cancelled', 'canceled', 'failed', 'rejected', 'expired', 'refunded')")
      )
    ).toBe(true);

    // Mixpost legacy handler blocks cross-tenant header override
    const mixpostCrossRes = await handleMixpostRequest(
      new Request('https://api.test/api/mixpost/accounts', {
        headers: { 'X-Tenant-ID': 'store-b' },
      }),
      {} as unknown as Env,
      'store-a'
    );
    expect(mixpostCrossRes.status).toBe(403);

    // Mautic enrollment tracker fails closed for non-default tenant on DB error
    const throwingEnrollDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            throw new Error('D1 transient timeout');
          },
        }),
      }),
    } as unknown as D1Database;
    const enrolled = await isAlreadyEnrolled(throwingEnrollDb, 'cust_1', 'welcome', 7, 'store-a');
    expect(enrolled).toBe(true);

    // Mautic contact mapper normalizes uppercase loyalty_tier and falls back to tier
    const mappedContact = toMauticContact({
      phone: '0901234567',
      name: 'VIP Guest',
      loyalty_tier: '  GOLD ',
      tenant_id: 'store-a',
    });
    expect(mappedContact.loyalty_tier).toBe('gold');
    expect(mappedContact.email).toBe('store-a+0901234567@aura-cafe.internal');
  });

  it('preserves non-default tenant rows in getAdminCustomers, blocks unscoped admin mutations, and enforces optionalAuth on getPricing', async () => {
    const adminDb = {
      prepare: (sql: string) => ({
        bind: () => ({
          all: async () => ({
            results: [
              {
                id: 'cust-a1',
                name: 'Alice Store A',
                phone: '0901234567',
                email: 'alice@aura.vn',
                loyalty_tier: 'GOLD',
                tier: 'GOLD',
                cashback_balance: 15000,
                total_spent: 500000,
                visit_count: 5,
                tenant_id: 'store-a',
                created_at: '2026-11-04T00:00:00Z',
              },
            ],
          }),
          first: async () => ({ total: 1 }),
          run: async () => {
            if (sql.includes('tenant_id')) throw new Error('no such column: tenant_id');
            return { success: true };
          },
        }),
      }),
    } as unknown as D1Database;

    const listRes = await getAdminCustomers(
      new Request('https://api.test/api/admin/customers'),
      { AURA_DB: adminDb },
      'store-a'
    );
    const listBody = (await listRes.json()) as { customers: Array<{ id: string }> };
    expect(listBody.customers).toHaveLength(1);
    expect(listBody.customers[0].id).toBe('cust-a1');

    await expect(
      updateAdminCustomer(
        new Request('https://api.test/api/admin/customers/cust-a1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        }),
        { AURA_DB: adminDb },
        'cust-a1',
        'store-a'
      )
    ).rejects.toThrow(/tenant_id/);

    await expect(deleteAdminCustomer({ AURA_DB: adminDb }, 'cust-a1', 'store-a')).rejects.toThrow(/tenant_id/);

    // SaaS pricing optionalAuth prevents cross-tenant header spoofing by authenticated staff
    const jwtSecret = 'test_jwt_secret_for_saas_pricing_32_bytes!';
    const session = await issueStaffSession(
      { JWT_SECRET: jwtSecret },
      { id: 'mgr-a', name: 'Manager A', phone: '0900000001', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
      { email: 'mgr-a@aura.vn', sessionType: 'staff-web' }
    );
    const pricingApp = new Hono<{ Bindings: Env }>();
    pricingApp.get('/api/saas/pricing', getPricing);
    const pricingRes = await pricingApp.fetch(
      new Request('https://api.test/api/saas/pricing', {
        headers: {
          Authorization: `Bearer ${session.token}`,
          'X-Tenant-ID': 'store-b',
        },
      }),
      {
        JWT_SECRET: jwtSecret,
        AURA_DB: {
          prepare: (sql: string) => ({
            all: async () => ({
              results: [
                { id: 'p-a', slug: 'pro-a', name_vi: 'Gói A', name_en: 'Plan A', price_vnd: 100000, tenant_id: 'store-a' },
                { id: 'p-b', slug: 'pro-b', name_vi: 'Gói B', name_en: 'Plan B', price_vnd: 200000, tenant_id: 'store-b' },
              ],
            }),
            bind: (t: string) => {
              if (sql.includes('FROM users WHERE id = ?')) {
                return {
                  first: async () => ({
                    id: t,
                    role: 'manager',
                    tenant_id: 'store-a',
                    is_active: 1,
                    auth_version: 1,
                  }),
                };
              }
              return { all: async () => ({ results: [] }) };
            },
          }),
        } as unknown as D1Database,
      } as unknown as Env
    );
    expect(pricingRes.status).toBe(200);
    const pricingBody = (await pricingRes.json()) as { data: Array<{ slug: string }> };
    expect(pricingBody.data).toHaveLength(1);
    expect(pricingBody.data[0].slug).toBe('pro-a');
  });

  it('excludes refunded orders in recommendations, merges stock_movements in forecasting, rate-limits WiFi by IP, and allows initial tip on settled orders', async () => {
    const jwtSecret = 'test_jwt_secret_for_phase56_suite_32_bytes!';
    const mgrSession = await issueStaffSession(
      { JWT_SECRET: jwtSecret },
      { id: 'mgr-a', name: 'Manager A', phone: '0900000001', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
      { email: 'mgr-a@aura.vn', sessionType: 'staff-web' }
    );
    const authHeader = `Bearer ${mgrSession.token}`;

    // 1. Recommendations: block cross-tenant mine-affinities & exclude refunded orders
    const recApp = new Hono<{ Bindings: Env }>();
    recApp.route('/api/recommendations', recommendationsRouter);
    const recDb = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM users WHERE id = ?')) {
              return { id: String(args[0]), role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
            }
            return null;
          },
          all: async () => ({
            results: [
              {
                items: JSON.stringify([{ id: 'p1', name: 'Refunded Drink' }, { id: 'p2', name: 'Refunded Cake' }]),
                status: 'completed',
                payment_status: 'refunded',
                tenant_id: 'store-a',
              },
            ],
          }),
          run: async () => ({ success: true }),
        }),
      }),
      batch: async () => [],
    } as unknown as D1Database;

    const crossMineRes = await recApp.fetch(
      new Request('https://api.test/api/recommendations/mine-affinities', {
        method: 'POST',
        headers: { Authorization: authHeader, 'X-Tenant-ID': 'store-b' },
      }),
      { AURA_DB: recDb, JWT_SECRET: jwtSecret } as unknown as Env
    );
    expect(crossMineRes.status).toBe(403);

    const trendingRes = await recApp.fetch(
      new Request('https://api.test/api/recommendations/trending', {
        headers: { Authorization: authHeader },
      }),
      { AURA_DB: recDb, JWT_SECRET: jwtSecret } as unknown as Env
    );
    expect(trendingRes.status).toBe(200);
    const trendingBody = (await trendingRes.json()) as { data: Array<{ id: string }> };
    expect(trendingBody.data.some((item) => item.id === 'p1')).toBe(false);

    // 2. Inventory forecasting: merges stock_movements for items not in inventory_transactions
    const fcApp = new Hono<{ Bindings: Env }>();
    fcApp.route('/api/inventory', inventoryForecastingRouter);
    const fcDb = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM users WHERE id = ?')) {
              return { id: String(args[0]), role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
            }
            return null;
          },
          all: async () => {
            if (sql.includes('FROM inventory_items')) {
              return {
                results: [
                  { id: 'ing-1', name: 'Coffee Beans', unit: 'g', current_stock: 1000, min_stock: 200, cost_per_unit: 500, category: 'coffee', tenant_id: 'store-a' },
                  { id: 'ing-2', name: 'Fresh Milk', unit: 'ml', current_stock: 500, min_stock: 200, cost_per_unit: 40, category: 'dairy', tenant_id: 'store-a' },
                ],
              };
            }
            if (sql.includes('FROM inventory_transactions')) {
              return { results: [{ item_id: 'ing-1', total_depleted: 700, tenant_id: 'store-a' }] };
            }
            if (sql.includes('FROM stock_movements')) {
              return { results: [{ item_id: 'ing-2', total_depleted: 1400, tenant_id: 'store-a' }] };
            }
            return { results: [] };
          },
        }),
      }),
    } as unknown as D1Database;

    const fcRes = await fcApp.fetch(
      new Request('https://api.test/api/inventory/run-rate?days=7', {
        headers: { Authorization: authHeader },
      }),
      { AURA_DB: fcDb, JWT_SECRET: jwtSecret } as unknown as Env
    );
    expect(fcRes.status).toBe(200);
    const fcBody = (await fcRes.json()) as { data: Array<{ item_id: string; daily_run_rate: number }> };
    const milkForecast = fcBody.data.find((f) => f.item_id === 'ing-2');
    expect(milkForecast?.daily_run_rate).toBe(200);

    // 3. WiFi rate limit across rotating X-Tenant-ID headers and fail-closed non-default session creation
    const rlMap = new Map<string, string>();
    const wifiApp = new Hono<{ Bindings: Env }>();
    wifiApp.route('/api/wifi', createWifiRoutes());
    const wifiEnv = {
      PILOT_TENANT_ID: 'store-a',
      AUTH_KV: {
        get: vi.fn(async (k: string) => rlMap.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => { rlMap.set(k, v); }),
      } as unknown as KVNamespace,
      AURA_DB: {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => null,
            run: async () => {
              if (sql.includes('tenant_id')) throw new Error('no such column: tenant_id');
              return { success: true };
            },
          }),
        }),
      } as unknown as D1Database,
    } as unknown as Env;

    await expect(
      loginWifiGuest({ AURA_DB: wifiEnv.AURA_DB }, { mac: 'AA:BB:CC:DD:EE:FF', phone: '0901234567' }, 'store-a')
    ).rejects.toThrow(/tenant_id/);
    await expect(
      authorizeWifiOverride({ AURA_DB: wifiEnv.AURA_DB }, { mac: 'AA:BB:CC:DD:EE:FF', action: 'grant' }, 'store-a')
    ).rejects.toThrow(/tenant_id/);

    rlMap.set('rl:wifi-login:ip:203.0.113.9', '15');
    const wifiRlRes = await wifiApp.fetch(
      new Request('https://api.test/api/wifi/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'X-Tenant-ID': 'store-z' },
        body: JSON.stringify({ mac: 'AA:BB:CC:DD:EE:FF', phone: '0901234567' }),
      }),
      wifiEnv
    );
    expect(wifiRlRes.status).toBe(429);

    // 4. Staff tips: allow initial tip on settled order (existingTipAmount === 0), block overwriting non-zero settled tip (409), and reject tip when order total <= 0 (400)
    let currentOrder: Record<string, unknown> = {
      id: 'ord-settled-0',
      status: 'completed',
      payment_status: 'paid',
      total: 100000,
      tip_amount: 0,
      tenant_id: 'store-a',
    };
    const tipsApp = new Hono<{ Bindings: Env }>();
    tipsApp.route('/api/staff-tips', staffTipsRouter);
    const tipsEnv = {
      JWT_SECRET: jwtSecret,
      AURA_DB: {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM users WHERE id = ?')) {
                return { id: String(args[0]), name: 'Staff', phone: '0900000001', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
              }
              if (sql.includes('FROM orders WHERE id = ?')) return currentOrder;
              return null;
            },
            run: async () => ({ success: true }),
          }),
        }),
      } as unknown as D1Database,
    } as unknown as Env;

    const initialTipRes = await tipsApp.fetch(
      new Request('https://api.test/api/staff-tips/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ order_id: 'ord-settled-0', staff_id: 'mgr-a', tip_amount: 20000 }),
      }),
      tipsEnv
    );
    expect(initialTipRes.status).toBe(200);

    currentOrder = { ...currentOrder, tip_amount: 20000 };
    const overwriteTipRes = await tipsApp.fetch(
      new Request('https://api.test/api/staff-tips/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ order_id: 'ord-settled-0', staff_id: 'mgr-a', tip_amount: 35000 }),
      }),
      tipsEnv
    );
    expect(overwriteTipRes.status).toBe(409);

    currentOrder = { id: 'ord-zero', status: 'pending', payment_status: 'unpaid', total: 0, tip_amount: 0, tenant_id: 'store-a' };
    const zeroTotalTipRes = await tipsApp.fetch(
      new Request('https://api.test/api/staff-tips/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ order_id: 'ord-zero', staff_id: 'mgr-a', tip_amount: 10000 }),
      }),
      tipsEnv
    );
    expect(zeroTotalTipRes.status).toBe(400);
  });
});
