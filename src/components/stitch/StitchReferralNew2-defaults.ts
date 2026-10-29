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
  { id: 'h1', date: 'Oct 12, 2023', source: 'Referral Reward (Alex N.)', amount: 10000 },
  { id: 'h2', date: 'Oct 01, 2023', source: 'Monthly Bonus Reward', amount: 10000 },
  { id: 'h3', date: 'Sept 24, 2023', source: 'Referral Reward (Marcus C.)', amount: 10000 },
  { id: 'h4', date: 'Aug 15, 2023', source: 'Welcome Referral Bonus', amount: 5000 },
];

export const DEFAULT_REFERRAL_DATA: ReferralPageData = {
  rewardAmount: 10000,
  referralCode: 'AURA-VIP-2024-X',
  currentReferrals: 3,
  targetReferrals: 5,
  progressPercent: 60,
  nextBonusAmount: 50000,
  nextBonusLabel: 'Nhận 10.000đ cho người giới thiệu và 5.000đ cho bạn mới ngay sau đơn đầu tiên thanh toán thành công.',
  memberTier: 'SILVER MEMBER',
  totalEarned: 30000,
  friends: DEFAULT_FRIENDS,
  rewardHistory: DEFAULT_HISTORY,
};
