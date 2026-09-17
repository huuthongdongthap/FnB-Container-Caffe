/**
 * pretix Routes — /api/pretix barrel re-export
 * Split into worker/src/routes/pretix-handlers/
 * - types.ts: PretixEnv, PretixEventResponse, PretixItemsResponse, PretixItem, getOrganizer
 * - webhook-handler.ts: POST /webhook HMAC validated
 * - event-handlers.ts: GET /events, GET /events/:slug, GET /orders
 * - checkin-handler.ts: POST /checkin ticket door verification
 * - generate-handler.ts: POST /generate social promo post
 * - routes.ts: Router setup
 * - index.ts: Barrel export
 */

import { pretixRouter } from './pretix-handlers';

export { pretixRouter } from './pretix-handlers';
export { registerWebhookHandler } from './pretix-handlers';
export { registerEventHandlers } from './pretix-handlers';
export { registerCheckinHandler } from './pretix-handlers';
export { registerGenerateHandler } from './pretix-handlers';
export type { PretixEnv, PretixEventResponse, PretixItemsResponse, PretixItem } from './pretix-handlers';

export default pretixRouter;