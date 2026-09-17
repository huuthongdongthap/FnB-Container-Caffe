import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerTableCrudHandlers } from './table-crud-handlers';
import { registerZoneCrudHandlers } from './zone-crud-handlers';

export const openApiTablesRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiTablesRouter.use('*', requireAuth(['owner', 'manager', 'staff']));

// Register sub-handlers
registerTableCrudHandlers(openApiTablesRouter);
registerZoneCrudHandlers(openApiTablesRouter);

export default openApiTablesRouter;
