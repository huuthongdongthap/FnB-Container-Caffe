import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { campaignsRouter } from '../../routes/campaigns';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

vi.mock('../../middleware/auth', () => ({
  requireAuth: () => (_c: any, next: any) => next()
}));

describe('campaigns smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / — returns 200 with empty defaults', async() => {
    const app = new Hono();
    app.route('/api/campaigns', campaignsRouter);

    const req = new Request('https://test.aura/api/campaigns', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });

  it('GET /:trigger — invalid trigger returns 404', async() => {
    const app = new Hono();
    app.route('/api/campaigns', campaignsRouter);

    const req = new Request('https://test.aura/api/campaigns/invalid_trigger', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(404);
  });
});
