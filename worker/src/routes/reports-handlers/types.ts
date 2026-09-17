export interface DailyReport {
  date: string;
  signups: number;
  orders: number;
  revenue: number;
  cashback_earned: number;
  cashback_redeemed: number;
  avg_order_value: number;
}

export interface SummaryReport {
  total_customers: number;
  total_revenue: number;
  total_orders: number;
  total_cashback_issued: number;
  active_customers_30d: number;
  churn_rate_30d: number;
}

export interface OrderExportRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
}

export interface RevenueExportRow {
  date: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
}

export interface CustomerExportRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  loyalty_tier: string;
  created_at: string;
  total_spent: number;
  order_count: number;
}

export interface ReconciliationRow {
  shift_id: string;
  date: string;
  opening_float: number;
  cash_payments: number;
  cash_payouts: number;
  expected_cash: number;
  actual_cash: number | null;
  variance: number | null;
  status: string;
  denominated: boolean;
}

export interface PaymentMethodSummary {
  method: string;
  count: number;
  total: number;
}

export interface CategorySummary {
  category: string;
  items_sold: number;
  revenue: number;
}

export interface DailyReconciliationReport {
  from: string;
  to: string;
  shifts: ReconciliationRow[];
  payment_methods: PaymentMethodSummary[];
  categories: CategorySummary[];
  totals: {
    revenue: number;
    cash_expected: number;
    cash_actual: number;
    cash_variance: number;
    digital_payments: number;
    order_count: number;
  };
}
