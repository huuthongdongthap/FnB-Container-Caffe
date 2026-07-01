// Extracted types from routes/subscriptions.ts

export interface PlanRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  container_size: string;
  monthly_price_vnd: number;
  deposit_vnd: number;
  features: string;
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
  notes: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
  plan_name?: string;
  plan_slug?: string;
  container_size?: string;
  plan_price?: number;
  plan_features?: string;
  features?: string;
}

export interface InvoiceRecord {
  id: string;
  subscription_id: string;
  amount_vnd: number;
  status: string;
  period_start: string;
  period_end: string;
  invoice_number: string;
  payment_method: string | null;
  payment_ref: string | null;
  paid_at: string | null;
  created_at: string;
  customer_name?: string;
  plan_name?: string;
}

export interface JwtPayload {
  role?: string;
  customerId?: string;
  sub?: string;
  id?: string;
}
