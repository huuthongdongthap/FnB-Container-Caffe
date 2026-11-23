/**
 * TypeScript interfaces and default data for StitchAccountNew components.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

/* ─── Interfaces ──────────────────────────────────────────────── */

export interface AccountProfileNew {
  name: string;
  avatar: string;
  tier: string;
  memberSince: string;
}

export interface LoyaltyDataNew {
  points: number;
  nextTier: string;
  pointsToNext: number;
  progressPercent: number;
}

export type OrderItemIcon = 'coffee' | 'bakery' | 'icecream' | 'cupSoda';
export type OrderItemStatus = 'preparing' | 'delivered';

export interface OrderItemNew {
  id: string;
  itemName: string;
  icon: OrderItemIcon;
  time: string;
  status: OrderItemStatus;
}

export interface AccountCardNew {
  type: 'subscription' | 'payment';
  title: string;
  subtitle: string;
  meta: string;
  accent?: boolean;
}

export interface StitchAccountNewProps {
  profile?: AccountProfileNew;
  loyalty?: LoyaltyDataNew;
  orders?: OrderItemNew[];
  cards?: AccountCardNew[];
}

/* ─── Default Data ────────────────────────────────────────────── */

export const defaultProfile: AccountProfileNew = {
  name: 'Khách hàng',
  avatar: '',
  tier: 'Bronze',
  memberSince: '',
};

export const defaultLoyalty: LoyaltyDataNew = {
  points: 0,
  nextTier: 'Silver',
  pointsToNext: 50,
  progressPercent: 0,
};

export const defaultOrders: OrderItemNew[] = [];

export const defaultCards: AccountCardNew[] = [];
