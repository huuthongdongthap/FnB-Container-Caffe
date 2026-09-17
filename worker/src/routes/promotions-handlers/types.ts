export interface PromotionCode {
  id: string;
  code: string;
  percent: number;
  max_discount: number;
  min_order: number;
  starts_at?: string | null;
  expires_at: string | null;
  usage_limit: number;
  usage_count: number;
  is_active: number;
}

export interface ValidateResult {
  valid: boolean;
  code?: string;
  percent?: number;
  max_discount?: number;
  min_order?: number;
  reason?: string;
}

export interface RedeemInput {
  code: string;
  order_id: string;
  order_total: number;
}

export interface CreatePromotionInput {
  code: string;
  percent: number;
  max_discount?: number;
  min_order?: number;
  usage_limit?: number;
  starts_at?: string;
  expires_at?: string;
  is_active?: number;
}
