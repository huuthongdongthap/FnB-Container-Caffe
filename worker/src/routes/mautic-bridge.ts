/**
 * Mautic Bridge Routes — /api/mautic-bridge
 * Cron-scheduled contact sync + campaign enrollment.
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
  MAUTIC_CAMPAIGN_WINBACK?: string;
  MAUTIC_CAMPAIGN_BIRTHDAY?: string;
  MAUTIC_CAMPAIGN_PROMO?: string;
  [key: string]: unknown;
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

function getMauticClient(env: MauticBridgeEnv): any | null {
  return createMauticClient({
    MAUTIC_BASE_URL: env.MAUTIC_BASE_URL as string,
    MAUTIC_CLIENT_ID: env.MAUTIC_CLIENT_ID as string,
    MAUTIC_CLIENT_SECRET: env.MAUTIC_CLIENT_SECRET as string,
  });
}

// ── toMauticContact — transform customer to Mautic format ──
export function toMauticContact(customer: Record<string, unknown>): Record<string, unknown> {
  const phone = (customer.phone as string) || '';
  return {
    email: (customer.email as string) || `${phone}@aura-cafe.internal`,
    firstname: (customer.name as string) || 'Khách',
    phone,
    loyalty_tier: (customer.loyalty_tier as string) || 'bronze',
    birthday: (customer.birthday as string) || null,
    last_order_date: (customer.last_order_date as string) || null,
    total_orders: (customer.total_orders as number) || 0,
  };
}

// ── syncSegments — assign tier/recency/birthday segments ──
export async function syncSegments(
  env: Record<string, unknown>,
  client: any,
  customers: Array<Record<string, unknown>>,
  contactIdMap: Record<string, number>,
): Promise<number> {
  const tierSegmentMap: Record<string, number> = {
    bronze: (env.MAUTIC_SEGMENT_LOYALTY_BRONZE as number) || 0,
    silver: (env.MAUTIC_SEGMENT_LOYALTY_SILVER as number) || 0,
    gold: (env.MAUTIC_SEGMENT_LOYALTY_GOLD as number) || 0,
    platinum: (env.MAUTIC_SEGMENT_LOYALTY_PLATINUM as number) || 0,
  };
  const activeSegment = (env.MAUTIC_SEGMENT_ACTIVE as number) || 0;
  const atRiskSegment = (env.MAUTIC_SEGMENT_AT_RISK as number) || 0;
  const inactiveSegment = (env.MAUTIC_SEGMENT_INACTIVE as number) || 0;
  const birthdaySegment = (env.MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH as number) || 0;

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  let assigned = 0;

  for (const customer of customers) {
    const email = (customer.email as string) || `${customer.phone}@aura-cafe.internal`;
    const contactId = contactIdMap[email];
    if (!contactId) continue;

    // Tier segment
    const tier = ((customer.loyalty_tier as string) || 'bronze').toLowerCase();
    const tierSegmentId = tierSegmentMap[tier];
    if (tierSegmentId > 0) {
      await client.addContactToSegment(contactId, tierSegmentId);
      assigned++;
    }

    // Recency segment
    const lastOrder = customer.last_order_date as string | null;
    if (lastOrder) {
      const daysSince = Math.floor((now.getTime() - new Date(lastOrder).getTime()) / 86400000);
      let recencySegmentId = 0;
      if (daysSince <= 30) recencySegmentId = activeSegment;
      else if (daysSince <= 60) recencySegmentId = atRiskSegment;
      else recencySegmentId = inactiveSegment;
      if (recencySegmentId > 0) {
        await client.addContactToSegment(contactId, recencySegmentId);
        assigned++;
      }
    } else {
      // No orders → inactive
      if (inactiveSegment > 0) {
        await client.addContactToSegment(contactId, inactiveSegment);
        assigned++;
      }
    }

    // Birthday segment
    const birthday = customer.birthday as string | null;
    if (birthday && birthdaySegment > 0) {
      const bdayMonth = birthday.slice(5, 7);
      if (bdayMonth === currentMonth) {
        await client.addContactToSegment(contactId, birthdaySegment);
        assigned++;
      }
    }
  }

  return assigned;
}

// ── trackEnrollment — insert into campaign_enrollments ──
export async function trackEnrollment(
  db: any,
  customerId: string,
  campaignType: string,
  campaignId: string,
  mauticContactId: number,
  status: string,
): Promise<string> {
  const id = 'ce_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  await db.prepare(
    `INSERT INTO campaign_enrollments (id, customer_id, campaign_type, campaign_id, created_at, mautic_contact_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, customerId, campaignType, campaignId, new Date().toISOString(), String(mauticContactId), status).run();
  return id;
}

// ── isAlreadyEnrolled — check campaign_enrollments for recent entries ──
export async function isAlreadyEnrolled(
  db: any,
  customerId: string,
  campaignType: string,
  days: number,
): Promise<boolean> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const row = await db.prepare(
    'SELECT 1 FROM campaign_enrollments WHERE customer_id = ? AND campaign_type = ? AND created_at >= ? LIMIT 1'
  ).bind(customerId, campaignType, since).first();
  return !!row;
}

// ── Campaign detection helpers ──

async function detectAndEnroll(
  env: Record<string, unknown>,
  campaignEnvVar: string,
  campaignId: string,
  campaignType: string,
  query: string,
  queryParams: unknown[],
): Promise<{ detected: number; enrolled: number }> {
  const campaignCfg = env[campaignEnvVar] as string | undefined;
  if (!campaignCfg) return { detected: 0, enrolled: 0 };

  const client = getMauticClient(env as unknown as MauticBridgeEnv);
  if (!client) return { detected: 0, enrolled: 0 };

  const db = env.AURA_DB as any;
  if (!db) return { detected: 0, enrolled: 0 };

  const { results } = await db.prepare(query).bind(...queryParams).all();
  const customers = (results || []) as Array<Record<string, unknown>>;
  let detected = customers.length;
  let enrolled = 0;

  for (const customer of customers) {
    try {
      const contact = toMauticContact(customer);
      const contactId = await client.createOrUpdateContact(contact);
      await client.addContactToCampaign(contactId, parseInt(campaignCfg, 10));
      await trackEnrollment(db, customer.id as string, campaignType, campaignCfg, contactId, 'enrolled');
      enrolled++;
    } catch {
      // skip on error
    }
  }

  return { detected, enrolled };
}

export async function detectWinbackCandidates(env: Record<string, unknown>): Promise<{ detected: number; enrolled: number }> {
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString();
  return detectAndEnroll(
    env,
    'MAUTIC_CAMPAIGN_WINBACK',
    (env.MAUTIC_CAMPAIGN_WINBACK as string) || '10',
    'winback',
    `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date
     FROM customers c
     WHERE c.phone IS NOT NULL AND c.phone != ''
       AND c.id NOT IN (
         SELECT customer_id FROM campaign_enrollments WHERE campaign_type = 'winback'
           AND created_at > ?
       )
       AND (
         SELECT MAX(o2.created_at) FROM orders o2 WHERE o2.customer_id = c.id
       ) IS NOT NULL
       AND (
         SELECT MAX(o3.created_at) FROM orders o3 WHERE o3.customer_id = c.id
       ) < ?
     LIMIT 100`,
    [thirtyOneDaysAgo, thirtyOneDaysAgo],
  );
}

export async function detectBirthdayCandidates(env: Record<string, unknown>): Promise<{ detected: number; enrolled: number }> {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  return detectAndEnroll(
    env,
    'MAUTIC_CAMPAIGN_BIRTHDAY',
    (env.MAUTIC_CAMPAIGN_BIRTHDAY as string) || '20',
    'birthday',
    `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth as birthday
     FROM customers c
     WHERE c.date_of_birth IS NOT NULL
       AND substr(c.date_of_birth, 6, 2) = ?
       AND c.phone IS NOT NULL AND c.phone != ''
       AND c.id NOT IN (
         SELECT customer_id FROM campaign_enrollments WHERE campaign_type = 'birthday'
           AND created_at > ?
       )
     LIMIT 100`,
    [currentMonth, new Date(now.getFullYear(), now.getMonth(), 1).toISOString()],
  );
}

export async function triggerPromoCampaign(
  env: Record<string, unknown>,
  opts: { segment: { tier: string }; templateName: string; promoTitle: string; promoDesc: string },
): Promise<{ enrolled: number }> {
  const campaignCfg = (env.MAUTIC_CAMPAIGN_PROMO as string) || '30';
  const client = getMauticClient(env as unknown as MauticBridgeEnv);
  if (!client) return { enrolled: 0 };

  const db = env.AURA_DB as any;
  if (!db) return { enrolled: 0 };

  const { results } = await db.prepare(
    `SELECT id, name, phone, email, loyalty_tier FROM customers
     WHERE LOWER(loyalty_tier) = LOWER(?) AND phone IS NOT NULL AND phone != ''
     LIMIT 500`
  ).bind(opts.segment.tier).all();

  const customers = (results || []) as Array<Record<string, unknown>>;
  let enrolled = 0;

  for (const customer of customers) {
    try {
      const contact = toMauticContact(customer);
      const contactId = await client.createOrUpdateContact(contact);
      await client.addContactToCampaign(contactId, parseInt(campaignCfg, 10));
      await trackEnrollment(db, customer.id as string, 'promo', campaignCfg, contactId, 'enrolled');
      enrolled++;
    } catch {
      // skip on error
    }
  }

  return { enrolled };
}

// ── syncMauticContacts — cron-scheduled full sync ──
export async function syncMauticContacts(env: Record<string, unknown>): Promise<{ synced: number; skipped?: boolean }> {
  const client = getMauticClient(env as unknown as MauticBridgeEnv);
  if (!client) return { synced: 0, skipped: true };

  const db = env.AURA_DB as any;
  if (!db) return { synced: 0, skipped: true };

  const kv = env.AUTH_KV as any;
  const lastSyncTs: string | null = kv ? await kv.get('mautic_last_sync_ts') : null;
  const since = lastSyncTs || new Date(Date.now() - 3600000).toISOString();

  const { results } = await db.prepare(
    `SELECT c.phone, c.name, c.email, c.loyalty_tier, c.date_of_birth as birthday,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date,
      (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = c.id) as total_orders,
      c.updated_at
     FROM customers c
     WHERE c.updated_at > ?
     ORDER BY c.updated_at ASC
     LIMIT 500`
  ).bind(since).all();

  const customers = (results || []) as Array<Record<string, unknown>>;
  if (customers.length === 0) {
    if (kv) await kv.put('mautic_last_sync_ts', new Date().toISOString());
    return { synced: 0 };
  }

  let synced = 0;
  const batchSize = 50;
  const contactIdMap: Record<string, number> = {};

  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    const contacts = batch.map(c => toMauticContact(c));

    try {
      const result: any = await (client.batchUpsertContacts || client.batchUpsertContacts).bind(client)(contacts);
      const created = result?.created || [];
      const updated = result?.updated || [];
      synced += created.length + updated.length;

      // Build contact ID map
      for (const item of created) {
        if (item.email) contactIdMap[item.email] = item.id;
      }
      for (const item of updated) {
        if (item.email) contactIdMap[item.email] = item.id;
      }
    } catch {
      // continue to next batch
    }
  }

  // Sync segments for all customers
  try {
    await syncSegments(env, client, customers, contactIdMap);
  } catch {
    // segment sync is best-effort
  }

  if (kv) await kv.put('mautic_last_sync_ts', new Date().toISOString());
  return { synced };
}

// ── Route handler (keep existing behavior) ──

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
          errors.push(...result.errors.map((e: any) => `Batch ${i}: ${e}`));
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
