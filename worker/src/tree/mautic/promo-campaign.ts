/**
 * Mautic Bridge — Promo campaign trigger
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { getMauticClient } from './client-factory';
import { toMauticContact } from './contact-mapper';
import { trackEnrollment } from './enrollment-tracker';
import type { D1Database } from '@cloudflare/workers-types';
import type { MauticBridgeEnv } from './types';

export async function triggerPromoCampaign(
  env: Record<string, unknown>,
  opts: { segment: { tier: string }; templateName: string; promoTitle: string; promoDesc: string },
): Promise<{ enrolled: number }> {
  const campaignCfg = (env.MAUTIC_CAMPAIGN_PROMO as string) || '30';
  const client = getMauticClient(env as unknown as MauticBridgeEnv);
  if (!client) return { enrolled: 0 };

  const db = env.AURA_DB as D1Database | undefined;
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
