/**
 * Mautic Bridge — Promo campaign trigger
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { getMauticClient } from './client-factory';
import { toMauticContact } from './contact-mapper';
import * as enrollmentTracker from './enrollment-tracker';
import { matchesMauticTenant } from './sync-state';
import type { D1Database } from '@cloudflare/workers-types';
import type { MauticBridgeEnv } from './types';

export async function triggerPromoCampaign(
  env: Record<string, unknown>,
  opts: { segment: { tier: string }; templateName: string; promoTitle: string; promoDesc: string; tenantId?: string },
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

  const rawTenant = (tenantId ?? opts.tenantId ?? '').trim();
  const isWildcard = rawTenant === '*';
  const effectiveTenant = isWildcard ? '*' : (rawTenant || 'default');
  const explicitScopedTenant = rawTenant && rawTenant !== '*' ? rawTenant : null;
  let results: unknown[] | undefined;
  let scopedOk = false;
  try {
    if (explicitScopedTenant) {
      const res = await db.prepare(
        `SELECT id, name, phone, email, loyalty_tier, tenant_id FROM customers
         WHERE LOWER(loyalty_tier) = LOWER(?) AND phone IS NOT NULL AND phone != ''
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         LIMIT 500`
      ).bind(opts.segment.tier, explicitScopedTenant).all();
      results = res.results;
      scopedOk = true;
    } else if (!isWildcard) {
      const res = await db.prepare(
        `SELECT id, name, phone, email, loyalty_tier, tenant_id FROM customers
         WHERE LOWER(loyalty_tier) = LOWER(?) AND phone IS NOT NULL AND phone != ''
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'
         LIMIT 500`
      ).bind(opts.segment.tier).all();
      results = res.results;
      scopedOk = true;
    } else {
      const res = await db.prepare(
        `SELECT id, name, phone, email, loyalty_tier, tenant_id FROM customers
         WHERE LOWER(loyalty_tier) = LOWER(?) AND phone IS NOT NULL AND phone != ''
         LIMIT 500`
      ).bind(opts.segment.tier).all();
      results = res.results;
      scopedOk = true;
    }
  } catch {
    scopedOk = false;
  }

  if (!scopedOk) {
    if (isWildcard || effectiveTenant === 'default') {
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
    matchesMauticTenant(r, effectiveTenant)
  );
  let enrolled = 0;

  for (const customer of customers) {
    try {
      const rawCustomerTenant = typeof customer.tenant_id === 'string' && customer.tenant_id.trim() && customer.tenant_id.trim() !== '*'
        ? customer.tenant_id.trim()
        : 'default';
      const rowTenant = isWildcard ? rawCustomerTenant : effectiveTenant;
      let alreadyEnrolled = false;
      try {
        if (typeof enrollmentTracker.isAlreadyEnrolled === 'function') {
          alreadyEnrolled = await enrollmentTracker.isAlreadyEnrolled(
            db,
            customer.id as string,
            'promo',
            30,
            rowTenant
          );
        }
      } catch {
        alreadyEnrolled = false;
      }
      if (alreadyEnrolled) {
        continue;
      }
      const contact = toMauticContact(customer);
      const contactId = await client.createOrUpdateContact(contact);
      await client.addContactToCampaign(contactId, parseInt(campaignCfg, 10));
      if (explicitScopedTenant || isWildcard) {
        await enrollmentTracker.trackEnrollment(db, customer.id as string, 'promo', campaignCfg, contactId, 'enrolled', rowTenant);
      } else {
        await enrollmentTracker.trackEnrollment(db, customer.id as string, 'promo', campaignCfg, contactId, 'enrolled');
      }
      enrolled++;
    } catch {
      // skip on error
    }
  }

  return { enrolled };
}
