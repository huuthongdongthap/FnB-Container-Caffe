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
});
