/**
 * Constants & defaults for StitchAccountDashNew — AURA CAFE Customer Account Dashboard
 */
import type { DashAccountProfile, DashLoyaltyData, DashOrderItem } from './StitchAccountDashNew-types';

/* ─── Font Stack Constants (from original HTML tailwind.config) ─── */
export const BODY_FONT = '"Hanken Grotesk", system-ui, sans-serif';
export const DISPLAY_FONT = '"EB Garamond", Georgia, "Times New Roman", serif';

/* ─── Default Data ────────────────────────────────────────────── */
export const defaultProfile: DashAccountProfile = {
  name: 'Julian Vane',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDjVgK1lkoKR0DuW8esKw0a2oRC-Fz_3evlAv6W1nahj6KkgttV-rJlrEvLN5KS3ksSDY5a3ELKu6G3REmcyRyyu6TGGXEsazdYI7OJMuLtalRqPUcq90xJe3pnN_sc__Z4hRt2hgz-5ofqbqlvfGogGreZRtSuZJ9Iv8mRFpZYG_CMBYjSHBA4w837Fqs39sFHpfKTfK0HIY2ckhrFOVQSKe3a8rDVyEPLlLKn30cEytzJCrGX9hkYE-uJI-xfZxCvnKfXoxgH4lI',
  tier: 'Gold',
  memberSince: '2022',
};

export const defaultLoyalty: DashLoyaltyData = {
  points: 1250,
  nextTier: 'Platinum',
  pointsToNext: 250,
  progressPercent: 80,
};

export const defaultOrders: DashOrderItem[] = [
  {
    id: '1',
    itemName: 'Truffle Cortado',
    icon: 'coffee',
    time: 'Today, 08:45 AM',
    status: 'preparing',
  },
  {
    id: '2',
    itemName: 'Gold Leaf Croissant',
    icon: 'bakery',
    time: 'Yesterday, 09:12 AM',
    status: 'delivered',
  },
  {
    id: '3',
    itemName: 'Iced Obsidian Brew',
    icon: 'icecream',
    time: 'Oct 24, 02:30 PM',
    status: 'delivered',
  },
];
