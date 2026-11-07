/**
 * Request Metrics Middleware — captures method, path, status, duration for every request.
 * Uses ctx.waitUntil() for zero-latency D1 writes.
 *
 * Register in index.ts:
 *   app.use('*', requestMetrics());
 */
import type { MiddlewareHandler } from 'hono';
import { createMetricsCollector } from '../lib/metrics-collector';
import type { Env } from '../types/env';

export function requestMetrics(): MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    const start = Date.now();
    try {
      await next();
    } finally {
      const duration = Date.now() - start;
      const status = c.res?.status ?? 500;
      let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
      try {
        ctx = c.executionCtx;
      } catch {
        // No execution context in testing
      }
      if (ctx) {
        const ctxGetter = (c as unknown as { get?: (k: string) => unknown }).get;
        const rawCtxTenant = typeof ctxGetter === 'function' ? String(ctxGetter.call(c, 'tenantId') || '').trim() : '';
        const rawHdrTenant = String(c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id') || '').trim();
        const rawPilotTenant = typeof (c.env as unknown as Record<string, unknown> | undefined)?.PILOT_TENANT_ID === 'string'
          ? String((c.env as unknown as Record<string, unknown>).PILOT_TENANT_ID).trim()
          : '';
        const resolvedTenant =
          (rawCtxTenant && rawCtxTenant !== '*' ? rawCtxTenant : '') ||
          (rawHdrTenant && rawHdrTenant !== '*' ? rawHdrTenant : '') ||
          (rawPilotTenant && rawPilotTenant !== '*' ? rawPilotTenant : '') ||
          'default';
        const mc = createMetricsCollector(c.env.AURA_DB);
        ctx.waitUntil(mc.recordMetric('request', 1, {
          method: c.req.method,
          path: c.req.path,
          status,
          duration,
          tenant_id: resolvedTenant,
        }));
      }
    }
  };
}
