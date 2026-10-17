import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv, createMockKV } from '../test-utils';
import { submitContact, contactRouter } from '../../routes/contact';

describe('contact smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeEnv() {
    return { ...createMockEnv(), AURA_DB: createMockDB(), AUTH_KV: createMockKV() };
  }

  it('POST /api/contact — missing required fields returns 400', async() => {
    const req = new Request('https://test.aura/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const res = await contactRouter.fetch(req, makeEnv());
    expect(res.status).toBe(400);
  });

  it('POST /api/contact — valid body returns 201', async() => {
    const req = new Request('https://test.aura/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        phone: '0909123456',
        email: 'test@example.com',
        content: 'Hello this is a test message'
      })
    });

    const res = await contactRouter.fetch(req, makeEnv());
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });

  it('POST /api/contact — sanitizes internal D1 errors on HTTP 500 without leaking SQLite details', async() => {
    const env = makeEnv();
    env.AURA_DB.prepare = vi.fn().mockReturnValue({
      bind: () => ({
        run: () => Promise.reject(new Error('SQLITE_ERROR: table contact_messages has no column named internal_col'))
      })
    });

    const req = new Request('https://test.aura/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        phone: '0909123456',
        content: 'Hello this is a test message'
      })
    });

    const res = await contactRouter.fetch(req, env);
    expect(res.status).toBe(500);
    const bodyText = await res.text();
    expect(bodyText).not.toContain('SQLITE_ERROR');
    expect(bodyText).not.toContain('internal_col');
  });
});
