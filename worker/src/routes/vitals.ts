/**
 * Vitals Route — POST /api/vitals
 * Web Vitals ingestion from sendBeacon (no auth, fire-and-forget).
 * Accepts LCP, FID, CLS, INP, TTFB, FCP metrics and writes to _metrics
 * with a 'web_vital_' name prefix for easy querying.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getClientIdentifier } from '../middleware/rate-limit';
import type { Env } from '../types/env';

// ─── Rate Limiting ──────────────────────────────────────────────────────────

const VITALS_RATE_LIMIT_MAX = 60;
const VITALS_RATE_LIMIT_WINDOW_MS = 60_000;
const VITALS_RATE_BUCKET_MAX_KEYS = 1000;
const vitalsRateBuckets = new Map<string, number[]>();

const VALID_TENANT_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidTenantId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== '*' && VALID_TENANT_RE.test(value.trim());
}

function resolveVitalsTenantId(
  c: {
    env: Env;
    get?: (key: string) => unknown;
    req: { header: (k: string) => string | undefined };
  },
): string {
  // Never trust unauthenticated headers, query params, or body.tenant_id on public beacon endpoint
  const user = typeof c.get === 'function' ? (c.get('user') as { tenant_id?: unknown; tenantId?: unknown } | undefined) : undefined;
  if (!user) {
    return 'default';
  }
  const authCandidates: unknown[] = [
    user.tenant_id,
    user.tenantId,
    typeof c.get === 'function' ? c.get('tenantId') : undefined,
  ];
  for (const cand of authCandidates) {
    if (isValidTenantId(cand)) {
      return cand.trim();
    }
  }
  return 'default';
}

async function isVitalsRateLimited(
  env: Env | undefined,
  clientIp: string
): Promise<boolean> {
  const now = Date.now();
  const key = clientIp;
  const cutoff = now - VITALS_RATE_LIMIT_WINDOW_MS;
  const existing = (vitalsRateBuckets.get(key) || []).filter((ts) => ts > cutoff);

  if (env?.AUTH_KV && typeof env.AUTH_KV.get === 'function') {
    try {
      const kvKey = `rl:vitals:${key}:${Math.floor(now / VITALS_RATE_LIMIT_WINDOW_MS)}`;
      const rawCount = await env.AUTH_KV.get(kvKey);
      const kvCount = rawCount ? parseInt(rawCount, 10) : 0;
      if (Number.isFinite(kvCount) && kvCount >= VITALS_RATE_LIMIT_MAX) {
        return true;
      }
      if (typeof env.AUTH_KV.put === 'function') {
        await env.AUTH_KV.put(kvKey, String(Math.max(kvCount, existing.length) + 1), { expirationTtl: 60 });
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

  if (vitalsRateBuckets.size > VITALS_RATE_BUCKET_MAX_KEYS) {
    for (const [bucketKey, timestamps] of vitalsRateBuckets) {
      const active = timestamps.filter((ts) => ts > cutoff);
      if (active.length === 0) {
        vitalsRateBuckets.delete(bucketKey);
      } else {
        vitalsRateBuckets.set(bucketKey, active);
      }
    }
    while (vitalsRateBuckets.size > VITALS_RATE_BUCKET_MAX_KEYS) {
      const oldestKey = vitalsRateBuckets.keys().next().value;
      if (oldestKey === undefined) break;
      vitalsRateBuckets.delete(oldestKey);
    }
  }
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
  const clientIp = getClientIdentifier(c);
  if (await isVitalsRateLimited(c.env, clientIp)) {
    return c.json({ error: 'Too many requests' }, 429);
  }
  const preBodyTenant = resolveVitalsTenantId(c);

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = vitalsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { name, value, rating } = parsed.data;
  const tenantId = preBodyTenant;

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
