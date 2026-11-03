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
import { createLogger } from 'worker/src/middleware/logger';
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
  tenantId?: string;
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
  source: ConsentSource,
  tenantId?: string
): Promise<void> {
  const effectiveTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  const eventId = genCustomerId('cev_');
  const eventType = granted ? 'ConsentGiven' : 'ConsentRevoked';
  const payload = JSON.stringify({
    purpose,
    source,
    ...(effectiveTenant !== 'default' && effectiveTenant !== '*' ? { tenant_id: effectiveTenant } : {}),
  });
  const now = nowIso();
  if (effectiveTenant !== '*') {
    try {
      await db.prepare(
        'INSERT INTO customer_events (id, customer_id, event_type, payload, tenant_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(eventId, customerId, eventType, payload, effectiveTenant, now).run();
      return;
    } catch {
      // fallback to legacy schema
    }
  }
  await db.prepare(
    'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(eventId, customerId, eventType, payload, now).run();
}

export async function recordConsent(input: RecordConsentInput): Promise<ConsentWriteResult> {
  const { db, customerId, purpose, granted, source } = input;
  const policyVersion = input.policyVersion || POLICY_VERSION;
  const effectiveTenant = input.tenantId && input.tenantId.trim()
    ? input.tenantId.trim()
    : 'default';
  try {
    const now = nowIso();

    // Close any still-active consent for this purpose (grant or revoke).
    let active: { id: string; granted: number } | null = null;
    if (effectiveTenant !== '*') {
      try {
        active = await db.prepare(
          "SELECT id, granted FROM consents WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY granted_at DESC LIMIT 1"
        ).bind(customerId, purpose, effectiveTenant).first<{ id: string; granted: number }>();
      } catch {
        // Fallback below
      }
      if (!active && !input.tenantId) {
        const fallback = await db.prepare(
          'SELECT id, granted FROM consents WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1'
        ).bind(customerId, purpose).first<{ id: string; granted: number; tenant_id?: string | null }>();
        if (
          fallback &&
          (!('tenant_id' in fallback) ||
            fallback.tenant_id == null ||
            String(fallback.tenant_id).trim() === '' ||
            String(fallback.tenant_id).trim() === effectiveTenant)
        ) {
          active = fallback;
        }
      }
    } else {
      active = await db.prepare(
        'SELECT id, granted FROM consents WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1'
      ).bind(customerId, purpose).first<{ id: string; granted: number }>();
    }

    if (active && active.granted === (granted ? 1 : 0)) {
      return { ok: true, consentId: active.id }; // no state change — idempotent
    }

    if (active) {
      if (input.tenantId && effectiveTenant !== '*') {
        try {
          await db.prepare(
            "UPDATE consents SET revoked_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(now, active.id, effectiveTenant).run();
        } catch {
          await db.prepare(
            'UPDATE consents SET revoked_at = ? WHERE id = ?'
          ).bind(now, active.id).run();
        }
      } else {
        await db.prepare(
          'UPDATE consents SET revoked_at = ? WHERE id = ?'
        ).bind(now, active.id).run();
      }
    }

    const consentId = genCustomerId('con_');
    if (effectiveTenant !== '*') {
      try {
        await db.prepare(
          'INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          consentId, customerId, purpose, granted ? 1 : 0, source,
          policyVersion, now, null, effectiveTenant, now
        ).run();
      } catch {
        await db.prepare(
          'INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          consentId, customerId, purpose, granted ? 1 : 0, source,
          policyVersion, now, null, now
        ).run();
      }
    } else {
      await db.prepare(
        'INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        consentId, customerId, purpose, granted ? 1 : 0, source,
        policyVersion, now, null, now
      ).run();
    }

    await appendConsentEvent(db, customerId, purpose, granted, source, effectiveTenant);
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
  purpose: ConsentPurpose,
  tenantId?: string
): Promise<boolean> {
  const effectiveTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  try {
    if (effectiveTenant !== '*') {
      try {
        const row = await db.prepare(
          "SELECT id FROM consents WHERE customer_id = ? AND purpose = ? AND granted = 1 AND revoked_at IS NULL AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(customerId, purpose, effectiveTenant).first<{ id: string }>();
        if (row) return true;
        if (tenantId) return false;
      } catch {
        if (effectiveTenant !== 'default') {
          return false;
        }
      }
    }
    const row = await db.prepare(
      'SELECT id FROM consents WHERE customer_id = ? AND purpose = ? AND granted = 1 AND revoked_at IS NULL LIMIT 1'
    ).bind(customerId, purpose).first<{ id: string; tenant_id?: string | null }>();
    if (!row) return false;
    if (
      effectiveTenant !== '*' &&
      'tenant_id' in row &&
      row.tenant_id !== undefined &&
      ((row.tenant_id && String(row.tenant_id).trim()) || 'default') !== effectiveTenant
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
