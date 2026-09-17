/**
 * CRM — Tier computation.
 * Pure function: no D1 dependency. Given lifetime_points + current tier name,
 * returns the resolved tier, the next tier above (if any), and points needed.
 *
 * Tier resolution uses loyalty_tiers.min_points against lifetime_points —
 * the highest tier whose threshold is met wins.
 */

import type { LoyaltyTierPolicy, LoyaltyPolicy } from './loyalty-policy';

export interface ComputedTier {
  tierName: string;
  lifetimePoints: number;
  nextTier: { name: string; minPoints: number; pointsNeeded: number } | null;
  /** True when resolved tier differs from the input currentTierName. */
  changed: boolean;
}

/**
 * Resolve which tier a customer qualifies for given their lifetime points.
 * Tiers must be sorted by min_points ASC (as loadPolicy returns them).
 */
export function computeTier(
  lifetimePoints: number,
  currentTierName: string | null,
  policy: LoyaltyPolicy,
): ComputedTier {
  const tiers = policy.tiers;
  if (tiers.length === 0) {
    return {
      tierName: policy.defaultTier.tierName,
      lifetimePoints,
      nextTier: null,
      changed: currentTierName !== policy.defaultTier.tierName,
    };
  }

  let resolved = tiers[0];
  for (const t of tiers) {
    if (lifetimePoints >= t.minPoints) {
      resolved = t;
    } else {
      break;
    }
  }

  const nextTier = findNextTier(lifetimePoints, resolved, tiers);

  return {
    tierName: resolved.tierName,
    lifetimePoints,
    nextTier,
    changed: resolved.tierName !== (currentTierName ?? resolved.tierName),
  };
}

function findNextTier(
  lifetimePoints: number,
  current: LoyaltyTierPolicy,
  tiers: LoyaltyTierPolicy[],
): { name: string; minPoints: number; pointsNeeded: number } | null {
  const idx = tiers.findIndex((t) => t.tierName === current.tierName);
  if (idx === -1 || idx >= tiers.length - 1) return null;
  const next = tiers[idx + 1];
  return {
    name: next.tierName,
    minPoints: next.minPoints,
    pointsNeeded: Math.max(0, next.minPoints - lifetimePoints),
  };
}
