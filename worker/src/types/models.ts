/**
 * D1 model types matching migration schema.
 * Used for type-safe query results across all routes.
 */

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image: string | null;
  available: number | boolean;
  tags: string | null; // JSON array stored as string
  nutrition: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  items: string; // JSON string
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  shipping_fee: number;
  discount: number;
  notes: string | null;
  delivery_time: string;
  cashback_earned: number | null;
  cashback_used: number | null;
  points_earned: number | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  status: string;
  transaction_id: string | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  loyalty_points: number;
  lifetime_points: number;
  loyalty_tier: string;
  date_of_birth: string | null;
  zalo: string | null;
  source: string | null;
  last_ip: string | null;
  consent_erpnext_sync: number | null;
  created_at: string;
  updated_at: string;
}

export interface CashbackWallet {
  id: string;
  customer_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CashbackTransaction {
  id: string;
  wallet_id: string;
  customer_id: string;
  order_id: string | null;
  type: 'earn' | 'spend' | 'bonus' | 'debit';
  amount: number;
  balance_after: number;
  expires_at: string | null;
  multiplier_applied: number | null;
  campaign_id: string | null;
  description: string | null;
  created_at: string;
}

export interface LoyaltyTier {
  id: string;
  tier_name: string;
  display_name_vi: string;
  min_points: number;
  cashback_rate: number;
  point_multiplier: number;
  expiry_days: number | null;
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  point_cost: number;
  discount_type: string | null;
  discount_value: number | null;
  description: string | null;
  active: number;
  created_at: string;
}

export interface UserReward {
  id: string;
  customer_id: string;
  reward_id: string;
  code: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  title?: string;
  discount_type?: string;
  discount_value?: number;
}

export interface ReferralCode {
  id: string;
  customer_id: string;
  code: string;
  times_used: number;
  total_points_earned: number;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_customer_id: string;
  referral_code: string;
  points_awarded: number;
  cashback_awarded_vnd: number;
  status: string;
  bonus_type: string | null;
  first_order_id: string | null;
  first_order_amount: number | null;
  reward_paid_at: string | null;
  created_at: string;
}

export interface CafeTable {
  id: string;
  table_number: string;
  zone: string;
  capacity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  date: string;
  time: string;
  zone: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BonusCampaign {
  id: string;
  code: string;
  name: string;
  description: string | null;
  cashback_multiplier: number;
  signup_bonus_vnd: number;
  signup_bonus_cap: number | null;
  refer_bonus_vnd: number;
  max_cap_per_customer_vnd: number;
  active: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  category: string;
  content: string;
  status: string;
  created_at: string;
}
