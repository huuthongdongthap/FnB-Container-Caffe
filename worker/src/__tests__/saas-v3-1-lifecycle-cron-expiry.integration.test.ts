// @vitest-environment node
/**
 * SaaS v3.1 Lifecycle Cron Stale Expiry, Retry, Parallel Tick Idempotency & No-Creds Suite
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSaasLifecycleCron } from '../lib/saas-lifecycle-cron';
import { buildEnv, createMigratedD1, seedTenantOrders, signupTenant } from './helpers/saas-v3-1-sqlite-fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

async function seedCronMilestones(env: ReturnType<typeof buildEnv>, sqlite: ReturnType<typeof createMigratedD1>['sqlite'], now: Date) {
  const ms = now.getTime();
  const hoursAgo = (h: number) => new Date(ms - h * 3600_000).toISOString();
  const hoursAhead = (h: number) => new Date(ms + h * 3600_000).toISOString();

  const tNudge = await signupTenant(env, { slug: 'cron-nudge', shopName: 'Cron Nudge', ownerEmail: 'nudge@ex.com' });
  const tD3 = await signupTenant(env, { slug: 'cron-d3', shopName: 'Cron D3', ownerEmail: 'd3@ex.com' });
  const tD1 = await signupTenant(env, { slug: 'cron-d1', shopName: 'Cron D1', ownerEmail: 'd1@ex.com' });
  const tGrace = await signupTenant(env, { slug: 'cron-grace', shopName: 'Cron Grace', ownerEmail: 'grace@ex.com' });

  sqlite.prepare('UPDATE saas_tenants SET created_at = ?, trial_ends_at = ? WHERE id = ?').run(hoursAgo(30), hoursAhead(240), tNudge.tenantId);
  sqlite.prepare('UPDATE tenant_subscriptions SET trial_ends_at = ? WHERE tenant_id = ?').run(hoursAhead(240), tNudge.tenantId);
  sqlite.prepare('UPDATE saas_tenants SET created_at = ?, trial_ends_at = ? WHERE id = ?').run(hoursAgo(240), hoursAhead(60), tD3.tenantId);
  sqlite.prepare('UPDATE tenant_subscriptions SET trial_ends_at = ? WHERE tenant_id = ?').run(hoursAhead(60), tD3.tenantId);
  sqlite.prepare('UPDATE saas_tenants SET created_at = ?, trial_ends_at = ? WHERE id = ?').run(hoursAgo(300), hoursAhead(12), tD1.tenantId);
  sqlite.prepare('UPDATE tenant_subscriptions SET trial_ends_at = ? WHERE tenant_id = ?').run(hoursAhead(12), tD1.tenantId);
  sqlite.prepare("UPDATE saas_tenants SET status = 'active', current_period_end = ? WHERE id = ?").run(hoursAgo(60), tGrace.tenantId);
  sqlite
    .prepare("UPDATE tenant_subscriptions SET status = 'active', current_period_end = ?, grace_ends_at = ? WHERE tenant_id = ?")
    .run(hoursAgo(60), hoursAhead(12), tGrace.tenantId);

  seedTenantOrders(sqlite, tD3.tenantId, 3, hoursAgo(5), 'ord_d3');
  seedTenantOrders(sqlite, tD1.tenantId, 3, hoursAgo(5), 'ord_d1');
  return { tNudge, tD3, tD1, tGrace, hoursAgo };
}

describe('SaaS v3.1 — Lifecycle Cron Expiry, Retry & Concurrency', () => {
  it('expires stale pending invoices/transactions, retries failed Telegram sends, and deduplicates replay ticks', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const now = new Date('2026-11-25T10:00:00.000Z');
    const { tNudge, hoursAgo } = await seedCronMilestones(env, sqlite, now);

    sqlite
      .prepare("INSERT INTO tenant_invoices (id, tenant_id, tier, billing_cycle, amount_vnd, status, created_at) VALUES (?, ?, 'pro', 'monthly', 299000, 'pending', ?)")
      .run('inv_stale', tNudge.tenantId, hoursAgo(30));
    sqlite
      .prepare("INSERT INTO tenant_invoices (id, tenant_id, tier, billing_cycle, amount_vnd, status, created_at) VALUES (?, ?, 'pro', 'monthly', 299000, 'pending', ?)")
      .run('inv_fresh', tNudge.tenantId, hoursAgo(2));
    sqlite
      .prepare("INSERT INTO tenant_invoices (id, tenant_id, tier, billing_cycle, amount_vnd, status, created_at) VALUES (?, ?, 'pro', 'monthly', 299000, 'paid', ?)")
      .run('inv_paid_old', tNudge.tenantId, hoursAgo(48));
    sqlite
      .prepare("INSERT INTO saas_billing_transactions (id, tenant_id, plan_id, billing_cycle, amount_vnd, order_code, status, created_at) VALUES (?, ?, 'pro', 'monthly', 299000, 100001, 'pending', ?)")
      .run('txn_stale', tNudge.tenantId, hoursAgo(24));
    sqlite
      .prepare("INSERT INTO saas_billing_transactions (id, tenant_id, plan_id, billing_cycle, amount_vnd, order_code, status, created_at) VALUES (?, ?, 'pro', 'monthly', 299000, 100002, 'pending', ?)")
      .run('txn_fresh', tNudge.tenantId, hoursAgo(23));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('fail', { status: 502 }));
    const failedRun = await runSaasLifecycleCron(env, now);
    expect(failedRun).toMatchObject({
      expiredInvoices: 1,
      expiredTransactions: 1,
      nudgesSent: 0,
      trialD3Sent: 0,
      trialD1Sent: 0,
      graceD1Sent: 0,
      telegramDispatched: 0,
    });
    const rolledBackCount = (sqlite.prepare("SELECT COUNT(*) AS c FROM saas_audit_logs WHERE actor_user_id = 'system_cron'").get() as { c: number }).c;
    expect(rolledBackCount).toBe(0);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const successRun = await runSaasLifecycleCron(env, now);
    expect(successRun).toMatchObject({
      expiredInvoices: 0,
      expiredTransactions: 0,
      nudgesSent: 1,
      trialD3Sent: 1,
      trialD1Sent: 1,
      graceD1Sent: 1,
      telegramDispatched: 4,
    });

    expect((sqlite.prepare('SELECT status FROM tenant_invoices WHERE id = ?').get('inv_stale') as { status: string }).status).toBe('expired');
    expect((sqlite.prepare('SELECT status FROM tenant_invoices WHERE id = ?').get('inv_fresh') as { status: string }).status).toBe('pending');
    expect((sqlite.prepare('SELECT status FROM tenant_invoices WHERE id = ?').get('inv_paid_old') as { status: string }).status).toBe('paid');
    expect((sqlite.prepare('SELECT status FROM saas_billing_transactions WHERE id = ?').get('txn_stale') as { status: string }).status).toBe('expired');
    expect((sqlite.prepare('SELECT status FROM saas_billing_transactions WHERE id = ?').get('txn_fresh') as { status: string }).status).toBe('pending');

    const replayRun = await runSaasLifecycleCron(env, now);
    expect(replayRun).toMatchObject({ nudgesSent: 0, trialD3Sent: 0, trialD1Sent: 0, graceD1Sent: 0, telegramDispatched: 0 });
  });

  it('deduplicates concurrent Promise.all cron ticks cleanly with a single Telegram dispatch per milestone', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const now = new Date('2026-11-25T10:00:00.000Z');
    await seedCronMilestones(env, sqlite, now);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('api.telegram.org')) throw new Error(`Unexpected external fetch: ${url}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const runs = await Promise.all([runSaasLifecycleCron(env, now), runSaasLifecycleCron(env, now), runSaasLifecycleCron(env, now)]);
    const sum = (k: keyof (typeof runs)[number]) => runs.reduce((acc, r) => acc + r[k], 0);
    expect(sum('nudgesSent')).toBe(1);
    expect(sum('trialD3Sent')).toBe(1);
    expect(sum('trialD1Sent')).toBe(1);
    expect(sum('graceD1Sent')).toBe(1);
    expect(sum('telegramDispatched')).toBe(4);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('does not insert audit claims when Telegram config is missing, then delivers once config is restored and escapes Markdown', async () => {
    const { db, sqlite } = createMigratedD1();
    const noCredEnv = buildEnv(db, { TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' });
    const now = new Date('2026-11-25T10:00:00.000Z');
    const { tNudge } = await seedCronMilestones(noCredEnv, sqlite, now);
    sqlite
      .prepare('UPDATE saas_tenants SET name = ?, owner_name = ? WHERE id = ?')
      .run('Quán *Sao_Mai* [A]\\B`1`', 'Chủ_Quán *VIP* [1]', tNudge.tenantId);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      throw new Error(`Unexpected external fetch without creds: ${String(input)}`);
    });

    const first = await runSaasLifecycleCron(noCredEnv, now);
    expect(first).toMatchObject({ nudgesSent: 0, trialD3Sent: 0, trialD1Sent: 0, graceD1Sent: 0, telegramDispatched: 0 });
    const partialCreds = await runSaasLifecycleCron(buildEnv(db, { TELEGRAM_CHAT_ID: '' }), now);
    expect(partialCreds).toMatchObject({ nudgesSent: 0, trialD3Sent: 0, trialD1Sent: 0, graceD1Sent: 0, telegramDispatched: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();

    const unclaimedCount = (sqlite.prepare("SELECT COUNT(*) AS c FROM saas_audit_logs WHERE actor_user_id = 'system_cron'").get() as { c: number }).c;
    expect(unclaimedCount).toBe(0);

    const sentTexts: string[] = [];
    fetchSpy.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('api.telegram.org')) throw new Error(`Unexpected external fetch: ${url}`);
      const payload = JSON.parse(String(init?.body || '{}')) as { text?: string };
      sentTexts.push(String(payload.text || ''));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const secondWithCreds = await runSaasLifecycleCron(buildEnv(db), now);
    expect(secondWithCreds).toMatchObject({ nudgesSent: 1, trialD3Sent: 1, trialD1Sent: 1, graceD1Sent: 1, telegramDispatched: 4 });
    const claimedCount = (sqlite.prepare("SELECT COUNT(*) AS c FROM saas_audit_logs WHERE actor_user_id = 'system_cron'").get() as { c: number }).c;
    expect(claimedCount).toBe(4);
    const nudgeMsg = sentTexts.find((t) => t.includes('SaaS Nudge 24h')) || '';
    expect(nudgeMsg).toContain('Quán \\*Sao\\_Mai\\* \\[A\\]\\\\B\\`1\\`');
    expect(nudgeMsg).toContain('Chủ\\_Quán \\*VIP\\* \\[1\\]');
  });
});
