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
  const safeLifetimePoints = Math.max(
    0,
    Number.isFinite(Number(lifetimePoints)) ? Math.floor(Number(lifetimePoints)) : 0,
  );
  const tiers = [...policy.tiers].sort(
    (a, b) =>
      (Number.isFinite(Number(a.minPoints)) ? Number(a.minPoints) : 0) -
      (Number.isFinite(Number(b.minPoints)) ? Number(b.minPoints) : 0),
  );
  if (tiers.length === 0) {
    return {
      tierName: policy.defaultTier.tierName,
      lifetimePoints: safeLifetimePoints,
      nextTier: null,
      changed: currentTierName !== policy.defaultTier.tierName,
    };
  }

  let resolved = tiers[0];
  for (const t of tiers) {
    const minPts = Math.max(0, Number.isFinite(Number(t.minPoints)) ? Number(t.minPoints) : 0);
    if (safeLifetimePoints >= minPts) {
      resolved = t;
    } else {
      break;
    }
  }

  const nextTier = findNextTier(safeLifetimePoints, resolved, tiers);

  return {
    tierName: resolved.tierName,
    lifetimePoints: safeLifetimePoints,
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
  const nextMinPoints = Math.max(0, Number.isFinite(Number(next.minPoints)) ? Number(next.minPoints) : 0);
  return {
    name: next.tierName,
    minPoints: nextMinPoints,
    pointsNeeded: Math.max(0, nextMinPoints - lifetimePoints),
  };
}
