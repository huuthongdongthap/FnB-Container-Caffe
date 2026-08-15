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
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB5VoyAqqlj9v1p_Fd0vKnkJbm4fDpCbBfcfnGk9iXWJsQkUY4p9MwZE9gW4aIGDezgU5nVuKq9kA5nJlELipUIKxSAu-iJ0TyddMgMz4EetP8GtGSFzEHu72d1fnLIk3pCADfO75fGMgJjAfybKZas0EOq-e0Wu_847djVJd6nISO3cs0Pjyb7NUii2ULfHnRyQW30Laqzeso6-81-OMMeqPUorTlgkBBRabwNARHVIRCd7uvVvxzFycbE1Y4I-ysk4OWL4tc5Mtk',
    alt: 'Private coffee cupping session with elegant glass vessels on dark industrial wood table',
  },
  {
    title: 'Limited Edition Vessel',
    points: '8,000',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ZYyk4mbXZG3-ZeOC-Q5TZST8LNWGfeghQ08Q6qfgBKPaqKi2xvxzOhGO64VKfR7PP8RlK7NqYc5d0KyUivemYw5JwC_jdKmOULyvxP6-iAfdcE3TynE0mhz2DNdVaaRjQQi2rnuYdumCRNtZb-HNEiKa1grVkNIXGPNK9z0SxwpgcmyPwiY8KGLjvlpu-inWp6t01uR2oV28qWJNBVzw7R7ne9nt747XKEB9Q2FKmg7c_NrELvOi2xwOpzmbhqX2YaBD_vG3uRE',
    alt: 'Matte black ceramic coffee vessel with polished bronze handle on dark slate surface',
  },
  {
    title: 'Artisan Coffee Flight',
    points: '2,500',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHAfEGOOefIl2MVbYXeX3iigZB8rveXFZ7jluS_IW7_nDi6Phokeh3xVop2G1btyCwd2nrPhZnWVDIeCsGyK_u0ukBnx06WTAn2Irk1_14p99qJYFVXOIyjxQPmBB5ONiDOz-sZHx1_hSVTRDTwU7zj75xxi5_-LTat6pQ36So9JPYZ4X4k9sCoOIWYVgr_SmQXuEaD9hCKRXmaI-eicBKDQJnGmeubIirNBf0n4CzrYV1-4-CnEiGR7ksClo00VjDHOFshsJkssc',
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
