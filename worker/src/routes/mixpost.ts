/**
 * Mixpost Routes — /api/mixpost barrel re-export
 * Split into worker/src/routes/mixpost-handlers/
 * - types.ts: MixpostEnv, PromotionRow, ProductRow, PostRecord, getMixpostClient
 * - posts-handler.ts: POST /posts, GET /posts, GET /accounts
 * - generate-handler.ts: POST /generate
 * - routes.ts: Router setup
 * - index.ts: Barrel export
 */

import { mixpostRouter } from './mixpost-handlers';

export { mixpostRouter } from './mixpost-handlers';
export { registerPostsHandler } from './mixpost-handlers';
export { registerGenerateHandler } from './mixpost-handlers';
export * from './mixpost-handlers';
export { handleMixpostRequest } from '../tree/mixpost/legacy-handler';
export { autoPostDailySpecials } from '../tree/mixpost/auto-post-daily-specials';
export { autoPostNewPromotions } from '../tree/mixpost/auto-post-new-promotions';
export { autoPostWeeklyHighlights } from '../tree/mixpost/auto-post-weekly-highlights';
export type { MixpostEnv, PromotionRow, ProductRow, PostRecord } from './mixpost-handlers';

export default mixpostRouter;