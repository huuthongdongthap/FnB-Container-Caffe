export const TIER_THRESHOLDS = {
  BASIC: 0,
  PREMIUM: 1000,
  ENTERPRISE: 2000,
  MASTER: 3000,
} as const;

export const TIER_LABELS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

export interface Benefit {
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
}

export const BENEFITS: readonly Benefit[] = [
  {
    icon: '\u{2615}',
    title: 'Free Monthly Cupping',
    desc: 'Exclusive tasting sessions',
    unlocked: false,
  },
  {
    icon: '\u{1F4CD}',
    title: 'Priority Lounge Access',
    desc: 'Fast-track seating in Aura Labs',
    unlocked: false,
  },
  {
    icon: '\u{1F69A}',
    title: 'Free Roastery Delivery',
    desc: 'Zero-cost shipping on bulk beans',
    unlocked: false,
  },
] as const;

export const MAX_VIS_PTS = 3000;
