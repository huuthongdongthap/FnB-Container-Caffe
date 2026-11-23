import { Hono } from 'hono';
import { reconciliationRoutes } from '@aura/domain-shift';
import type { Env } from '../types/env';
import { authenticateRequest } from '../middleware/auth';

type ShiftReconApp = Hono<{
  Bindings: Env;
  Variables: { user: Record<string, unknown>; tenantId: string };
}>;

/**
 * Legacy sub-router mounted at `/api/shifts`.
 * Delegates directly to `@aura/domain-shift` `reconciliationRoutes` as the single source of truth.
 */
export const shiftReconciliationRouter = new Hono<{
  Bindings: Env;
  Variables: { user?: Record<string, unknown>; tenantId?: string };
}>();

const forwardToDomain = async (c: {
  req: { url: string; raw: Request };
  env: Env;
  get: (k: 'user' | 'tenantId') => unknown;
}) => {
  const url = new URL(c.req.url);
  const forwardedReq = url.pathname.startsWith('/api/shifts')
    ? c.req.raw
    : new Request(
        new URL(`/api/shifts${url.pathname.startsWith('/') ? '' : '/'}${url.pathname}${url.search}`, url.origin).toString(),
        c.req.raw,
      );
  const existingUser = c.get('user') as Record<string, unknown> | undefined;
  const existingTenant = c.get('tenantId') as string | undefined;

  const wrapper: ShiftReconApp = new Hono();
  wrapper.use('*', async (wc, next) => {
    if (existingUser) {
      wc.set('user', existingUser);
    } else {
      const auth = await authenticateRequest(wc.req.raw, wc.env);
      if (auth && !('blocked' in auth)) {
        const tenantId = auth.account?.tenant_id ?? auth.payload.tenantId ?? 'default';
        wc.set('user', {
          id: auth.account?.id ?? auth.payload.sub,
          role: auth.account?.role ?? auth.payload.role,
          tenantId,
          tenant_id: tenantId,
          name: auth.account?.name ?? auth.payload.name,
        });
        if (tenantId) wc.set('tenantId', String(tenantId));
      }
    }
    if (existingTenant) wc.set('tenantId', existingTenant);
    await next();
  });
  reconciliationRoutes(wrapper);
  return wrapper.fetch(forwardedReq, c.env);
};

shiftReconciliationRouter.post('/:id/reconcile', forwardToDomain);
shiftReconciliationRouter.get('/:id/reconciliation', forwardToDomain);
shiftReconciliationRouter.post('/:id/assign-cash-payments', forwardToDomain);
shiftReconciliationRouter.get('/:id/payouts', forwardToDomain);
shiftReconciliationRouter.post('/:id/payouts', forwardToDomain);

export { reconciliationRoutes };
