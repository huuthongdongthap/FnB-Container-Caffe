// @vitest-environment node
/**
 * Security & Data Integrity Regression Suite:
 * - SaaS write-guard password-recovery exemptions and multi-source tenant enforcement
 * - SaaS entitlement tenant-status precedence and fail-closed error handling
 * - SaaS commercial branding/domain audit logging and lifecycle cron KV lock deduplication
 * - Floor-plan occupied-table payment guard, session pointer clearing, and table_sessions closure
 * - Customer PII erasure tenant token derivation, customer-account/session/guest-order scrubbing, and KV retry
 * - Mautic & ERPNext outbound marketing consent enforcement and structured log redaction
 * - Audit log immutability triggers in db/schema.sql, trigger migration linting, and trigger resume support
 * - Encrypted D1 backup trap cleanup, HMAC-SHA256 integrity tags, and local encryption enforcement
 * - Legacy logger PII/secret redaction parity and campaign HTML template escaping
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';

import { saasWriteGuard } from '../middleware/saas-write-guard';
import { getTenantEntitlement, assertTenantWritable } from '../lib/saas-entitlement';
import { createSaasCommercialRoutes } from '../routes/saas-commercial';
import { runSaasLifecycleCron } from '../lib/saas-lifecycle-cron';
import { floorPlanRouter } from '../routes/floor-plan';
import { eraseCustomerPii } from '../../../packages/domain/crm/commands/erase-customer-pii';
import { syncMauticContacts } from '../tree/mautic/contact-sync-cron';
import {
  detectWinbackCandidates,
  detectBirthdayCandidates,
} from '../tree/mautic/campaign-detection';
import { syncOrderToERPNext } from '../tree/erpnext/sync.js';
import { redact as legacyRedact, createLogger as createLegacyLogger } from '../utils/logger.js';
import { renderTemplate as renderTreeCampaignTemplate } from '../tree/campaigns/templates';
import {
  winbackTemplate,
  birthdayTemplate,
  promoTemplate,
} from '../lib/campaign-templates';
import {
  inspectMigrationReversibility,
  lintMigrationsDirectory,
} from '../../../scripts/lint-d1-migrations.mjs';
import { generateJWT } from '../lib/jwt';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const JWT_SECRET = 'test-saas-gdpr-consent-hardening-secret-32chars!';

function createSqliteD1(sqlite: DatabaseSync) {
  function makeStmt(sql: string, boundValues: unknown[] = []) {
    return {
      sql,
      boundValues,
      bind(...values: unknown[]) {
        return makeStmt(sql, values);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(boundValues as [string])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>() {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...(boundValues as [string])) as unknown as T[];
        return { results, success: true, meta: { changes: 0 } };
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(boundValues as [string])) as { changes?: number; lastInsertRowid?: number };
        return {
          success: true,
          meta: {
            changes: Number(info?.changes ?? 0),
            last_row_id: Number(info?.lastInsertRowid ?? 0),
          },
        };
      },
    };
  }

  return {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec('SAVEPOINT d1_batch_sp');
      try {
        const out = [];
        for (const stmt of statements) {
          out.push(await stmt.run());
        }
        sqlite.exec('RELEASE SAVEPOINT d1_batch_sp');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK TO SAVEPOINT d1_batch_sp');
        sqlite.exec('RELEASE SAVEPOINT d1_batch_sp');
        throw err;
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
}

function createMemoryKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const putCalls: Array<{ key: string; value: string; options?: Record<string, unknown> }> = [];
  const deleteCalls: string[] = [];
  return {
    store,
    putCalls,
    deleteCalls,
    async get(key: string, type?: string) {
      const val = store.get(key) ?? null;
      if (val !== null && type === 'json') {
        return JSON.parse(val);
      }
      return val;
    },
    async put(key: string, value: string, options?: Record<string, unknown>) {
      putCalls.push({ key, value, options });
      store.set(key, value);
    },
    async delete(key: string) {
      deleteCalls.push(key);
      store.delete(key);
    },
  };
}

async function mintStaffJwt(payload: Record<string, unknown>, secret = JWT_SECRET) {
  const now = Math.floor(Date.now() / 1000);
  return generateJWT(
    {
      sub: String(payload.id || 'user-1'),
      id: String(payload.id || 'user-1'),
      role: String(payload.role || 'owner'),
      tenantId: String(payload.tenantId || 'default'),
      authVersion: 1,
      authTime: now,
      sessionType: 'staff-web',
      ...payload,
    } as never,
    secret,
    3600,
    now,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SaaS Write Guard, Entitlement Precedence, Commercial Audit & Lifecycle Cron Locking', () => {
  it('exempts password recovery endpoints and blocks multi-source tenant write bypasses when any referenced tenant is read-only', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE saas_tenants (
        id TEXT PRIMARY KEY,
        slug TEXT,
        name TEXT,
        tier TEXT NOT NULL DEFAULT 'starter',
        status TEXT NOT NULL DEFAULT 'active',
        trial_ends_at TEXT,
        current_period_end TEXT
      );
      CREATE TABLE tenant_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        billing_cycle TEXT DEFAULT 'monthly',
        status TEXT NOT NULL,
        trial_ends_at TEXT,
        grace_ends_at TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        price_vnd INTEGER DEFAULT 0
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        auth_version INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO saas_tenants (id, slug, name, tier, status, current_period_end) VALUES
        ('tenant_active', 'active-cafe', 'Active Cafe', 'pro', 'active', '2099-01-01T00:00:00Z'),
        ('tenant_expired', 'expired-cafe', 'Expired Cafe', 'starter', 'expired', '2020-01-01T00:00:00Z');
      INSERT INTO tenant_subscriptions (id, tenant_id, tier, status, current_period_end) VALUES
        ('sub_active', 'tenant_active', 'pro', 'active', '2099-01-01T00:00:00Z'),
        ('sub_expired', 'tenant_expired', 'starter', 'expired', '2020-01-01T00:00:00Z');
      INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version) VALUES
        ('u-exp', 'Expired Owner', '0900000001', 'owner', 'tenant_expired', 1, 1);
    `);

    const db = createSqliteD1(sqlite);
    const kv = createMemoryKv();
    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET };

    const app = new Hono();
    app.use('/api/*', saasWriteGuard);
    app.post('/api/auth/forgot-password', (c) => c.json({ ok: true, route: 'forgot-password' }));
    app.post('/api/auth/reset-password', (c) => c.json({ ok: true, route: 'reset-password' }));
    app.post('/api/v1/auth/forgot-password', (c) => c.json({ ok: true, route: 'v1-forgot-password' }));
    app.post('/api/v1/auth/reset-password', (c) => c.json({ ok: true, route: 'v1-reset-password' }));
    app.post('/api/orders', async (c) => {
      const body = await c.req.json().catch(() => ({}));
      return c.json({ ok: true, body });
    });

    // 1. Password recovery paths remain accessible for expired tenants
    for (const recoveryPath of [
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
    ]) {
      const res = await app.request(
        `http://localhost${recoveryPath}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_expired' },
          body: JSON.stringify({ email: 'owner@expired.cafe' }),
        },
        env as never,
      );
      expect(res.status).toBe(200);
    }

    // 2. Spoofing active X-Tenant-ID header while JWT belongs to expired tenant -> 402
    const expiredJwt = await mintStaffJwt({ id: 'u-exp', role: 'owner', tenantId: 'tenant_expired' });
    const jwtMismatchRes = await app.request(
      'http://localhost/api/orders',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expiredJwt}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'tenant_active',
        },
        body: JSON.stringify({ items: [{ id: 'p1', qty: 1 }] }),
      },
      env as never,
    );
    expect(jwtMismatchRes.status).toBe(402);

    // 3. Spoofing active X-Tenant-ID header while JSON body targets expired tenant_id -> 402
    const bodyTargetRes = await app.request(
      'http://localhost/api/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'tenant_active',
        },
        body: JSON.stringify({ tenant_id: 'tenant_expired', items: [] }),
      },
      env as never,
    );
    expect(bodyTargetRes.status).toBe(402);

    // 4. Spoofing active X-Tenant-ID header while query string targets expired store_id -> 402
    const queryTargetRes = await app.request(
      'http://localhost/api/orders?store_id=tenant_expired',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'tenant_active',
        },
        body: JSON.stringify({ items: [] }),
      },
      env as never,
    );
    expect(queryTargetRes.status).toBe(402);

    // 5. Pure active tenant write succeeds and downstream handler can still parse JSON body
    const activeRes = await app.request(
      'http://localhost/api/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'tenant_active',
        },
        body: JSON.stringify({ tenant_id: 'tenant_active', marker: 'parsed-ok' }),
      },
      env as never,
    );
    expect(activeRes.status).toBe(200);
    const activeJson = (await activeRes.json()) as { ok: boolean; body: { marker: string } };
    expect(activeJson.body.marker).toBe('parsed-ok');
  });

  it('enforces saas_tenants status precedence over stale active subscriptions and fails closed on unexpected D1 errors', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE saas_tenants (
        id TEXT PRIMARY KEY,
        slug TEXT,
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        trial_ends_at TEXT,
        current_period_end TEXT
      );
      CREATE TABLE tenant_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        billing_cycle TEXT DEFAULT 'monthly',
        status TEXT NOT NULL,
        trial_ends_at TEXT,
        grace_ends_at TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        price_vnd INTEGER DEFAULT 0
      );
      INSERT INTO saas_tenants (id, slug, tier, status) VALUES
        ('tenant_cancelled_override', 'cancelled-cafe', 'pro', 'cancelled'),
        ('tenant_suspended_override', 'suspended-cafe', 'pro', 'suspended');
      INSERT INTO tenant_subscriptions (id, tenant_id, tier, status, current_period_end) VALUES
        ('sub_1', 'tenant_cancelled_override', 'pro', 'active', '2099-12-31T23:59:59Z'),
        ('sub_2', 'tenant_suspended_override', 'pro', 'active', '2099-12-31T23:59:59Z');
    `);

    const db = createSqliteD1(sqlite);

    const cancelledEnt = await getTenantEntitlement(db as never, 'tenant_cancelled_override');
    expect(cancelledEnt.rawStatus).toBe('cancelled');
    expect(cancelledEnt.lifecycleState).toBe('readonly');
    expect(cancelledEnt.isReadOnly).toBe(true);
    const cancelledCheck = await assertTenantWritable(db as never, 'tenant_cancelled_override');
    expect(cancelledCheck.allowed).toBe(false);
    expect(cancelledCheck.status).toBe(402);

    const suspendedEnt = await getTenantEntitlement(db as never, 'tenant_suspended_override');
    expect(suspendedEnt.rawStatus).toBe('suspended');
    expect(suspendedEnt.lifecycleState).toBe('readonly');
    expect(suspendedEnt.isReadOnly).toBe(true);

    // Unexpected D1 runtime error fails closed to readonly
    const brokenDb = {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                throw new Error('D1_INTERNAL_TIMEOUT: database connection lost');
              },
            };
          },
        };
      },
    };
    const failClosedEnt = await getTenantEntitlement(brokenDb as never, 'tenant_outage');
    expect(failClosedEnt.lifecycleState).toBe('readonly');
    expect(failClosedEnt.isReadOnly).toBe(true);
    expect(failClosedEnt.rawStatus).toBe('readonly');

    // Missing saas_tenants table in legacy single-store schema still falls back to active
    const legacySqlite = new DatabaseSync(':memory:');
    const legacyEnt = await getTenantEntitlement(createSqliteD1(legacySqlite) as never, 'legacy_store');
    expect(legacyEnt.lifecycleState).toBe('active');
    expect(legacyEnt.isReadOnly).toBe(false);
  });

  it('records saas_audit_logs on branding update and domain verification and deduplicates lifecycle cron alerts via AUTH_KV lock', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const now = new Date('2026-11-27T08:00:00.000Z');
    const trialEndsIn2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const trialEndTag = trialEndsIn2Days.slice(0, 10);

    sqlite.exec(`
      CREATE TABLE saas_tenants (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        name TEXT,
        tier TEXT NOT NULL DEFAULT 'pro',
        status TEXT NOT NULL DEFAULT 'trial',
        owner_name TEXT,
        owner_email TEXT,
        owner_phone TEXT,
        trial_ends_at TEXT,
        current_period_end TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE tenant_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'pro',
        billing_cycle TEXT DEFAULT 'monthly',
        status TEXT NOT NULL DEFAULT 'trial',
        trial_ends_at TEXT,
        grace_ends_at TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        price_vnd INTEGER DEFAULT 0
      );
      CREATE TABLE tenant_branding (
        tenant_id TEXT PRIMARY KEY,
        display_name TEXT,
        tagline TEXT,
        logo_url TEXT,
        primary_color TEXT,
        accent_color TEXT,
        address TEXT,
        phone TEXT,
        receipt_footer TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE tenant_domains (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        verification_token TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        verified_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE saas_audit_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        actor_user_id TEXT,
        actor_role TEXT,
        action TEXT NOT NULL,
        after_json TEXT,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        role TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        auth_version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        is_available INTEGER DEFAULT 1
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL
      );

      INSERT INTO saas_tenants (id, slug, name, tier, status, owner_name, owner_email, owner_phone, trial_ends_at, created_at) VALUES
        ('tenant_brand', 'brand-cafe', 'Brand Cafe', 'pro', 'trial', 'Owner Brand', 'owner@brand.cafe', '0901112233', '${trialEndsIn2Days}', '${now.toISOString()}');
      INSERT INTO tenant_subscriptions (id, tenant_id, tier, status, trial_ends_at) VALUES
        ('sub_brand', 'tenant_brand', 'pro', 'trial', '${trialEndsIn2Days}');
      INSERT INTO tenant_domains (id, tenant_id, domain, verification_token, status, created_at) VALUES
        ('dom_1', 'tenant_brand', 'order.brand.cafe', 'aura-verify=tok123', 'pending', '${now.toISOString()}');
      INSERT INTO users (id, name, phone, email, role, tenant_id, is_active, auth_version) VALUES
        ('owner_brand', 'Owner Brand', '0901112233', 'owner@brand.cafe', 'owner', 'tenant_brand', 1, 1);
    `);

    const db = createSqliteD1(sqlite);
    const kv = createMemoryKv();
    const env = {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET,
      TELEGRAM_BOT_TOKEN: 'tg_bot_tok',
      TELEGRAM_CHAT_ID: '-100123456',
    };

    const ownerToken = await mintStaffJwt({ id: 'owner_brand', role: 'owner', tenantId: 'tenant_brand' });
    const app = new Hono();
    app.route('/api/saas', createSaasCommercialRoutes());

    // 1. PATCH /api/saas/branding writes branding_updated to saas_audit_logs
    const brandRes = await app.request(
      'http://localhost/api/saas/branding',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: 'Brand Cafe Roasters',
          primaryColor: '#123456',
          accentColor: '#654321',
        }),
      },
      env as never,
    );
    expect(brandRes.status).toBe(200);

    const brandingAudit = sqlite
      .prepare("SELECT tenant_id, actor_user_id, action, after_json FROM saas_audit_logs WHERE action = 'branding_updated'")
      .get() as Record<string, unknown> | undefined;
    expect(brandingAudit).toBeDefined();
    expect(brandingAudit?.tenant_id).toBe('tenant_brand');
    expect(brandingAudit?.actor_user_id).toBe('owner_brand');
    expect(String(brandingAudit?.after_json)).toContain('Brand Cafe Roasters');

    // 2. POST /api/saas/domains/:id/verify writes domain_verified to saas_audit_logs
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('cloudflare-dns.com/dns-query')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ Answer: [{ data: '"aura-verify=tok123"' }] }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const verifyRes = await app.request(
      'http://localhost/api/saas/domains/dom_1/verify',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
      },
      env as never,
    );
    expect(verifyRes.status).toBe(200);

    const domainAudit = sqlite
      .prepare("SELECT tenant_id, actor_user_id, action, after_json FROM saas_audit_logs WHERE action = 'domain_verified'")
      .get() as Record<string, unknown> | undefined;
    expect(domainAudit).toBeDefined();
    expect(domainAudit?.tenant_id).toBe('tenant_brand');
    expect(domainAudit?.actor_user_id).toBe('owner_brand');
    expect(String(domainAudit?.after_json)).toContain('order.brand.cafe');

    // 3. Lifecycle cron KV lock prevents duplicate Telegram notification when lock already exists
    const expectedAuditId = `saas_trial_d3:tenant_brand:${trialEndTag}`;
    const lockKey = `saas_lifecycle_notify_lock:${expectedAuditId}`;
    fetchMock.mockClear();

    await kv.put(lockKey, now.toISOString(), { expirationTtl: 300 });
    const lockedSweep = await runSaasLifecycleCron(env as never, now);
    expect(lockedSweep.telegramDispatched).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();

    // 4. Release lock and simulate Telegram send failure -> lock is deleted so next cron run can retry
    await kv.delete(lockKey);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'telegram error',
    });
    const failedSendSweep = await runSaasLifecycleCron(env as never, now);
    expect(failedSendSweep.telegramDispatched).toBe(0);
    expect(kv.store.has(lockKey)).toBe(false);

    // 5. Simulate Telegram send success followed by D1 saas_audit_logs insert failure -> lock extended to 86400s
    sqlite.exec(`
      CREATE TRIGGER trg_fail_cron_audit_insert
      BEFORE INSERT ON saas_audit_logs
      WHEN NEW.id = '${expectedAuditId}'
      BEGIN
        SELECT RAISE(ABORT, 'simulated D1 write failure after Telegram send');
      END;
    `);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const dbFailureSweep = await runSaasLifecycleCron(env as never, now);
    expect(dbFailureSweep.telegramDispatched).toBe(0);
    expect(kv.store.has(lockKey)).toBe(true);
    const extendedPut = kv.putCalls.find(
      (call) => call.key === lockKey && call.options?.expirationTtl === 86400,
    );
    expect(extendedPut).toBeDefined();

    // 6. Drop failure trigger and clear lock -> retry succeeds and writes audit row
    sqlite.exec('DROP TRIGGER trg_fail_cron_audit_insert');
    await kv.delete(lockKey);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const okSweep = await runSaasLifecycleCron(env as never, now);
    expect(okSweep.telegramDispatched).toBe(1);
    expect(okSweep.trialD3Sent).toBe(1);
    const notifyAudit = sqlite
      .prepare('SELECT id FROM saas_audit_logs WHERE id = ?')
      .get(expectedAuditId);
    expect(notifyAudit).toBeDefined();
  });
});

describe('Floor-Plan Occupied Table Guard & Session Release Cleanup', () => {
  it('blocks any transition away from occupied while unpaid active orders exist and clears current_session_id + table_sessions on release', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        zone TEXT NOT NULL DEFAULT 'indoor',
        table_number INTEGER NOT NULL DEFAULT 1,
        seats INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'occupied',
        current_order_id TEXT,
        current_session_id TEXT,
        updated_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        table_id TEXT,
        status TEXT NOT NULL,
        payment_status TEXT NOT NULL,
        total INTEGER NOT NULL DEFAULT 50000,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE table_sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        table_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        closed_at TEXT,
        ended_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        auth_version INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO users (id, name, phone, tenant_id, role, is_active, auth_version) VALUES
        ('staff_1', 'Floor Manager', '0908887766', 'store-fp', 'manager', 1, 1);
      INSERT INTO cafe_tables (id, tenant_id, status, current_order_id, current_session_id) VALUES
        ('tbl_1', 'store-fp', 'occupied', 'ord_unpaid', 'sess_active');
      INSERT INTO orders (id, tenant_id, table_id, status, payment_status, total) VALUES
        ('ord_unpaid', 'store-fp', 'tbl_1', 'preparing', 'pending', 85000);
      INSERT INTO table_sessions (id, tenant_id, table_id, status) VALUES
        ('sess_active', 'store-fp', 'tbl_1', 'active');
    `);

    const db = createSqliteD1(sqlite);
    const kv = createMemoryKv();
    const staffToken = await mintStaffJwt({ id: 'staff_1', role: 'manager', tenantId: 'store-fp' });
    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET, PILOT_STORE_ID: 'store-fp' };

    const app = new Hono();
    app.route('/api/floor-plan', floorPlanRouter);

    // 1. Attempt to transition occupied -> reserved, maintenance, inactive, cleaning, or available while unpaid order exists must return 409
    for (const targetStatus of ['reserved', 'maintenance', 'inactive', 'cleaning', 'available']) {
      const blockedRes = await app.request(
        'http://localhost/api/floor-plan/tables/tbl_1/status',
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${staffToken}`,
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'store-fp',
          },
          body: JSON.stringify({ status: targetStatus }),
        },
        env as never,
      );
      expect(blockedRes.status).toBe(409);
    }

    // 2. Mark order paid, then transition occupied -> cleaning: must clear current_order_id, current_session_id, and close table_sessions
    sqlite.prepare("UPDATE orders SET payment_status = 'paid', status = 'completed' WHERE id = 'ord_unpaid'").run();

    const releaseRes = await app.request(
      'http://localhost/api/floor-plan/tables/tbl_1/status',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'store-fp',
        },
        body: JSON.stringify({ status: 'cleaning' }),
      },
      env as never,
    );
    expect(releaseRes.status).toBe(200);

    const tableRow = sqlite
      .prepare('SELECT status, current_order_id, current_session_id FROM cafe_tables WHERE id = ?')
      .get('tbl_1') as Record<string, unknown>;
    expect(tableRow.status).toBe('cleaning');
    expect(tableRow.current_order_id).toBeNull();
    expect(tableRow.current_session_id).toBeNull();

    const sessionRow = sqlite
      .prepare('SELECT status, closed_at FROM table_sessions WHERE id = ?')
      .get('sess_active') as Record<string, unknown>;
    expect(sessionRow.status).toBe('closed');
    expect(sessionRow.closed_at).toBeTruthy();
  });
});

describe('Customer PII Erasure Completeness Across Auth, Guest Orders & KV Retry', () => {
  it('derives erased token from resolved tenant under HQ wildcard, scrubs customer users/sessions/resets/otps/guest-orders, and surfaces KV failures after retry', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        phone TEXT,
        name TEXT,
        email TEXT,
        date_of_birth TEXT,
        birthday TEXT,
        notes TEXT,
        zalo TEXT,
        consent_marketing INTEGER DEFAULT 1,
        marketing_consent INTEGER DEFAULT 1,
        consent_analytics INTEGER DEFAULT 1,
        referral_code TEXT,
        last_ip TEXT,
        auth_version INTEGER DEFAULT 1,
        anonymized_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        customer_address TEXT,
        delivery_address TEXT,
        notes TEXT,
        total INTEGER NOT NULL DEFAULT 100000
      );
      CREATE TABLE consents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 1,
        revoked_at TEXT
      );
      CREATE TABLE customer_identities (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT NOT NULL
      );
      CREATE TABLE push_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT,
        user_id TEXT
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'customer',
        password_hash TEXT,
        is_active INTEGER DEFAULT 1,
        auth_version INTEGER DEFAULT 1,
        updated_at TEXT
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        user_id TEXT NOT NULL
      );
      CREATE TABLE password_resets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        user_id TEXT,
        email TEXT
      );
      CREATE TABLE otp_codes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        email TEXT
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        actor TEXT,
        actor_id TEXT,
        actor_role TEXT,
        action TEXT,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        status TEXT,
        created_at TEXT
      );

      INSERT INTO customers (id, tenant_id, phone, name, email) VALUES
        ('cust_erase_1', 'branch_02', '0901234567', 'Pham Thi X', 'pham.x@example.com');
      INSERT INTO orders (id, tenant_id, customer_id, customer_name, customer_phone, customer_email, delivery_address, total) VALUES
        ('ord_linked', 'branch_02', 'cust_erase_1', 'Pham Thi X', '0901234567', 'pham.x@example.com', '123 Le Loi', 90000),
        ('ord_guest_phone', 'branch_02', NULL, 'Pham Thi X Guest', '+84 901-234-567', NULL, '123 Le Loi', 65000),
        ('ord_guest_email', 'branch_02', NULL, 'Pham Thi X Email', NULL, 'PHAM.X@EXAMPLE.COM', '123 Le Loi', 45000),
        ('ord_other_tenant', 'branch_99', NULL, 'Pham Thi X Other', '0901234567', 'pham.x@example.com', '999 Tran Hung Dao', 55000);
      INSERT INTO customer_identities (id, tenant_id, customer_id) VALUES
        ('ident_b2', 'branch_02', 'cust_erase_1'),
        ('ident_b99', 'branch_99', 'cust_erase_1');
      INSERT INTO push_subscriptions (id, tenant_id, customer_id, user_id) VALUES
        ('push_b2', 'branch_02', 'cust_erase_1', 'user_cust_1'),
        ('push_b99', 'branch_99', 'cust_erase_1', 'user_cust_1');
      INSERT INTO users (id, tenant_id, email, name, phone, role, password_hash, is_active) VALUES
        ('user_cust_1', 'branch_02', 'pham.x@example.com', 'Pham Thi X', '+84901234567', 'customer', 'hash_secret', 1),
        ('user_staff_same_phone', 'branch_02', 'manager@branch02.cafe', 'Branch Manager', '0901234567', 'manager', 'staff_hash', 1);
      INSERT INTO sessions (id, tenant_id, user_id) VALUES
        ('sess_cust_1', 'branch_02', 'user_cust_1'),
        ('sess_staff_1', 'branch_02', 'user_staff_same_phone');
      INSERT INTO password_resets (id, tenant_id, user_id, email) VALUES
        ('pr_cust_1', 'branch_02', 'user_cust_1', 'pham.x@example.com');
      INSERT INTO otp_codes (id, tenant_id, email) VALUES
        ('otp_1', 'branch_02', 'pham.x@example.com');
    `);

    const db = createSqliteD1(sqlite);
    const permanentFailKey = 'phone_otp:branch_02:0901234567';
    const transientFailKey = 'user:user_cust_1';
    const deleteAttempts = new Map<string, number>();

    const kv = {
      async get() {
        return null;
      },
      async delete(key: string) {
        const count = (deleteAttempts.get(key) || 0) + 1;
        deleteAttempts.set(key, count);
        if (key === transientFailKey && count === 1) {
          throw new Error('TRANSIENT_KV_ERROR');
        }
        if (key === permanentFailKey) {
          throw new Error('KV_DELETE_TIMEOUT');
        }
      },
    };

    // Execute erasure as HQ wildcard ('*') so effectiveTargetTenant resolves from customer row ('branch_02')
    const result = await eraseCustomerPii(db as never, {
      customerId: 'cust_erase_1',
      tenantId: '*',
      actorId: 'hq_admin',
      actorRole: 'owner',
      kv: kv as never,
    });

    expect(result.ok).toBe(true);
    expect(result.kvCleanupFailed).toBe(true);
    expect(result.kvCleanupErrors).toContain('phone_otp');
    // Transient failure on user:user_cust_1 succeeded on retry attempt 2
    expect(deleteAttempts.get(transientFailKey)).toBe(2);
    expect(result.kvCleanupErrors).not.toContain('user');

    // Token matches direct branch_02 derivation (re-running under 'branch_02' produces the exact same erasedToken)
    const secondRun = await eraseCustomerPii(db as never, {
      customerId: 'cust_erase_1',
      tenantId: 'branch_02',
      actorId: 'branch_admin',
      actorRole: 'manager',
    });
    expect(secondRun.ok).toBe(true);
    expect(secondRun.erasedToken).toBe(result.erasedToken);

    const customerRow = sqlite
      .prepare('SELECT name, phone, email, anonymized_at FROM customers WHERE id = ?')
      .get('cust_erase_1') as Record<string, unknown>;
    expect(customerRow.name).toBe('[ERASED]');
    expect(customerRow.phone).toBe(result.erasedToken);
    expect(customerRow.email).toBeNull();
    expect(customerRow.anonymized_at).toBeTruthy();

    // Guest orders in branch_02 are scrubbed; guest order in branch_99 is untouched
    const guestPhoneOrder = sqlite
      .prepare('SELECT customer_name, customer_phone, delivery_address FROM orders WHERE id = ?')
      .get('ord_guest_phone') as Record<string, unknown>;
    expect(guestPhoneOrder.customer_name).toBe('[ERASED]');
    expect(guestPhoneOrder.customer_phone).toBe(result.erasedToken);
    expect(guestPhoneOrder.delivery_address).toBeNull();

    const guestEmailOrder = sqlite
      .prepare('SELECT customer_name, customer_phone, customer_email, delivery_address FROM orders WHERE id = ?')
      .get('ord_guest_email') as Record<string, unknown>;
    expect(guestEmailOrder.customer_name).toBe('[ERASED]');
    expect(guestEmailOrder.customer_phone).toBe(result.erasedToken);
    expect(guestEmailOrder.customer_email).toBeNull();

    const otherTenantOrder = sqlite
      .prepare('SELECT customer_name, customer_phone FROM orders WHERE id = ?')
      .get('ord_other_tenant') as Record<string, unknown>;
    expect(otherTenantOrder.customer_name).toBe('Pham Thi X Other');
    expect(otherTenantOrder.customer_phone).toBe('0901234567');

    // Customer user account in branch_02 is scrubbed & deactivated, while manager account is untouched
    const custUser = sqlite
      .prepare('SELECT email, name, phone, password_hash, is_active FROM users WHERE id = ?')
      .get('user_cust_1') as Record<string, unknown>;
    expect(custUser.name).toBe('[ERASED]');
    expect(custUser.phone).toBe(result.erasedToken);
    expect(custUser.email).toBeNull();
    expect(custUser.password_hash).toBeNull();
    expect(custUser.is_active).toBe(0);

    const staffUser = sqlite
      .prepare('SELECT name, phone, is_active FROM users WHERE id = ?')
      .get('user_staff_same_phone') as Record<string, unknown>;
    expect(staffUser.name).toBe('Branch Manager');
    expect(staffUser.phone).toBe('0901234567');
    expect(staffUser.is_active).toBe(1);

    // Customer sessions, password_resets, otp_codes, and branch_02 identities/push_subscriptions deleted; branch_99 preserved
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ?').get('user_cust_1')).toEqual({ cnt: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ?').get('user_staff_same_phone')).toEqual({ cnt: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM password_resets WHERE user_id = ?').get('user_cust_1')).toEqual({ cnt: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM otp_codes WHERE tenant_id = ?').get('branch_02')).toEqual({ cnt: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM customer_identities WHERE tenant_id = ?').get('branch_02')).toEqual({ cnt: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM customer_identities WHERE tenant_id = ?').get('branch_99')).toEqual({ cnt: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM push_subscriptions WHERE tenant_id = ?').get('branch_02')).toEqual({ cnt: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) as cnt FROM push_subscriptions WHERE tenant_id = ?').get('branch_99')).toEqual({ cnt: 1 });
  });
});

describe('Mautic & ERPNext Outbound Marketing Consent Gate & Log Redaction', () => {
  it('filters out non-consented, analytics-only, revoked, and anonymized customers across Mautic sync and campaign detection and fails closed if consents table is missing', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        phone TEXT,
        name TEXT,
        email TEXT,
        loyalty_tier TEXT DEFAULT 'silver',
        tier TEXT DEFAULT 'silver',
        total_spent INTEGER DEFAULT 600000,
        last_visit TEXT,
        date_of_birth TEXT,
        consent_marketing INTEGER DEFAULT 0,
        marketing_consent INTEGER DEFAULT 0,
        anonymized_at TEXT,
        updated_at TEXT,
        created_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT
      );
      CREATE TABLE consents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 1,
        revoked_at TEXT
      );
      CREATE TABLE campaign_enrollments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT NOT NULL,
        campaign_type TEXT NOT NULL,
        campaign_id TEXT,
        mautic_contact_id INTEGER,
        status TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const todayMd = new Date().toISOString().slice(5, 10);
    const oldVisit = new Date(Date.now() - 45 * 86400000).toISOString();
    const recentUpdate = new Date().toISOString();

    sqlite.exec(`
      INSERT INTO customers (id, tenant_id, phone, name, email, loyalty_tier, tier, total_spent, last_visit, date_of_birth, consent_marketing, anonymized_at, updated_at, created_at) VALUES
        ('c_consented', 'store-m', '0911111111', 'Consented User', 'ok@example.com', 'gold', 'gold', 800000, '${oldVisit}', '1992-${todayMd}', 1, NULL, '${recentUpdate}', '${recentUpdate}'),
        ('c_analytics_only', 'store-m', '0922222222', 'Analytics Only', 'analytics@example.com', 'gold', 'gold', 800000, '${oldVisit}', '1992-${todayMd}', 0, NULL, '${recentUpdate}', '${recentUpdate}'),
        ('c_revoked', 'store-m', '0933333333', 'Revoked User', 'revoked@example.com', 'gold', 'gold', 800000, '${oldVisit}', '1992-${todayMd}', 1, NULL, '${recentUpdate}', '${recentUpdate}'),
        ('c_erased', 'store-m', '0944444444', '[ERASED]', 'erased@privacy.invalid', 'gold', 'gold', 800000, '${oldVisit}', '1992-${todayMd}', 1, '${recentUpdate}', '${recentUpdate}', '${recentUpdate}');

      INSERT INTO consents (id, tenant_id, customer_id, purpose, granted, revoked_at) VALUES
        ('co_1', 'store-m', 'c_consented', 'marketing', 1, NULL),
        ('co_2', 'store-m', 'c_analytics_only', 'analytics', 1, NULL),
        ('co_3', 'store-m', 'c_revoked', 'marketing', 0, '${recentUpdate}'),
        ('co_4', 'store-m', 'c_erased', 'marketing', 1, NULL);

      INSERT INTO orders (id, tenant_id, customer_id, status, created_at) VALUES
        ('o_1', 'store-m', 'c_consented', 'completed', '${oldVisit}'),
        ('o_2', 'store-m', 'c_analytics_only', 'completed', '${oldVisit}'),
        ('o_3', 'store-m', 'c_revoked', 'completed', '${oldVisit}'),
        ('o_4', 'store-m', 'c_erased', 'completed', '${oldVisit}');
    `);

    const db = createSqliteD1(sqlite);
    const syncedEmails: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = String(url);
        if (u.endsWith('/oauth/v2/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'mautic_tok', expires_in: 3600 }),
          };
        }
        if (u.includes('/api/contacts/batch/new')) {
          const parsed = JSON.parse(String(init?.body || '[]')) as Array<{ email?: string }>;
          for (const item of parsed) {
            if (item.email) syncedEmails.push(item.email);
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              contacts: parsed.map((item, idx) => ({ id: idx + 101, fields: { all: { email: item.email } } })),
              statusCodes: Object.fromEntries(parsed.map((_, idx) => [idx, 201])),
            }),
          };
        }
        if (u.includes('/api/contacts/new')) {
          const parsed = JSON.parse(String(init?.body || '{}')) as { email?: string };
          if (parsed.email) syncedEmails.push(parsed.email);
          return {
            ok: true,
            status: 200,
            json: async () => ({ contact: { id: 501 } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: 1 }),
        };
      }),
    );

    const mauticEnv = {
      AURA_DB: db,
      MAUTIC_BASE_URL: 'https://mautic.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csecret',
      MAUTIC_CAMPAIGN_WINBACK: '10',
      MAUTIC_CAMPAIGN_BIRTHDAY: '20',
    };

    const winback = await detectWinbackCandidates(mauticEnv, 'store-m');
    expect(winback.detected).toBe(1);
    expect(winback.enrolled).toBe(1);

    const birthday = await detectBirthdayCandidates(mauticEnv, 'store-m');
    expect(birthday.detected).toBe(1);
    expect(birthday.enrolled).toBe(1);

    syncedEmails.length = 0;
    const activeSync = await syncMauticContacts(mauticEnv, 'store-m');
    expect(activeSync.synced).toBe(1);
    expect(syncedEmails).toEqual(['ok@example.com']);

    // If consents table is dropped, all detection & contact sync functions fail closed with 0 records
    sqlite.exec('DROP TABLE consents');
    expect(await detectWinbackCandidates(mauticEnv, 'store-m')).toEqual({ detected: 0, enrolled: 0 });
    expect(await detectBirthdayCandidates(mauticEnv, 'store-m')).toEqual({ detected: 0, enrolled: 0 });
    expect(await syncMauticContacts(mauticEnv, 'store-m')).toEqual({ synced: 0, errors: 0 });
  });

  it('requires explicit opt-in consent before syncing walk-in Leads to ERPNext and redacts raw upstream failure payloads', async () => {
    const fetchCalls: Array<{ url: string; body: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        fetchCalls.push({ url: String(url), body: String(init?.body || '') });
        return {
          ok: false,
          status: 422,
          json: async () => ({
            exc_type: 'ValidationError',
            exception: 'Leaked customer phone 0909888777 and email secret@example.com',
          }),
          text: async () => 'Leaked customer phone 0909888777 and email secret@example.com',
        };
      }),
    );

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = {
      ERPNEXT_URL: 'https://erp.example.com',
      ERPNEXT_API_KEY: 'key',
      ERPNEXT_API_SECRET: 'sec',
    };

    // 1. Walk-in order without consent -> Sales Order attempted, Lead NOT called
    await syncOrderToERPNext(env, 'ord_walkin_no_consent', {
      customer_name: 'Walkin Guest',
      customer_phone: '0909888777',
      items: [{ product_id: 'cf-1', quantity: 1, unit_price: 35000 }],
    });
    expect(fetchCalls.map((c) => c.url)).toEqual(['https://erp.example.com/api/resource/Sales%20Order']);

    // Error log must be structured JSON without raw upstream PII leak
    const loggedLines = errSpy.mock.calls.map((c) => String(c[0]));
    expect(loggedLines.some((line) => line.includes('erpnext_sales_order_failed'))).toBe(true);
    expect(loggedLines.join('\n')).not.toContain('0909888777');
    expect(loggedLines.join('\n')).not.toContain('secret@example.com');

    // 2. Walk-in order with explicit consent_marketing: true -> Lead IS created
    fetchCalls.length = 0;
    await syncOrderToERPNext(env, 'ord_walkin_consented', {
      customer_name: 'Consented Guest',
      customer_phone: '0909888777',
      consent_marketing: true,
      items: [{ product_id: 'cf-1', quantity: 1, unit_price: 35000 }],
    } as never);
    expect(fetchCalls.map((c) => c.url)).toEqual([
      'https://erp.example.com/api/resource/Sales%20Order',
      'https://erp.example.com/api/resource/Lead',
    ]);
  });
});

describe('Audit Log Immutability Triggers, Migration Linter & Trigger Resume Support', () => {
  it('defines all 4 append-only triggers in db/schema.sql and blocks UPDATE/DELETE on audit_logs and saas_audit_logs', () => {
    const dbSchemaSql = fs.readFileSync(path.join(REPO_ROOT, 'db/schema.sql'), 'utf8');
    expect(dbSchemaSql).toContain('CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update');
    expect(dbSchemaSql).toContain('CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete');
    expect(dbSchemaSql).toContain('CREATE TRIGGER IF NOT EXISTS trg_saas_audit_logs_no_update');
    expect(dbSchemaSql).toContain('CREATE TRIGGER IF NOT EXISTS trg_saas_audit_logs_no_delete');

    const sqlite = new DatabaseSync(':memory:');
    const migrationSql = fs.readFileSync(
      path.join(REPO_ROOT, 'worker/db/migrations/20261127_02_audit_logs_immutability_triggers.sql'),
      'utf8',
    );
    sqlite.exec(`
      CREATE TABLE audit_logs (id TEXT PRIMARY KEY, action TEXT);
      CREATE TABLE saas_audit_logs (id TEXT PRIMARY KEY, action TEXT);
      INSERT INTO audit_logs (id, action) VALUES ('a1', 'created');
      INSERT INTO saas_audit_logs (id, action) VALUES ('s1', 'created');
      ${migrationSql}
    `);

    expect(() => sqlite.exec("UPDATE audit_logs SET action = 'tampered' WHERE id = 'a1'")).toThrow(
      /audit_logs is append-only and cannot be updated/,
    );
    expect(() => sqlite.exec("DELETE FROM audit_logs WHERE id = 'a1'")).toThrow(
      /audit_logs is append-only and cannot be deleted/,
    );
    expect(() => sqlite.exec("UPDATE saas_audit_logs SET action = 'tampered' WHERE id = 's1'")).toThrow(
      /saas_audit_logs is append-only and cannot be updated/,
    );
    expect(() => sqlite.exec("DELETE FROM saas_audit_logs WHERE id = 's1'")).toThrow(
      /saas_audit_logs is append-only and cannot be deleted/,
    );
  });

  it('validates CREATE TRIGGER IF NOT EXISTS, DROP TRIGGER IF EXISTS, and trigger reversal in lint-d1-migrations.mjs', () => {
    const revMissingDrop = inspectMigrationReversibility(
      `CREATE TRIGGER IF NOT EXISTS trg_demo BEFORE UPDATE ON audit_logs BEGIN SELECT 1; END;`,
      `SELECT 1;`,
    );
    expect(revMissingDrop.safeReversible).toBe(false);
    expect(revMissingDrop.hazards).toContain('incomplete_down_missing_trigger_reversal');

    const revUnsafeDrop = inspectMigrationReversibility(
      `CREATE TRIGGER IF NOT EXISTS trg_demo BEFORE UPDATE ON audit_logs BEGIN SELECT 1; END;`,
      `DROP TRIGGER trg_demo;`,
    );
    expect(revUnsafeDrop.safeReversible).toBe(false);
    expect(revUnsafeDrop.hazards).toContain('unsafe_down_ddl_missing_if_exists');

    const revSafe = inspectMigrationReversibility(
      `CREATE TRIGGER IF NOT EXISTS trg_demo BEFORE UPDATE ON audit_logs BEGIN SELECT 1; END;`,
      `DROP TRIGGER IF EXISTS trg_demo;`,
    );
    expect(revSafe.safeReversible).toBe(true);
    expect(revSafe.hazards).toEqual([]);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-trigger-test-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, '20261127_01_bad_trigger.sql'),
        `CREATE TRIGGER trg_missing_guard BEFORE DELETE ON audit_logs BEGIN SELECT 1; END;\nDROP TRIGGER trg_missing_if_exists;\n`,
      );
      const lintRes = lintMigrationsDirectory(tmpDir);
      expect(lintRes.valid).toBe(false);
      expect(lintRes.errors.some((e: string) => e.includes('CREATE TRIGGER statement missing IF NOT EXISTS guard'))).toBe(true);
      expect(lintRes.errors.some((e: string) => e.includes('Unsafe DROP TRIGGER without IF EXISTS guard'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('supports multi-line CREATE TRIGGER migrations in prepare-migration-resume.mjs across partial resume, verified no-op, and drift detection', () => {
    const resumeScript = path.join(REPO_ROOT, 'worker/scripts/prepare-migration-resume.mjs');
    const triggerMigration = path.join(
      REPO_ROOT,
      'worker/db/migrations/20261127_02_audit_logs_immutability_triggers.sql',
    );
    const triggerSql = fs.readFileSync(triggerMigration, 'utf8');

    // 1. --check succeeds for pinned trigger migration
    const checkRes = spawnSync('node', [resumeScript, '--check', triggerMigration], { encoding: 'utf8' });
    expect(checkRes.status, checkRes.stderr).toBe(0);

    // 2. --query includes base tables, legacy drop target, and all 4 immutability triggers without excluding triggers
    const queryRes = spawnSync('node', [resumeScript, '--query', triggerMigration], { encoding: 'utf8' });
    expect(queryRes.status, queryRes.stderr).toBe(0);
    expect(queryRes.stdout).toContain("'audit_logs'");
    expect(queryRes.stdout).toContain("'saas_audit_logs'");
    expect(queryRes.stdout).toContain("'trg_audit_logs_sync'");
    expect(queryRes.stdout).toContain("'trg_audit_logs_no_update'");
    expect(queryRes.stdout).not.toContain("s.type <> 'trigger'");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-trigger-test-'));
    try {
      // 3a. Legacy trg_audit_logs_sync present on migrated DB: applying migration drops it so INSERT succeeds while UPDATE/DELETE abort
      const migratedSqlite = new DatabaseSync(':memory:');
      migratedSqlite.exec(`
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          actor_id TEXT DEFAULT 'system',
          user_id TEXT,
          action TEXT NOT NULL,
          resource_type TEXT DEFAULT 'system',
          entity_type TEXT,
          resource_id TEXT,
          entity_id TEXT,
          details TEXT DEFAULT '{}',
          metadata TEXT DEFAULT '{}'
        );
        CREATE TABLE saas_audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL);
        CREATE TRIGGER IF NOT EXISTS trg_audit_logs_sync
        AFTER INSERT ON audit_logs
        BEGIN
          UPDATE audit_logs SET actor_id = COALESCE(actor_id, user_id, 'system') WHERE rowid = NEW.rowid;
        END;
      `);
      const legacyRows = migratedSqlite.prepare(queryRes.stdout.trim()).all();
      const legacySnapshot = path.join(tmpDir, 'legacy-snapshot.json');
      const legacyResidual = path.join(tmpDir, 'legacy-residual.sql');
      fs.writeFileSync(legacySnapshot, JSON.stringify([{ success: true, results: legacyRows }]));

      const prepLegacy = spawnSync(
        'node',
        [resumeScript, '--prepare', triggerMigration, legacySnapshot, legacyResidual],
        { encoding: 'utf8' },
      );
      expect(prepLegacy.status, prepLegacy.stderr).toBe(0);
      const legacyResidualSql = fs.readFileSync(legacyResidual, 'utf8');
      expect(legacyResidualSql).toContain('DROP TRIGGER IF EXISTS trg_audit_logs_sync;');
      expect(legacyResidualSql.indexOf('DROP TRIGGER IF EXISTS trg_audit_logs_sync;')).toBeLessThan(
        legacyResidualSql.indexOf('CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update'),
      );

      // Executing the residual SQL on the migrated DB must drop trg_audit_logs_sync so INSERT succeeds while UPDATE/DELETE abort
      migratedSqlite.exec(legacyResidualSql);
      expect(() =>
        migratedSqlite.exec("INSERT INTO audit_logs (id, action) VALUES ('al_1', 'login')"),
      ).not.toThrow();
      expect(() =>
        migratedSqlite.exec("UPDATE audit_logs SET action = 'tampered' WHERE id = 'al_1'"),
      ).toThrow(/append-only/i);
      expect(() =>
        migratedSqlite.exec("DELETE FROM audit_logs WHERE id = 'al_1'"),
      ).toThrow(/append-only/i);
      migratedSqlite.close();

      // 3b. Partial resume: when legacy trigger is already absent and only audit_logs triggers exist, residual contains only saas_audit_logs triggers
      const partialSqlite = new DatabaseSync(':memory:');
      partialSqlite.exec(`
        CREATE TABLE audit_logs (id TEXT PRIMARY KEY);
        CREATE TABLE saas_audit_logs (id TEXT PRIMARY KEY);
        CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
        BEFORE UPDATE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'audit_logs is append-only and cannot be updated');
        END;
        CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
        BEFORE DELETE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'audit_logs is append-only and cannot be deleted');
        END;
      `);
      const partialRows = partialSqlite.prepare(queryRes.stdout.trim()).all();
      const partialSnapshot = path.join(tmpDir, 'partial-snapshot.json');
      const partialResidual = path.join(tmpDir, 'partial-residual.sql');
      fs.writeFileSync(partialSnapshot, JSON.stringify([{ success: true, results: partialRows }]));

      const prepPartial = spawnSync(
        'node',
        [resumeScript, '--prepare', triggerMigration, partialSnapshot, partialResidual],
        { encoding: 'utf8' },
      );
      expect(prepPartial.status, prepPartial.stderr).toBe(0);
      const partialResidualSql = fs.readFileSync(partialResidual, 'utf8');
      expect(partialResidualSql).not.toContain('DROP TRIGGER IF EXISTS trg_audit_logs_sync');
      expect(partialResidualSql).not.toContain('trg_audit_logs_no_update');
      expect(partialResidualSql).not.toContain('trg_audit_logs_no_delete');
      expect(partialResidualSql).toContain('trg_saas_audit_logs_no_update');
      expect(partialResidualSql).toContain('trg_saas_audit_logs_no_delete');

      // 4. Verified no-op: when all 4 triggers already exist, residual is empty
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE audit_logs (id TEXT PRIMARY KEY);
        CREATE TABLE saas_audit_logs (id TEXT PRIMARY KEY);
        ${triggerSql}
      `);
      const rows = sqlite.prepare(queryRes.stdout.trim()).all();
      const snapshotPath = path.join(tmpDir, 'snapshot.json');
      const residualPath = path.join(tmpDir, 'residual.sql');
      fs.writeFileSync(snapshotPath, JSON.stringify([{ success: true, results: rows }]));

      const prepNoop = spawnSync(
        'node',
        [resumeScript, '--prepare', triggerMigration, snapshotPath, residualPath],
        { encoding: 'utf8' },
      );
      expect(prepNoop.status, prepNoop.stderr).toBe(0);
      expect(fs.readFileSync(residualPath, 'utf8').trim()).toBe('');

      // 5. Tamper with one trigger definition in snapshot -> must fail closed with Schema drift
      const driftedSqlite = new DatabaseSync(':memory:');
      driftedSqlite.exec(`
        CREATE TABLE audit_logs (id TEXT PRIMARY KEY);
        CREATE TABLE saas_audit_logs (id TEXT PRIMARY KEY);
        CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(IGNORE); END;
      `);
      const driftedRows = driftedSqlite.prepare(queryRes.stdout.trim()).all();
      const driftedSnapshot = path.join(tmpDir, 'drifted.json');
      const driftedResidual = path.join(tmpDir, 'drifted-residual.sql');
      fs.writeFileSync(driftedSnapshot, JSON.stringify([{ success: true, results: driftedRows }]));

      const prepDrift = spawnSync(
        'node',
        [resumeScript, '--prepare', triggerMigration, driftedSnapshot, driftedResidual],
        { encoding: 'utf8' },
      );
      expect(prepDrift.status).not.toBe(0);
      expect(prepDrift.stderr).toContain('Schema drift: trigger trg_audit_logs_no_update');
      partialSqlite.close();
      sqlite.close();
      driftedSqlite.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Encrypted D1 Backup Cleanup Traps, HMAC Integrity & Local Encryption Enforcement', () => {
  it('registers EXIT INT TERM cleanup traps, computes verifiable HMAC-SHA256 tags without argv key exposure, and enforces encryption on local backups by default', () => {
    const deployYml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/deploy.yml'), 'utf8');
    expect(deployYml).toContain('trap cleanup_plaintext_backup EXIT INT TERM');
    expect(deployYml).toContain('createHmac("sha256", key)');
    expect(deployYml).toContain('path: d1-backups/*.enc*');

    const backupScriptPath = path.join(REPO_ROOT, 'worker/scripts/backup-d1.sh');
    const backupSh = fs.readFileSync(backupScriptPath, 'utf8');
    expect(backupSh).toContain('trap cleanup_plaintext_backup EXIT INT TERM');
    expect(backupSh).toContain('--allow-plaintext-local');
    expect(backupSh).toContain('createHmac("sha256", key)');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-d1-test-'));
    try {
      const envWithoutKey = { ...process.env };
      delete envWithoutKey.D1_BACKUP_ENCRYPTION_KEY;

      // 1. --local without D1_BACKUP_ENCRYPTION_KEY fails closed with exit 1
      const localNoKey = spawnSync('bash', [backupScriptPath, '--local'], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: envWithoutKey,
      });
      expect(localNoKey.status).toBe(1);
      expect(localNoKey.stderr).toContain('D1_BACKUP_ENCRYPTION_KEY environment variable is required for local D1 backups');

      // 2. --remote with --allow-plaintext-local and no key still fails closed
      const remoteAllowPlaintextNoKey = spawnSync('bash', [backupScriptPath, '--remote', '--allow-plaintext-local'], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: envWithoutKey,
      });
      expect(remoteAllowPlaintextNoKey.status).toBe(1);
      expect(remoteAllowPlaintextNoKey.stderr).toContain('D1_BACKUP_ENCRYPTION_KEY environment variable is required for remote D1 backups');

      // 3. Simulate failed export after writing partial plaintext SQL -> EXIT trap must delete plaintext file
      const binDir = path.join(tmpDir, 'bin');
      fs.mkdirSync(binDir);
      fs.writeFileSync(
        path.join(binDir, 'npx'),
        `#!/usr/bin/env bash
for ((i=1; i<=$#; i++)); do
  if [[ "\${!i}" == "--output" ]]; then
    next=$((i+1))
    echo "PARTIAL_SENSITIVE_SQL_DUMP" > "\${!next}"
    exit 42
  fi
done
exit 1
`,
        { mode: 0o700 },
      );

      const failedExport = spawnSync('bash', [backupScriptPath, '--remote'], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          D1_BACKUP_ENCRYPTION_KEY: 'super-secret-backup-key-for-test',
        },
      });
      expect(failedExport.status).not.toBe(0);
      const remainingSqlAfterFail = fs
        .readdirSync(path.join(tmpDir, 'backups'))
        .filter((f) => f.endsWith('.sql'));
      expect(remainingSqlAfterFail).toEqual([]);

      // 4. Simulate successful export -> produces .sql.enc and matching .sql.enc.hmac, removes plaintext .sql
      fs.writeFileSync(
        path.join(binDir, 'npx'),
        `#!/usr/bin/env bash
for ((i=1; i<=$#; i++)); do
  if [[ "\${!i}" == "--output" ]]; then
    next=$((i+1))
    echo "CREATE TABLE test_backup (id TEXT PRIMARY KEY);" > "\${!next}"
    exit 0
  fi
done
exit 0
`,
        { mode: 0o700 },
      );

      const testKey = 'super-secret-backup-key-for-test';
      const okExport = spawnSync('bash', [backupScriptPath, '--local'], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          D1_BACKUP_ENCRYPTION_KEY: testKey,
        },
      });
      expect(okExport.status, okExport.stderr).toBe(0);

      const localBackupDir = path.join(tmpDir, 'backups/local');
      const backupFiles = fs.readdirSync(localBackupDir);
      expect(backupFiles.filter((f) => f.endsWith('.sql'))).toEqual([]);
      const encFile = backupFiles.find((f) => f.endsWith('.sql.enc'));
      const hmacFile = backupFiles.find((f) => f.endsWith('.sql.enc.hmac'));
      expect(encFile).toBeDefined();
      expect(hmacFile).toBeDefined();

      const encBytes = fs.readFileSync(path.join(localBackupDir, encFile!));
      const expectedHmac = createHmac('sha256', testKey).update(encBytes).digest('hex');
      const recordedHmacLine = fs.readFileSync(path.join(localBackupDir, hmacFile!), 'utf8').trim();
      expect(recordedHmacLine.startsWith(`${expectedHmac}  `)).toBe(true);

      // 5. Explicit --local --allow-plaintext-local works without encryption key when intentionally opted in
      const plaintextLocal = spawnSync('bash', [backupScriptPath, '--local', '--allow-plaintext-local'], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: {
          ...envWithoutKey,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      });
      expect(plaintextLocal.status, plaintextLocal.stderr).toBe(0);
      const filesAfterPlaintext = fs.readdirSync(localBackupDir);
      expect(filesAfterPlaintext.some((f) => f.endsWith('.sql'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Legacy Logger Redaction Parity & Campaign HTML Escaping', () => {
  it('redacts sensitive keys and inline PII/tokens in worker/src/utils/logger.js', () => {
    const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const redacted = legacyRedact({
      customer_name: 'Nguyen Van A',
      delivery_address: '123 Nguyen Hue, Q1',
      shipping_address: '456 Le Loi, Q1',
      address: '789 Pasteur',
      order_token: 'tok_secret_123',
      device_token: 'dev_secret_456',
      raw_device_token: 'raw_dev_789',
      otp_code: '654321',
      verification_code: '112233',
      note: `Contact buyer@example.com or +84901234567 with Bearer secret_abc_123 or ${sampleJwt} at https://auraspace.cafe/order?order_token=ord_tok_999&access_token=acc_888`,
      barePhone: '0912345678',
    }) as Record<string, unknown>;

    expect(redacted.customer_name).toBe('[REDACTED]');
    expect(redacted.delivery_address).toBe('[REDACTED]');
    expect(redacted.shipping_address).toBe('[REDACTED]');
    expect(redacted.address).toBe('[REDACTED]');
    expect(redacted.order_token).toBe('[REDACTED]');
    expect(redacted.device_token).toBe('[REDACTED]');
    expect(redacted.raw_device_token).toBe('[REDACTED]');
    expect(redacted.otp_code).toBe('[REDACTED]');
    expect(redacted.verification_code).toBe('[REDACTED]');
    expect(redacted.barePhone).toBe('[REDACTED]');
    expect(String(redacted.note)).not.toContain('buyer@example.com');
    expect(String(redacted.note)).not.toContain('901234567');
    expect(String(redacted.note)).not.toContain('secret_abc_123');
    expect(String(redacted.note)).not.toContain(sampleJwt);
    expect(String(redacted.note)).not.toContain('ord_tok_999');
    expect(String(redacted.note)).not.toContain('acc_888');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLegacyLogger({ route: 'test.legacy' });
    log.info('Order fail for user@example.com phone 0901234567', { order_token: 'secret_tok' });
    const emitted = String(logSpy.mock.calls[0]?.[0] || '');
    expect(emitted).not.toContain('user@example.com');
    expect(emitted).not.toContain('0901234567');
    expect(emitted).not.toContain('secret_tok');
  });

  it('escapes HTML special characters in campaign templates and blocks non-HTTP(S) review links', () => {
    const xssName = '<script>alert("xss")</script>';
    const treeWelcome = renderTreeCampaignTemplate('welcome', xssName);
    expect(treeWelcome.html).not.toContain('<script>');
    expect(treeWelcome.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(treeWelcome.sms).toContain(xssName);

    const jsLinkPostVisit = renderTreeCampaignTemplate('post_visit', 'Lan', {
      review_link: 'javascript:alert(document.cookie)',
    });
    expect(jsLinkPostVisit.html).not.toContain('javascript:');
    expect(jsLinkPostVisit.html).toContain('https://auraspace.cafe/review');

    const attrBreakPostVisit = renderTreeCampaignTemplate('post_visit', 'Lan', {
      review_link: 'https://auraspace.cafe/review?a=1&b="><script>alert(1)</script>',
    });
    expect(attrBreakPostVisit.html).not.toContain('<script>');
    expect(attrBreakPostVisit.html).toContain('&amp;b=&quot;&gt;&lt;script&gt;');

    const wb = winbackTemplate(xssName);
    expect(wb.html).not.toContain('<script>');
    expect(wb.html).toContain('&lt;script&gt;');

    const bd = birthdayTemplate(xssName, 'GOLD', 20);
    expect(bd.html).not.toContain('<script>');
    expect(bd.html).toContain('&lt;script&gt;');

    const promo = promoTemplate(
      xssName,
      '<img src=x onerror=alert(1)>',
      '<b>Discount & "Gift"</b>',
    );
    expect(promo.html).not.toContain('<script>');
    expect(promo.html).not.toContain('<img src=x');
    expect(promo.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(promo.html).toContain('&lt;b&gt;Discount &amp; &quot;Gift&quot;&lt;/b&gt;');
  });
});
