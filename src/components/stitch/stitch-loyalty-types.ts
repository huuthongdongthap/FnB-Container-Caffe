/**
 * Shared types for StitchLoyaltyNew component family.
 */

export interface LoyaltyRewardItem {
  id: string;
  title: string;
  pointsCost: number;
  imageUrl: string;
  imageAlt: string;
}

export interface LoyaltyHistoryEntry {
  id: string;
  activity: string;
  date: string;
  status: 'completed' | 'pending' | 'expired';
  points: number;
}

export interface LoyaltyStreakDay {
  label: string;
  checked: boolean;
}

export interface LoyaltyTierBenefit {
  label: string;
}

export interface LoyaltyDashboardData {
  tierName: string;
  memberSince: string;
  tierDescription: string;
  nextTier: string;
  pointsRemainingForNextTier: number;
  progressPercent: number;
  pointsBalance: number;
  streakCount: number;
  referralCode: string;
  rewards: LoyaltyRewardItem[];
  pointsHistory: LoyaltyHistoryEntry[];
  streakDays: LoyaltyStreakDay[];
  tierBenefits: LoyaltyTierBenefit[];
}

export type LoyaltyLoadingState = 'idle' | 'loading' | 'error';

export interface StitchLoyaltyNewProps {
  data?: LoyaltyDashboardData;
  loadingState?: LoyaltyLoadingState;
  errorMessage?: string;
  onRedeemPoints?: () => void;
  onClaimReward?: (rewardId: string) => void;
  onCheckIn?: () => void;
  onShareReferral?: () => void;
}
