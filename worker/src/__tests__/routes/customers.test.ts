import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { customersRouter } from '../../routes/customers';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

describe('customers smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / — returns 200 with empty list', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);

    const req = new Request('https://test.aura/api/customers', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB(), JWT_SECRET: 'test-jwt-secret-at-least-16-chars' };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });

  it('GET /segments — missing auth returns 401', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);

    const req = new Request('https://test.aura/api/customers/segments', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB(), JWT_SECRET: 'test-jwt-secret-at-least-16-chars' };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it('GET / — enforces staff/manager/owner auth in production environment', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);

    const prodEnv = {
      ...createMockEnv(),
      ENVIRONMENT: 'production',
      AURA_DB: makeDB(),
      JWT_SECRET: 'test-jwt-secret-at-least-16-chars'
    };

    const unauthReq = new Request('https://test.aura/api/customers', { method: 'GET' });
    const unauthRes = await app.fetch(unauthReq, prodEnv);
    expect(unauthRes.status).toBe(401);

    const { generateJWT } = await import('../../lib/jwt');
    const customerToken = await generateJWT({ id: 'c1', role: 'customer', email: 'c@test.aura' } as any, prodEnv.JWT_SECRET);
    const customerReq = new Request('https://test.aura/api/customers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const customerRes = await app.fetch(customerReq, prodEnv);
    expect(customerRes.status).toBe(403);

    const managerToken = await generateJWT({ id: 'm1', role: 'manager', email: 'm@test.aura' } as any, prodEnv.JWT_SECRET);
    const managerReq = new Request('https://test.aura/api/customers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const managerRes = await app.fetch(managerReq, prodEnv);
    expect(managerRes.status).toBe(200);
  });

  it('GET /segments — sanitizes internal D1 errors on HTTP 500', async() => {
    const app = new Hono();
    app.route('/api/customers', customersRouter);
    const db = makeDB();
    db.prepare = vi.fn().mockReturnValue({
      bind: () => ({ first: () => Promise.reject(new Error('SQLITE_ERROR: no such column secret_col')) }),
      first: () => Promise.reject(new Error('SQLITE_ERROR: no such column secret_col'))
    });

    const { generateJWT } = await import('../../lib/jwt');
    const secret = 'test-jwt-secret-at-least-16-chars';
    const token = await generateJWT({ id: 'm1', role: 'manager', email: 'm@test.aura' } as any, secret);
    const req = new Request('https://test.aura/api/customers/segments', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    const res = await app.fetch(req, { ...createMockEnv(), AURA_DB: db, JWT_SECRET: secret });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('SQLITE_ERROR');
    expect(text).not.toContain('secret_col');
  });
});
