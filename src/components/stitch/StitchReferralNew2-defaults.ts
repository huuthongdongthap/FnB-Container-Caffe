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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDUAdvlAWNMDxFLROoo1CYIy-fNMHTOCrFrXZrp5LVUXFykARu_Yq1VUqp65YM6pBUWllu1oBvL_NRQbkiybpp4-1yQIkVc6o7FrmSaykHB4yask-MRtfCmJcuF_GIhhqe2HSPraHgNmf-y5V8-HCboU02N7DK0xN6hp_d3A19Qop4pLEs5XidKnpofOEkDr8cExPpYVZJWad6MukJMbTXQ_6tbnW1FEOYAbKMh1NThPJz-xv1rKcWrvL6eE6j2MkwarWbeYzR9aD8',
    avatarAlt: 'Close up portrait of a sophisticated man with dark hair in professional attire',
    status: 'active',
  },
  {
    id: 'f2',
    name: 'Elena Sofia',
    joinedDate: 'Oct 08, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAxAh0XJiOWCO32Cvuz--AYHCp_ESZWJjqbW0SyeZHUY1sTQlz_jZXr5eMMAb_NaoM-JqzAeq2UBsK9ImV8w8fO0OIZ10KT057a0wd-wRkDmPeteDvkRfl9O4KEl7TtcIxWM4uRJj7aNx81FE4lzXL8Tnne6xxeDu4WGrlixzhTgTWvswAlF_lYaovl2MRs1eNEr9w-foM1UnUdSdbE-dxPWkRB_9SAl7s-dNp-DUtLDbv9Jy05o_Ei1ijbnsWRgAAFwOThOB0MO8k',
    avatarAlt: 'Portrait of an elegant woman with a refined smile, warm professional lighting',
    status: 'joined',
  },
  {
    id: 'f3',
    name: 'Marcus Chen',
    joinedDate: 'Sept 24, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBw3Oa90mcS2sGFr8mG4KMEQmaMoB6B7NNqAvjwQvOMKF5XePNRKZdmo8lwiScFIuHnQhCqjvovm56uCjg7eU_bfYKu6NustIfEuHKi0_-JBqS7PgQzunmhMXuM_MRIJrTu5JeKB203_0S59hPS2q8-fod-EaUwOuAnJWHYywjLxj40ASrEQ3wPVzQ947dz5UVeCc74bCfwDot-_9TaXSA4PUeKtTXGCk5kYHgV8CANNY4S1mLNAAdhJn0A663yAmYs9RTliuNAi0E',
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
