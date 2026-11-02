/**
 * Mautic Bridge — Promo campaign trigger
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { getMauticClient } from './client-factory';
import { toMauticContact } from './contact-mapper';
import { trackEnrollment } from './enrollment-tracker';
import { matchesMauticTenant } from './sync-state';
import type { D1Database } from '@cloudflare/workers-types';
import type { MauticBridgeEnv } from './types';

export async function triggerPromoCampaign(
  env: Record<string, unknown>,
  opts: { segment: { tier: string }; templateName: string; promoTitle: string; promoDesc: string },
  tenantId?: string
): Promise<{ enrolled: number }> {
  const campaignCfg = (env.MAUTIC_CAMPAIGN_PROMO as string) || '30';
  const client = getMauticClient(env as unknown as MauticBridgeEnv);
  if (!client) {
    return { enrolled: 0 };
  }

  const db = env.AURA_DB as D1Database | undefined;
  if (!db) {
    return { enrolled: 0 };
  }

  const scopedTenant = tenantId && tenantId.trim() && tenantId.trim() !== '*' ? tenantId.trim() : null;
  let results: unknown[] | undefined;
  try {
    if (scopedTenant) {
      const res = await db.prepare(
        `SELECT id, name, phone, email, loyalty_tier, tenant_id FROM customers
         WHERE LOWER(loyalty_tier) = LOWER(?) AND phone IS NOT NULL AND phone != ''
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         LIMIT 500`
      ).bind(opts.segment.tier, scopedTenant).all();
      results = res.results;
    } else {
      const res = await db.prepare(
        `SELECT id, name, phone, email, loyalty_tier, tenant_id FROM customers
         WHERE LOWER(loyalty_tier) = LOWER(?) AND phone IS NOT NULL AND phone != ''
         LIMIT 500`
      ).bind(opts.segment.tier).all();
      results = res.results;
    }
  } catch {
    if (!scopedTenant || scopedTenant === 'default') {
      const res = await db.prepare(
        `SELECT id, name, phone, email, loyalty_tier FROM customers
         WHERE LOWER(loyalty_tier) = LOWER(?) AND phone IS NOT NULL AND phone != ''
         LIMIT 500`
      ).bind(opts.segment.tier).all();
      results = res.results;
    } else {
      results = [];
    }
  }

  const customers = ((results || []) as Array<Record<string, unknown>>).filter((r) =>
    matchesMauticTenant(r, tenantId)
  );
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
