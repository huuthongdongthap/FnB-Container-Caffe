import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { registerQueryHandler } from './query-handler';
import { registerExportHandler } from './export-handler';

export const adminAuditLogsRouter = new Hono<{ Bindings: Env }>();

// All routes require auth owner/staff
adminAuditLogsRouter.use('*', requireAuth(['owner', 'staff']));

registerQueryHandler(adminAuditLogsRouter);
registerExportHandler(adminAuditLogsRouter);

/**
 * Đăng ký routes audit log vào app Hono chính
 * Register audit log routes on the main Hono app.
 */
export function registerAuditLogRoutes(app: Hono<{ Bindings: Env }>): void {
  app.route('/api/admin/audit-logs', adminAuditLogsRouter);
}