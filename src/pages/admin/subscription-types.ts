export interface PlanRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  container_size: string;
  monthly_price_vnd: number;
  deposit_vnd: number;
  features: string[];
  max_occupants: number;
  is_popular: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  plan_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  container_number: string | null;
  zone: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  amount_vnd: number;
  deposit_paid: number;
  deposit_vnd: number;
  created_at: string;
  plan_name?: string;
  plan_slug?: string;
  container_size?: string;
}

export interface SubscriptionStats {
  mrr_vnd: number;
  arr_vnd: number;
  active_subscriptions: number;
  total_contracts: number;
  new_this_month: number;
  churned_this_month: number;
  churn_rate_pct: number;
  avg_contract_value_vnd: number;
  pending_count: number;
  by_zone: { zone: string; count: number; revenue: number }[];
  by_plan: { name: string; slug: string; count: number; revenue: number }[];
  mrr_buckets: {
    under_1m: number;
    from_1m_to_3m: number;
    from_3m_to_5m: number;
    above_5m: number;
  };
}

export interface PlanFormData {
  name: string;
  slug: string;
  description: string;
  container_size: string;
  monthly_price_vnd: string;
  deposit_vnd: string;
  features: string;
  max_occupants: string;
  is_popular: boolean;
  is_active: boolean;
  sort_order: string;
}

export const EMPTY_PLAN_FORM: PlanFormData = {
  name: '',
  slug: '',
  description: '',
  container_size: '20ft',
  monthly_price_vnd: '',
  deposit_vnd: '0',
  features: '',
  max_occupants: '1',
  is_popular: false,
  is_active: true,
  sort_order: '0',
};
