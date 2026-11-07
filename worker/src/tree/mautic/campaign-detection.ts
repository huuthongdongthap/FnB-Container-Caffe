/**
 * Mautic Bridge — Campaign detection and enrollment helpers
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { resolvePilotStore, matchesTenantRow } from '../../middleware/tenant';
import { getMauticClient } from './client-factory';
import { toMauticContact } from './contact-mapper';
import { trackEnrollment } from './enrollment-tracker';
import type { MauticBridgeEnv } from './types';

async function detectAndEnroll(
  env: Record<string, unknown>,
  campaignEnvVar: string,
  campaignId: string,
  campaignType: string,
  query: string,
  queryParams: unknown[],
  tenantId?: string,
  fallbackUnscopedQuery?: string,
  fallbackUnscopedParams?: unknown[]
): Promise<{ detected: number; enrolled: number }> {
  const campaignCfg = env[campaignEnvVar] as string | undefined;
  if (!campaignCfg) {
    return { detected: 0, enrolled: 0 };
  }

  const client = getMauticClient(env as unknown as MauticBridgeEnv);
  if (!client) {
    return { detected: 0, enrolled: 0 };
  }

  const db = env.AURA_DB as D1Database | undefined;
  if (!db) {
    return { detected: 0, enrolled: 0 };
  }

  let customers: Array<Record<string, unknown>> = [];
  const allowUnscopedFallback = !tenantId || tenantId === 'default' || tenantId === '*';
  try {
    const { results } = await db.prepare(query).bind(...queryParams).all();
    customers = (results || []) as Array<Record<string, unknown>>;
  } catch (err) {
    const msg = String((err as Error)?.message || '');
    const baseQuery = (allowUnscopedFallback && fallbackUnscopedQuery) ? fallbackUnscopedQuery : query;
    const baseParams = (allowUnscopedFallback && fallbackUnscopedParams) ? fallbackUnscopedParams : queryParams;
    if (msg.includes('no such column') && baseQuery.includes('c.loyalty_tier')) {
      try {
        const fallbackQuery = baseQuery
          .replace('c.loyalty_tier', 'c.tier as loyalty_tier')
          .replace(/c\.date_of_birth/g, 'c.birthday');
        const { results } = await db.prepare(fallbackQuery).bind(...baseParams).all();
        customers = (results || []) as Array<Record<string, unknown>>;
      } catch {
        try {
          const canonicalQuery = baseQuery
            .replace('c.loyalty_tier', 'c.tier as loyalty_tier')
            .replace('AND created_at > ?', 'AND enrolled_at > ?');
          const { results } = await db.prepare(canonicalQuery).bind(...baseParams).all();
          customers = (results || []) as Array<Record<string, unknown>>;
        } catch {
          return { detected: 0, enrolled: 0 };
        }
      }
    } else if (allowUnscopedFallback && fallbackUnscopedQuery && fallbackUnscopedParams) {
      try {
        const { results } = await db.prepare(fallbackUnscopedQuery).bind(...fallbackUnscopedParams).all();
        customers = (results || []) as Array<Record<string, unknown>>;
      } catch {
        return { detected: 0, enrolled: 0 };
      }
    } else {
      return { detected: 0, enrolled: 0 };
    }
  }
  if (tenantId && tenantId !== '*') {
    customers = customers.filter((row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId));
  }
  const detected = customers.length;
  let enrolled = 0;

  for (const customer of customers) {
    try {
      const contact = toMauticContact(customer);
      const contactId = await client.createOrUpdateContact(contact);
      await client.addContactToCampaign(contactId, parseInt(campaignCfg, 10));
      const hasExplicitTenant =
        Boolean(tenantId && tenantId !== '*' && tenantId !== 'default') ||
        Boolean(env.PILOT_TENANT_ID || env.PILOT_STORE_ID);
      const writeTenant = hasExplicitTenant && tenantId && tenantId !== '*' ? tenantId : undefined;
      await trackEnrollment(db, customer.id as string, campaignType, campaignCfg, contactId, 'enrolled', writeTenant);
      enrolled++;
    } catch {
      // skip on error
    }
  }

  return { detected, enrolled };
}

export async function detectWinbackCandidates(
  env: Record<string, unknown>,
  tenantOverride?: string
): Promise<{ detected: number; enrolled: number }> {
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString();
  const tenantId = tenantOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  const unscopedQuery = `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired')) as last_order_date
     FROM customers c
     WHERE c.phone IS NOT NULL AND c.phone != ''
       AND c.id NOT IN (
         SELECT customer_id FROM campaign_enrollments WHERE campaign_type = 'winback'
           AND created_at > ?
       )
       AND (
         SELECT MAX(o2.created_at) FROM orders o2 WHERE o2.customer_id = c.id AND COALESCE(o2.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired')
       ) IS NOT NULL
       AND (
         SELECT MAX(o3.created_at) FROM orders o3 WHERE o3.customer_id = c.id AND COALESCE(o3.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired')
       ) < ?
     LIMIT 100`;
  const unscopedParams = [thirtyOneDaysAgo, thirtyOneDaysAgo];

  if (tenantId && tenantId !== '*') {
    const scopedQuery = `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.tenant_id,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(o.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired') AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) as last_order_date
       FROM customers c
       WHERE c.phone IS NOT NULL AND c.phone != ''
         AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
         AND c.id NOT IN (
           SELECT customer_id FROM campaign_enrollments WHERE campaign_type = 'winback'
             AND created_at > ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         )
         AND (
           SELECT MAX(o2.created_at) FROM orders o2 WHERE o2.customer_id = c.id AND COALESCE(o2.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired') AND COALESCE(NULLIF(TRIM(o2.tenant_id), ''), 'default') = ?
         ) IS NOT NULL
         AND (
           SELECT MAX(o3.created_at) FROM orders o3 WHERE o3.customer_id = c.id AND COALESCE(o3.status, '') NOT IN ('cancelled', 'rejected', 'failed', 'expired') AND COALESCE(NULLIF(TRIM(o3.tenant_id), ''), 'default') = ?
         ) < ?
       LIMIT 100`;
    return detectAndEnroll(
      env,
      'MAUTIC_CAMPAIGN_WINBACK',
      (env.MAUTIC_CAMPAIGN_WINBACK as string) || '10',
      'winback',
      scopedQuery,
      [tenantId, tenantId, thirtyOneDaysAgo, tenantId, tenantId, tenantId, thirtyOneDaysAgo],
      tenantId,
      unscopedQuery,
      unscopedParams
    );
  }

  return detectAndEnroll(
    env,
    'MAUTIC_CAMPAIGN_WINBACK',
    (env.MAUTIC_CAMPAIGN_WINBACK as string) || '10',
    'winback',
    unscopedQuery,
    unscopedParams
  );
}

export async function detectBirthdayCandidates(
  env: Record<string, unknown>,
  tenantOverride?: string
): Promise<{ detected: number; enrolled: number }> {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const tenantId = tenantOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  const unscopedQuery = `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth as birthday
     FROM customers c
     WHERE c.date_of_birth IS NOT NULL
       AND substr(c.date_of_birth, 6, 2) = ?
       AND c.phone IS NOT NULL AND c.phone != ''
       AND c.id NOT IN (
         SELECT customer_id FROM campaign_enrollments WHERE campaign_type = 'birthday'
           AND created_at > ?
       )
     LIMIT 100`;
  const unscopedParams = [currentMonth, monthStart];

  if (tenantId && tenantId !== '*') {
    const scopedQuery = `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth as birthday, c.tenant_id
       FROM customers c
       WHERE c.date_of_birth IS NOT NULL
         AND substr(c.date_of_birth, 6, 2) = ?
         AND c.phone IS NOT NULL AND c.phone != ''
         AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
         AND c.id NOT IN (
           SELECT customer_id FROM campaign_enrollments WHERE campaign_type = 'birthday'
             AND created_at > ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         )
       LIMIT 100`;
    return detectAndEnroll(
      env,
      'MAUTIC_CAMPAIGN_BIRTHDAY',
      (env.MAUTIC_CAMPAIGN_BIRTHDAY as string) || '20',
      'birthday',
      scopedQuery,
      [currentMonth, tenantId, monthStart, tenantId],
      tenantId,
      unscopedQuery,
      unscopedParams
    );
  }

  return detectAndEnroll(
    env,
    'MAUTIC_CAMPAIGN_BIRTHDAY',
    (env.MAUTIC_CAMPAIGN_BIRTHDAY as string) || '20',
    'birthday',
    unscopedQuery,
    unscopedParams
  );
}
