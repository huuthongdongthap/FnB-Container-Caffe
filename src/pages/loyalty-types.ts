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

export interface LoyaltyPageProps {
  /** Override points (default: store.points) */
  points?: number;
  /** Override tier (default: store.tier) */
  tier?: string;
  /** Override rewards (default: store.rewards) */
  rewards?: Reward[];
  /** Override history (default: store.history) */
  history?: PointsHistoryEntry[];
  /** Override referral code (default: "AURA-PLAT-882") */
  referralCode?: string;
  /** Override check-in days (default: Mon-Wed checked) */
  checkinDays?: Record<string, boolean>;
}
