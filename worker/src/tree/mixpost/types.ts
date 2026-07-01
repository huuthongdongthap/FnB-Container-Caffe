import type { D1Database } from '@cloudflare/workers-types';

export interface MixpostEnv {
  AURA_DB?: D1Database;
  MIXPOST_API_URL?: string;
  MIXPOST_API_TOKEN?: string;
  MIXPOST_ACCOUNTS?: string;
  [key: string]: unknown;
}

export interface MixpostPostInput {
  content: string;
  accounts?: number[];
  mediaUrls?: string[];
  scheduledAt?: string;
}

export interface PromotionRow {
  id: string;
  code: string;
  percent: number;
  is_active: number;
}

export interface ProductRow {
  id: string;
  name: string;
  price: number;
  is_available: number;
  category_id?: number;
}

export interface AutoPostTemplate {
  id: string;
  content_template: string;
  schedule_cron: string;
  accounts: string;
  is_active: number;
}

export interface PostRecord {
  id: string;
  content: string;
  status: string;
  platforms: string;
  media_urls: string;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
}
