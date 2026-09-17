/**
 * Broadcast Routes — /api/broadcast barrel re-export
 * Split into worker/src/routes/broadcast-handlers/
 * - types.ts: BroadcastCustomer, segmentSQL
 * - send-handler.ts: POST /send bulk message handler
 * - routes.ts: Router setup
 * - index.ts: Barrel export
 */

import { broadcastRouter } from './broadcast-handlers';

export { broadcastRouter, segmentSQL } from './broadcast-handlers';
export type { BroadcastCustomer } from './broadcast-handlers';

export default broadcastRouter;
