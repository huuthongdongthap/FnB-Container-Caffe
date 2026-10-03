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
