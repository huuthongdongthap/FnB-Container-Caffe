import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerTierHandlers } from './tier-handlers';
import { registerAccountHandlers } from './account-handlers';
import { registerRewardHandlers } from './reward-handlers';
import { registerAdminHandlers } from './admin-handlers';

export const openApiLoyaltyRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes (customer allowed for self-service; admin/mutation handlers enforce owner/manager)
openApiLoyaltyRouter.use('/api/loyalty', requireAuth(['owner', 'manager', 'staff', 'customer']));
openApiLoyaltyRouter.use('/api/loyalty/*', requireAuth(['owner', 'manager', 'staff', 'customer']));

// Register all loyalty sub-handlers
registerTierHandlers(openApiLoyaltyRouter);
registerAccountHandlers(openApiLoyaltyRouter);
registerRewardHandlers(openApiLoyaltyRouter);
registerAdminHandlers(openApiLoyaltyRouter);

export default openApiLoyaltyRouter;
