/**
 * Auth Routes — Tests for registerUser, loginUser, logoutUser,
 * getCurrentUser, registerStaff, listStaff, bootstrapOwner,
 * resetPassword, changePassword.
 *
 * Strategy: mock JWT, metrics-collector, and dynamic email imports.
 * Test each function independently by calling it directly with
 * a mock Request and env.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock JWT library ────────────────────────────────────────────
vi.mock('../worker/src/lib/jwt.ts', () => ({
  generateJWT: vi.fn(async () => 'mock-jwt-token'),
  verifyJWT: vi.fn(async (token: string) => {
    if (token === 'valid-token') {
      return { email: 'test@test.com', sub: 'user1', id: 'USR_001', name: 'Test User', role: 'staff', exp: Math.floor(Date.now() / 1000) + 3600 };
    }
    return null;
  }),
  getAuthToken: vi.fn((request: Request) => {
    const auth = request.headers.get('Authorization');
    return auth?.startsWith('Bearer ') ? auth.substring(7) : null;
  }),
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(async (password: string, stored: string) => stored === `hashed:${password}`),
}));

// ── Mock metrics collector ──────────────────────────────────────
vi.mock('../worker/src/lib/metrics-collector.ts', () => ({
  createMetricsCollector: vi.fn(() => ({
    recordMetric: vi.fn(async () => {}),
    recordAlert: vi.fn(),
    pruneOldMetrics: vi.fn(),
    markAlertDispatched: vi.fn(),
  })),
}));

// ── Mock dynamic imports used in registerUser ───────────────────
vi.mock('../worker/src/lib/email.js', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock('../worker/src/templates/welcome.js', () => ({
  renderWelcome: vi.fn(() => '<html>Welcome</html>'),
}));

import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  registerStaff,
  listStaff,
  bootstrapOwner,
  resetPassword,
  changePassword,
  verifyJWT,
} from '../worker/src/routes/auth.ts';

// ── Helpers ─────────────────────────────────────────────────────
function createKvStore(entries: Record<string, unknown> = {}) {
  const store = new Map<string, string>();
  for (const [key, val] of Object.entries(entries)) {
    store.set(key, typeof val === 'string' ? val : JSON.stringify(val));
  }
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async (opts: { prefix?: string; limit?: number; cursor?: string }) => {
      const keys = Array.from(store.keys())
        .filter((k) => !opts?.prefix || k.startsWith(opts.prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    }),
  };
}

function createMockD1() {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn(async () => ({ success: true })),
      first: vi.fn(async () => null),
      all: vi.fn(async () => ({ results: [] })),
    })),
  };
}

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createAuthRequest(token: string, body?: Record<string, unknown>): Request {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  return new Request('http://localhost/api/auth', {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : null,
  });
}

const BASE_ENV = {
  JWT_SECRET: 'test-secret-16chars',
  JWT_EXPIRY_SECONDS: '3600',
};

const DEFAULT_USER = {
  id: 'USR_001',
  email: 'test@test.com',
  name: 'Test User',
  phone: '0909123001',
  password: 'hashed:password123',
  role: 'customer',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const STAFF_USER = {
  id: 'USR_002',
  email: 'staff@test.com',
  name: 'Staff User',
  phone: '0909123002',
  password: 'hashed:staffpass123',
  role: 'staff',
  active: true,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const OWNER_USER = {
  id: 'USR_003',
  email: 'owner@test.com',
  name: 'Owner User',
  phone: '',
  password: 'hashed:ownerpass123',
  role: 'owner',
  active: true,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

// ── Suite ───────────────────────────────────────────────────────
describe('Auth Handlers', () => {
  // ── registerUser ────────────────────────────────────────────
  describe('registerUser', () => {
    test('registers new user and returns JWT', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'new@test.com', password: 'password123', name: 'New User', phone: '0909123456' });

      const res = await registerUser(req, env);
      expect(res.status).toBe(201);
      const body = await res.json() as { success: boolean; user: { email: string }; token: string; message: string };
      expect(body.success).toBe(true);
      expect(body.user.email).toBe('new@test.com');
      expect(body.token).toBe('mock-jwt-token');
      expect(body.message).toContain('Đăng ký');
    });

    test('returns 409 on duplicate email', async () => {
      const kv = createKvStore({ 'user:dup@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'dup@test.com', password: 'password123' });

      const res = await registerUser(req, env);
      expect(res.status).toBe(409);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Email đã');
    });

    test('returns 400 on invalid email format', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'not-an-email', password: 'password123' });

      const res = await registerUser(req, env);
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Email/i);
    });

    test('returns 400 on short password', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'a@b.com', password: '123' });

      const res = await registerUser(req, env);
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Mật khẩu/i);
    });
  });

  // ── loginUser ───────────────────────────────────────────────
  describe('loginUser', () => {
    test('logs in with correct credentials and returns JWT', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'test@test.com', password: 'password123' });

      const res = await loginUser(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; token: string; user: { email: string } };
      expect(body.success).toBe(true);
      expect(body.token).toBe('mock-jwt-token');
      expect(body.user.email).toBe('test@test.com');
    });

    test('returns 401 with wrong password', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'test@test.com', password: 'wrongpassword' });

      const res = await loginUser(req, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Email hoặc mật khẩu/);
    });

    test('returns 401 for non-existent email', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'unknown@test.com', password: 'password123' });

      const res = await loginUser(req, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Email hoặc mật khẩu/);
    });
  });

  // ── logoutUser ──────────────────────────────────────────────
  describe('logoutUser', () => {
    test('revokes valid token on logout', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv };
      const req = createAuthRequest('valid-token');

      const res = await logoutUser(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean };
      expect(body.success).toBe(true);
    });

    test('returns 400 when no token provided', async () => {
      const env = { ...BASE_ENV, AUTH_KV: createKvStore() };
      const req = new Request('http://localhost/api/auth/logout', { method: 'POST' });

      const res = await logoutUser(req, env);
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/token/i);
    });
  });

  // ── getCurrentUser ──────────────────────────────────────────
  describe('getCurrentUser', () => {
    test('returns user profile from valid JWT', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv };
      const req = createAuthRequest('valid-token');

      const res = await getCurrentUser(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; user: { email: string; name: string } };
      expect(body.success).toBe(true);
      expect(body.user.email).toBe('test@test.com');
      expect(body.user.name).toBe('Test User');
    });

    test('returns 401 when no authorization header', async () => {
      const env = { ...BASE_ENV, AUTH_KV: createKvStore() };
      const req = new Request('http://localhost/api/auth/me');

      const res = await getCurrentUser(req, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Authorization/);
    });

    test('returns 401 with invalid token', async () => {
      const env = { ...BASE_ENV, AUTH_KV: createKvStore() };
      const req = createAuthRequest('invalid-token');

      const res = await getCurrentUser(req, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Token verify/);
    });

    test('returns 404 when user not found in KV', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv };
      const req = createAuthRequest('valid-token');

      const res = await getCurrentUser(req, env);
      expect(res.status).toBe(404);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/không tồn tại/);
    });

    test('returns 401 when token is revoked', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER, 'revoked:valid-token': '1' });
      const env = { ...BASE_ENV, AUTH_KV: kv };
      const req = createAuthRequest('valid-token');

      const res = await getCurrentUser(req, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/thu hồi/);
    });
  });

  // ── registerStaff ───────────────────────────────────────────
  describe('registerStaff', () => {
    test('registers staff account successfully', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv };
      const req = createPostRequest({ email: 'newstaff@test.com', password: 'staffpass123', name: 'New Staff', phone: '0909123999' });

      const res = await registerStaff(req, env);
      expect(res.status).toBe(201);
      const body = await res.json() as { success: boolean; user: { email: string; role: string }; message: string };
      expect(body.success).toBe(true);
      expect(body.user.email).toBe('newstaff@test.com');
      expect(body.user.role).toBe('staff');
    });

    test('returns 409 on duplicate email', async () => {
      const kv = createKvStore({ 'user:staff@test.com': STAFF_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv };
      const req = createPostRequest({ email: 'staff@test.com', password: 'staffpass123' });

      const res = await registerStaff(req, env);
      expect(res.status).toBe(409);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('đã được đăng ký');
    });
  });

  // ── listStaff ───────────────────────────────────────────────
  describe('listStaff', () => {
    test('returns staff and owner users', async () => {
      const kv = createKvStore({
        'user:staff@test.com': STAFF_USER,
        'user:owner@test.com': OWNER_USER,
        'user:customer@test.com': DEFAULT_USER,
      });
      const env = { ...BASE_ENV, AUTH_KV: kv };

      const res = await listStaff(new Request('http://localhost/api/auth/staff'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; users: any[] };
      expect(body.success).toBe(true);
      expect(body.users).toHaveLength(2);
      const emails = body.users.map((u: any) => u.email).sort();
      expect(emails).toEqual(['owner@test.com', 'staff@test.com']);
    });

    test('returns empty list when no staff or owners exist', async () => {
      const kv = createKvStore({ 'user:customer@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv };

      const res = await listStaff(new Request('http://localhost/api/auth/staff'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; users: any[] };
      expect(body.users).toHaveLength(0);
    });
  });

  // ── bootstrapOwner ──────────────────────────────────────────
  describe('bootstrapOwner', () => {
    test('creates owner when no owner exists', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createPostRequest({ email: 'owner@test.com', password: 'ownerpass123', name: 'New Owner' });

      const res = await bootstrapOwner(req, env);
      expect(res.status).toBe(201);
      const body = await res.json() as { success: boolean; user: { email: string; role: string }; token: string };
      expect(body.success).toBe(true);
      expect(body.user.email).toBe('owner@test.com');
      expect(body.user.role).toBe('owner');
      expect(body.token).toBe('mock-jwt-token');
    });

    test('returns 409 when owner already exists', async () => {
      const kv = createKvStore({ 'user:owner@test.com': OWNER_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv };
      const req = createPostRequest({ email: 'another@test.com', password: 'ownerpass123' });

      const res = await bootstrapOwner(req, env);
      expect(res.status).toBe(409);
      const body = await res.json() as { error?: string; success?: boolean };
      // Returns success: false with error when owner exists
      expect(body.success).toBe(false);
    });
  });

  // ── resetPassword ───────────────────────────────────────────
  describe('resetPassword', () => {
    const resetBody = { email: 'test@test.com', newPassword: 'newpass123' };

    test('resets password and returns new JWT', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv, RESET_KEY: 'my-reset-key' };
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Reset-Key': 'my-reset-key' },
        body: JSON.stringify(resetBody),
      });

      const res = await resetPassword(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; token: string };
      expect(body.success).toBe(true);
      expect(body.token).toBe('mock-jwt-token');
    });

    test('returns 200 even for unknown email (no leak)', async () => {
      const kv = createKvStore();
      const env = { ...BASE_ENV, AUTH_KV: kv, RESET_KEY: 'my-reset-key' };
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Reset-Key': 'my-reset-key' },
        body: JSON.stringify(resetBody),
      });

      const res = await resetPassword(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; message: string };
      expect(body.success).toBe(true);
      expect(body.message).toContain('Nếu email tồn tại');
    });

    test('returns 401 with wrong X-Reset-Key', async () => {
      const env = { ...BASE_ENV, AUTH_KV: createKvStore(), RESET_KEY: 'my-reset-key' };
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Reset-Key': 'wrong-key' },
        body: JSON.stringify(resetBody),
      });

      const res = await resetPassword(req, env);
      expect(res.status).toBe(401);
    });

    test('returns 503 when RESET_KEY not configured', async () => {
      const env = { ...BASE_ENV, AUTH_KV: createKvStore() };
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetBody),
      });

      const res = await resetPassword(req, env);
      expect(res.status).toBe(503);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('RESET_KEY');
    });
  });

  // ── changePassword ──────────────────────────────────────────
  describe('changePassword', () => {
    test('changes password with valid token and current password', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createAuthRequest('valid-token', { currentPassword: 'password123', newPassword: 'newpass456' });

      const res = await changePassword(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; message: string };
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/thay đổi/);
    });

    test('returns 401 with invalid token', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createAuthRequest('invalid-token', { currentPassword: 'password123', newPassword: 'newpass456' });

      const res = await changePassword(req, env);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Token/);
    });

    test('returns 400 when current password is wrong', async () => {
      const kv = createKvStore({ 'user:test@test.com': DEFAULT_USER });
      const env = { ...BASE_ENV, AUTH_KV: kv, AURA_DB: createMockD1() };
      const req = createAuthRequest('valid-token', { currentPassword: 'wrongpass', newPassword: 'newpass456' });

      const res = await changePassword(req, env);
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/mật khẩu/i);
    });
  });

  // ── verifyJWT re-export ──────────────────────────────────────
  describe('verifyJWT re-export', () => {
    test('re-exports verifyJWT from jwt library (backward compat)', async () => {
      const result = await verifyJWT('valid-token', 'test-secret');
      expect(result).not.toBeNull();
      expect(result && 'email' in result).toBe(true);
    });

    test('returns null for invalid token', async () => {
      const result = await verifyJWT('bad-token', 'test-secret');
      expect(result).toBeNull();
    });
  });
});
