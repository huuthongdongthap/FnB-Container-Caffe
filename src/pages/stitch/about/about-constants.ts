import type { TimelineStep, StatItem, SocialLink } from './about-types';

export const NAV_ITEMS = [
  { label: 'Menu', href: '#menu' },
  { label: 'Story', href: '#story' },
  { label: 'Reservation', href: '#reservation' },
  { label: 'Location', href: '#location' },
] as const;

export const TIMELINE_STEPS: TimelineStep[] = [
  {
    icon: '\u{1F3ED}',
    titleEn: 'Structural Origins',
    titleVi: 'Gốc Công Trình',
    description:
      'Three high-cube shipping containers re-engineered into a minimalist sanctuary. Raw steel meets precision glass — every scar tells a story of rebirth.',
  },
  {
    icon: '\u{1F3A8}',
    titleEn: 'Brewing Artistry',
    titleVi: 'Nghệ Thuật Pha Chế',
    description:
      'Custom pressure profiles, single-estate beans, and laboratory-grade filtration. Each cup is a repeatable masterpiece of flavor chemistry.',
  },
  {
    icon: '\u{1F525}',
    titleEn: 'The Roast',
    titleVi: 'Nướng Hạt',
    description:
      'Small-batch roasting calibrated to the nocturnal rhythm. Beans sourced from 50+ origins, roasted to unlock depth, clarity, and soul.',
  },
];

export const STATS: StatItem[] = [
  { value: '2024', labelEn: 'Established', labelVi: 'Thành Lập' },
  { value: '12K+', labelEn: 'Cups Served', labelVi: 'Ly Đã Phục Vụ' },
  { value: '50+', labelEn: 'Bean Origins', labelVi: 'Nguồn Gốc Hạt' },
];

export const SOCIAL_LINKS: SocialLink[] = [
  { icon: '\u{1F4F7}', label: 'Instagram', href: '#' },
  { icon: '\u{1F4D8}', label: 'Facebook', href: '#' },
  { icon: '\u{1F3B5}', label: 'TikTok', href: '#' },
];
