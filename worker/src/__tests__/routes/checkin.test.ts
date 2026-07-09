import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { checkinRouter } from '../../routes/checkin';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

vi.mock('../../middleware/auth', () => ({
  requireAuth: () => (_c: any, next: any) => next()
}));

describe('checkin smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST / — missing body returns 400', async() => {
    const app = new Hono();
    app.route('/api/checkin', checkinRouter);

    const req = new Request('https://test.aura/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('GET / — returns 200 with empty list', async() => {
    const app = new Hono();
    app.route('/api/checkin', checkinRouter);

    const req = new Request('https://test.aura/api/checkin', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });
});
