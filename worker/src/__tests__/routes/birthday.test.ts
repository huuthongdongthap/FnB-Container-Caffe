import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { birthdayRouter } from '../../routes/birthday';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

describe('birthday smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /check — missing params returns 400', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);

    const req = new Request('https://test.aura/api/birthday/check', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('GET /check — no customer found returns eligible:false', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);

    const req = new Request('https://test.aura/api/birthday/check?phone=0000000000', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.data.eligible).toBe(false);
  });

  it('POST /redeem — missing body returns 400', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);

    const req = new Request('https://test.aura/api/birthday/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });
});
