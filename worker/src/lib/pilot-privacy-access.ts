import type { Context } from 'hono';
import type { Env } from '../types/env';
import { errorResponse } from '../middleware/cors';
import { resolvePilotStore, pilotStoreErrorResponse } from './pilot-store';
import { resourceCreationErrorResponse } from './resource-creation';

/** The pilot is one concrete store; wildcard/HQ sessions never broaden its scope. */
export function privacyStore(c: Context<{ Bindings: Env }>, roles?: string[]): string | Response {
  const tenantId = resolvePilotStore(c.env);
  const user = c.get('user');
  if (!user) return errorResponse('Unauthorized', 401);
  if ((roles && !roles.includes(user.role)) || !user.tenantId || user.tenantId !== tenantId)
    return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
  return tenantId;
}
export function privacyError(error: unknown): Response | null {
  return pilotStoreErrorResponse(error) || resourceCreationErrorResponse(error);
}
