// @vitest-environment node
/**
 * SaaS v3.1 Lifecycle Cron Extension Rearm, Immunity & Date Boundary Suite
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { runSaasLifecycleCron } from '../lib/saas-lifecycle-cron';
import { buildEnv, createHqToken, createMigratedD1, dummyCtx, seedTenantOrders, signupTenant } from './helpers/saas-v3-1-sqlite-fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

function stubTelegramOk() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('api.telegram.org')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    throw new Error(`Unexpected external fetch: ${url}`);
  });
}

describe('SaaS v3.1 — Lifecycle Extension Rearm, Immunity & Boundaries', () => {
  it('rearms trial D-3 and D-1 dunning after HQ extend-trial while keeping 24h nudge deduplicated', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const hqToken = await createHqToken(env, sqlite);
    stubTelegramOk();

    const t = await signupTenant(env, { slug: 'cron-rearm', shopName: 'Cron Rearm', ownerEmail: 'rearm@ex.com' });
    const t0 = new Date('2026-11-25T10:00:00.000Z');
    const shiftIso = (base: Date, hours: number) => new Date(base.getTime() + hours * 3600_000).toISOString();

    sqlite.prepare('UPDATE saas_tenants SET created_at = ?, trial_ends_at = ? WHERE id = ?').run(shiftIso(t0, -30), shiftIso(t0, 12), t.tenantId);
    sqlite.prepare('UPDATE tenant_subscriptions SET trial_ends_at = ? WHERE tenant_id = ?').run(shiftIso(t0, 12), t.tenantId);

    const beforeExt = await runSaasLifecycleCron(env, t0);
    expect(beforeExt).toMatchObject({ nudgesSent: 1, trialD1Sent: 1, trialD3Sent: 0 });

    const extRes = await app.fetch(
      new Request(`https://auraspace.cafe/api/hq/saas/tenants/${t.tenantId}/extend-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
        body: JSON.stringify({ days: 10, reason: 'Extended for onboarding' }),
      }),
      env,
      dummyCtx
    );
    expect(extRes.status).toBe(200);
    const extJson = (await extRes.json()) as { data: { trialEndsAt: string } };
    const newTrialEnd = new Date(extJson.data.trialEndsAt);

    const d3Tick = await runSaasLifecycleCron(env, new Date(newTrialEnd.getTime() - 60 * 3600_000));
    expect(d3Tick).toMatchObject({ nudgesSent: 0, trialD3Sent: 1, trialD1Sent: 0 });

    const d1Tick = await runSaasLifecycleCron(env, new Date(newTrialEnd.getTime() - 12 * 3600_000));
    expect(d1Tick).toMatchObject({ nudgesSent: 0, trialD3Sent: 0, trialD1Sent: 1 });
  });

  it('enforces immunity for suspended, active, readonly, expired, default, and HQ tenants', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const fetchSpy = stubTelegramOk();
    const now = new Date('2026-11-25T10:00:00.000Z');
    const oldCreated = new Date(now.getTime() - 48 * 3600_000).toISOString();
    const soonTrial = new Date(now.getTime() + 12 * 3600_000).toISOString();
    const futurePeriod = new Date(now.getTime() + 10 * 24 * 3600_000).toISOString();

    for (const [slug, status] of [
      ['immune-susp', 'suspended'],
      ['immune-active', 'active'],
      ['immune-ro', 'readonly'],
      ['immune-exp', 'expired'],
    ] as const) {
      const t = await signupTenant(env, { slug, shopName: slug, ownerEmail: `${slug}@ex.com` });
      const periodEnd = status === 'active' ? futurePeriod : soonTrial;
      sqlite.prepare('UPDATE saas_tenants SET status = ?, created_at = ?, trial_ends_at = ?, current_period_end = ? WHERE id = ?').run(
        status,
        oldCreated,
        soonTrial,
        periodEnd,
        t.tenantId
      );
      sqlite.prepare('UPDATE tenant_subscriptions SET status = ?, trial_ends_at = ?, current_period_end = ? WHERE tenant_id = ?').run(
        status,
        soonTrial,
        periodEnd,
        t.tenantId
      );
    }

    sqlite.exec(`
      INSERT OR IGNORE INTO saas_tenants (id, slug, name, tier, status, created_at, trial_ends_at) VALUES
        ('default', 'default-flagship', 'Default', 'chain', 'trial', '${oldCreated}', '${soonTrial}'),
        ('hq', 'hq-ctrl', 'HQ Lower', 'chain', 'trial', '${oldCreated}', '${soonTrial}'),
        ('HQ', 'hq-upper', 'HQ Upper', 'chain', 'trial', '${oldCreated}', '${soonTrial}');
    `);

    const summary = await runSaasLifecycleCron(env, now);
    expect(summary).toMatchObject({ nudgesSent: 0, trialD3Sent: 0, trialD1Sent: 0, graceD1Sent: 0, telegramDispatched: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('respects inactive product count, 24h nudge boundary, and trial -> grace -> readonly date transitions', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    stubTelegramOk();

    const tBoundary = await signupTenant(env, { slug: 'cron-boundary', shopName: 'Cron Boundary', ownerEmail: 'b@ex.com' });
    const createdAt = new Date('2026-11-10T10:00:00.000Z');
    const trialEnd = new Date('2026-11-24T10:00:00.000Z');
    const graceEnd = new Date('2026-11-27T10:00:00.000Z');

    sqlite.prepare('UPDATE saas_tenants SET created_at = ?, trial_ends_at = ? WHERE id = ?').run(createdAt.toISOString(), trialEnd.toISOString(), tBoundary.tenantId);
    sqlite.prepare('UPDATE tenant_subscriptions SET trial_ends_at = ?, grace_ends_at = ? WHERE tenant_id = ?').run(
      trialEnd.toISOString(),
      graceEnd.toISOString(),
      tBoundary.tenantId
    );
    seedTenantOrders(sqlite, tBoundary.tenantId, 3, createdAt.toISOString(), 'ord_bnd');
    sqlite.prepare('UPDATE products SET is_available = 0 WHERE tenant_id = ?').run(tBoundary.tenantId);

    const before24h = await runSaasLifecycleCron(env, new Date(createdAt.getTime() + 24 * 3600_000 - 60_000));
    expect(before24h.nudgesSent).toBe(0);

    const after24h = await runSaasLifecycleCron(env, new Date(createdAt.getTime() + 24 * 3600_000 + 60_000));
    expect(after24h.nudgesSent).toBe(1);

    const exactD3 = await runSaasLifecycleCron(env, new Date(trialEnd.getTime() - 72 * 3600_000));
    expect(exactD3).toMatchObject({ nudgesSent: 0, trialD3Sent: 1, trialD1Sent: 0 });

    const exactTrialEnd = await runSaasLifecycleCron(env, trialEnd);
    expect(exactTrialEnd).toMatchObject({ trialD1Sent: 1, graceD1Sent: 0 });

    const earlyGrace = await runSaasLifecycleCron(env, new Date(trialEnd.getTime() + 1000));
    expect(earlyGrace).toMatchObject({ trialD1Sent: 0, graceD1Sent: 0 });

    const graceD1 = await runSaasLifecycleCron(env, new Date(graceEnd.getTime() - 12 * 3600_000));
    expect(graceD1).toMatchObject({ trialD1Sent: 0, graceD1Sent: 1 });

    const postGrace = await runSaasLifecycleCron(env, new Date(graceEnd.getTime() + 1000));
    expect(postGrace).toMatchObject({ nudgesSent: 0, trialD3Sent: 0, trialD1Sent: 0, graceD1Sent: 0, telegramDispatched: 0 });
  });
});
