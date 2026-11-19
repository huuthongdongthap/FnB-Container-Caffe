/**
 * Hostname / Custom-Domain / Subdomain Tenant Resolution Middleware.
 *
 * Resolution priority for unauthenticated / storefront requests:
 *  1. Verified Custom Domain in `tenant_domains` (`status = 'verified'`)
 *  2. Subdomain `{slug}.{SAAS_PLATFORM_DOMAIN}` matching `saas_tenants.subdomain`
 *  3. Explicit `/s/:slug` path prefix or `?store=:slug` query param
 *  4. Default flagship `'default'` (AURA Sa Đéc at `/`)
 *
 * Authenticated staff requests continue to bind strictly to their signed JWT
 * via `tenantMiddleware` / `getTenantId(c)`.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';

const IGNORED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function stripPort(hostHeader: string | undefined): string {
  return String(hostHeader || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

export const hostTenantMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: { tenantId?: string; resolvedTenantSlug?: string; user?: unknown };
}> = async (c, next) => {
  // Never override an already-resolved authenticated user's JWT tenant
  if (c.get('user')) {
    return next();
  }

  const db = c.env?.AURA_DB;
  if (!db) {
    return next();
  }

  const host = stripPort(c.req.header('x-forwarded-host') || c.req.header('host'));
  const platformDomain = stripPort(c.env.SAAS_PLATFORM_DOMAIN || '');

  // 1. Verified custom domain lookup (when host is neither localhost nor platform apex)
  if (host && !IGNORED_HOSTS.has(host) && !host.endsWith('.workers.dev') && !host.endsWith('.pages.dev')) {
    if (!platformDomain || (host !== platformDomain && host !== `www.${platformDomain}`)) {
      const domainMatch = await db
        .prepare(
          `SELECT d.tenant_id, t.slug
           FROM tenant_domains d
           JOIN saas_tenants t ON t.id = d.tenant_id
           WHERE LOWER(d.domain) = ? AND d.status = 'verified'
           LIMIT 1`
        )
        .bind(host)
        .first<{ tenant_id: string; slug: string }>()
        .catch(() => null);

      if (domainMatch?.tenant_id) {
        c.set('tenantId', domainMatch.tenant_id);
        c.set('resolvedTenantSlug', domainMatch.slug);
        return next();
      }

      // 2. Subdomain {slug}.{platformDomain}
      if (platformDomain && host.endsWith(`.${platformDomain}`)) {
        const sub = host.slice(0, -(platformDomain.length + 1));
        if (sub && !sub.includes('.') && sub !== 'www' && sub !== 'api' && sub !== 'hq') {
          const subMatch = await db
            .prepare(`SELECT id, slug FROM saas_tenants WHERE LOWER(subdomain) = ? OR LOWER(slug) = ? LIMIT 1`)
            .bind(sub, sub)
            .first<{ id: string; slug: string }>()
            .catch(() => null);

          if (subMatch?.id) {
            c.set('tenantId', subMatch.id);
            c.set('resolvedTenantSlug', subMatch.slug);
            return next();
          }
        }
      }
    }
  }

  // 3. Explicit slug header or query param for /s/:slug SPA API calls
  const explicitSlug = (
    c.req.header('x-tenant-slug') ||
    c.req.header('X-Tenant-Slug') ||
    c.req.query('store') ||
    c.req.query('slug') ||
    ''
  )
    .trim()
    .toLowerCase();

  if (explicitSlug && explicitSlug !== 'default' && explicitSlug !== 'hq' && explicitSlug !== '*') {
    const slugMatch = await db
      .prepare(`SELECT id, slug FROM saas_tenants WHERE LOWER(slug) = ? OR id = ? LIMIT 1`)
      .bind(explicitSlug, explicitSlug)
      .first<{ id: string; slug: string }>()
      .catch(() => null);

    if (slugMatch?.id) {
      c.set('tenantId', slugMatch.id);
      c.set('resolvedTenantSlug', slugMatch.slug);
    }
  }

  return next();
};
