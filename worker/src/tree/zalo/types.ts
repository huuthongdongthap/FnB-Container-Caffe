export interface ZnsData {
  name?: string;
  member_id?: string;
  balance?: number;
  qr_url?: string;
  amount?: number;
  order_id?: string;
  new_tier?: string;
  new_tier_vi?: string;
  new_rate?: number;
  days?: number;
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
}
