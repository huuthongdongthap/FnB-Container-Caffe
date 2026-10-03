/**
 * Shared API response types
 */

export interface ApiSuccess<T = unknown> {
success: true;
message?: string;
data?: T;
[key: string]: unknown;
}

export interface ApiError {
success: false;
error: string;
detail?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
total: number;
limit: number;
offset: number;
}

export interface PaginatedResponse<T> extends ApiSuccess<T[]> {
pagination: PaginationMeta;
}

/**
 * Auth types
 */
export interface AuthUser {
id: string;
email: string;
name: string;
phone: string;
role: 'customer' | 'staff' | 'waiter' | 'manager' | 'owner';
}

export interface LoginRequest {
email: string;
password: string;
}

export interface RegisterRequest {
email: string;
password: string;
name?: string;
phone?: string;
}

export interface AuthResponse {
success: boolean;
user: AuthUser;
token: string;
message: string;
}

export interface JwtPayload {
email: string;
name: string;
id: string;
role: string;
tenantId?: string;
tier?: string;
iat?: number;
exp?: number;
}

/**
 * Order types
 */
export type OrderStatus =
| 'pending'
| 'confirmed'
| 'preparing'
| 'ready'
| 'served'
| 'delivered'
| 'completed'
| 'cancelled';

export type PaymentMethod = 'cod' | 'payos';

/**
 * Menu types
 */
export interface MenuQueryParams {
category?: string;
available?: boolean;
search?: string;
limit?: number;
offset?: number;
}

/**
 * Payment types
 */
export interface PayOSCreateLinkRequest {
order_id: string;
description?: string;
customer_name?: string;
}

export interface PayOSCreateLinkResponse {
success: boolean;
checkoutUrl?: string;
orderCode?: number;
paymentLinkId?: string;
error?: string;
}

/**
 * Loyalty types
 */
export type LoyaltyTierName = 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * Referral types
 */
export interface ReferralApplyRequest {
code: string;
}

export interface ReferralStats {
referral_code: string | null;
total_referrals: number;
total_cashback_earned_vnd: number;
total_points_earned_legacy: number;
code_usage: number;
recent_referrals: Array<Record<string, unknown>>;
}

/**
 * Reservation types
 */
export interface ReservationRequest {
table_id: string;
customer_name: string;
customer_phone: string;
guest_count?: number;
date: string;
time: string;
notes?: string;
}

/**
 * Contact types
 */
export interface ContactRequest {
name: string;
phone: string;
email?: string;
category?: string;
content: string;
}

/**
 * Franchise Location types
 */
export interface FranchiseLocation {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  royalty_percentage: number;
  status: 'active' | 'suspended' | 'closed';
  created_at?: string;
  updated_at?: string;
}

export interface FranchiseLocationMetrics {
  location_id: string;
  code: string;
  name: string;
  tenant_id: string;
  order_count: number;
  gross_sales: number;
  royalty_percentage: number;
  royalty_amount: number;
  net_franchisee_payout: number;
}

/**
 * AI & Forecasting Types
 */
export interface RecommendationItem {
  id: string;
  name: string;
  reason: string;
  score?: number;
  orders_count?: number;
}

export interface InventoryForecastItem {
  item_id: string;
  item_sku: string;
  item_name: string;
  current_stock: number;
  daily_run_rate: number;
  days_of_supply: number;
  risk_level: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  suggested_reorder_qty: number;
  unit: string;
  lead_time_days: number;
}

export interface DailyDemandProjection {
  date: string;
  day_of_week: string;
  projected_orders: number;
  projected_revenue: number;
  seasonality_index: number;
  is_weekend: boolean;
}

export interface DemandForecastResponse {
  tenant_id: string;
  forecast_horizon_days: number;
  projected_total_orders: number;
  projected_total_revenue: number;
  historical_sample_orders: number;
  daily_projections: DailyDemandProjection[];
  peak_windows: {
    morning_rush: { hours: string; share_percentage: number; suggested_prep: string };
    evening_social: { hours: string; share_percentage: number; suggested_prep: string };
  };
  staffing_advice: string;
}

export interface BaristaRecommendationResponse {
  product_id: string;
  name: string;
  reason: string;
  temperature: string;
  pairing_suggestion: string;
  barista_note: string;
  engine: string;
}

export interface DynamicPricingRule {
  id: string;
  tenant_id: string;
  name: string;
  rule_type: string;
  discount_percent: number;
  target_category?: string | null;
  target_product_id?: string | null;
  min_margin_percent: number;
  days_of_week: string;
  start_time: string;
  end_time: string;
  is_active: number;
}

export interface DynamicPricingCalculationItem {
  product_id: string;
  quantity: number;
  original_price: number;
  final_price: number;
  discount_applied: number;
  discount_percent: number;
  rule_name: string | null;
}

export interface CalculatePricingResponse {
  original_total: number;
  discounted_total: number;
  total_savings: number;
  items: DynamicPricingCalculationItem[];
}

export interface CustomerAssistantResponse {
  intent: string;
  reply: string;
  engine: string;
}

export interface ContainerTelemetryStatus {
  container_id: string;
  operational_status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  power_source: string;
  battery_percentage: number | null;
  ambient_temp_celsius: number;
  kds_online: boolean;
  alert_message: string | null;
  last_heartbeat: string;
  minutes_since_heartbeat: number;
}

