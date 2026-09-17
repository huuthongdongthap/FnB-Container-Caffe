import { createMixpostClient } from '../../lib/mixpost-client';
import type { MixpostEnv, PromotionRow, ProductRow, PostRecord } from '../../tree/mixpost/types';

export type { MixpostEnv, PromotionRow, ProductRow, PostRecord };

export function getMixpostClient(env: MixpostEnv) {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) {
    return null;
  }
  return createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);
}
