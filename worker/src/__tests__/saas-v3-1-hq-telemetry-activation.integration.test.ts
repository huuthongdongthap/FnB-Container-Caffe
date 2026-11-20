// @vitest-environment node
/**
 * SaaS v3.1 HQ Telemetry, UTM Attribution, 7-Day Activation Funnel & RBAC Suite
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { buildEnv, createHqToken, createMigratedD1, dummyCtx, seedTenantOrders, signupTenant } from './helpers/saas-v3-1-sqlite-fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SaaS v3.1 — HQ Telemetry, Activation Funnel & Suspend Controls', () => {
  it('tracks UTM attribution, 7-day activation funnel, and HQ suspend/unsuspend round-trip', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const hqToken = await createHqToken(env, sqlite);

    const tenantFb = await signupTenant(env, {
      slug: 'quan-fb-activated',
      shopName: 'Quán Facebook Activated',
      ownerEmail: 'fb@example.com',
      attribution: { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'sadec_cafe_launch', utm_content: 'video_roi' },
    });
    const tenantZalo = await signupTenant(env, {
      slug: 'quan-zalo-idle',
      shopName: 'Quán Zalo Chưa Kích Hoạt',
      ownerEmail: 'zalo@example.com',
      attribution: { utm_source: 'zalo', utm_medium: 'oa', utm_campaign: 'sadec_cafe_launch' },
    });

    seedTenantOrders(sqlite, tenantFb.tenantId, 3, new Date().toISOString(), 'ord_fb');
    const thirtyHoursAgo = new Date(Date.now() - 30 * 3600_000).toISOString();
    sqlite.prepare('UPDATE saas_tenants SET created_at = ? WHERE id = ?').run(thirtyHoursAgo, tenantZalo.tenantId);

    const suspendRes = await app.fetch(
      new Request(`https://auraspace.cafe/api/hq/saas/tenants/${tenantZalo.tenantId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
        body: JSON.stringify({ suspend: true, reason: 'Billing hold' }),
      }),
      env,
      dummyCtx
    );
    expect(suspendRes.status).toBe(200);

    const listSuspRes = await app.fetch(
      new Request(`https://auraspace.cafe/api/hq/saas/tenants?search=${tenantZalo.slug}`, {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      env,
      dummyCtx
    );
    expect(listSuspRes.status).toBe(200);
    const listSuspJson = (await listSuspRes.json()) as {
      data: { tenants: Array<{ id: string; rawStatus: string; lifecycleState: string }> };
    };
    expect(listSuspJson.data.tenants[0]).toMatchObject({ id: tenantZalo.tenantId, rawStatus: 'suspended', lifecycleState: 'readonly' });

    const unsuspendRes = await app.fetch(
      new Request(`https://auraspace.cafe/api/hq/saas/tenants/${tenantZalo.tenantId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
        body: JSON.stringify({ suspend: false, reason: 'Billing cleared' }),
      }),
      env,
      dummyCtx
    );
    expect(unsuspendRes.status).toBe(200);

    const ovRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/overview', { headers: { Authorization: `Bearer ${hqToken}` } }),
      env,
      dummyCtx
    );
    expect(ovRes.status).toBe(200);
    const ovJson = (await ovRes.json()) as {
      data: {
        activationFunnel: { totalMerchants: number; activated7dCount: number; activationRatePercent: number; unactivatedOver24hCount: number };
        utmBreakdown: Array<{ source: string; campaign: string; signups: number; activated7d: number }>;
      };
    };
    expect(ovJson.data.activationFunnel).toMatchObject({
      totalMerchants: 2,
      activated7dCount: 1,
      activationRatePercent: 50,
      unactivatedOver24hCount: 1,
    });
    expect(ovJson.data.utmBreakdown.find((b) => b.source === 'facebook')).toMatchObject({
      source: 'facebook',
      campaign: 'sadec_cafe_launch',
      signups: 1,
      activated7d: 1,
    });

    const filteredRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/tenants?utm_source=facebook&activated=true', {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      env,
      dummyCtx
    );
    expect(filteredRes.status).toBe(200);
    const filteredJson = (await filteredRes.json()) as {
      data: { tenants: Array<{ slug: string; activated7d: boolean; ordersFirst7d: number; usage: { products: number } }> };
    };
    expect(filteredJson.data.tenants).toHaveLength(1);
    expect(filteredJson.data.tenants[0]).toMatchObject({ slug: tenantFb.slug, activated7d: true, ordersFirst7d: 3 });
    expect(filteredJson.data.tenants[0]!.usage.products).toBeGreaterThanOrEqual(5);
  });

  it('excludes orders past 7d, inactive products, and control tenants from funnel metrics and enforces HQ RBAC', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const hqToken = await createHqToken(env, sqlite);
    const tenantLate = await signupTenant(env, { slug: 'quan-late-orders', shopName: 'Quán Late Orders', ownerEmail: 'late@ex.com' });
    const tenantLowStock = await signupTenant(env, { slug: 'quan-low-avail', shopName: 'Quán Low Avail', ownerEmail: 'low@ex.com' });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600_000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600_000).toISOString();
    sqlite.prepare('UPDATE saas_tenants SET created_at = ? WHERE id = ?').run(tenDaysAgo, tenantLate.tenantId);
    seedTenantOrders(sqlite, tenantLate.tenantId, 4, twoDaysAgo, 'ord_late');

    sqlite.prepare('UPDATE saas_tenants SET created_at = ? WHERE id = ?').run(tenDaysAgo, tenantLowStock.tenantId);
    seedTenantOrders(sqlite, tenantLowStock.tenantId, 4, tenDaysAgo, 'ord_low');
    sqlite.prepare('UPDATE products SET is_available = 0 WHERE tenant_id = ?').run(tenantLowStock.tenantId);

    sqlite.exec(`
      INSERT OR IGNORE INTO saas_tenants (id, slug, name, tier, status, created_at) VALUES
        ('default', 'default-flagship', 'Flagship', 'chain', 'active', '${tenDaysAgo}'),
        ('hq', 'hq-platform', 'HQ Control', 'chain', 'active', '${tenDaysAgo}');
    `);

    const ovRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/overview', { headers: { Authorization: `Bearer ${hqToken}` } }),
      env,
      dummyCtx
    );
    expect(ovRes.status).toBe(200);
    const ovJson = (await ovRes.json()) as {
      data: { activationFunnel: { totalMerchants: number; activated7dCount: number; unactivatedOver24hCount: number } };
    };
    expect(ovJson.data.activationFunnel).toMatchObject({ totalMerchants: 2, activated7dCount: 0, unactivatedOver24hCount: 2 });

    const forbiddenRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/overview', { headers: { Authorization: `Bearer ${tenantLate.token}` } }),
      env,
      dummyCtx
    );
    expect(forbiddenRes.status).toBe(403);

    const notFoundRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/tenants/nonexistent-tenant/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
        body: JSON.stringify({ suspend: true }),
      }),
      env,
      dummyCtx
    );
    expect(notFoundRes.status).toBe(404);
  });
});
