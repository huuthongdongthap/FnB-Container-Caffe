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
          'INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          user.id,
          user.name || user.email || 'unknown',
          action,
          action.split('_')[0] || 'resource', // e.g., 'product' from 'product_create'
          extractResourceId(c, action) || null,
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

function extractResourceId(c: { req: { method: string; path: string; param: (key: string) => string | undefined } }, action: string): string | undefined {
  // Try to extract resource ID from path params
  const id = c.req.param('id');
  if (id) return id;

  // Fallback: extract from path like /api/products/abc123
  const pathParts = c.req.path.split('/').filter(Boolean);
  if (pathParts.length >= 3) {
    return pathParts[pathParts.length - 1];
  }
  return undefined;
}
