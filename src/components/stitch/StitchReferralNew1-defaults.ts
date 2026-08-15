import type { ReferralFriendEntry, ReferralPageData, RewardHistoryRow } from './StitchReferralNew1-types';

export const DEFAULT_FRIENDS: ReferralFriendEntry[] = [
  {
    id: 'f1',
    name: 'Julian Vane',
    joinedDate: 'Oct 24, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCCsMYxIHtob9JKtxjb7suRYqr5__2Hw9P7CA4URv5UGE_A5lVWKHmdY8gvm_L4ONs_Xgk6m4dgUVPPDtp2wJ38gq5zZYyOXOz-VzUXB2Fc9yiYdQ5emWHdpNxpKO9qOZ90tGzbxNb3KySLjgHYoHOxPmZnfiCxEiasd4DALpMfRMKrlYENasQqBLAXM3yvVzQ6lrAMD_Q0nZR-OP74kJaoeqxgnJ3PyqCxv5lArGeN3OyG9a_JaCtK6C35GZXg1a8ZcZ8Ke02kfVA',
    avatarAlt: 'Close-up professional headshot with low-key lighting',
    status: 'active',
  },
  {
    id: 'f2',
    name: 'Elara Thorne',
    joinedDate: 'Oct 21, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCnw47a61SI7BhBWRqukVEuJa8EHBcJ10d5YxwdW8Hj75pcZD5MZ94QcnctDwJr_8gu52kZDmC787bnx5moad2McEjvwfRMFAzgOorFjpQCRg8gXEzRrTUrI686eGHgkQVl6qEu0SDUzRugW3cvUfbQ9bAT3Iv9t6bbxmTAoQWNngMqL4-9XUMPM7fm2bWuvVS4ASKQ_6p2R5C9vtBYeTq4MClEMUgy9gnUqCO41i-l-okHBVIT8hgzDuHn46X0GhZn1mtKK4Y3TSU',
    avatarAlt: 'Chic young professional in dark luxury interior',
    status: 'joined',
  },
  {
    id: 'f3',
    name: 'Marcus Chen',
    joinedDate: 'Oct 15, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ8QWOurR1Uxm8azubKFd7S_F9-B-s9G9KZneCjhJZRIVTcHSWebDFRyEHZx8BhafXKS5KXWWGzeVKn9sgkYLS0VBlRYpIHoAWr8ySSNRYbV4Me5q17j9L1rH8EVVWxPd4Xj252gDehlC1MVdfSTkK31_EMLzlvhz3FaNOZjVqQXL0CRjXKjWIH0sXP5bGPFkMzD34SsKknuo_emLP7dqsxqpo9AoXL4q05vmF7wMgDUD8VI0K2aDb3pvuWugqrQD0xDPOXql8ixU',
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
