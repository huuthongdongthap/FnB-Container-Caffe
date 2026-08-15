/* ── Constants for Referral Rewards 1 ──────────────────────────────────── */

import type { ShareChannel, Friend, Reward } from './referral-rewards-1-types';

export const REFERRAL_CODE = 'AURA-LUXE-88';

export const SHARE_CHANNELS: readonly ShareChannel[] = [
  { label: 'Zalo', icon: '💬' },
  { label: 'Messenger', icon: '💭' },
  { label: 'SMS', icon: '📱' },
] as const;

export const FRIENDS: readonly Friend[] = [
  { name: 'Julian Vane', joined: 'Joined Oct 24, 2023', status: 'active' as const },
  { name: 'Elara Thorne', joined: 'Joined Oct 21, 2023', status: 'joined' as const },
  { name: 'Marcus Chen', joined: 'Joined Oct 15, 2023', status: 'active' as const },
] as const;

export const REWARDS: readonly Reward[] = [
  { date: '24 Oct', source: 'J. Vane', amount: '+$15.00' },
  { date: '21 Oct', source: 'E. Thorne', amount: '+$15.00' },
  { date: '15 Oct', source: 'M. Chen', amount: '+$15.00' },
] as const;

export const AVATAR_COLORS: Record<string, string> = {
  'Julian Vane': '#8B7355',
  'Elara Thorne': '#5A7D6E',
  'Marcus Chen': '#4A5568',
};
