/**
 * Campaign Types — Automated Marketing Campaigns
 */
export type CampaignTrigger = 'welcome' | 'birthday' | 'winback' | 'post_visit' | 'cashback_expiry';
export type CampaignChannel = 'sms' | 'email' | 'zalo';

export interface CampaignCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyalty_tier?: string;
  total_spent?: number;
  visit_count?: number;
  last_order_date?: string;
  date_of_birth?: string;
  created_at?: string;
}

export interface CampaignMessage {
  trigger: CampaignTrigger;
  channel: CampaignChannel;
  to: string;
  subject?: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface CampaignResult {
  trigger: CampaignTrigger;
  channel: CampaignChannel;
  customer_id: string;
  sent: boolean;
  error?: string;
}

export interface CampaignLogRow {
  id: string;
  customer_id: string;
  trigger: CampaignTrigger;
  channel: CampaignChannel;
  sent_at: string;
  status: string;
  error?: string;
}
