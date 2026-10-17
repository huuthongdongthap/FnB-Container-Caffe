/**
 * Observability & Reliability Middleware Integration Verification
 * Tests HTTP request lifecycle:
 * - W3C traceparent extraction & header propagation
 * - Error handler mapping & response normalization
 * - Correlation ID preservation across Hono context
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { correlationIdMiddleware } from '../../middleware/correlation-id';
import { errorHandler, AppError } from '../../middleware/error-handler';
import { z } from 'zod';
import type { Env } from '../../types/env';

describe('Observability Middleware — HTTP Trace & Error Contracts', () => {
  function createTestApp() {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', correlationIdMiddleware());
    app.onError(errorHandler);

    app.get('/test/trace', (c) => {
      const trace = c.get('traceContext' as any);
      return c.json({
        traceId: trace?.traceId,
        correlationId: trace?.correlationId
      });
    });

    app.get('/test/business-error', () => {
      throw new AppError('Product is out of stock', 422, 'Món đã hết hàng');
    });

    app.get('/test/auth-error', () => {
      throw new AppError('Unauthorized: token expired', 401);
    });

    app.get('/test/infra-error', () => {
      throw new Error('D1 database connection timeout');
    });

    app.post('/test/validation', async (c) => {
      const schema = z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive()
      });
      const body = await c.req.json();
      schema.parse(body);
      return c.json({ ok: true });
    });

    return app;
  }

  it('preserves inbound W3C traceparent and returns correlation headers', async () => {
    const app = createTestApp();
    const inboundTrace = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

    const res = await app.request('/test/trace', {
      headers: {
        traceparent: inboundTrace,
        'x-correlation-id': 'custom_corr_888'
      }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('x-correlation-id')).toBe('custom_corr_888');
    expect(res.headers.get('traceparent')?.startsWith('00-4bf92f3577b34da6a3ce929d0e0e4736-')).toBe(true);

    const body = (await res.json()) as { traceId: string; correlationId: string };
    expect(body.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(body.correlationId).toBe('custom_corr_888');
  });

  it('handles business rule AppError with HTTP 422 and actionable message', async () => {
    const app = createTestApp();
    const res = await app.request('/test/business-error');

    expect(res.status).toBe(422);
    const body = (await res.json()) as { success: boolean; error: string; code: string; correlationId: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Product is out of stock');
    expect(body.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(body.correlationId).toBeDefined();
  });

  it('handles validation failure with structured fields and 400 status', async () => {
    const app = createTestApp();
    const res = await app.request('/test/validation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', quantity: -1 })
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; code: string; fields: Array<{ field: string }> };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields.length).toBeGreaterThan(0);
  });

  it('masks internal infrastructure errors from client responses', async () => {
    const app = createTestApp();
    const res = await app.request('/test/infra-error');

    expect(res.status).toBe(504); // Classified as timeout / retryable infra error
    const body = (await res.json()) as { success: boolean; error: string; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('DEPENDENCY_TIMEOUT');
    expect(body.error).not.toContain('stack');
  });
});
