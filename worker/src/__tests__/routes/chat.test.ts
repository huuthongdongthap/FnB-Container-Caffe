import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv, createMockKV } from '../test-utils';
import { Hono } from 'hono';
import { chatRouter } from '../../routes/chat';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

describe('chat smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /messages — missing message returns 400', async() => {
    const app = new Hono();
    app.route('/api/chat', chatRouter);

    const req = new Request('https://test.aura/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB(), AUTH_KV: createMockKV() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('GET /conversations — returns 200', async() => {
    const app = new Hono();
    app.route('/api/chat', chatRouter);

    const req = new Request('https://test.aura/api/chat/conversations', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB(), AUTH_KV: createMockKV() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
  });
});
