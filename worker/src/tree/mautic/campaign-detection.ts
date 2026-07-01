/**
 * Mautic Bridge — Campaign detection and enrollment helpers
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import type { D1Database } from '@cloudflare/workers-types';
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
): Promise<{ detected: number; enrolled: number }> {
  const campaignCfg = env[campaignEnvVar] as string | undefined;
  if (!campaignCfg) return { detected: 0, enrolled: 0 };

  const client = getMauticClient(env as unknown as MauticBridgeEnv);
  if (!client) return { detected: 0, enrolled: 0 };

  const db = env.AURA_DB as D1Database | undefined;
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
