/**
 * Body limit middleware tests.
 *
 * Built on a real Hono app so the middleware runs exactly as it does in
 * production: the payload is actually streamed and the ceiling is actually
 * enforced by Hono, not by an injected mock.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  orderBodyLimit,
  authBodyLimit,
  ORDER_BODY_LIMIT,
  AUTH_BODY_LIMIT,
} from '../../middleware/body-limit';

function buildApp(maxSize: number) {
  const app = new Hono();
  app.use('/*', maxSize === ORDER_BODY_LIMIT ? orderBodyLimit() : authBodyLimit());
  app.post('/submit', async(c) => {
    const body = await c.req.json<{ pad?: string }>();
    return c.json({ ok: true, received: body.pad?.length ?? 0 });
  });
  return app;
}

function payloadOfBytes(size: number): string {
  // A JSON string of N bytes: {"pad":"<N-10 chars>"}
  const filler = 'a'.repeat(Math.max(0, size - 10));
  return JSON.stringify({ pad: filler });
}

describe('order body limit', () => {
  it('accepts a payload just under the ceiling', async () => {
    const app = buildApp(ORDER_BODY_LIMIT);
    const res = await app.request('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payloadOfBytes(ORDER_BODY_LIMIT - 2),
    });

    expect(res.status).toBe(200);
  });

  it('rejects a payload over the ceiling with 413', async () => {
    const app = buildApp(ORDER_BODY_LIMIT);
    const res = await app.request('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payloadOfBytes(ORDER_BODY_LIMIT + 2),
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.limit).toBe(ORDER_BODY_LIMIT);
  });
});

describe('auth body limit', () => {
  it('accepts an OTP-sized payload', async () => {
    const app = buildApp(AUTH_BODY_LIMIT);
    const res = await app.request('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payloadOfBytes(512),
    });

    expect(res.status).toBe(200);
  });

  it('rejects a payload larger than the auth ceiling', async () => {
    const app = buildApp(AUTH_BODY_LIMIT);
    const res = await app.request('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payloadOfBytes(AUTH_BODY_LIMIT + 2),
    });

    expect(res.status).toBe(413);
  });

  it('allows a payload that fits for orders but not for auth', async () => {
    // A 64KB body is fine for an order but must fail the 10KB auth ceiling.
    const orderApp = buildApp(ORDER_BODY_LIMIT);
    const authApp = buildApp(AUTH_BODY_LIMIT);
    const payload = payloadOfBytes(64 * 1024);

    const orderRes = await orderApp.request('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    const authRes = await authApp.request('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });

    expect(orderRes.status).toBe(200);
    expect(authRes.status).toBe(413);
  });
});
