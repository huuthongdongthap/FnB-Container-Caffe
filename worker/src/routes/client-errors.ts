/**
 * Client Error Reporting — POST /api/client-error
 *
 * Receives uncaught-render reports from the SPA's ErrorBoundary and stores
 * them in the `client_errors` table for later triage. Fire-and-forget:
 * the boundary never awaits the response.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

export const clientErrorsRouter = new Hono<{ Bindings: Env }>();

clientErrorsRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;
  let body: Record<string, unknown>;
  try {
    body = await c.req.json() as Record<string, unknown>;
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const route = String(body.route || '').slice(0, 255);
  const message = String(body.message || 'Unknown error').slice(0, 1000);
  const stack = body.stack ? String(body.stack).slice(0, 4000) : null;
  const href = body.href ? String(body.href).slice(0, 500) : null;
  const ts = body.ts ? String(body.ts) : new Date().toISOString();

  const id = `CE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    `INSERT INTO client_errors (id, route, message, stack, href, user_agent, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, route, message, stack, href, c.req.header('User-Agent') || null, ts).run();

  return c.json({ success: true, id }, 201);
});
