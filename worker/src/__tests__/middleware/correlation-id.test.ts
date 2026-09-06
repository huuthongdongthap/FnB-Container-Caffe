import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { correlationId, REQUEST_ID_HEADER } from '../../middleware/correlation-id';

describe('correlationId middleware', () => {
  const app = new Hono();
  app.use('*', correlationId());
  app.get('/ping', (c) => c.json({ ok: true }));

  it('mints a request id and echoes it in the response header', async() => {
    const res = await app.request('/ping');
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).toBeTruthy();
    expect(id!.startsWith('r_')).toBe(true);
  });

  it('propagates a valid inbound X-Request-ID unchanged', async() => {
    const res = await app.request('/ping', { headers: { 'X-Request-ID': 'upstream-trace-123' } });
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('upstream-trace-123');
  });

  it('rejects a too-short inbound id and mints a fresh one', async() => {
    const res = await app.request('/ping', { headers: { 'X-Request-ID': 'abc' } });
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).not.toBe('abc');
    expect(id!.startsWith('r_')).toBe(true);
  });

  it('rejects an oversized inbound id', async() => {
    const res = await app.request('/ping', {
      headers: { 'X-Request-ID': 'x'.repeat(200) }
    });
    expect(res.headers.get(REQUEST_ID_HEADER)!.startsWith('r_')).toBe(true);
  });
});
