/* ── Loyalty store types & localStorage key ── */

export const LOYALTY_KEY = 'aura_loyalty';

export interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string;
  description: string;
}

export interface PointsHistoryEntry {
  id: string;
  date: string;
  reason: string;
  points: number;
  balance: number;
}

export interface StoredLoyalty {
  tier: string;
  points: number;
  cashbackRate: number;
}
