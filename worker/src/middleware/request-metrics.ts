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
        const mc = createMetricsCollector(c.env.AURA_DB);
        ctx.waitUntil(mc.recordMetric('request', 1, {
          method: c.req.method,
          path: c.req.path,
          status,
          duration
        }));
      }
    }
  };
}
