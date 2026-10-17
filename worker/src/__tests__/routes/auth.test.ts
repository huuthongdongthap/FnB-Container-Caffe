/**
 * Unit tests for auth routes (register, login, logout, getCurrentUser)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { registerUser, registerWithVerification, verifyEmail, loginUser, logoutUser, getCurrentUser, bootstrapOwner, registerStaff, listStaff, expiresAtFromNow } from '../../routes/auth';
import { createMockEnv, createMockKV, TEST_JWT_SECRET } from '../test-utils';

function mockRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
}

function mockRequestWithHeader(method: string, path: string, headers: Record<string, string>, body?: unknown): Request {
  return new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
}

describe('registerUser', () => {
  it('registers a new user', async() => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/register', { email: 'new@test.com', password: 'Test1234!', name: 'New User' });
    const res = await registerUser(req, env);
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.token).toBeTruthy();
  });

  it('rejects duplicate email', async() => {
    const env = createMockEnv();
    const req1 = mockRequest('POST', '/api/auth/register', { email: 'dup@test.com', password: 'Test1234!' });
    await registerUser(req1, env);
    const req2 = mockRequest('POST', '/api/auth/register', { email: 'dup@test.com', password: 'Test1234!' });
    const res2 = await registerUser(req2, env);
    expect(res2.status).toBe(409);
  });

  it('rejects invalid email format', async() => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/register', { email: 'not-email', password: 'Test1234!' });
    const res = await registerUser(req, env);
    expect(res.status).toBe(400);
  });
});

describe('loginUser', () => {
  it('logs in with valid credentials', async() => {
    const env = createMockEnv();
    const registerReq = mockRequest('POST', '/api/auth/register', { email: 'login@test.com', password: 'Test1234!' });
    await registerUser(registerReq, env);

    const loginReq = mockRequest('POST', '/api/auth/login', { email: 'login@test.com', password: 'Test1234!' });
    const res = await loginUser(loginReq, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.token).toBeTruthy();
  });

  it('rejects wrong password', async() => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/login', { email: 'nonexist@test.com', password: 'WrongPass1!' });
    const res = await loginUser(req, env);
    expect(res.status).toBe(401);
  });
});

describe('getCurrentUser', () => {
  it('returns user info for valid token', async() => {
    const env = createMockEnv();
    const registerReq = mockRequest('POST', '/api/auth/register', { email: 'me@test.com', password: 'Test1234!' });
    const registerRes = await registerUser(registerReq, env);
    const { token } = await registerRes.json() as { token: string };

    const profileReq = mockRequestWithHeader('GET', '/api/auth/me', { Authorization: `Bearer ${token}` });
    const res = await getCurrentUser(profileReq, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect((data.user as Record<string, unknown>).email).toBe('me@test.com');
  });

  it('rejects missing auth header', async() => {
    const env = createMockEnv();
    const req = mockRequest('GET', '/api/auth/me');
    const res = await getCurrentUser(req, env);
    expect(res.status).toBe(401);
  });
});

describe('logoutUser', () => {
  it('revokes token on logout', async() => {
    const env = createMockEnv();
    const registerReq = mockRequest('POST', '/api/auth/register', { email: 'logout@test.com', password: 'Test1234!' });
    const registerRes = await registerUser(registerReq, env);
    const { token } = await registerRes.json() as { token: string };

    const logoutReq = mockRequestWithHeader('POST', '/api/auth/logout', { Authorization: `Bearer ${token}` });
    const res = await logoutUser(logoutReq, env);
    expect(res.status).toBe(200);
  });
});

describe('bootstrapOwner', () => {
  it('creates first owner', async() => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/bootstrap', { email: 'owner@test.com', password: 'Owner1234!', name: 'Owner' });
    const res = await bootstrapOwner(req, env);
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });
});

describe('verifyEmail & registerWithVerification hardening', () => {
  it('expiresAtFromNow sets 10-minute TTL instead of 100-minute typo', () => {
    const diffMs = new Date(expiresAtFromNow()).getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(9 * 60_000);
    expect(diffMs).toBeLessThanOrEqual(11 * 60_000);
  });

  it('locks out OTP verification after 5 failed attempts and deletes verification record', async() => {
    const env = createMockEnv();
    let deletedId: string | null = null;
    (env as any).AURA_DB = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('SELECT id, code, expires_at FROM email_verifications')) {
              return deletedId
                ? null
                : { id: 'EV_1', code: '654321', expires_at: new Date(Date.now() + 600_000).toISOString() };
            }
            return null;
          },
          run: async () => {
            if (sql.includes('DELETE FROM email_verifications')) {
              deletedId = String(args[0]);
            }
            return { rowCount: 1 };
          }
        })
      })
    };

    for (let i = 1; i <= 4; i++) {
      const req = mockRequest('POST', '/api/auth/verify-email', { email: 'otp@test.com', code: '000000' });
      const res = await verifyEmail(req, env as unknown as Record<string, unknown>);
      expect(res.status).toBe(401);
    }

    const req5 = mockRequest('POST', '/api/auth/verify-email', { email: 'otp@test.com', code: '000000' });
    const res5 = await verifyEmail(req5, env as unknown as Record<string, unknown>);
    expect(res5.status).toBe(429);
    expect(deletedId).toBe('EV_1');
  });

  it('sanitizes 500 error responses in registerWithVerification and verifyEmail', async() => {
    const brokenEnv = {
      ...createMockEnv(),
      AUTH_KV: {
        get: async () => { throw new Error('KV_SECRET_CONNECTION_FAILURE'); }
      },
      AURA_DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => { throw new Error('D1_INTERNAL_SQL_STACK_LEAK'); }
          })
        })
      }
    };

    const regReq = mockRequest('POST', '/api/auth/register', { email: 'err@test.com', password: 'Test1234!', name: 'Test' });
    const regRes = await registerWithVerification(regReq, brokenEnv as unknown as Record<string, unknown>);
    expect(regRes.status).toBe(500);
    const regData = await regRes.json() as Record<string, unknown>;
    expect(String(regData.error)).not.toContain('KV_SECRET_CONNECTION_FAILURE');

    const verReq = mockRequest('POST', '/api/auth/verify-email', { email: 'err@test.com', code: '123456' });
    const verRes = await verifyEmail(verReq, brokenEnv as unknown as Record<string, unknown>);
    expect(verRes.status).toBe(500);
    const verData = await verRes.json() as Record<string, unknown>;
    expect(String(verData.error)).not.toContain('D1_INTERNAL_SQL_STACK_LEAK');
  });

  it('verifies OpenAPI auth password hashes round-trip using PBKDF2', async() => {
    const { hashPassword, verifyPassword } = await import('../../routes/openapi-auth-handlers/helpers');
    const hash = await hashPassword('AuraSecurePass123!');
    expect(hash.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyPassword('AuraSecurePass123!', hash)).toBe(true);
    expect(await verifyPassword('WrongPass123!', hash)).toBe(false);
  });

  it('registerStaff mirrors new staff into D1 users even without tenant_id and listStaff returns normalized staff + users', async() => {
    const env = createMockEnv();
    const d1Inserted: Array<{ sql: string; args: unknown[] }> = [];
    (env as any).AURA_DB = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => {
            d1Inserted.push({ sql, args });
            return { rowCount: 1 };
          },
          all: async () => ({ results: [] }),
        }),
        all: async () => ({
          results: [
            {
              id: 'USR_D1_SEED',
              email: 'd1staff@aura.vn',
              name: 'D1 Seeded Staff',
              phone: '0905556666',
              role: 'manager',
              is_active: 1,
              created_at: '2026-10-10T08:00:00Z',
            },
          ],
        }),
      }),
    };

    const regReq = mockRequest('POST', '/api/auth/register-staff', {
      email: 'barista1@aura.vn',
      password: 'StaffPass123!',
      name: 'Barista One',
      phone: '0901234567',
      role: 'Barista',
    });
    const regRes = await registerStaff(regReq, env as unknown as Record<string, unknown>);
    expect(regRes.status).toBe(201);
    expect(d1Inserted.length).toBeGreaterThanOrEqual(1);
    expect(d1Inserted[0].sql).toContain('INSERT OR IGNORE INTO users');

    const listReq = mockRequest('GET', '/api/auth/staff');
    const listRes = await listStaff(listReq, env as unknown as Record<string, unknown>);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as {
      success: boolean;
      users: Array<Record<string, unknown>>;
      staff: Array<Record<string, unknown>>;
    };
    expect(listBody.success).toBe(true);
    expect(listBody.users.length).toBe(2);
    expect(listBody.staff.length).toBe(2);
    const kvStaff = listBody.staff.find((s) => s.email === 'barista1@aura.vn');
    expect(kvStaff).toMatchObject({
      name: 'Barista One',
      role: 'Barista',
      isActive: true,
    });
    const d1Staff = listBody.staff.find((s) => s.email === 'd1staff@aura.vn');
    expect(d1Staff).toMatchObject({
      id: 'USR_D1_SEED',
      name: 'D1 Seeded Staff',
      role: 'manager',
      isActive: true,
    });
  });

  it('getCurrentUser falls back to D1 users lookup for mobile staff JWT without email claim', async() => {
    const { generateJWT } = await import('../../lib/jwt');
    const env = createMockEnv();
    (env as any).AURA_DB = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM users WHERE id = ?') && args[0] === 'USR_MOB_99') {
              return {
                id: 'USR_MOB_99',
                email: 'waiter99@aura.vn',
                name: 'Waiter 99',
                phone: '0909998888',
                role: 'waiter',
              };
            }
            return null;
          },
        }),
      }),
    };

    const mobileToken = await generateJWT({ id: 'USR_MOB_99', role: 'waiter' }, TEST_JWT_SECRET, '8h');
    const meReq = mockRequestWithHeader('GET', '/mobile/me', { Authorization: `Bearer ${mobileToken}` });
    const meRes = await getCurrentUser(meReq, env);
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json() as { success: boolean; user: Record<string, unknown> };
    expect(meBody.success).toBe(true);
    expect(meBody.user).toMatchObject({
      id: 'USR_MOB_99',
      email: 'waiter99@aura.vn',
      name: 'Waiter 99',
      phone: '0909998888',
      role: 'waiter',
    });
  });
});
