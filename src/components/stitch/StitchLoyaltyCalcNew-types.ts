export interface BenefitReward {
  id: string;
  icon: 'coffee' | 'seat' | 'truck';
  title: string;
  description: string;
  locked: boolean;
}

export interface StitchLoyaltyCalcNewProps {
  /** Points earned per dollar spent */
  pointsPerDollar?: number;
  /** Tier milestones (points needed for each tier) */
  tierMilestones?: number[];
  /** Tier labels */
  tierLabels?: string[];
  /** Benefits/rewards list */
  benefits?: BenefitReward[];
}

export interface LoyaltyCalcState {
  spending: number;
  points: number;
  percentage: number;
  currentTierIndex: number;
  nextTierIndex: number;
  pointsToNext: number;
  handleSpendingChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
