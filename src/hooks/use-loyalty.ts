import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface TierConfig {
  rank: string;
  tier: string;
  minPoints: number;
  cashbackRate: number;
  pointsMultiplier: number;
}

export interface LoyaltyData {
  tier: string;
  points: number;
  lifetimePoints: number;
  spentVnd: number;
  cashbackRate: number;
  birthdayBonus: number;
  rewards?: Array<{
    id: string;
    name: string;
    cost: number;
    icon: string;
    description: string;
  }>;
  checkinStreak?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const TIER_THRESHOLDS: TierConfig[] = [
  { rank: 'Dong', tier: 'bronze', minPoints: 0, cashbackRate: 3, pointsMultiplier: 1.0 },
  { rank: 'Bac', tier: 'silver', minPoints: 50, cashbackRate: 5, pointsMultiplier: 1.1 },
  { rank: 'Vang', tier: 'gold', minPoints: 200, cashbackRate: 7, pointsMultiplier: 1.3 },
  { rank: 'Bach Kim', tier: 'platinum', minPoints: 500, cashbackRate: 10, pointsMultiplier: 1.5 },
];

export function getTierConfig(points: number): TierConfig {
  let config = TIER_THRESHOLDS[0] as TierConfig;
  for (const t of TIER_THRESHOLDS) {
    if (points >= t.minPoints) config = t;
  }
  return config;
}

export function getTierForSpend(spendVnd: number): TierConfig {
  // Approximate: 1 point = ~10,000 VND spend (AOV-based estimation)
  const estimatedPoints = Math.floor(spendVnd / 10000);
  return getTierConfig(estimatedPoints);
}

export function getNextTier(currentTier: string): TierConfig | null {
  const idx = TIER_THRESHOLDS.findIndex((t) => t.tier === currentTier);
  if (idx === -1) return TIER_THRESHOLDS[0] as TierConfig;
  if (idx >= TIER_THRESHOLDS.length - 1) return null; // Already at max
  return TIER_THRESHOLDS[idx + 1] as TierConfig;
}

export function useLoyalty() {
  return useQuery<LoyaltyData>({
    queryKey: ['loyalty'],
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<LoyaltyData>>('/api/loyalty');
      return res.data;
    },
  });
}
