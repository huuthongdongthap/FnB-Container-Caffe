import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerCampaignConfigHandlers } from './config-handlers';
import { registerCampaignStatsHandlers } from './stats-handlers';

export const campaignsRouter = new Hono<{ Bindings: Env }>();

// All routes require auth
campaignsRouter.use('/*', requireAuth(['owner', 'staff']));

registerCampaignConfigHandlers(campaignsRouter);
registerCampaignStatsHandlers(campaignsRouter);

export default campaignsRouter;
