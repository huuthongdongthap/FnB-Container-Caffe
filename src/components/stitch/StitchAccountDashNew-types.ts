/**
 * Types for StitchAccountDashNew — AURA CAFE Customer Account Dashboard (v2)
 */

export interface DashAccountProfile {
  name: string;
  avatar: string;
  tier: string;
  memberSince: string;
}

export interface DashLoyaltyData {
  points: number;
  nextTier: string;
  pointsToNext: number;
  progressPercent: number;
}

export interface DashOrderItem {
  id: string;
  itemName: string;
  icon: 'coffee' | 'bakery' | 'icecream' | 'cupSoda';
  time: string;
  status: 'preparing' | 'delivered';
  rawItems?: string;
}

export interface StitchAccountDashNewProps {
  profile?: DashAccountProfile;
  loyalty?: DashLoyaltyData;
  orders?: DashOrderItem[];
}
