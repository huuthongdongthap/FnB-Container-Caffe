/**
 * Audit Log Middleware
 * Logs admin actions to D1 for compliance.
 * Converted from middleware/audit-log.js.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';

export function audit(action: string): MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    await next();
    try {
      const user = c.get('user');
      if (user && c.env.AURA_DB) {
        const now = new Date().toISOString();
        await c.env.AURA_DB.prepare(
          'INSERT INTO audit_log (user_id, action, details, ip, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          user.id,
          action,
          JSON.stringify({ method: c.req.method, path: c.req.path }),
          c.req.header('cf-connecting-ip') || null,
          now
        ).run().catch(() => { /* non-fatal */ });
      }
    } catch {
      // non-fatal
    }
  };
}
