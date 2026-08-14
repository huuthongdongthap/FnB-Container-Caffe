/**
 * Types for StitchReferralNew2 referral rewards page.
 */

export interface ReferralFriendEntry {
  id: string;
  name: string;
  joinedDate: string;
  avatarUrl: string;
  avatarAlt: string;
  status: 'active' | 'joined';
}

export interface RewardHistoryRow {
  id: string;
  date: string;
  source: string;
  amount: number;
}

export interface ReferralPageData {
  rewardAmount: number;
  referralCode: string;
  currentReferrals: number;
  targetReferrals: number;
  progressPercent: number;
  nextBonusAmount: number;
  nextBonusLabel: string;
  memberTier: string;
  totalEarned: number;
  friends: ReferralFriendEntry[];
  rewardHistory: RewardHistoryRow[];
}

export type ReferralLoadingState = 'idle' | 'loading' | 'error';

export interface StitchReferralNew2Props {
  data?: ReferralPageData;
  loadingState?: ReferralLoadingState;
  errorMessage?: string;
  onCopyCode?: (code: string) => void;
  onShareVia?: (method: string) => void;
  onDownloadStatement?: () => void;
}
