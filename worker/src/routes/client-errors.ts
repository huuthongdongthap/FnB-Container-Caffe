/**
 * Client Error Reporting — POST /api/client-error
 *
 * Receives uncaught-render reports from the SPA's ErrorBoundary and stores
 * them in the `client_errors` table for later triage. Fire-and-forget:
 * the boundary never awaits the response.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { createLogger } from '../middleware/logger';
import { rateLimitMiddleware, CLIENT_ERROR_RATE_LIMIT } from '../middleware/rate-limit';

const log = createLogger({ route: 'client-errors' });

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'code',
  'secret',
  'password',
  'phone',
  'email',
  'key',
  'authorization'
]);

export function sanitizeClientHref(rawHref: string): string | null {
  if (!rawHref) return null;
  try {
    const parsed = new URL(rawHref);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    parsed.hash = '';
    return parsed.toString().slice(0, 500);
  } catch {
    return rawHref
      .replace(/([?&](?:token|access_token|refresh_token|code|secret|password|phone|email|key|authorization)=)[^&#]*/gi, '$1[REDACTED]')
      .slice(0, 500);
  }
}

function extractRouteFromUrl(rawHref: string): string {
  if (!rawHref) return '';
  try {
    return new URL(rawHref).pathname;
  } catch {
    return '';
  }
}

export const clientErrorsRouter = new Hono<{ Bindings: Env }>();

const MAX_CLIENT_ERROR_BODY_BYTES = 64 * 1024;

clientErrorsRouter.post('/', rateLimitMiddleware(CLIENT_ERROR_RATE_LIMIT), async(c) => {
  const contentLength = Number(c.req.header('content-length') || 0);
  if (contentLength > MAX_CLIENT_ERROR_BODY_BYTES) {
    return c.json({ success: false, error: 'Payload too large' }, 413);
  }
  const db = c.env.AURA_DB;
  let body: Record<string, unknown>;
  try {
    const rawBody = await c.req.text();
    if (rawBody.length > MAX_CLIENT_ERROR_BODY_BYTES) {
      return c.json({ success: false, error: 'Payload too large' }, 413);
    }
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const rawHref = body.href ? String(body.href) : (body.url ? String(body.url) : '');
  const route = String(body.route || body.path || extractRouteFromUrl(rawHref) || '').slice(0, 255);
  const message = String(body.message || body.error || 'Unknown error').slice(0, 1000);
  const stackParts = [
    body.stack ? String(body.stack) : '',
    body.componentStack ? String(body.componentStack) : ''
  ].filter(Boolean);
  const stack = stackParts.length > 0 ? stackParts.join('\n--- Component Stack ---\n').slice(0, 4000) : null;
  const href = sanitizeClientHref(rawHref);
  const ts = String(body.ts || body.timestamp || new Date().toISOString()).slice(0, 64);

  const id = `CE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await db.prepare(
      `INSERT INTO client_errors (id, route, message, stack, href, user_agent, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, route, message, stack, href, c.req.header('User-Agent') || null, ts).run();

    return c.json({ success: true, id }, 201);
  } catch (error) {
    log.error('Failed to persist client error report', { message: (error as Error).message });
    return c.json({ success: false, error: 'Failed to record client error' }, 500);
  }
});
