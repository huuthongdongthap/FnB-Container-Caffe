import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createMockDB, createMockEnv } from '../test-utils';
import { clientErrorsRouter, sanitizeClientHref } from '../../routes/client-errors';

describe('Client Errors Route (/api/client-error)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeApp() {
    const app = new Hono();
    app.route('/api/client-error', clientErrorsRouter);
    return app;
  }

  it('normalizes ErrorBoundary payload (error, componentStack, url, timestamp) and scrubs URL secrets', async () => {
    const app = makeApp();
    const bindSpy = vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({ success: true }),
    });
    const env = {
      ...createMockEnv(),
      AURA_DB: {
        ...createMockDB(),
        prepare: vi.fn().mockReturnValue({ bind: bindSpy }),
      },
    };

    const req = new Request('https://auraspace.cafe/api/client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VitestBrowser/1.0',
      },
      body: JSON.stringify({
        error: 'Cannot read properties of undefined (reading "price")',
        stack: 'TypeError: Cannot read properties...\n  at CheckoutPage',
        componentStack: 'in CheckoutPage\n  in ErrorBoundary',
        url: 'https://auraspace.cafe/checkout?table=T02&token=eyJhbGciOiJIUzI1NiJ9&phone=0986470981#payment',
        timestamp: '2026-10-14T12:00:00.000Z',
      }),
    });

    const res = await app.fetch(req, env as any);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; id: string };
    expect(body.success).toBe(true);
    expect(body.id).toMatch(/^CE-/);

    expect(bindSpy).toHaveBeenCalledTimes(1);
    const [, route, message, stack, href, userAgent, ts] = bindSpy.mock.calls[0];
    expect(route).toBe('/checkout');
    expect(message).toBe('Cannot read properties of undefined (reading "price")');
    expect(stack).toContain('TypeError: Cannot read properties');
    expect(stack).toContain('--- Component Stack ---');
    expect(stack).toContain('in ErrorBoundary');
    expect(href).toContain('table=T02');
    expect(href).toContain('token=%5BREDACTED%5D');
    expect(href).toContain('phone=%5BREDACTED%5D');
    expect(href).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(href).not.toContain('0986470981');
    expect(href).not.toContain('#payment');
    expect(userAgent).toBe('VitestBrowser/1.0');
    expect(ts).toBe('2026-10-14T12:00:00.000Z');
  });

  it('normalizes api-client payload (path, message, url, timestamp)', async () => {
    const app = makeApp();
    const bindSpy = vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({ success: true }),
    });
    const env = {
      ...createMockEnv(),
      AURA_DB: {
        ...createMockDB(),
        prepare: vi.fn().mockReturnValue({ bind: bindSpy }),
      },
    };

    const req = new Request('https://auraspace.cafe/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'api_error',
        status: 502,
        message: 'Bad Gateway',
        path: '/api/orders',
        method: 'POST',
        url: 'https://auraspace.cafe/menu',
        timestamp: '2026-10-14T12:05:00.000Z',
      }),
    });

    const res = await app.fetch(req, env as any);
    expect(res.status).toBe(201);
    const [, route, message, , href, , ts] = bindSpy.mock.calls[0];
    expect(route).toBe('/api/orders');
    expect(message).toBe('Bad Gateway');
    expect(href).toBe('https://auraspace.cafe/menu');
    expect(ts).toBe('2026-10-14T12:05:00.000Z');
  });

  it('returns sanitized 500 response when D1 insert fails without leaking SQLite details', async () => {
    const app = makeApp();
    const env = {
      ...createMockEnv(),
      AURA_DB: {
        ...createMockDB(),
        prepare: vi.fn().mockReturnValue({
          bind: () => ({
            run: () => Promise.reject(new Error('SQLITE_ERROR: table client_errors is locked')),
          }),
        }),
      },
    };

    const req = new Request('https://auraspace.cafe/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Render crash' }),
    });

    const res = await app.fetch(req, env as any);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('SQLITE_ERROR');
    expect(text).toContain('Failed to record client error');
  });

  it('sanitizeClientHref handles relative or malformed URLs with sensitive parameters', () => {
    const scrubbed = sanitizeClientHref('/reset?code=998877&access_token=abc#hash');
    expect(scrubbed).toContain('code=[REDACTED]');
    expect(scrubbed).toContain('access_token=[REDACTED]');
    expect(scrubbed).not.toContain('998877');
    expect(scrubbed).not.toContain('abc');
  });
});
