/**
 * Security smoke tests — admin-metrics auth guard.
 * Verifies that GET /api/admin/metrics requires valid staff/owner token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import adminMetrics from '../../routes/admin-metrics';
import { createMockKV } from '../test-utils';

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

function createTestEnv(staffAccount?: Record<string, unknown>, overrides?: Record<string, unknown>) {
  const db = createStubDB();
  if (staffAccount) setStaffAccount(db, staffAccount);
  return {
    AURA_DB: db,
    AUTH_KV: createMockKV() as any,
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_EXPIRY_SECONDS: '3600',
    ...overrides
  } as any;
}

/** Point the account lookup at the row a staff token should be judged against. */
function setStaffAccount(db: ReturnType<typeof createStubDB>, row: Record<string, unknown>) {
  (db as unknown as { _staffState: { staffAccount: Record<string, unknown> | null } })._staffState.staffAccount = row;
}

function createStubDB() {
  // The session gate reads the staff account row behind a token, so a lookup by
  // id has to answer with the account the presented token names. Declared before
  // the statements so their closures can read it without a use-before-init error.
  const state: { staffAccount: Record<string, unknown> | null } = { staffAccount: null };
  const accountStmt = {
    bind: () => accountStmt,
    first: async() => state.staffAccount,
    all: async() => ({ results: [] }),
    run: async() => ({ meta: { changes: 1 } }),
    raw: async() => []
  };
  const stmt = {
    bind: () => stmt,
    first: async() => null,
    all: async() => ({ results: [] }),
    run: async() => ({ meta: { changes: 0 } }),
    raw: async() => []
  };
  const db = {
    _staffState: state,
    prepare: (sql: string) => {
      if (/FROM users WHERE id = \?/i.test(sql)) return accountStmt as any;
      return stmt;
    },
    batch: async() => [],
    exec: async() => ({ count: 0, duration: 0 }),
    dump: async() => new Uint8Array()
  };
  return db;
}

/**
 * Helper: sign a minimalist JWT for testing.
 * Uses Web Crypto — matches the HMAC-SHA256 used by production auth.
 */
async function signTestJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify({
    ...payload, id: payload.id || payload.sub,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${sigB64}`;
}

describe('admin-metrics security', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    // Mirror the actual index.ts setup: auth middleware, then route
    app.use('/api/admin/*', requireAuth(['owner', 'staff']));
    app.route('/api/admin/metrics', adminMetrics);
  });

  it('returns 401 when no Authorization header', async() => {
    const env = createTestEnv();
    const res = await app.request('/api/admin/metrics?range=24h', {}, env);
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 401 with invalid token (malformed)', async() => {
    const env = createTestEnv();
    const res = await app.request('/api/admin/metrics?range=24h', {
      headers: { Authorization: 'Bearer not-a-real-token' }
    }, env);
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid owner token', async() => {
    const env = createTestEnv({ id: 'USR_1', name: 'Owner', phone: null, role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 });
    const token = await signTestJwt({ sub: 'USR_1', role: 'owner', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' }, TEST_JWT_SECRET);
    const res = await app.request('/api/admin/metrics?range=24h', {
      headers: { Authorization: `Bearer ${token}` }
    }, env);
    expect(res.status).toBe(200);
  });

  it('returns 200 with valid staff token', async() => {
    const env = createTestEnv({ id: 'USR_2', name: 'Staff', phone: null, role: 'staff', tenant_id: 'default', is_active: 1, auth_version: 1 });
    const token = await signTestJwt({ sub: 'USR_2', role: 'staff', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' }, TEST_JWT_SECRET);
    const res = await app.request('/api/admin/metrics?range=24h', {
      headers: { Authorization: `Bearer ${token}` }
    }, env);
    expect(res.status).toBe(200);
  });

  it('returns 403 with non-staff role (customer)', async() => {
    const env = createTestEnv();
    const token = await signTestJwt({ sub: 'USR_3', role: 'customer' }, TEST_JWT_SECRET);
    const res = await app.request('/api/admin/metrics?range=24h', {
      headers: { Authorization: `Bearer ${token}` }
    }, env);
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('Không đủ quyền');
  });

  it('returns 401 with expired token', async() => {
    const env = createTestEnv();
    const encoder = new TextEncoder();
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify({
      sub: 'USR_1',
      role: 'owner',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600 // expired 1h ago
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(TEST_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${data}.${sigB64}`;

    const res = await app.request('/api/admin/metrics?range=24h', {
      headers: { Authorization: `Bearer ${token}` }
    }, env);
    expect(res.status).toBe(401);
  });

  it('response does not leak internal details on auth failure', async() => {
    const env = createTestEnv();
    const res = await app.request('/api/admin/metrics?range=24h', {}, env);
    const body = await res.json() as Record<string, unknown>;
    // Should NOT contain stack traces or DB internals
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('detail');
    expect(body).not.toHaveProperty('sql');
    expect(body).toHaveProperty('error');
  });
});
