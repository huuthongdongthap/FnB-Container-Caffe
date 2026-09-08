/**
 * Default data for StitchReferralNew2 when no external data is provided.
 * Contains sample friends list and reward history.
 */

import type {
  ReferralFriendEntry,
  ReferralPageData,
  RewardHistoryRow,
} from './StitchReferralNew2-types';

export const DEFAULT_FRIENDS: ReferralFriendEntry[] = [
  {
    id: 'f1',
    name: 'Alex Nguyen',
    joinedDate: 'Oct 12, 2023',
    avatarUrl:
      '/photos/IMG_6565.webp',
    avatarAlt: 'Close up portrait of a sophisticated man with dark hair in professional attire',
    status: 'active',
  },
  {
    id: 'f2',
    name: 'Elena Sofia',
    joinedDate: 'Oct 08, 2023',
    avatarUrl:
      '/photos/IMG_6566.webp',
    avatarAlt: 'Portrait of an elegant woman with a refined smile, warm professional lighting',
    status: 'joined',
  },
  {
    id: 'f3',
    name: 'Marcus Chen',
    joinedDate: 'Sept 24, 2023',
    avatarUrl:
      '/photos/IMG_6702.webp',
    avatarAlt: 'A stylish young man wearing a modern tailored suit, soft atmospheric lighting',
    status: 'active',
  },
];

export const DEFAULT_HISTORY: RewardHistoryRow[] = [
  { id: 'h1', date: 'Oct 12, 2023', source: 'Referral Reward (Alex N.)', amount: 15.0 },
  { id: 'h2', date: 'Oct 01, 2023', source: 'Monthly Bonus Reward', amount: 10.0 },
  { id: 'h3', date: 'Sept 24, 2023', source: 'Referral Reward (Marcus C.)', amount: 15.0 },
  { id: 'h4', date: 'Aug 15, 2023', source: 'Account Verified', amount: 5.0 },
];

export const DEFAULT_REFERRAL_DATA: ReferralPageData = {
  rewardAmount: 15.0,
  referralCode: 'AURA-VIP-2024-X',
  currentReferrals: 3,
  targetReferrals: 5,
  progressPercent: 60,
  nextBonusAmount: 50.0,
  nextBonusLabel: 'Unlock a $50 Premium Reserve credit upon reaching 5 referrals.',
  memberTier: 'SILVER MEMBER',
  totalEarned: 45.0,
  friends: DEFAULT_FRIENDS,
  rewardHistory: DEFAULT_HISTORY,
};
