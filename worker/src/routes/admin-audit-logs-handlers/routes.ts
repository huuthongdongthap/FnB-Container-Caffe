import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { registerQueryHandler } from './query-handler';
import { registerExportHandler } from './export-handler';

export const adminAuditLogsRouter = new Hono<{ Bindings: Env }>();

const AUDIT_LOG_ALLOWED_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

// All routes require auth owner/manager/supervisor/admin
adminAuditLogsRouter.use('*', async (c, next) => {
  const preUser = c.get('user' as never) as { role?: string } | undefined;
  if (preUser?.role) {
    if (!AUDIT_LOG_ALLOWED_ROLES.includes(String(preUser.role).toLowerCase())) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    return next();
  }
  return requireAuth(AUDIT_LOG_ALLOWED_ROLES)(c, next);
});

registerQueryHandler(adminAuditLogsRouter);
registerExportHandler(adminAuditLogsRouter);

/**
 * Đăng ký routes audit log vào app Hono chính
 * Register audit log routes on the main Hono app.
 */
export function registerAuditLogRoutes(app: Hono<{ Bindings: Env }>): void {
  app.route('/api/admin/audit-logs', adminAuditLogsRouter);
}
