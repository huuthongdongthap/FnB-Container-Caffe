/**
 * Audit Log Middleware
 * Logs admin actions to D1 for compliance.
 * Converted from middleware/audit-log.js.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { writeCanonicalAuditLog } from '@aura/domain-audit';
import { resolvePilotStore } from '../lib/pilot-store';
import { isHQSuperAdmin } from './tenant';

export function audit(action: string, explicitResourceType?: string): MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    await next();
    try {
      if (!c.env?.AURA_DB) return;
      const user = c.get('user') as { id?: string; name?: string; email?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
      const rawUserTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
      const isHqAdmin = isHQSuperAdmin(user);
      const ctxTenant = String(c.get('tenantId' as never) ?? '').trim();
      const headerTenant = String(
        c.req.query?.('tenant_id') ??
          c.req.query?.('tenantId') ??
          c.req.query?.('store_id') ??
          c.req.query?.('storeId') ??
          c.req.header?.('x-tenant-id') ??
          c.req.header?.('X-Tenant-ID') ??
          c.req.header?.('x-store-id') ??
          c.req.header?.('X-Store-ID') ??
          ''
      ).trim();
      const resolvedTenant = user
        ? isHqAdmin
          ? (
              (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '') ||
              (headerTenant && headerTenant !== '*' && headerTenant.toLowerCase() !== 'hq' ? headerTenant : '') ||
              (rawUserTenant && rawUserTenant !== '*' && rawUserTenant.toLowerCase() !== 'hq' ? rawUserTenant : '') ||
              resolvePilotStore(c.env)
            )
          : (
              (rawUserTenant && rawUserTenant !== '*' && rawUserTenant.toLowerCase() !== 'hq' ? rawUserTenant : '') ||
              (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '') ||
              resolvePilotStore(c.env)
            )
        : resolvePilotStore(c.env);

      const resourceType = explicitResourceType || action.split('_')[0] || 'resource';
      const resourceId = extractResourceId(c) || null;
      const ipAddress = c.req.header('cf-connecting-ip') || null;
      const writeResult = await writeCanonicalAuditLog(c.env.AURA_DB, {
        actor: {
          id: user?.id || 'anonymous',
          name: user?.name || user?.email || 'unknown',
          role: user?.role,
          tenantId: resolvedTenant,
        },
        tenantId: resolvedTenant,
        action,
        resourceType,
        resourceId,
        metadata: { method: c.req.method, path: c.req.path },
        ipAddress,
      }, { policy: 'best_effort' });

      if (!writeResult.ok) {
        const rec = writeResult.record;
        await c.env.AURA_DB.prepare(
          `INSERT INTO audit_logs (id, user_id, actor_id, action, resource_type, entity_type, resource_id, entity_id, details, metadata, ip_address, tenant_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          rec.id,
          rec.user_id,
          rec.actor_id,
          rec.action,
          rec.resource_type,
          rec.entity_type,
          rec.resource_id,
          rec.entity_id,
          rec.details,
          rec.metadata,
          rec.ip_address,
          resolvedTenant,
          rec.created_at
        ).run().catch(() => {});
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
