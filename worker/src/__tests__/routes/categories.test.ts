import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { categoriesRouter } from '../../routes/categories';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

describe('categories smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / — returns 200 with empty list', async() => {
    const app = new Hono();
    app.route('/api/categories', categoriesRouter);

    const req = new Request('https://test.aura/api/categories', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });

  it('GET /:id — missing category returns 404', async() => {
    const app = new Hono();
    app.route('/api/categories', categoriesRouter);

    const req = new Request('https://test.aura/api/categories/nonexistent', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(404);
  });
});
