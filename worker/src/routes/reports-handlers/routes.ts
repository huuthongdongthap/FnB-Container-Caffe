import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { optionalAuth } from '../../middleware/auth';
import { registerAnalyticsHandlers } from './analytics-handlers';
import { registerReconciliationHandlers } from './reconciliation-handlers';
import { registerExportHandlers } from './export-handlers';
import { registerGroupedSalesHandlers } from './grouped-sales-handlers';

export const reportsRouter = new Hono<{ Bindings: Env }>();

const REPORT_ALLOWED_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);

reportsRouter.use('*', async (c, next) => {
  if (!c.get('user' as never)) {
    return optionalAuth()(c, async () => {
      const user = c.get('user' as never) as { role?: string } | undefined;
      const role = user?.role ? String(user.role).toLowerCase() : '';
      if (role && !REPORT_ALLOWED_ROLES.has(role)) {
        c.res = c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
        return;
      }
      if (!role && (c.req.header('Authorization') || c.req.header('authorization') || c.env?.ENVIRONMENT === 'production')) {
        c.res = c.json({ success: false, error: 'Authentication required' }, 401);
        return;
      }
      await next();
    });
  }
  const user = c.get('user' as never) as { role?: string } | undefined;
  const role = user?.role ? String(user.role).toLowerCase() : '';
  if (role && !REPORT_ALLOWED_ROLES.has(role)) {
    return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
  }
  if (!role && (c.req.header('Authorization') || c.req.header('authorization') || c.env?.ENVIRONMENT === 'production')) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  await next();
});

registerAnalyticsHandlers(reportsRouter);
registerReconciliationHandlers(reportsRouter);
registerExportHandlers(reportsRouter);
registerGroupedSalesHandlers(reportsRouter);

export default reportsRouter;

