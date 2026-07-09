import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser } from '../../../tree/auth/login.js';
import { createMockEnv, createMockKV, createMockContext, mockRequest } from '../../test-utils';

// ---------------------------------------------------------------------------
// Shared mutable state — tests update these before calling loginUser()
// ---------------------------------------------------------------------------
const jwtCreds = {
  token: 'fake-jwt-token',
  verifyResult: true,
  hashResult: (_p: string) => `pbkdf2$${_p}`,
  generateError: false
};

function makeJwtCtx() {
  return {
    generateJWT: async() => (jwtCreds.generateError ? Promise.reject(new Error('JWT internal failure')) : jwtCreds.token),
    verifyPassword: async() => jwtCreds.verifyResult,
    hashPassword: async(_p: string) => jwtCreds.hashResult(_p)
  };
}

let recordedMetric: { name: string; value: number; tags?: Record<string, string> } | null = null;
function makeMetricsCtx() {
  return {
    createMetricsCollector: () => ({
      recordMetric: async(name: string, value: number, tags?: Record<string, string>) => {
        recordedMetric = { name, value, tags };
      }
    })
  };
}

vi.mock('../../../lib/jwt.js', () => makeJwtCtx());
vi.mock('../../../lib/metrics-collector.js', () => makeMetricsCtx());
vi.mock('../../../middleware/cors.js', () => ({
  jsonResponse: (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }),
  errorResponse: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status })
}));
vi.mock('../../../middleware/logger.js', () => ({
  createLogger: () => ({ error: () => {}, warn: () => {} })
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const SEEDED_USER = {
  id: 'user-1',
  email: 'test@aura.com',
  name: 'Test User',
  password: 'pbkdf2$some-hash',
  phone: '0901234567',
  role: 'customer'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('loginUser', () => {
  beforeEach(() => {
    jwtCreds.token = 'fake-jwt-token';
    jwtCreds.verifyResult = true;
    jwtCreds.hashResult = (_p: string) => `pbkdf2$${_p}`;
    jwtCreds.generateError = false;
    recordedMetric = null;
  });

  it('returns 500 when body is invalid JSON (parseJSON throws)', async() => {
    const request = new Request('https://test.aura/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json'
    });
    const env = createMockEnv({ AUTH_KV: createMockKV() });
    const response = await loginUser(request, env);
    expect(response.status).toBe(500);
  });

  it('returns 400 when required fields are missing', async() => {
    const request = mockRequest('POST', '/auth/login', {});
    const env = createMockEnv({ AUTH_KV: createMockKV() });
    const response = await loginUser(request, env);
    expect(response.status).toBe(400);
  });

  it('returns 400 when email is missing', async() => {
    const request = mockRequest('POST', '/auth/login', { password: 'abc' });
    const env = createMockEnv({ AUTH_KV: createMockKV() });
    const response = await loginUser(request, env);
    expect(response.status).toBe(400);
  });

  it('returns 401 when user not found in KV', async() => {
    const request = mockRequest('POST', '/auth/login', {
      email: 'nobody@aura.com',
      password: 'x'
    });
    const env = createMockEnv({ AUTH_KV: createMockKV() });
    const response = await loginUser(request, env);
    expect(response.status).toBe(401);
  });

  it('returns 401 on wrong password', async() => {
    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(SEEDED_USER) });
    jwtCreds.verifyResult = false;

    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'wrong'
    });
    const env = createMockEnv({ AUTH_KV: kv });
    const response = await loginUser(request, env);
    expect(response.status).toBe(401);
  });

  it('returns 200 with JWT token on successful login', async() => {
    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(SEEDED_USER) });
    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'correct'
    });
    const env = createMockEnv({ AUTH_KV: kv });
    const response = await loginUser(request, env);
    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.token).toBe('fake-jwt-token');
  });

  it('response user object has correct shape', async() => {
    const userWithAllFields = {
      ...SEEDED_USER,
      phone: '0901234567',
      role: 'customer'
    };
    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(userWithAllFields) });
    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'correct'
    });
    const env = createMockEnv({ AUTH_KV: kv });
    const response = await loginUser(request, env);
    const data = (await response.json()) as {
      user: { id: string; email: string; name: string; phone: string; role: string };
    };
    expect(data.user).toMatchObject({
      id: 'user-1',
      email: 'test@aura.com',
      name: 'Test User',
      phone: '0901234567',
      role: 'customer'
    });
  });

  it('records login_success metric on success via waitUntil', async() => {
    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(SEEDED_USER) });
    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'correct'
    });
    const env = createMockEnv({ AUTH_KV: kv });

    // Pre-assign resolve so the in-flight waitUntil() call can trigger it
    let _resolve: () => void = () => {};
    const done = new Promise<void>((r) => {
      _resolve = r;
    });

    const ctx = {
      waitUntil: async(p: Promise<unknown>) => {
        await p; // metric promise resolves immediately (mock is sync)
        _resolve();
      }
    };

    const response = await loginUser(request, env, ctx);
    expect(response.status).toBe(200);
    await done; // block until the background metric fires
    expect(recordedMetric).toEqual({ name: 'login_success', value: 1 });
  });

  it('records login_failed metric when user not found', async() => {
    const request = mockRequest('POST', '/auth/login', {
      email: 'nonexistent@aura.com',
      password: 'x'
    });
    const env = createMockEnv({ AUTH_KV: createMockKV() });

    let _resolve: () => void = () => {};
    const done = new Promise<void>((r) => {
      _resolve = r;
    });

    const ctx = {
      waitUntil: async(p: Promise<unknown>) => {
        await p;
        _resolve();
      }
    };

    await loginUser(request, env, ctx);
    await done;

    expect(recordedMetric).toEqual({ name: 'login_failed', value: 1, tags: { reason: 'user_not_found' } });
  });

  it('records login_failed metric on wrong password via waitUntil', async() => {
    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(SEEDED_USER) });
    jwtCreds.verifyResult = false;

    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'wrong'
    });
    const env = createMockEnv({ AUTH_KV: kv });

    let _resolve: () => void = () => {};
    const done = new Promise<void>((r) => {
      _resolve = r;
    });

    const ctx = {
      waitUntil: async(p: Promise<unknown>) => {
        await p;
        _resolve();
      }
    };

    await loginUser(request, env, ctx);
    await done;

    expect(recordedMetric).toEqual({ name: 'login_failed', value: 1, tags: { reason: 'wrong_password' } });
  });

  it('migrates legacy hash when password does not start with pbkdf2$', async() => {
    // SEEDED_USER starts with 'pbkdf2$' — use a fresh user without that prefix
    const legacyUser = {
      id: 'user-1',
      email: 'test@aura.com',
      name: 'Test User',
      password: 'old-hash' // NOT pbkdf2$ — triggers migration
    };
    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(legacyUser) });
    // hashPassword mock returns `pbkdf2$${p}` — so with p='correct' → 'pbkdf2$correct'
    jwtCreds.hashResult = (_p: string) => `pbkdf2$${_p}`;

    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'correct'
    });
    const env = createMockEnv({ AUTH_KV: kv });
    const ctx = createMockContext();
    const response = await loginUser(request, env, ctx);

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.token).toBe('fake-jwt-token');

    const updatedRaw = await kv.get('user:test@aura.com');
    const updated = JSON.parse(updatedRaw);
    expect(updated.password).toBe('pbkdf2$correct');
  });

  it('does not re-hash when password already starts with pbkdf2$', async() => {
    // Use fresh user whose password is already pbkdf2$ — migration should NOT fire
    const preHashedUser = {
      id: 'user-5',
      email: 'hashed@aura.com',
      name: 'Hashed User',
      password: 'pbkdf2$abc123'
    };
    const kv = createMockKV({ 'user:hashed@aura.com': JSON.stringify(preHashedUser) });

    const request = mockRequest('POST', '/auth/login', {
      email: 'hashed@aura.com',
      password: 'anything'
    });
    const env = createMockEnv({ AUTH_KV: kv });
    const response = await loginUser(request, env);

    expect(response.status).toBe(200);
    // key assertion: after login password hash is unchanged
    const updatedRaw = await kv.get('user:hashed@aura.com');
    const updated = JSON.parse(updatedRaw);
    expect(updated.password).toBe('pbkdf2$abc123');
  });

  it('updates last_login and updated_at timestamps on success', async() => {
    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(SEEDED_USER) });
    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'correct'
    });
    const env = createMockEnv({ AUTH_KV: kv });
    const response = await loginUser(request, env);

    expect(response.status).toBe(200);
    const updatedRaw = await kv.get('user:test@aura.com');
    const updated = JSON.parse(updatedRaw);
    expect(updated.last_login).toBeDefined();
    expect(updated.updated_at).toBeDefined();
    expect(new Date(updated.last_login).toISOString()).toBe(updated.last_login);
    expect(new Date(updated.updated_at).toISOString()).toBe(updated.updated_at);
  });

  it('returns 500 on unexpected exception', async() => {
    jwtCreds.generateError = true;

    const kv = createMockKV({ 'user:test@aura.com': JSON.stringify(SEEDED_USER) });
    const request = mockRequest('POST', '/auth/login', {
      email: 'test@aura.com',
      password: 'correct'
    });
    const env = createMockEnv({ AUTH_KV: kv });
    const response = await loginUser(request, env);

    expect(response.status).toBe(500);
  });
});
