/**
 * Mautic Bridge Routes — /api/mautic-bridge
 * Cron-scheduled contact sync + campaign enrollment (~605 lines in original JS).
 *
 * Endpoints:
 *   POST /sync-contacts    — Sync customer contacts to Mautic
 *   POST /campaign-enroll  — Enroll contacts in campaigns
 *   POST /sync-all         — Full sync: contacts + campaigns
 *   GET  /status           — Last sync status
 */

import { createMauticClient, MauticClient, MauticContactInput, MauticBatchResult } from '../lib/mautic-client';
import { createLogger } from '../utils/logger.js';

interface MauticBridgeEnv {
  AURA_DB?: D1Database;
  MAUTIC_BASE_URL?: string;
  MAUTIC_CLIENT_ID?: string;
  MAUTIC_CLIENT_SECRET?: string;
}

interface CustomerContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: string;
  total_spent: number;
  visit_count: number;
  last_visit: string | null;
}

interface SyncStatus {
  last_sync: string | null;
  contacts_synced: number;
  campaigns_enrolled: number;
  errors: Array<{ customer_id: string; error: string }>;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

const log = createLogger({ route: 'mautic-bridge' });

// In-memory sync state (per-isolate)
let syncStatus: SyncStatus = {
  last_sync: null,
  contacts_synced: 0,
  campaigns_enrolled: 0,
  errors: [],
  status: 'idle',
};

function getMauticClient(env: MauticBridgeEnv): MauticClient | null {
  return createMauticClient({
    MAUTIC_BASE_URL: env.MAUTIC_BASE_URL,
    MAUTIC_CLIENT_ID: env.MAUTIC_CLIENT_ID,
    MAUTIC_CLIENT_SECRET: env.MAUTIC_CLIENT_SECRET,
  });
}

// ── Route handlers (plain exports for non-Hono routes) ──

export async function handleMauticBridgeRequest(request: Request, env: MauticBridgeEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mautic-bridge', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // GET /api/mautic-bridge/status
  if (method === 'GET' && path === '/status') {
    return json({ success: true, data: syncStatus });
  }

  // POST /api/mautic-bridge/sync-contacts
  if (method === 'POST' && path === '/sync-contacts') {
    return json(await syncContacts(env));
  }

  // POST /api/mautic-bridge/campaign-enroll
  if (method === 'POST' && path === '/campaign-enroll') {
    return json(await enrollCampaigns(env));
  }

  // POST /api/mautic-bridge/sync-all
  if (method === 'POST' && path === '/sync-all') {
    const contacts = await syncContacts(env);
    const campaigns = await enrollCampaigns(env);
    return json({ success: true, data: { contacts, campaigns } });
  }

  return json({ success: false, error: 'Not found' }, 404);
}

async function syncContacts(env: MauticBridgeEnv): Promise<{ success: boolean; synced: number; errors: string[] }> {
  const client = getMauticClient(env);
  if (!client) {
    return { success: false, synced: 0, errors: ['Mautic not configured'] };
  }

  const db = env.AURA_DB;
  if (!db) {
    return { success: false, synced: 0, errors: ['Database not available'] };
  }

  syncStatus.status = 'running';
  syncStatus.errors = [];
  let synced = 0;
  const errors: string[] = [];

  try {
    // Fetch customers updated in last hour (or all if first sync)
    const since = syncStatus.last_sync || new Date(Date.now() - 3600000).toISOString();

    const { results } = await db.prepare(
      `SELECT id, name, phone, email, tier, total_spent, visit_count,
        (SELECT MAX(created_at) FROM orders WHERE customer_id = customers.id) as last_visit
       FROM customers WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT 200`
    ).bind(since).all<CustomerContact>();

    if (!results || results.length === 0) {
      syncStatus.status = 'completed';
      syncStatus.last_sync = new Date().toISOString();
      return { success: true, synced: 0, errors: [] };
    }

    // Sync in batches of 20
    const batchSize = 20;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const contacts: MauticContactInput[] = batch.map(c => ({
        firstname: c.name || 'Unknown',
        email: c.email || `${c.phone || c.id}@aura-fnb.local`,
        mobile: c.phone || '',
        tier: c.tier || 'BASIC',
        total_spent: String(c.total_spent || 0),
        visit_count: String(c.visit_count || 0),
        last_visit: c.last_visit || '',
      }));

      try {
        const result: MauticBatchResult = await (client as any).syncContacts(contacts);
        synced += (result as any).created + (result as any).updated;
        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors.map(e => `Batch ${i}: ${e}`));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Batch ${i}: ${msg}`);
      }
    }

    syncStatus.contacts_synced += synced;
    syncStatus.status = 'completed';
    syncStatus.last_sync = new Date().toISOString();

    return { success: true, synced, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    syncStatus.status = 'failed';
    syncStatus.errors.push({ customer_id: 'batch', error: msg });
    return { success: false, synced, errors: [...errors, msg] };
  }
}

// ── Cron exports (re-exported by cron.ts) ──

export async function syncMauticContacts(env: Record<string, unknown>): Promise<{ synced: number }> {
  const result = await syncContacts(env as unknown as MauticBridgeEnv);
  return { synced: result.synced };
}

export async function detectWinbackCandidates(_env: Record<string, unknown>): Promise<{ candidates: number }> {
  return { candidates: 0 };
}

export async function detectBirthdayCandidates(_env: Record<string, unknown>): Promise<{ candidates: number }> {
  return { candidates: 0 };
}

async function enrollCampaigns(env: MauticBridgeEnv): Promise<{ success: boolean; enrolled: number; errors: string[] }> {
  const client = getMauticClient(env);
  if (!client) {
    return { success: false, enrolled: 0, errors: ['Mautic not configured'] };
  }

  const db = env.AURA_DB;
  if (!db) {
    return { success: false, enrolled: 0, errors: ['Database not available'] };
  }

  let enrolled = 0;
  const errors: string[] = [];

  try {
    // Enroll MASTER tier in VIP campaign
    const { results: masterCustomers } = await db.prepare(
      "SELECT id, email, phone FROM customers WHERE tier = 'MASTER' AND (email != '' OR phone != '') LIMIT 100"
    ).all<{ id: string; email: string; phone: string }>();

    for (const customer of masterCustomers || []) {
      try {
        await (client as any).addToCampaign(customer.email || customer.phone, 'vip-master');
        enrolled++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${customer.id}: ${msg}`);
      }
    }

    // Enroll new signups in welcome campaign (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { results: newCustomers } = await db.prepare(
      "SELECT id, email, phone FROM customers WHERE created_at >= ? AND (email != '' OR phone != '') LIMIT 100"
    ).bind(weekAgo).all<{ id: string; email: string; phone: string }>();

    for (const customer of newCustomers || []) {
      try {
        await (client as any).addToCampaign(customer.email || customer.phone, 'welcome-series');
        enrolled++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${customer.id}: ${msg}`);
      }
    }

    syncStatus.campaigns_enrolled += enrolled;

    return { success: true, enrolled, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, enrolled, errors: [...errors, msg] };
  }
}
