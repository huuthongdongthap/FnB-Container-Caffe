import type { D1Database } from '@cloudflare/workers-types';

export interface PretixEnv {
  PRETIX_API_URL?: string;
  PRETIX_API_TOKEN?: string;
  PRETIX_ORGANIZER?: string;
  PRETIX_WEBHOOK_SECRET?: string;
  AURA_DB?: D1Database;
  [key: string]: unknown;
}

export interface PretixWebhookBody {
  notification_id: number;
  organizer: string;
  event: string;
  code: string;
  action: string;
}

export interface PretixItemsResponse {
  results?: PretixItem[];
}

export interface PretixItem {
  id: string;
  name: Record<string, string>;
  price: number;
}

export interface PretixEventResponse {
  name?: Record<string, string>;
  items?: PretixItem[];
}

export interface PretixCheckinBody {
  secret: string;
  event?: string;
  listId?: number;
}

export interface PretixGenerateBody {
  source: string;
  slug: string;
}
