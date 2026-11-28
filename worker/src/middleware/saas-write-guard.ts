/**
 * Global & Authenticated SaaS Write Guard Middleware.
 *
 * Enforces read-only mode (HTTP 402 `subscription_expired_readonly`) for expired
 * tenants past their 14-day trial + 3-day grace window, while explicitly allowing
 * authentication, read-only reporting, data export, HQ management, webhooks, and SaaS billing.
 *
 * Runs at two authoritative points:
 *  1. Globally after `hostTenantMiddleware` for unauthenticated guest writes (skipped when an auth
 *     token is present so spoofed guest headers cannot override a signed JWT before `requireAuth`).
 *  2. Inside `requireAuth` right after the signed JWT user/tenant is verified.
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { assertTenantWritable } from '../lib/saas-entitlement';
import { getAuthToken } from '../lib/jwt';
import { authenticateRequest } from '../lib/staff-session-auth';
import { isHQSuperAdmin } from './tenant';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const EXEMPT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/saas/signup',
  '/api/saas/check-slug',
  '/api/saas/billing',
  '/api/saas/export',
  '/api/hq/',
  '/api/webhook/',
  '/api/webhooks/',
  '/api/v1/webhooks/',
  '/api/health',
];

function isControlTenantId(tenantId: string): boolean {
  const clean = tenantId.trim();
  return !clean || clean === 'default' || clean.toLowerCase() === 'hq' || clean === '*';
}

export function isSaasWriteExemptPath(pathname: string): boolean {
  const normalized = pathname.replace(/^\/api\/v1(?=\/|$)/, '/api');
  return EXEMPT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

async function resolveGuestCandidateTenants(c: Context<{ Bindings: Env }>): Promise<string[]> {
  const candidates = new Set<string>();
  const addCandidate = (value: unknown) => {
    const clean = String(value ?? '').trim();
    if (!isControlTenantId(clean)) {
      candidates.add(clean);
    }
  };

  const ctxGetter = (c as unknown as { get?: (k: string) => unknown }).get;
  addCandidate(ctxGetter?.('tenantId'));
  addCandidate(ctxGetter?.('hostTenantId'));

  const readHeader = (name: string): string =>
    typeof c.req.header === 'function'
      ? c.req.header(name) || ''
      : c.req.raw?.headers.get(name) || '';
  addCandidate(readHeader('X-Tenant-ID') || readHeader('x-tenant-id'));
  addCandidate(readHeader('X-Store-ID') || readHeader('x-store-id'));

  const rawUrl = c.req.url || c.req.raw?.url || 'http://localhost';
  const searchParams = new URL(rawUrl, 'http://localhost').searchParams;
  const readQuery = (name: string): string =>
    typeof c.req.query === 'function'
      ? c.req.query(name) || ''
      : searchParams.get(name) || '';
  addCandidate(readQuery('tenant_id') || readQuery('tenantId'));
  addCandidate(readQuery('store_id') || readQuery('storeId'));

  // Inspect JSON body for tenant_id / store_id on public guest write routes
  const contentType = (readHeader('content-type') || readHeader('Content-Type') || '').toLowerCase();
  if (contentType.includes('application/json') && c.req.raw && typeof c.req.raw.clone === 'function') {
    try {
      const parsed = (await c.req.raw.clone().json()) as Record<string, unknown> | null;
      if (parsed && typeof parsed === 'object') {
        addCandidate(parsed.tenant_id ?? parsed.tenantId);
        addCandidate(parsed.store_id ?? parsed.storeId);
      }
    } catch {
      // Ignore invalid JSON; downstream route validation will handle it
    }
  }

  return Array.from(candidates);
}

/**
 * Evaluate the SaaS write guard against the authoritative tenant for the current request.
 * Returns a 402 Response if the tenant is in read-only/expired state, or null if allowed.
 */
export async function enforceSaasWriteGuard(
  c: Context<{ Bindings: Env }>,
  options: {
    deferIfAuthTokenPresent?: boolean;
    authenticatedUser?: { id?: string; role?: string; tenantId?: string; tenant_id?: string };
  } = {}
): Promise<Response | null> {
  if (!WRITE_METHODS.has(c.req.method.toUpperCase())) {
    return null;
  }

  const pathname = new URL(c.req.url || c.req.raw?.url || 'http://localhost', 'http://localhost').pathname;
  if (isSaasWriteExemptPath(pathname)) {
    return null;
  }

  const db = c.env?.AURA_DB;
  if (!db) {
    return null;
  }

  let resolvedUser =
    options.authenticatedUser ??
    (c as unknown as {
      get?: (k: string) => { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
    }).get?.('user');

  // When running globally before requireAuth with a bearer/cookie token present, verify the token
  // so forged tokens cannot bypass read-only enforcement on public write routes and untrusted
  // guest headers cannot override a signed JWT's tenant scope.
  if (!resolvedUser && options.deferIfAuthTokenPresent && getAuthToken(c.req.raw)) {
    if (c.env?.JWT_SECRET) {
      try {
        const session = await authenticateRequest(c.req.raw, c.env, { optional: true });
        if (session && 'payload' in session) {
          resolvedUser = {
            id: session.payload.id,
            role: session.payload.role,
            tenantId: session.payload.tenantId,
          };
        } else if (session && 'blocked' in session) {
          const guestTenants = await resolveGuestCandidateTenants(c);
          if (guestTenants.length === 0) {
            return null;
          }
        }
      } catch {
        // Invalid/forged token: fall through to guest tenant enforcement
      }
    }
  }

  if (resolvedUser && isHQSuperAdmin(resolvedUser)) {
    return null;
  }

  const userTenant = resolvedUser
    ? String(resolvedUser.tenantId || resolvedUser.tenant_id || '').trim()
    : '';
  const candidateTenants = await resolveGuestCandidateTenants(c);
  const targetTenants = Array.from(
    new Set([userTenant, ...candidateTenants].filter((tid) => !isControlTenantId(tid)))
  );

  if (targetTenants.length === 0) {
    return null;
  }

  for (const resolvedTenant of targetTenants) {
    const check = await assertTenantWritable(db, resolvedTenant);
    if (!check.allowed) {
      return c.json(
        {
          ok: false,
          success: false,
          code: check.code || 'subscription_expired_readonly',
          error: check.code || 'subscription_expired_readonly',
          message: check.message,
          lifecycleState: check.entitlement.lifecycleState,
        },
        402
      );
    }
  }

  return null;
}

export const saasWriteGuard: MiddlewareHandler<{
  Bindings: Env;
  Variables: {
    tenantId?: string;
    user?: { id?: string; role?: string; tenantId?: string; tenant_id?: string };
  };
}> = async (c, next) => {
  const blocked = await enforceSaasWriteGuard(c as unknown as Context<{ Bindings: Env }>, {
    deferIfAuthTokenPresent: true,
  });
  if (blocked) return blocked;
  return next();
};
