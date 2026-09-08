import type { ReferralFriendEntry, ReferralPageData, RewardHistoryRow } from './StitchReferralNew1-types';

export const DEFAULT_FRIENDS: ReferralFriendEntry[] = [
  {
    id: 'f1',
    name: 'Julian Vane',
    joinedDate: 'Oct 24, 2023',
    avatarUrl:
      '/photos/IMG_6566.webp',
    avatarAlt: 'Close-up professional headshot with low-key lighting',
    status: 'active',
  },
  {
    id: 'f2',
    name: 'Elara Thorne',
    joinedDate: 'Oct 21, 2023',
    avatarUrl:
      '/photos/IMG_6702.webp',
    avatarAlt: 'Chic young professional in dark luxury interior',
    status: 'joined',
  },
  {
    id: 'f3',
    name: 'Marcus Chen',
    joinedDate: 'Oct 15, 2023',
    avatarUrl:
      '/photos/IMG_6556-frame.webp',
    avatarAlt: 'Distinguished individual with sharp modern haircut in neon glow',
    status: 'active',
  },
];

export const DEFAULT_HISTORY: RewardHistoryRow[] = [
  { id: 'h1', date: '24 Oct', source: 'J. Vane', amount: 15.0 },
  { id: 'h2', date: '21 Oct', source: 'E. Thorne', amount: 15.0 },
  { id: 'h3', date: '15 Oct', source: 'M. Chen', amount: 15.0 },
];

export const DEFAULT_REFERRAL_DATA: ReferralPageData = {
  rewardAmount: 15.0,
  referralCode: 'AURA-LUXE-88',
  currentReferrals: 3,
  targetReferrals: 5,
  progressPercent: 60,
  friends: DEFAULT_FRIENDS,
  rewardHistory: DEFAULT_HISTORY,
};
