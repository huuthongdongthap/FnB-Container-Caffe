/**
 * Campaigns Routes — /api/campaigns barrel re-export
 * Split into worker/src/routes/campaigns-handlers/
 * - constants.ts: ALL_TRIGGERS, ALL_CHANNELS, TRIGGER_META, types
 * - config-handlers.ts: List, get, update, delete campaign configs
 * - stats-handlers.ts: Aggregate stats from campaign_logs
 * - routes.ts: Router initialization, auth middleware, and route composition
 * - index.ts: Barrel export
 */

import { campaignsRouter } from './campaigns-handlers';

export {
  campaignsRouter,
  ALL_TRIGGERS,
  ALL_CHANNELS,
  TRIGGER_META,
  type CampaignConfig,
  type TriggerMeta
} from './campaigns-handlers';

export default campaignsRouter;
