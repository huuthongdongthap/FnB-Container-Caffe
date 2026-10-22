/**
 * Audit Log Middleware
 * Logs admin actions to D1 for compliance.
 * Converted from middleware/audit-log.js.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { writeCanonicalAuditLog } from '@aura/domain-audit';

export function audit(action: string): MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    await next();
    try {
      const user = c.get('user') as { id?: string; name?: string; email?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
      if (user && c.env.AURA_DB) {
        await writeCanonicalAuditLog(c.env.AURA_DB, {
          actor: {
            id: user.id || 'unknown',
            name: user.name || user.email || 'unknown',
            role: user.role,
            tenantId: user?.tenantId ?? user?.tenant_id,
          },
          action,
          resourceType: action.split('_')[0] || 'resource',
          resourceId: extractResourceId(c) || null,
          metadata: { method: c.req.method, path: c.req.path },
          ipAddress: c.req.header('cf-connecting-ip') || null,
        }, { policy: 'best_effort' });
      }
    } catch {
      // non-fatal
    }
  };
}

function extractResourceId(c: { req: { method: string; path: string; param: (key: string) => string | undefined } }): string | undefined {
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

/**
 * Records a privileged tenant override.
 *
 * Cross-tenant reads are a privilege-escalation path for HQ super-admins, so
 * every activation must leave a durable trail with from/to/by for SIEM review.
 * Fire-and-forget: an audit write failure must never block the request it describes.
 */
export function writeTenantOverrideAudit(
  c: { env?: Env; req?: { method?: string; path?: string; header?: (name: string) => string | undefined } },
  user: { id?: string; name?: string; email?: string; role?: string; tenantId?: string } | undefined,
  from: string | undefined,
  to: string
): void {
  if (!c.env?.AURA_DB) return;
  writeCanonicalAuditLog(c.env.AURA_DB, {
    actor: {
      id: user?.id || 'unknown',
      name: user?.name || user?.email || 'unknown',
      role: user?.role,
      tenantId: from,
    },
    action: 'tenant_override',
    resourceType: 'tenant',
    resourceId: to,
    metadata: {
      method: c.req?.method,
      path: c.req?.path,
      tenant_from: from ?? null,
      tenant_to: to,
    },
    ipAddress: c.req?.header?.('cf-connecting-ip') || null,
  }, { policy: 'best_effort' }).catch(() => {});
}
