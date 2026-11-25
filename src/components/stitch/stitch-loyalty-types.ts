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

export interface LoyaltyTierLadderItem {
  tier_name: string;
  display_name_vi: string;
  min_points: number;
  point_multiplier: number;
  cashback_rate: number;
  is_current: boolean;
}

import type { RedeemedVoucher, CashbackTransactionEntry } from '@/hooks/stores/loyalty-store-types';

export interface LoyaltyBirthdayOffer {
  eligible: boolean;
  discountPercent: number;
  rewardType: string;
  isBirthdayToday?: boolean;
  redeemed?: boolean;
  redeemedMessage?: string | null;
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
  tierLadder: LoyaltyTierLadderItem[];
  isGuest?: boolean;
  cashbackBalance?: number;
  cashbackRate?: number;
  cashbackTotalEarned?: number;
  cashbackTotalSpent?: number;
  cashbackExpiring7d?: number;
  cashbackHistory?: CashbackTransactionEntry[];
  birthdayOffer?: LoyaltyBirthdayOffer | null;
}

export type LoyaltyLoadingState = 'idle' | 'loading' | 'error';

export interface StitchLoyaltyNewProps {
  data?: LoyaltyDashboardData;
  loadingState?: LoyaltyLoadingState;
  errorMessage?: string;
  myVouchers?: RedeemedVoucher[];
  lastRedeemedVoucher?: RedeemedVoucher | null;
  onDismissVoucherBanner?: () => void;
  onRedeemPoints?: () => void;
  onClaimReward?: (rewardId: string) => void;
  onCheckIn?: () => void;
  onShareReferral?: () => void;
  onClaimBirthday?: () => void;
}
