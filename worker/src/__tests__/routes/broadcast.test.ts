import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { broadcastRouter } from '../../routes/broadcast';
import { segmentSQL } from '../../routes/broadcast-handlers/types';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

describe('broadcast smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /send — missing fields returns 400', async() => {
    const app = new Hono();
    app.route('/api/broadcast', broadcastRouter);

    const req = new Request('https://test.aura/api/broadcast/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('POST /send — invalid channel returns 400', async() => {
    const app = new Hono();
    app.route('/api/broadcast', broadcastRouter);

    const req = new Request('https://test.aura/api/broadcast/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment: 'all', channel: 'invalid', message: 'test' })
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('segmentSQL uses case-insensitive LOWER(loyalty_tier) for D1 tier matching', () => {
    expect(segmentSQL('loyalty_bronze').sql).toContain("LOWER(loyalty_tier) = 'bronze'");
    expect(segmentSQL('loyalty_silver').sql).toContain("LOWER(loyalty_tier) = 'silver'");
    expect(segmentSQL('loyalty_gold').sql).toContain("LOWER(loyalty_tier) = 'gold'");
    expect(segmentSQL('loyalty_platinum').sql).toContain("LOWER(loyalty_tier) = 'platinum'");
  });
});
