import { describe, it, vi } from 'vitest';

vi.mock('../../middleware/auth', () => ({
  requireAuth: () => (_c: any, next: any) => next()
}));

import { dindinRouter } from '../routes/dindin';

describe('env check', () => {
  it('checks c.env shape', async() => {
    const env: any = { AURA_DB: null, AUTH_KV: null, JWT_SECRET: 't', RESET_KEY: 't' };
    const res = await dindinRouter.request(
      new Request('http://test/config', { method: 'GET' }),
      env
    );
    console.log('STATUS', res.status);
    console.log('HEADERS', [...res.headers.entries()]);
    const text = await res.text();
    console.log('BODY', text);
  });
});
