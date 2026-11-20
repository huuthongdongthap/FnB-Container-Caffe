// @vitest-environment node
/**
 * SaaS v3.1 HQ Guards, Duration Validation, Pre-Slice Filtering & First-Week Bounds Suite
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { buildEnv, createHqToken, createMigratedD1, dummyCtx, seedTenantOrders, signupTenant } from './helpers/saas-v3-1-sqlite-fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

async function hqPost(env: ReturnType<typeof buildEnv>, token: string, path: string, body: Record<string, unknown>) {
  return app.fetch(
    new Request(`https://auraspace.cafe/api/hq/saas${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
    env,
    dummyCtx
  );
}

describe('SaaS v3.1 — HQ Control-Tenant Guards, Validation & Filter Bounds', () => {
  it('excludes default/hq/* from overview commercial metrics and rejects control-tenant mutations with 403', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const hqToken = await createHqToken(env, sqlite);
    const merchant = await signupTenant(env, { slug: 'quan-commercial', shopName: 'Quán Commercial', ownerEmail: 'com@ex.com' });
    const nowIso = new Date().toISOString();
    const futureIso = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();

    sqlite.exec(`
      INSERT OR REPLACE INTO saas_tenants (id, slug, name, tier, status, current_period_end, created_at) VALUES
        ('default', 'default-flagship', 'Flagship', 'chain', 'active', '${futureIso}', '${nowIso}'),
        ('hq', 'hq-ctrl', 'HQ Control', 'chain', 'active', '${futureIso}', '${nowIso}'),
        ('*', 'wildcard-ctrl', 'Wildcard', 'chain', 'active', '${futureIso}', '${nowIso}');
    `);

    const ovRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/overview', { headers: { Authorization: `Bearer ${hqToken}` } }),
      env,
      dummyCtx
    );
    expect(ovRes.status).toBe(200);
    const ovJson = (await ovRes.json()) as {
      data: { totalTenants: number; activePaid: number; inTrial: number; mrrVnd: number; activationFunnel: { totalMerchants: number } };
    };
    expect(ovJson.data).toMatchObject({ totalTenants: 1, activePaid: 0, inTrial: 1, mrrVnd: 0 });
    expect(ovJson.data.activationFunnel.totalMerchants).toBe(1);

    const listRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/tenants', { headers: { Authorization: `Bearer ${hqToken}` } }),
      env,
      dummyCtx
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { data: { tenants: Array<{ id: string }> } };
    expect(listJson.data.tenants.map((t) => t.id)).toEqual([merchant.tenantId]);

    for (const controlId of ['default', 'hq', 'HQ', '*']) {
      const encoded = encodeURIComponent(controlId);
      expect((await hqPost(env, hqToken, `/tenants/${encoded}/extend-trial`, { days: 7 })).status).toBe(403);
      expect((await hqPost(env, hqToken, `/tenants/${encoded}/override-tier`, { planId: 'pro', durationDays: 30 })).status).toBe(403);
      expect((await hqPost(env, hqToken, `/tenants/${encoded}/suspend`, { suspend: true })).status).toBe(403);
    }
  });

  it('rejects non-finite or <1 numeric durations with 400 and truncates/caps valid values', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const hqToken = await createHqToken(env, sqlite);
    const merchant = await signupTenant(env, { slug: 'quan-duration', shopName: 'Quán Duration', ownerEmail: 'dur@ex.com' });

    for (const badDays of [0, -5, 'NaN', 'abc', null, Number.POSITIVE_INFINITY]) {
      const res = await hqPost(env, hqToken, `/tenants/${merchant.tenantId}/extend-trial`, { days: badDays as unknown as number });
      expect(res.status).toBe(400);
    }
    for (const badDuration of [0, -10, 'NaN', 'xyz', null, Number.POSITIVE_INFINITY]) {
      const res = await hqPost(env, hqToken, `/tenants/${merchant.tenantId}/override-tier`, {
        planId: 'pro',
        status: 'active',
        durationDays: badDuration as unknown as number,
      });
      expect(res.status).toBe(400);
    }
    expect((await hqPost(env, hqToken, `/tenants/${merchant.tenantId}/override-tier`, { planId: 'pro', status: 'bogus', durationDays: 30 })).status).toBe(400);

    const beforeExt = Date.now();
    const extTrunc = await hqPost(env, hqToken, `/tenants/${merchant.tenantId}/extend-trial`, { days: 10.9 });
    expect(extTrunc.status).toBe(200);
    const extTruncJson = (await extTrunc.json()) as { data: { trialEndsAt: string } };
    const extTruncDays = (Date.parse(extTruncJson.data.trialEndsAt) - beforeExt) / (24 * 3600_000);
    expect(extTruncDays).toBeGreaterThan(9.9);
    expect(extTruncDays).toBeLessThan(10.1);

    const extCap = await hqPost(env, hqToken, `/tenants/${merchant.tenantId}/extend-trial`, { days: 999 });
    expect(extCap.status).toBe(200);
    const extCapJson = (await extCap.json()) as { data: { trialEndsAt: string } };
    const extCapDays = (Date.parse(extCapJson.data.trialEndsAt) - beforeExt) / (24 * 3600_000);
    expect(extCapDays).toBeGreaterThan(89.9);
    expect(extCapDays).toBeLessThan(90.1);

    const beforeOvr = Date.now();
    const ovrCap = await hqPost(env, hqToken, `/tenants/${merchant.tenantId}/override-tier`, {
      planId: 'pro',
      status: 'active',
      durationDays: 1000.7,
    });
    expect(ovrCap.status).toBe(200);
    const ovrCapJson = (await ovrCap.json()) as { data: { currentPeriodEnd: string } };
    const ovrCapDays = (Date.parse(ovrCapJson.data.currentPeriodEnd) - beforeOvr) / (24 * 3600_000);
    expect(ovrCapDays).toBeGreaterThan(729.9);
    expect(ovrCapDays).toBeLessThan(730.1);
  });

  it('applies tenant filters before slicing to 200 and bounds first-week orders strictly to BETWEEN 0 AND 7 days', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const hqToken = await createHqToken(env, sqlite);
    const baseMs = Date.parse('2026-11-01T10:00:00.000Z');

    const target = await signupTenant(env, {
      slug: 'quan-oldest-needle',
      shopName: 'Quán Oldest Needle',
      ownerEmail: 'needle@ex.com',
      attribution: { utm_source: 'tiktok', utm_campaign: 'early_bird_2026' },
    });
    const createdIso = new Date(baseMs).toISOString();
    sqlite.prepare('UPDATE saas_tenants SET created_at = ? WHERE id = ?').run(createdIso, target.tenantId);

    // 2 orders before signup (delta < 0) + 2 orders after day 7 (delta > 7) + 2 orders inside [0, 7] => only 2 count (<3, not activated)
    seedTenantOrders(sqlite, target.tenantId, 2, new Date(baseMs - 24 * 3600_000).toISOString(), 'ord_pre');
    seedTenantOrders(sqlite, target.tenantId, 2, new Date(baseMs + 8 * 24 * 3600_000).toISOString(), 'ord_post');
    seedTenantOrders(sqlite, target.tenantId, 2, new Date(baseMs + 3 * 24 * 3600_000).toISOString(), 'ord_in');

    const insertTenant = sqlite.prepare(
      `INSERT INTO saas_tenants (id, slug, name, tier, status, config_json, created_at)
       VALUES (?, ?, ?, 'starter', 'trial', '{}', ?)`
    );
    for (let i = 1; i <= 205; i++) {
      const ts = new Date(baseMs + i * 60_000).toISOString();
      insertTenant.run(`ten_filler_${i}`, `filler-${i}`, `Filler Shop ${i}`, ts);
    }

    const unfilteredRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/tenants', { headers: { Authorization: `Bearer ${hqToken}` } }),
      env,
      dummyCtx
    );
    expect(unfilteredRes.status).toBe(200);
    const unfilteredJson = (await unfilteredRes.json()) as { data: { tenants: Array<{ slug: string }> } };
    expect(unfilteredJson.data.tenants).toHaveLength(200);
    expect(unfilteredJson.data.tenants.some((t) => t.slug === target.slug)).toBe(false);

    const filteredRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/tenants?utm_source=tiktok&utm_campaign=early_bird_2026&activated=false', {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      env,
      dummyCtx
    );
    expect(filteredRes.status).toBe(200);
    const filteredJson = (await filteredRes.json()) as {
      data: { tenants: Array<{ slug: string; ordersFirst7d: number; activated7d: boolean; usage: { orders: number } }> };
    };
    expect(filteredJson.data.tenants).toHaveLength(1);
    expect(filteredJson.data.tenants[0]).toMatchObject({
      slug: target.slug,
      ordersFirst7d: 2,
      activated7d: false,
      usage: { orders: 6 },
    });

    // Adding a 3rd in-window order on day 7 (inclusive) flips activation to true
    seedTenantOrders(sqlite, target.tenantId, 1, new Date(baseMs + 7 * 24 * 3600_000).toISOString(), 'ord_day7');
    const activatedRes = await app.fetch(
      new Request('https://auraspace.cafe/api/hq/saas/tenants?search=needle&activated=true', {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      env,
      dummyCtx
    );
    expect(activatedRes.status).toBe(200);
    const activatedJson = (await activatedRes.json()) as { data: { tenants: Array<{ slug: string; ordersFirst7d: number; activated7d: boolean }> } };
    expect(activatedJson.data.tenants).toHaveLength(1);
    expect(activatedJson.data.tenants[0]).toMatchObject({ slug: target.slug, ordersFirst7d: 3, activated7d: true });
  });
});
