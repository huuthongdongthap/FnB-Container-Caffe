import type { NavLink, Reward, Activity } from './loyalty-rewards-types';

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Tiers', href: '#tiers', active: false },
  { label: 'Rewards', href: '#rewards', active: true },
  { label: 'Lounge', href: '#lounge', active: false },
  { label: 'Concierge', href: '#concierge', active: false },
] as const;

export const REWARDS: readonly Reward[] = [
  {
    title: 'Private Cupping Session',
    points: '4,500',
    image: '/photos/IMG_6565.webp',
    alt: 'Private coffee cupping session with elegant glass vessels on dark industrial wood table',
  },
  {
    title: 'Limited Edition Vessel',
    points: '8,000',
    image: '/photos/IMG_6566.webp',
    alt: 'Matte black ceramic coffee vessel with polished bronze handle on dark slate surface',
  },
  {
    title: 'Artisan Coffee Flight',
    points: '2,500',
    image: '/photos/IMG_6702.webp',
    alt: 'Three crystal carafes of specialty coffees on metallic tray in dimly lit lounge',
  },
];

export const ACTIVITIES: readonly Activity[] = [
  { activity: 'Kenya SL28 Purchase', date: 'OCT 24, 2024', status: 'COMPLETED', points: '+450' },
  { activity: 'Concierge Booking', date: 'OCT 20, 2024', status: 'COMPLETED', points: '+1,200' },
  { activity: 'Referral Bonus', date: 'OCT 15, 2024', status: 'COMPLETED', points: '+2,000' },
];

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const COMPLETED_DAYS = 3;

export const TIER_BENEFITS = [
  'Complementary valet parking',
  'Priority reservation access',
  'Invite-only tasting events',
  '15% Discount on retail gear',
] as const;
