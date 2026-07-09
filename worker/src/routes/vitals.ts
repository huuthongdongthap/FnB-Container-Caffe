/**
 * Vitals Route — POST /api/vitals
 * Web Vitals ingestion from sendBeacon (no auth, fire-and-forget).
 * Accepts LCP, FID, CLS, INP, TTFB, FCP metrics and writes to _metrics
 * with a 'web_vital_' name prefix for easy querying.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_NAMES = ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'FCP'] as const;

const vitalsSchema = z.object({
  name: z.enum(VALID_NAMES, { message: 'name must be one of: LCP, FID, CLS, INP, TTFB, FCP' }),
  value: z.number({ message: 'value must be a number' }),
  rating: z.string({ message: 'rating must be a string' }).min(1, 'rating cannot be empty')
});

// ─── Router ─────────────────────────────────────────────────────────────────

const vitalsRouter = new Hono<{ Bindings: Env }>();

vitalsRouter.post('/', async(c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = vitalsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { name, value, rating } = parsed.data;

  // Non-blocking: fire-and-forget write via ctx.waitUntil
  c.executionCtx.waitUntil(
    c.env.AURA_DB.prepare(
      'INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
    )
      .bind(
        `web_vital_${name}`,
        value,
        JSON.stringify({ rating, metric: name })
      )
      .run()
      .catch(() => {
        // vitals is non-critical — silently ignore
      })
  );

  return c.body(null, 204);
});

// ─── Registration ───────────────────────────────────────────────────────────

/**
 * Mount the vitals route at POST /api/vitals.
 * No auth required — sendBeacon does not support custom headers.
 */
export function registerVitalsRoute<E extends Env>(app: Hono<{ Bindings: E }>): void {
  app.route('/api/vitals', vitalsRouter);
}
