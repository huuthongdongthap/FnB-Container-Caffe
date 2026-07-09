import { describe, it, expect } from 'vitest';
import { autoPostNewPromotions } from '../../../tree/mixpost/auto-post-new-promotions.js';
function makeEnv() {
  return {
    AURA_DB: {
      prepare: () => ({
        bind: () => ({ first: async () => ({ id: 'p1', name: 'Promo', image_url: 'img.jpg' }) }),
      }),
    } as unknown as D1Database,
    AUTH_KV: { get: async () => null },
  };
}
describe('Mixpost: auto post', () => {
  it('autoPostNewPromotions returns structured result', async () => {
    const r = await autoPostNewPromotions(makeEnv());
    expect(r && typeof r).toBe('object');
  });
  it('autoPostNewPromotions handles empty promotions list', async () => {
    const env = {
      AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database,
      AUTH_KV: { get: async () => null },
    };
    const r = await autoPostNewPromotions(env);
    expect(r && typeof r).toBe('object');
  });
});
