/**
 * Constants & defaults for StitchAccountDashNew — AURA CAFE Customer Account Dashboard
 */
import type { DashAccountProfile, DashLoyaltyData, DashOrderItem } from './StitchAccountDashNew-types';

/* ─── Font Stack Constants (from original HTML tailwind.config) ─── */
export const BODY_FONT = '"Hanken Grotesk", system-ui, sans-serif';
export const DISPLAY_FONT = 'var(--aura-font-display)';

/* ─── Default Data ────────────────────────────────────────────── */
export const defaultProfile: DashAccountProfile = {
  name: 'Julian Vane',
  avatar:
    '/photos/IMG_6593.webp',
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
