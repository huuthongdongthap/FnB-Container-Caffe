import type { Context } from 'hono';
import type { Env } from '../types/env';
import { errorResponse } from '../middleware/cors';
import { resolvePilotStore, pilotStoreErrorResponse } from './pilot-store';
import { resourceCreationErrorResponse } from './resource-creation';

/** The pilot is one concrete store; wildcard/HQ sessions never broaden its scope. */
export function privacyStore(c: Context<{ Bindings: Env }>, roles?: string[]): string | Response {
  const tenantId = resolvePilotStore(c.env);
  const requestedCandidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const requestedTenant = new Set(requestedCandidates).size > 1 ? '__CONFLICT__' : (requestedCandidates[0] || '');
  const user = c.get('user');
  const hasAuthHeader = Boolean(c.req.header('Authorization') || c.req.header('authorization'));
  if (!user && !hasAuthHeader) return errorResponse('Unauthorized', 401);
  if (
    requestedTenant &&
    (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || requestedTenant !== tenantId)
  ) {
    return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
  }
  if (!user) return errorResponse('Unauthorized', 401);
  const rawUserTenant = user.tenantId ?? (user as { tenant_id?: string }).tenant_id;
  const userTenant = typeof rawUserTenant === 'string' ? rawUserTenant.trim() : '';
  if (
    (roles && !roles.includes(user.role)) ||
    !userTenant ||
    userTenant !== tenantId
  ) {
    return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
  }
  return tenantId;
}
export function privacyError(error: unknown): Response | null {
  return pilotStoreErrorResponse(error) || resourceCreationErrorResponse(error);
}
