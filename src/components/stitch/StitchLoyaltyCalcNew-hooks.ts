import { useState, useCallback, useMemo } from 'react';
import type { LoyaltyCalcState } from './StitchLoyaltyCalcNew-types';

export function useLoyaltyCalc(
  pointsPerDollar: number,
  tierMilestones: number[],
): LoyaltyCalcState {
  const [spending, setSpending] = useState(125);

  const points = useMemo(
    () => Math.round(spending * pointsPerDollar),
    [spending, pointsPerDollar],
  );

  const percentage = useMemo(() => {
    const max = tierMilestones[tierMilestones.length - 1]!;
    return Math.min((points / max) * 100, 100);
  }, [points, tierMilestones]);

  const currentTierIndex = useMemo(() => {
    let idx = 0;
    for (let i = tierMilestones.length - 1; i >= 0; i--) {
      if (points >= tierMilestones[i]!) {
        idx = i;
        break;
      }
    }
    return idx;
  }, [points, tierMilestones]);

  const nextTierIndex = useMemo(() => {
    const next = currentTierIndex + 1;
    return next < tierMilestones.length ? next : -1;
  }, [currentTierIndex, tierMilestones.length]);

  const pointsToNext = useMemo(() => {
    if (nextTierIndex < 0) return 0;
    return tierMilestones[nextTierIndex]! - points;
  }, [nextTierIndex, points, tierMilestones]);

  const handleSpendingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setSpending(Number.isNaN(val) || val < 0 ? 0 : val);
    },
    [],
  );

  return {
    spending,
    points,
    percentage,
    currentTierIndex,
    nextTierIndex,
    pointsToNext,
    handleSpendingChange,
  };
}
