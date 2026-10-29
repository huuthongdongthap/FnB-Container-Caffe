import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import { staffSessionErrorResponse, STAFF_SESSION_ROLES } from '../../lib/staff-session';
import { ShiftContractError } from '../../../../packages/domain/shift/commands/shift-access';
import type { Env } from '../../types/env';
import { registerStaffHandlers } from './staff-handlers';
import { registerShiftHandlers } from './shift-handlers';
import { registerAttendanceHandlers } from './attendance-handlers';

export const openApiStaffRouter = new OpenAPIHono<{ Bindings: Env }>();

openApiStaffRouter.onError((error, c) => {
  if (error instanceof ShiftContractError) return c.json({ success: false, error: error.message }, error.status);
  if ('status' in error && error.status === 503) return c.json({ success: false, error: error.message }, 503);
  return staffSessionErrorResponse(error) || c.json({ success: false, error: 'Không thể cập nhật nhân viên' }, 500);
});

// Apply auth middleware to all routes
openApiStaffRouter.use('/api/staff', requireAuth(['owner', 'manager', 'admin']));
openApiStaffRouter.use('/api/staff/*', async (c, next) => {
  const attendance = /^\/api\/staff\/(?:shifts|attendance)(?:\/|$)/.test(c.req.path);
  return requireAuth(attendance ? STAFF_SESSION_ROLES : ['owner', 'manager', 'admin'])(c, next);
});

// Register sub-handlers
registerShiftHandlers(openApiStaffRouter);
registerAttendanceHandlers(openApiStaffRouter);
registerStaffHandlers(openApiStaffRouter);

export default openApiStaffRouter;
