// @vitest-environment node
/**
 * Unit tests for auth routes (register, login, logout, getCurrentUser)
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { registerUser, registerWithVerification, verifyEmail, loginUser, logoutUser, getCurrentUser, bootstrapOwner, registerStaff, listStaff, expiresAtFromNow } from '../../routes/auth';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
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

const sqliteDatabases: Array<{ close(): void }> = [];
afterEach(() => { for (const db of sqliteDatabases.splice(0)) db.close(); });

describe('bootstrapOwner', () => {
  it('creates first owner', async() => {
    const db = paymentSqliteDB({ canonicalStaff: true }); sqliteDatabases.push(db.sqlite);
    const env = createMockEnv({ AURA_DB: db.db });
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

  it('registerStaff writes canonical tenant authority and listStaff returns normalized staff + users', async() => {
    const f = staffSessionFixture(); sqliteDatabases.push(f.sqlite);
    const token = await f.token('owner');
    const req = mockRequestWithHeader('POST', '/api/auth/register-staff', { Authorization: `Bearer ${token}` }, {
      email: 'barista1@aura.vn', password: 'StaffPass123!', name: 'Barista One', phone: '0901234567', role: 'Barista',
    });
    const registered = await registerStaff(req, f.env);
    expect(registered.status).toBe(201);
    const created = (await registered.json()).user;
    expect(f.sqlite.prepare('SELECT role, tenant_id, auth_version FROM users WHERE id = ?').get(created.id))
      .toMatchObject({ role: 'barista', tenant_id: 'cafe-a', auth_version: 1 });
    const list = await listStaff(mockRequestWithHeader('GET', '/api/auth/staff', { Authorization: `Bearer ${token}` }), f.env);
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.staff).toEqual(body.users);
    expect(body.staff.find((row: any) => row.id === created.id))
      .toMatchObject({ email: 'barista1@aura.vn', name: 'Barista One', role: 'barista', isActive: true });
    expect(body.staff.map((row: any) => row.id)).not.toContain('other');
  });

  it('getCurrentUser reads canonical mobile Staff authority without an email column or KV profile', async() => {
    const f = staffSessionFixture(); sqliteDatabases.push(f.sqlite);
    const token = await f.token('staff', true);
    const response = await getCurrentUser(mockRequestWithHeader('GET', '/mobile/me', { Authorization: `Bearer ${token}` }), f.env);
    expect(response.status).toBe(200);
    expect((await response.json()).user).toMatchObject({ id: 'staff', email: '', name: 'Name staff', role: 'staff', tenantId: 'cafe-a' });
  });

  it('GET /api/auth/devices lists canonical staff_devices and OpenAPI auth/staff handlers work on minimal canonical D1', async() => {
    const f = staffSessionFixture(); sqliteDatabases.push(f.sqlite);
    const staffToken = await f.token('staff', true);
    const devRes = await f.request('/api/auth/devices', staffToken);
    expect(devRes.status).toBe(200);
    const devBody = (await devRes.json()) as { success: boolean; data: Array<{ id: string; fingerprint: string; platform: string; isTrusted: boolean }> };
    expect(devBody.success).toBe(true);
    expect(devBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'device-1', fingerprint: 'local-device-token', platform: 'mobile', isTrusted: true }),
      ])
    );

    const { openApiAuthRouter } = await import('../../routes/openapi-auth');
    const ownerToken = await f.token('owner');
    const regStaffRes = await openApiAuthRouter.request(
      '/api/auth/register-staff',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'OpenAPI Waiter', email: 'openapi.waiter@aura.vn', password: 'WaiterPass123!', role: 'waiter' }),
      },
      f.env
    );
    expect(regStaffRes.status).toBe(201);
    const regStaffBody = (await regStaffRes.json()) as { success: boolean; data: { id: string; email: string; role: string } };
    expect(regStaffBody.data).toMatchObject({ email: 'openapi.waiter@aura.vn', role: 'waiter' });
    const identityRow = f.sqlite.prepare('SELECT email, staff_id FROM staff_login_identities WHERE staff_id = ?').get(regStaffBody.data.id) as { email: string; staff_id: string };
    expect(identityRow).toEqual({ email: 'openapi.waiter@aura.vn', staff_id: regStaffBody.data.id });

    const listStaffRes = await openApiAuthRouter.request(
      '/api/auth/staff',
      { method: 'GET', headers: { Authorization: `Bearer ${ownerToken}` } },
      f.env
    );
    expect(listStaffRes.status).toBe(200);
    const listStaffBody = (await listStaffRes.json()) as { data: { staff: Array<{ id: string; email: string }> } };
    expect(listStaffBody.data.staff.find((s) => s.id === regStaffBody.data.id)?.email).toBe('openapi.waiter@aura.vn');

    const loginRes = await openApiAuthRouter.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'openapi.waiter@aura.vn', password: 'WaiterPass123!' }),
      },
      f.env
    );
    expect(loginRes.status).toBe(200);

    const meRes = await openApiAuthRouter.request(
      '/api/auth/me',
      { method: 'GET', headers: { Authorization: `Bearer ${ownerToken}` } },
      f.env
    );
    expect(meRes.status).toBe(200);
  });
});
