/**
 * Unit tests for auth routes (register, login, logout, getCurrentUser)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { registerUser, loginUser, logoutUser, getCurrentUser, bootstrapOwner } from '../../routes/auth';
import { createMockEnv, createMockKV, TEST_JWT_SECRET } from '../test-utils';

function mockRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockRequestWithHeader(method: string, path: string, headers: Record<string, string>, body?: unknown): Request {
  return new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('registerUser', () => {
  it('registers a new user', async () => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/register', { email: 'new@test.com', password: 'Test1234!', name: 'New User' });
    const res = await registerUser(req, env);
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.token).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    const env = createMockEnv();
    const req1 = mockRequest('POST', '/api/auth/register', { email: 'dup@test.com', password: 'Test1234!' });
    await registerUser(req1, env);
    const req2 = mockRequest('POST', '/api/auth/register', { email: 'dup@test.com', password: 'Test1234!' });
    const res2 = await registerUser(req2, env);
    expect(res2.status).toBe(409);
  });

  it('rejects invalid email format', async () => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/register', { email: 'not-email', password: 'Test1234!' });
    const res = await registerUser(req, env);
    expect(res.status).toBe(400);
  });
});

describe('loginUser', () => {
  it('logs in with valid credentials', async () => {
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

  it('rejects wrong password', async () => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/login', { email: 'nonexist@test.com', password: 'WrongPass1!' });
    const res = await loginUser(req, env);
    expect(res.status).toBe(401);
  });
});

describe('getCurrentUser', () => {
  it('returns user info for valid token', async () => {
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

  it('rejects missing auth header', async () => {
    const env = createMockEnv();
    const req = mockRequest('GET', '/api/auth/me');
    const res = await getCurrentUser(req, env);
    expect(res.status).toBe(401);
  });
});

describe('logoutUser', () => {
  it('revokes token on logout', async () => {
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
  it('creates first owner', async () => {
    const env = createMockEnv();
    const req = mockRequest('POST', '/api/auth/bootstrap', { email: 'owner@test.com', password: 'Owner1234!', name: 'Owner' });
    const res = await bootstrapOwner(req, env);
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });
});
