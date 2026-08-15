import type { BenefitReward } from './StitchLoyaltyCalcNew-types';

export const defaultBenefits: BenefitReward[] = [
  {
    id: 'cupping',
    icon: 'coffee',
    title: 'Free Monthly Cupping',
    description: 'Exclusive tasting sessions',
    locked: true,
  },
  {
    id: 'lounge',
    icon: 'seat',
    title: 'Priority Lounge Access',
    description: 'Fast-track seating in Aura Labs',
    locked: true,
  },
  {
    id: 'delivery',
    icon: 'truck',
    title: 'Free Roastery Delivery',
    description: 'Zero-cost shipping on bulk beans',
    locked: true,
  },
];

export const DEFAULT_POINTS_PER_DOLLAR = 10;
export const DEFAULT_TIER_MILESTONES = [0, 1000, 2000, 3000];
export const DEFAULT_TIER_LABELS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
