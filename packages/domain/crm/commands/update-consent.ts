/**
 * update-consent — write path for customer self-service consent
 * changes (M4 Online). Customer can revoke/grant their own consents;
 * staff/owner can update any customer's consents.
 *
 * Audit: every change writes a new row (append-only, no UPDATE). The
 * latest row per (customer_id, purpose) is the current state.
 *
 * Returns the new consent row so the handler can 200 it back.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'crm.consent' });

export interface ConsentUpdate {
  customerId: string;
  purpose: string;
  granted: boolean;
  source: string; // 'customer_portal' | 'checkout' | 'staff_action'
  policyVersion?: string;
  actorId: string; // customer.id or staff user id
  actorRole: 'customer' | 'staff' | 'owner';
}

export interface ConsentRow {
  id: string;
  customerId: string;
  purpose: string;
  granted: number;
  source: string;
  policyVersion: string | null;
  grantedAt: string;
  revokedAt: string | null;
  createdBy: string;
}

export type ConsentResult =
  | { ok: true; consent: ConsentRow }
  | { ok: false; error: string; code: 'forbidden' | 'invalid_purpose' | 'server_error' };

const VALID_PURPOSES = ['marketing', 'order', 'analytics', 'referral', 'loyalty'];

export async function updateConsent(
  db: D1Database,
  update: ConsentUpdate,
): Promise<ConsentResult> {
  if (!VALID_PURPOSES.includes(update.purpose)) {
    return { ok: false, error: `Invalid consent purpose: ${update.purpose}`, code: 'invalid_purpose' };
  }

  // Staff/owner acting on behalf of a customer must be explicit.
  if (update.actorRole !== 'customer' && update.actorId === update.customerId) {
    return { ok: false, error: 'Staff consent changes require actor_id !== customer_id', code: 'forbidden' };
  }

  try {
    const id = genId('c_');
    const now = new Date().toISOString();
    const granted = update.granted ? 1 : 0;
    const grantedAt = update.granted ? now : null;
    const revokedAt = update.granted ? null : now;

    await db
      .prepare(
        `INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        update.customerId,
        update.purpose,
        granted,
        update.source,
        update.policyVersion ?? null,
        grantedAt,
        revokedAt,
        update.actorId,
        now,
        now,
      )
      .run();

    log.info('consent_updated', {
      customerId: update.customerId,
      purpose: update.purpose,
      granted: update.granted,
      actorRole: update.actorRole,
    });

    return {
      ok: true,
      consent: {
        id,
        customerId: update.customerId,
        purpose: update.purpose,
        granted,
        source: update.source,
        policyVersion: update.policyVersion ?? null,
        grantedAt: grantedAt ?? revokedAt ?? now,
        revokedAt,
        createdBy: update.actorId,
      },
    };
  } catch (err) {
    log.error('consent_update_failed', { customerId: update.customerId, error: String(err) });
    return { ok: false, error: 'Server error recording consent', code: 'server_error' };
  }
}

export const CONSENT_PURPOSES = VALID_PURPOSES;

function genId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix;
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
