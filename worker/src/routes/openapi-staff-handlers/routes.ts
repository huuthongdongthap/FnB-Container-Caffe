import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerStaffHandlers } from './staff-handlers';
import { registerShiftHandlers } from './shift-handlers';
import { registerAttendanceHandlers } from './attendance-handlers';

export const openApiStaffRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiStaffRouter.use('*', requireAuth(['owner', 'manager']));

// Register sub-handlers
registerStaffHandlers(openApiStaffRouter);
registerShiftHandlers(openApiStaffRouter);
registerAttendanceHandlers(openApiStaffRouter);

export default openApiStaffRouter;
