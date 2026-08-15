export const FRIENDS = [
  {
    name: 'Alex Nguyen',
    joined: 'Oct 12, 2023',
    status: 'ACTIVE',
    avatar: 'AN',
  },
  {
    name: 'Elena Sofia',
    joined: 'Oct 08, 2023',
    status: 'JOINED',
    avatar: 'ES',
  },
  {
    name: 'Marcus Chen',
    joined: 'Sept 24, 2023',
    status: 'ACTIVE',
    avatar: 'MC',
  },
] as const;

export const REWARD_HISTORY = [
  { date: 'Oct 12, 2023', source: 'Referral Reward (Alex N.)', credit: 15.0 },
  { date: 'Oct 01, 2023', source: 'Monthly Bonus Reward', credit: 10.0 },
  { date: 'Sept 24, 2023', source: 'Referral Reward (Marcus C.)', credit: 15.0 },
  { date: 'Aug 15, 2023', source: 'Account Verified', credit: 5.0 },
] as const;

export const SHARE_CHANNELS = [
  { label: 'Zalo', icon: '💬' },
  { label: 'Messenger', icon: '📨' },
  { label: 'SMS', icon: '📱' },
] as const;

export const MOBILE_NAV_ITEMS = [
  { label: 'Menu', icon: '🍽️', active: false },
  { label: 'Referrals', icon: '👥', active: true },
  { label: 'Rewards', icon: '🏆', active: false },
  { label: 'Profile', icon: '👤', active: false },
] as const;

export const DESKTOP_NAV_ITEMS = ['MENU', 'REFERRALS', 'REWARDS', 'PROFILE'] as const;

export const REFERRAL_CODE = 'AURA-VIP-2024-X';
