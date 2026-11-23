/**
 * Constants & defaults for StitchAccountDashNew — AURA CAFE Customer Account Dashboard
 */
import type { DashAccountProfile, DashLoyaltyData, DashOrderItem } from './StitchAccountDashNew-types';

/* ─── Font Stack Constants (from original HTML tailwind.config) ─── */
export const BODY_FONT = '"Hanken Grotesk", system-ui, sans-serif';
export const DISPLAY_FONT = 'var(--aura-font-display)';

/* ─── Default Data ────────────────────────────────────────────── */
export const defaultProfile: DashAccountProfile = {
  name: 'Khách hàng',
  avatar: '',
  tier: 'Bronze',
  memberSince: '',
};

export const defaultLoyalty: DashLoyaltyData = {
  points: 0,
  nextTier: 'Silver',
  pointsToNext: 50,
  progressPercent: 0,
};

export const defaultOrders: DashOrderItem[] = [];
