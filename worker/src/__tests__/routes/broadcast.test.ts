import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { broadcastRouter } from '../../routes/broadcast';
import { segmentSQL } from '../../routes/broadcast-handlers/types';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

describe('broadcast smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /send — missing fields returns 400', async() => {
    const app = new Hono();
    app.route('/api/broadcast', broadcastRouter);

    const req = new Request('https://test.aura/api/broadcast/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('POST /send — invalid channel returns 400', async() => {
    const app = new Hono();
    app.route('/api/broadcast', broadcastRouter);

    const req = new Request('https://test.aura/api/broadcast/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment: 'all', channel: 'invalid', message: 'test' })
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('segmentSQL uses case-insensitive LOWER(loyalty_tier) for D1 tier matching', () => {
    expect(segmentSQL('loyalty_bronze').sql).toContain("LOWER(loyalty_tier) = 'bronze'");
    expect(segmentSQL('loyalty_silver').sql).toContain("LOWER(loyalty_tier) = 'silver'");
    expect(segmentSQL('loyalty_gold').sql).toContain("LOWER(loyalty_tier) = 'gold'");
    expect(segmentSQL('loyalty_platinum').sql).toContain("LOWER(loyalty_tier) = 'platinum'");
  });

  it('Phase X1-X4: enforces tenant-scoped inventory depletion run-rate, pilot store fallback in recommendations/pricing/telemetry, TRIM(tenant_id) in broadcast segmentSQL, and tenant filtering in customer menu queries', async () => {
    // 1. X3: segmentSQL normalizes whitespace-padded tenant_id in active_30d and inactive_90d
    const activeSql = segmentSQL('active_30d', 'tenant_sadec_02').sql;
    expect(activeSql).toContain("COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')");
    const inactiveSql = segmentSQL('inactive_90d', 'tenant_sadec_02').sql;
    expect(inactiveSql).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");

    // 2. X1: inventoryForecastingRouter /run-rate filters cross-tenant depletion rows by matchesTenantRow
    const { inventoryForecastingRouter } = await import('../../routes/inventory-forecasting');
    const { issueStaffSession } = await import('../../lib/staff-session');
    const forecastDb: any = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => ({ id: 'USR_MGR', name: 'Mgr', phone: null, role: 'manager', active: 1, is_active: 1, tenant_id: 'tenant_sadec_02', auth_version: 1 }),
          all: async () => {
            if (sql.includes('FROM inventory_items')) {
              return { results: [{ id: 'ITM_1', sku: 'SKU_1', name: 'Coffee Beans', current_stock: 20, min_stock: 5, tenant_id: 'tenant_sadec_02' }] };
            }
            if (sql.includes('FROM inventory_transactions')) {
              return {
                results: [
                  { item_id: 'ITM_1', total_depleted: 14, tenant_id: 'tenant_sadec_02' },
                  { item_id: 'ITM_1', total_depleted: 999, tenant_id: 'default' },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
    };
    const env = { ...createMockEnv(), AURA_DB: forecastDb, PILOT_STORE_ID: 'tenant_sadec_02' };
    const { token: mgrToken } = await issueStaffSession(
      env as any,
      { id: 'USR_MGR', name: 'Mgr', phone: null, role: 'manager', tenant_id: 'tenant_sadec_02', is_active: 1, auth_version: 1 },
      { sessionType: 'staff-web' }
    );
    const runRateRes = await inventoryForecastingRouter.request('https://test.aura/run-rate?days=7', {
      headers: { Authorization: `Bearer ${mgrToken}` },
    }, env as any);
    expect(runRateRes.status).toBe(200);
    const runRateJson = (await runRateRes.json()) as { data: Array<{ daily_run_rate: number }> };
    expect(runRateJson.data[0].daily_run_rate).toBe(2);

    // 3. X2: containerTelemetryRouter resolves PILOT_STORE_ID on unauthenticated heartbeat without explicit tenant_id
    const { containerTelemetryRouter } = await import('../../routes/container-telemetry');
    const capturedHbBinds: unknown[][] = [];
    const hbDb: any = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          capturedHbBinds.push(args);
          return { run: async () => ({ success: true, changes: 1 }) };
        },
      }),
    };
    const hbRes = await containerTelemetryRouter.request('https://test.aura/telemetry/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ container_id: 'CONT_SADEC', ambient_temp_celsius: 26 }),
    }, { AURA_DB: hbDb, PILOT_TENANT_ID: 'tenant_sadec_02' } as any);
    expect(hbRes.status).toBe(200);
    expect(capturedHbBinds[0]).toContain('tenant_sadec_02');

    // 4. X4: getCustomerMenu and getMenu filter out cross-tenant menu_items
    const { getCustomerMenu, getMenu } = await import('@aura/domain-catalog');
    const menuDb: any = {
      prepare: (sql: string) => ({
        bind: () => ({
          all: async () => {
            if (sql.includes('COUNT(*)')) return { results: [{ total: 1 }] };
            if (sql.includes('FROM menu_items')) {
              return {
                results: [
                  { id: 'M_OWN', name: 'Cà Phê Sa Đéc', description: null, price: 35000, category: 'coffee', image_url: null, tags: null, available: 1, tenant_id: 'tenant_sadec_02' },
                  { id: 'M_OTHER', name: 'Cà Phê Default', description: null, price: 30000, category: 'coffee', image_url: null, tags: null, available: 1, tenant_id: 'default' },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
    };
    const custMenu = await getCustomerMenu(menuDb, { tenantId: 'tenant_sadec_02' });
    expect(custMenu.totalItems).toBe(1);
    expect(custMenu.categories[0].items[0].id).toBe('M_OWN');

    const legacyMenuRes = await getMenu(new Request('https://test.aura/api/menu'), { AURA_DB: menuDb, PILOT_TENANT_ID: 'tenant_sadec_02' });
    const legacyMenuJson = (await legacyMenuRes.json()) as { items: Array<{ id: string }> };
    expect(legacyMenuJson.items).toHaveLength(1);
    expect(legacyMenuJson.items[0].id).toBe('M_OWN');
  });
});
