/**
 * Mautic Bridge — Type definitions
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { MauticClient, MauticContactInput } from '../../lib/mautic-client';

export interface MauticBridgeEnv {
  AURA_DB?: D1Database;
  MAUTIC_BASE_URL?: string;
  MAUTIC_CLIENT_ID?: string;
  MAUTIC_CLIENT_SECRET?: string;
  MAUTIC_CAMPAIGN_WINBACK?: string;
  MAUTIC_CAMPAIGN_BIRTHDAY?: string;
  MAUTIC_CAMPAIGN_PROMO?: string;
  [key: string]: unknown;
}

/**
 * Extended client type covering methods used at runtime that are not
 * declared on MauticClient (e.g. legacy or custom Mautic API operations).
 */
export type MauticClientDuck = MauticClient & {
  addToCampaign: (email: string, campaignName: string) => Promise<unknown>;
  syncContacts: (contacts: MauticContactInput[]) => Promise<SyncContactsResponse>;
};

export interface CustomerContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: string;
  total_spent: number;
  visit_count: number;
  last_visit: string | null;
}

export interface SyncContactsResponse {
  created: number;
  updated: number;
  errors: Array<{ email: string; error: string }>;
}

export interface SyncStatus {
  last_sync: string | null;
  contacts_synced: number;
  campaigns_enrolled: number;
  errors: Array<{ customer_id: string; error: string }>;
  status: 'idle' | 'running' | 'completed' | 'failed';
}
