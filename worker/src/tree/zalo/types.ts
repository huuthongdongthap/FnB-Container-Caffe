export interface ZnsData {
  name?: string;
  member_id?: string;
  balance?: number;
  qr_url?: string;
  amount?: number;
  order_id?: string;
  status?: string;
  new_tier?: string;
  new_tier_vi?: string;
  new_rate?: number;
  days?: number;
  // Promotion announcement fields (general_promotion template)
  title?: string;
  message?: string;
  promo_code?: string;
  discount?: string;
  expires_at?: string;
}

export interface ZnsResult {
  ok: boolean;
  channel: string;
  reason?: string;
  result?: unknown;
}

export interface ZnsNotifyInput {
  customer_id: string;
  template_key: string;
  data: ZnsData;
  tenantId?: string;
}
