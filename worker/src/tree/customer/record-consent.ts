/**
 * recordConsent — granular opt-in write + ConsentGiven event.
 *
 * A consent is only valid when explicitly granted by the customer at
 * checkout/signup/setting (or by staff with verbal confirmation). CRM
 * writes (tier promotion, outreach, export) MUST check an active
 * consent row before mutating state.
 *
 * Re-granting after a revoke re-activates: the old row keeps its
 * revoked_at, a new row records the fresh grant. Append-only intent —
 * never UPDATE a granted row to revoked; insert a new row with
 * granted = 0 (ConsentRevoked) and revoke the old one.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from '../../middleware/logger';
import { genCustomerId, nowIso } from './helpers';

const log = createLogger({ route: 'customer' });

export type ConsentPurpose = 'crm' | 'marketing' | 'analytics' | 'erpnext_sync';
export type ConsentSource = 'checkout' | 'signup' | 'setting' | 'staff';

export const POLICY_VERSION = 'v1';

export interface RecordConsentInput {
  db: D1Database;
  customerId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  source: ConsentSource;
  policyVersion?: string;
}

export interface ConsentWriteResult {
  ok: boolean;
  consentId?: string;
}

/** Append a ConsentGiven / ConsentRevoked event row. */
async function appendConsentEvent(
  db: D1Database,
  customerId: string,
  purpose: ConsentPurpose,
  granted: boolean,
  source: ConsentSource
): Promise<void> {
  await db.prepare(
    'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    genCustomerId('cev_'), customerId,
    granted ? 'ConsentGiven' : 'ConsentRevoked',
    JSON.stringify({ purpose, source }),
    nowIso()
  ).run();
}

export async function recordConsent(input: RecordConsentInput): Promise<ConsentWriteResult> {
  const { db, customerId, purpose, granted, source } = input;
  const policyVersion = input.policyVersion || POLICY_VERSION;
  try {
    const now = nowIso();

    // Close any still-active consent for this purpose (grant or revoke).
    const active = await db.prepare(
      'SELECT id, granted FROM consents WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1'
    ).bind(customerId, purpose).first<{ id: string; granted: number }>();

    if (active && active.granted === (granted ? 1 : 0)) {
      return { ok: true, consentId: active.id }; // no state change — idempotent
    }

    if (active) {
      await db.prepare(
        'UPDATE consents SET revoked_at = ? WHERE id = ?'
      ).bind(now, active.id).run();
    }

    const consentId = genCustomerId('con_');
    await db.prepare(
      'INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      consentId, customerId, purpose, granted ? 1 : 0, source,
      policyVersion, now, null, now
    ).run();

    await appendConsentEvent(db, customerId, purpose, granted, source);
    return { ok: true, consentId };
  } catch (err) {
    // Consent capture must never break the caller's flow.
    log.warn('recordConsent failed (non-blocking):', {
      message: (err as Error).message, customerId, purpose
    });
    return { ok: false };
  }
}

/** True when the customer currently holds an active granted consent. */
export async function hasActiveConsent(
  db: D1Database,
  customerId: string,
  purpose: ConsentPurpose
): Promise<boolean> {
  try {
    const row = await db.prepare(
      'SELECT id FROM consents WHERE customer_id = ? AND purpose = ? AND granted = 1 AND revoked_at IS NULL LIMIT 1'
    ).bind(customerId, purpose).first<{ id: string }>();
    return !!row;
  } catch {
    return false;
  }
}
