/**
 * Vitals Route — POST /api/vitals
 * Web Vitals ingestion from sendBeacon (no auth, fire-and-forget).
 * Accepts LCP, FID, CLS, INP, TTFB, FCP metrics and writes to _metrics
 * with a 'web_vital_' name prefix for easy querying.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { resolvePublicTenantId } from '../middleware/tenant';

// ─── Rate Limiting ──────────────────────────────────────────────────────────

const VITALS_RATE_LIMIT_MAX = 60;
const VITALS_RATE_LIMIT_WINDOW_MS = 60_000;
const vitalsRateBuckets = new Map<string, number[]>();

function resolveVitalsTenantId(
  c: { env: Env; req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined } },
  bodyTenantId?: string
): string {
  const candidates = [
    bodyTenantId,
    c.req.query('tenant_id'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Tenant-ID'),
  ];
  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim() && cand.trim() !== '*') {
      return cand.trim();
    }
  }
  try {
    const resolved = resolvePublicTenantId(c as unknown as Parameters<typeof resolvePublicTenantId>[0]);
    if (resolved && resolved.trim() && resolved.trim() !== '*') {
      return resolved.trim();
    }
  } catch {
    // fallback to default
  }
  return 'default';
}

function resolveClientIp(c: { req: { header: (k: string) => string | undefined } }): string {
  const raw =
    c.req.header('cf-connecting-ip') ||
    c.req.header('CF-Connecting-IP') ||
    c.req.header('x-forwarded-for')?.split(',')[0] ||
    c.req.header('X-Forwarded-For')?.split(',')[0] ||
    c.req.header('x-real-ip') ||
    'unknown';
  return raw.trim() || 'unknown';
}

async function isVitalsRateLimited(
  env: Env | undefined,
  tenantId: string,
  clientIp: string
): Promise<boolean> {
  const now = Date.now();
  const key = `${tenantId}:${clientIp}`;
  const cutoff = now - VITALS_RATE_LIMIT_WINDOW_MS;
  const existing = (vitalsRateBuckets.get(key) || []).filter((ts) => ts > cutoff);

  if (env?.AURA_KV && typeof env.AURA_KV.get === 'function') {
    try {
      const kvKey = `rl:vitals:${key}:${Math.floor(now / VITALS_RATE_LIMIT_WINDOW_MS)}`;
      const rawCount = await env.AURA_KV.get(kvKey);
      const kvCount = rawCount ? parseInt(rawCount, 10) : 0;
      if (Number.isFinite(kvCount) && kvCount >= VITALS_RATE_LIMIT_MAX) {
        return true;
      }
      if (typeof env.AURA_KV.put === 'function') {
        await env.AURA_KV.put(kvKey, String(Math.max(kvCount, existing.length) + 1), { expirationTtl: 60 });
      }
    } catch {
      // fall through to in-memory sliding window
    }
  }

  if (existing.length >= VITALS_RATE_LIMIT_MAX) {
    vitalsRateBuckets.set(key, existing);
    return true;
  }
  existing.push(now);
  vitalsRateBuckets.set(key, existing);
  return false;
}

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_NAMES = ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'FCP'] as const;
const VALID_RATINGS = ['good', 'needs-improvement', 'needsImprovement', 'poor'] as const;

const vitalsSchema = z.object({
  name: z.enum(VALID_NAMES, { message: 'name must be one of: LCP, FID, CLS, INP, TTFB, FCP' }),
  value: z.number({ message: 'value must be a number' }).finite('value must be finite').min(0, 'value cannot be negative').max(600000, 'value exceeds maximum bound'),
  rating: z.enum(VALID_RATINGS, { message: 'rating must be one of: good, needs-improvement, poor' }),
  tenant_id: z.string().trim().min(1).max(64).optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────────

const vitalsRouter = new Hono<{ Bindings: Env }>();

vitalsRouter.post('/', async(c) => {
  const clientIp = resolveClientIp(c);
  const preBodyTenant = resolveVitalsTenantId(c);
  if (await isVitalsRateLimited(c.env, preBodyTenant, clientIp)) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = vitalsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { name, value, rating, tenant_id: bodyTenantId } = parsed.data;
  const tenantId = resolveVitalsTenantId(c, bodyTenantId);

  const writePromise = c.env?.AURA_DB
    ? c.env.AURA_DB.prepare(
        'INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
      )
        .bind(
          `web_vital_${name}`,
          value,
          JSON.stringify({ rating, metric: name, tenant_id: tenantId })
        )
        .run()
        .catch(() => {
          // vitals is non-critical — silently ignore
        })
    : Promise.resolve();

  let scheduled = false;
  try {
    if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
      c.executionCtx.waitUntil(writePromise);
      scheduled = true;
    }
  } catch {
    scheduled = false;
  }
  if (!scheduled) {
    await writePromise;
  }

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
