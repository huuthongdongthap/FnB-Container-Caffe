import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { resolveTenantLifecycle, getTenantEntitlement } from '../lib/saas-entitlement';
import { resolvePayosReconcileCredentials } from '../lib/merchant-payment';
import { createSaasCommercialRoutes } from '../routes/saas-commercial';
import { floorPlanRouter } from '../routes/floor-plan';
import { enforceSaasWriteGuard } from '../middleware/saas-write-guard';
import { checkRateLimit } from '../middleware/rate-limit';
import { customerAssistantRouter, processCustomerQuery } from '../routes/customer-assistant';
import { aiBaristaRouter, resetBaristaRateLimitForTests } from '../routes/ai-barista';
import { registerVitalsRoute } from '../routes/vitals';
import { chatRouter } from '../routes/chat';
import { clientErrorsRouter } from '../routes/client-errors';
import { generateJWT } from '../lib/jwt';

const JWT_SECRET = 'k9X2mP7qR4vW8zB3nL6jF1hD5cT0yA9sE2uG4iO8';

function makeKvMock() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
}

function makeD1Mock(handlers: {
  first?: (sql: string, params: unknown[]) => unknown;
  all?: (sql: string, params: unknown[]) => { results: unknown[] };
  run?: (sql: string, params: unknown[]) => { success: boolean; meta: { changes: number } };
}) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    executed,
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          bound = params;
          return stmt;
        },
        async first<T = unknown>() {
          executed.push({ sql, params: bound });
          return (handlers.first ? handlers.first(sql, bound) : null) as T | null;
        },
        async all<T = unknown>() {
          executed.push({ sql, params: bound });
          return (handlers.all ? handlers.all(sql, bound) : { results: [] }) as { results: T[] };
        },
        async run() {
          executed.push({ sql, params: bound });
          return handlers.run ? handlers.run(sql, bound) : { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
  return db as unknown as D1Database & { executed: Array<{ sql: string; params: unknown[] }> };
}

describe('Issue #269: SaaS Entitlement, BFLA, Floor Plan & Write Guard Regressions', () => {
  it('locks cancelled tenant to readonly instead of falling into unlimited trial', () => {
    const futureIso = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const ent = resolveTenantLifecycle({
      tenant_id: 'tenant-cancelled',
      tier: 'starter',
      status: 'cancelled',
      trial_ends_at: futureIso,
      grace_ends_at: futureIso,
      current_period_end: futureIso,
    });
    expect(ent.lifecycleState).toBe('readonly');
    expect(ent.isReadOnly).toBe(true);
    expect(ent.fullAccessTrial).toBe(false);
    expect(ent.daysRemaining).toBe(0);
  });

  it('locks cancelled non-default tenants to readonly in getTenantEntitlement while preserving unenrolled legacy stores as active', async () => {
    const dbUnenrolled = makeD1Mock({ first: () => null });
    const entUnenrolled = await getTenantEntitlement(dbUnenrolled, 'tenant-unenrolled');
    expect(entUnenrolled.lifecycleState).toBe('active');
    expect(entUnenrolled.isReadOnly).toBe(false);

    const dbCancelled = makeD1Mock({
      first: () => ({
        tenant_id: 'tenant-cancelled',
        tier: 'starter',
        status: 'cancelled',
        trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        grace_ends_at: null,
        current_period_end: null,
      }),
    });
    const entCancelled = await getTenantEntitlement(dbCancelled, 'tenant-cancelled');
    expect(entCancelled.lifecycleState).toBe('readonly');
    expect(entCancelled.isReadOnly).toBe(true);
    expect(entCancelled.planId).toBe('starter');
  });

  it('never falls back to flagship env.PAYOS_* credentials for non-default tenants', async () => {
    const db = makeD1Mock({ first: () => null });
    const env = {
      AURA_DB: db,
      PAYOS_CLIENT_ID: 'flagship-client',
      PAYOS_API_KEY: 'flagship-key',
      PAYOS_CHECKSUM_KEY: 'flagship-checksum',
    } as unknown as Env;

    const creds = await resolvePayosReconcileCredentials(db, env, 'tenant-unenrolled');
    expect(creds).toBeNull();
  });

  it('blocks manager role from /api/saas/me, /api/saas/branding, /api/saas/payment-config and /api/saas/export', async () => {
    const db = makeD1Mock({
      first: (sql, params) => {
        if (sql.includes('FROM users')) {
          const uid = String(params[0] || '');
          if (uid === 'u-mgr') {
            return { id: 'u-mgr', name: 'mgr', role: 'manager', tenant_id: 'tenant-a', is_active: 1, auth_version: 1 };
          }
          if (uid === 'u-own') {
            return { id: 'u-own', name: 'own', role: 'owner', tenant_id: 'tenant-a', is_active: 1, auth_version: 1 };
          }
        }
        return null;
      },
      all: () => ({ results: [] }),
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/saas', createSaasCommercialRoutes());

    const managerToken = await generateJWT(
      { id: 'u-mgr', username: 'mgr', role: 'manager', tenantId: 'tenant-a', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' },
      JWT_SECRET,
      3600
    );
    const env = { AURA_DB: db, JWT_SECRET, AUTH_KV: makeKvMock() as unknown as KVNamespace } as unknown as Env;

    const resMe = await app.request(
      'http://localhost/api/saas/me',
      { headers: { Authorization: `Bearer ${managerToken}` } },
      env
    );
    expect(resMe.status).toBe(403);

    const resExport = await app.request(
      'http://localhost/api/saas/export',
      { headers: { Authorization: `Bearer ${managerToken}` } },
      env
    );
    expect(resExport.status).toBe(403);

    const ownerToken = await generateJWT(
      { id: 'u-own', username: 'own', role: 'owner', tenantId: 'tenant-a', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' },
      JWT_SECRET,
      3600
    );
    const resOwnerExport = await app.request(
      'http://localhost/api/saas/export',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(resOwnerExport.status).toBe(200);
    expect(
      db.executed.some((q) => q.sql.includes('INSERT INTO saas_audit_logs') && q.params.includes('tenant_data_exported'))
    ).toBe(true);
  });

  it('blocks floor-plan status:"cleaning" when table has unpaid active orders and rejects arbitrary status strings', async () => {
    const db = makeD1Mock({
      first: (sql) => {
        if (sql.includes('FROM users')) {
          return { id: 'u-staff', name: 'staff1', role: 'manager', tenant_id: 'tenant-a', is_active: 1, auth_version: 1 };
        }
        if (sql.includes('FROM tenant_subscriptions')) {
          return { tenant_id: 'tenant-a', tier: 'pro', status: 'active' };
        }
        if (sql.includes('FROM cafe_tables WHERE id = ?')) {
          return { id: 'tbl-1', tenant_id: 'tenant-a', status: 'occupied' };
        }
        if (sql.includes('FROM orders')) {
          return { id: 'ord-unpaid', status: 'pending', payment_status: 'unpaid', tenant_id: 'tenant-a' };
        }
        return null;
      },
      all: (sql) => {
        if (sql.includes('FROM orders')) {
          return { results: [{ id: 'ord-unpaid', status: 'pending', payment_status: 'unpaid', tenant_id: 'tenant-a' }] };
        }
        return { results: [] };
      },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/floor-plan', floorPlanRouter);

    const staffToken = await generateJWT(
      { id: 'u-staff', username: 'staff1', role: 'manager', tenantId: 'tenant-a', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' },
      JWT_SECRET,
      3600
    );
    const env = { AURA_DB: db, JWT_SECRET, AUTH_KV: makeKvMock() as unknown as KVNamespace } as unknown as Env;

    const resCleaning = await app.request(
      'http://localhost/api/floor-plan/tbl-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ status: 'cleaning' }),
      },
      env
    );
    expect(resCleaning.status).toBe(409);

    const resArbitrary = await app.request(
      'http://localhost/api/floor-plan/tbl-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ status: 'pwned_arbitrary_status' }),
      },
      env
    );
    expect(resArbitrary.status).toBe(400);
  });

  it('enforces saasWriteGuard on JSON body tenant_id and non-login /api/auth/register', async () => {
    const db = makeD1Mock({
      first: (sql) => {
        if (sql.includes('FROM tenant_subscriptions')) {
          return { tenant_id: 'tenant-expired', tier: 'starter', status: 'expired' };
        }
        return null;
      },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      const blocked = await enforceSaasWriteGuard(c);
      if (blocked) return blocked;
      await next();
    });
    app.post('/api/orders', (c) => c.json({ ok: true }));
    app.post('/api/auth/register', (c) => c.json({ ok: true }));
    app.post('/api/auth/login', (c) => c.json({ ok: true }));

    const env = { AURA_DB: db } as unknown as Env;

    const resOrder = await app.request(
      'http://localhost/api/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: 'tenant-expired' }),
      },
      env
    );
    expect(resOrder.status).toBe(402);

    const resRegister = await app.request(
      'http://localhost/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-expired' },
        body: JSON.stringify({}),
      },
      env
    );
    expect(resRegister.status).toBe(402);

    const resLogin = await app.request(
      'http://localhost/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-expired' },
        body: JSON.stringify({}),
      },
      env
    );
    expect(resLogin.status).toBe(200);
  });
});

describe('Issue #270: AI/LLM Assistant, Rate-Limit Bypass & D1 Flooding Regressions', () => {
  beforeEach(() => {
    resetBaristaRateLimitForTests();
  });

  it('never leaks wifi_password cross-tenant and always masks order UUID even when channel is zalo', async () => {
    const db = makeD1Mock({
      all: (sql) => {
        if (sql.includes('FROM store_settings')) {
          return {
            results: [
              { key: 'wifi_ssid', value: 'TENANT_B_WIFI' },
              { key: 'wifi_password', value: 'SUPER_SECRET_WIFI_PASS' },
            ],
          };
        }
        return { results: [] };
      },
      first: (sql) => {
        if (sql.includes('FROM orders')) {
          return { id: 'ord-100001', status: 'preparing', total: 55000, tenant_id: 'tenant-b' };
        }
        return null;
      },
    });

    const wifiRes = await processCustomerQuery(db, undefined, 'tenant-b', {
      query: 'cho xin mat khau wifi',
      channel: 'web',
    });
    expect(wifiRes.reply).not.toContain('SUPER_SECRET_WIFI_PASS');

    const orderRes = await processCustomerQuery(db, undefined, 'tenant-b', {
      query: 'kiem tra don hang cua toi',
      phone: '0901234567',
      channel: 'zalo',
    });
    expect(orderRes.reply).not.toContain('ord-100001');
  });

  it('blocks evil-localhost.com origin bypass in checkRateLimit', async () => {
    const kv = makeKvMock();
    const app = new Hono<{ Bindings: Env }>();
    app.post('/test', async (c) => {
      const ok = await checkRateLimit(c, { prefix: 'evil-test', max: 1, windowSec: 60, keyType: 'ip' });
      return c.json({ ok }, ok ? 200 : 429);
    });

    const env = {
      ENVIRONMENT: 'development',
      AUTH_KV: kv as unknown as KVNamespace,
    } as unknown as Env;

    const reqInit = {
      method: 'POST',
      headers: {
        Origin: 'https://evil-localhost.com',
        'CF-Connecting-IP': '203.0.113.55',
      },
    };
    const r1 = await app.request('http://api.example.com/test', reqInit, env);
    expect(r1.status).toBe(200);
    const r2 = await app.request('http://api.example.com/test', reqInit, env);
    expect(r2.status).toBe(429);
  });

  it('uses AUTH_KV for /api/vitals and /api/ai/barista/recommend and /api/chat/assistant rate limiting', async () => {
    const kv = makeKvMock();
    const db = makeD1Mock({ first: () => null, all: () => ({ results: [] }) });
    const env = {
      ENVIRONMENT: 'production',
      AURA_DB: db,
      AUTH_KV: kv as unknown as KVNamespace,
    } as unknown as Env;

    const app = new Hono<{ Bindings: Env }>();
    registerVitalsRoute(app);
    app.route('/api/ai/barista', aiBaristaRouter);
    app.route('/api/chat/assistant', customerAssistantRouter);

    const vRes = await app.request(
      'http://api.example.com/api/vitals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.10' },
        body: JSON.stringify({ name: 'LCP', value: 1200, rating: 'good' }),
      },
      env
    );
    expect(vRes.status).toBe(204);
    expect(Array.from(kv.store.keys()).some((k) => k.startsWith('rl:vitals:'))).toBe(true);

    const bRes = await app.request(
      'http://api.example.com/api/ai/barista/recommend',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.11' },
        body: JSON.stringify({ mood: 'relaxed' }),
      },
      env
    );
    expect(bRes.status).toBe(200);
    expect(Array.from(kv.store.keys()).some((k) => k.startsWith('rl:barista:'))).toBe(true);
  });

  it('rejects unauthenticated order lookups on customer assistant regardless of request host or order id', async () => {
    const db = makeD1Mock({ first: () => null, all: () => ({ results: [] }) });
    const env = {
      ENVIRONMENT: 'production',
      JWT_SECRET,
      AURA_DB: db,
    } as unknown as Env;

    const res = await customerAssistantRouter.fetch(
      new Request('https://test.local/?tenant_id=tenant_sadec_02', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Kiểm tra đơn #ord-sad-88', order_id: 'ord-sad-88' }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it('hardens chat route against invalid Bearer tokens, D1 outages, and unverified JWT phone claims', async () => {
    const kv = makeKvMock();
    const envWithDbError = {
      ENVIRONMENT: 'production',
      JWT_SECRET,
      PILOT_TENANT_ID: 'default',
      AUTH_KV: kv as unknown as KVNamespace,
      AURA_DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              throw new Error('D1 connection failed');
            },
          }),
        }),
      },
    } as unknown as Env;

    const badBearerRes = await chatRouter.fetch(
      new Request('https://auraspace.cafe/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid.jwt.token',
        },
        body: JSON.stringify({ name: 'Guest', phone: '0901234567', message: 'Hello' }),
      }),
      envWithDbError
    );
    expect(badBearerRes.status).toBe(401);

    const dbOutageRes = await chatRouter.fetch(
      new Request('https://auraspace.cafe/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Guest', phone: '0901234567', message: 'Hello' }),
      }),
      envWithDbError
    );
    expect(dbOutageRes.status).toBe(503);

    const customerToken = await generateJWT(
      { id: 'cust-no-db-phone', sub: 'cust-no-db-phone', role: 'customer', phone: '0909998888', tenantId: 'default' } as any,
      JWT_SECRET,
      3600
    );
    const dbMissingPhone = makeD1Mock({
      first: () => null,
      all: () => ({ results: [] }),
    });
    const historyEnv = {
      ENVIRONMENT: 'production',
      JWT_SECRET,
      PILOT_TENANT_ID: 'default',
      AUTH_KV: kv as unknown as KVNamespace,
      AURA_DB: dbMissingPhone,
    } as unknown as Env;

    const historyRes = await chatRouter.fetch(
      new Request('https://auraspace.cafe/messages/0909998888', {
        method: 'GET',
        headers: { Authorization: `Bearer ${customerToken}` },
      }),
      historyEnv
    );
    expect(historyRes.status).toBe(403);
  });

  it('ignores attacker-supplied future timestamps in client-errors and stores server timestamp', async () => {
    const insertedParams: unknown[][] = [];
    const db = makeD1Mock({
      run: (_sql, params) => {
        insertedParams.push(params);
        return { success: true, meta: { changes: 1 } };
      },
    });
    const env = {
      ENVIRONMENT: 'production',
      AURA_DB: db,
    } as unknown as Env;

    const res = await clientErrorsRouter.fetch(
      new Request('https://auraspace.cafe/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test error',
          ts: '9999-12-31T23:59:59Z',
          timestamp: '9999-12-31T23:59:59Z',
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    expect(insertedParams.length).toBeGreaterThanOrEqual(1);
    const storedTs = String(insertedParams[0][6]);
    expect(storedTs).not.toBe('9999-12-31T23:59:59Z');
    expect(new Date(storedTs).getUTCFullYear()).toBeLessThan(2100);
  });
});
