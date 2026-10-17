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

  it('GET /conversations — returns 401 when unauthenticated', async() => {
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

  it('POST /messages — enforces IP rate limit across rotating phone numbers and scrubs 500 errors', async() => {
    const app = new Hono();
    app.route('/api/chat', chatRouter);

    const kv = createMockKV({ 'rl:chat:ip:203.0.113.77': '20' });
    const env = { ...createMockEnv(), AURA_DB: makeDB(), AUTH_KV: kv };

    const rateLimitedReq = new Request('https://test.aura/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.77',
      },
      body: JSON.stringify({ name: 'Spammer', phone: '0901234567', message: 'Spam' }),
    });
    const rlRes = await app.fetch(rateLimitedReq, env);
    expect(rlRes.status).toBe(429);

    const brokenDb = {
      prepare: () => ({
        bind: () => ({
          run: async () => { throw new Error('D1_CHAT_SQL_LEAK'); },
        }),
      }),
    };
    const errEnv = { ...createMockEnv(), AURA_DB: brokenDb, AUTH_KV: createMockKV() };
    const errReq = new Request('https://test.aura/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Customer', phone: '0909998887', message: 'Hello' }),
    });
    const errRes = await app.fetch(errReq, errEnv);
    expect(errRes.status).toBe(500);
    const errBody = await errRes.json() as { error: string };
    expect(errBody.error).toBe('Failed to send message');
    expect(errBody.error).not.toContain('D1_CHAT_SQL_LEAK');
  });
});
