/**
 * Mount point for the admin SOP surface (`/api/sop/admin/*`).
 *
 * Registered once, in `index.ts`, so the `/api/sop` prefix is never mounted
 * twice — the mobile checklist side mounts under `/api/sop` separately, through
 * the staff router. The guard is applied at both `'/api/sop/admin'` and
 * `'/api/sop/admin/*'` because the wildcard form does not cover the bare path.
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { SopAccessError } from '@aura/domain-sop';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { MANAGER_ROLES, SopAdminRoutes } from '../../schemas/sop-routes';
import { registerSopAdminReadHandlers } from './sop-admin-read-handlers';
import { registerSopAdminWriteHandlers } from './sop-admin-write-handlers';
import { registerSopReminderHandlers } from './sop-reminder-handlers';

export const openApiSopRouter = new OpenAPIHono<{ Bindings: Env }>();

openApiSopRouter.onError((error, c) => {
  if (error instanceof SopAccessError) {
    return c.json({ success: false, error: error.message }, error.status);
  }
  return c.json({ success: false, error: 'Không thể xử lý yêu cầu SOP' }, 500);
});

openApiSopRouter.use('/api/sop/admin', requireAuth([...MANAGER_ROLES]));
openApiSopRouter.use('/api/sop/admin/*', requireAuth([...MANAGER_ROLES]));

registerSopAdminReadHandlers(openApiSopRouter, SopAdminRoutes);
registerSopAdminWriteHandlers(openApiSopRouter, SopAdminRoutes);
registerSopReminderHandlers(openApiSopRouter, SopAdminRoutes);

export { SopAdminRoutes };
