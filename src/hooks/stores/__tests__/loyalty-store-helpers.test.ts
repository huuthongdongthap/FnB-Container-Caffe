import { describe, it, expect } from 'vitest';
import { parseTierLadder } from '../loyalty-store-helpers';
import type { LoyaltyTierLadderItem } from '../loyalty-store-types';

describe('parseTierLadder', () => {
  it('maps API tier rows to ladder items', () => {
    const rows = [
      { tier_name: 'silver', display_name_vi: 'Bạc', min_points: 50, point_multiplier: 1.1, cashback_rate: 0.05 },
      { tier_name: 'bronze', display_name_vi: 'Đồng', min_points: 0, point_multiplier: 1.0, cashback_rate: 0.03 },
    ];
    const result = parseTierLadder(rows as Record<string, unknown>[], 'bronze');
    expect(result.length).toBe(2);
    const bronze = result.find((t) => t.tier_name === 'bronze') as LoyaltyTierLadderItem;
    const silver = result.find((t) => t.tier_name === 'silver') as LoyaltyTierLadderItem;
    expect(bronze.display_name_vi).toBe('Đồng');
    expect(bronze.is_current).toBe(true);
    expect(silver.is_current).toBe(false);
  });

  it('sorts tiers by min_points ascending', () => {
    const rows = [
      { tier_name: 'gold', display_name_vi: 'Vàng', min_points: 200, point_multiplier: 1.3, cashback_rate: 0.07 },
      { tier_name: 'platinum', display_name_vi: 'Bạch Kim', min_points: 500, point_multiplier: 1.5, cashback_rate: 0.10 },
      { tier_name: 'bronze', display_name_vi: 'Đồng', min_points: 0, point_multiplier: 1.0, cashback_rate: 0.03 },
    ];
    const result = parseTierLadder(rows as Record<string, unknown>[], 'gold');
    expect(result.map((t) => t.tier_name)).toEqual(['bronze', 'gold', 'platinum']);
    expect(result.find((t) => t.tier_name === 'gold')?.is_current).toBe(true);
  });

  it('coerces missing fields to safe defaults', () => {
    const rows = [{ tier_name: 'bronze' }];
    const result = parseTierLadder(rows as Record<string, unknown>[], 'bronze');
    const bronze = result[0];
    expect(bronze?.display_name_vi).toBe('bronze');
    expect(bronze?.min_points).toBe(0);
    expect(bronze?.point_multiplier).toBe(1);
    expect(bronze?.cashback_rate).toBe(0);
    expect(bronze?.is_current).toBe(true);
  });

  it('returns empty array for empty input', () => {
    const result = parseTierLadder([], 'bronze');
    expect(result).toEqual([]);
  });
});
