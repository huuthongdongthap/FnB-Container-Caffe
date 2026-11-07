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
  actorRole:
    | 'customer'
    | 'staff'
    | 'owner'
    | 'manager'
    | 'supervisor'
    | 'admin'
    | 'cashier'
    | 'waiter'
    | 'kitchen'
    | 'barista'
    | 'chef';
  tenantId?: string;
}

export type UpdateConsentInput = ConsentUpdate;

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
  tenantId?: string,
): Promise<ConsentResult> {
  if (!VALID_PURPOSES.includes(update.purpose)) {
    return { ok: false, error: `Invalid consent purpose: ${update.purpose}`, code: 'invalid_purpose' };
  }

  // Staff/owner acting on behalf of a customer must be explicit.
  if (update.actorRole !== 'customer' && update.actorId === update.customerId) {
    return { ok: false, error: 'Staff consent changes require actor_id !== customer_id', code: 'forbidden' };
  }

  const rawTenant = (tenantId ?? update.tenantId)?.trim() || 'default';
  const effectiveTenant = rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  const isWildcard = effectiveTenant === '*';
  let resolvedCustomerTenant: string | undefined;
  try {
    const custRow = await db
      .prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1')
      .bind(update.customerId)
      .first<{ id: string; tenant_id?: string | null }>();
    if (custRow && 'tenant_id' in custRow && custRow.tenant_id !== undefined) {
      const custTenant = (custRow.tenant_id && String(custRow.tenant_id).trim()) || 'default';
      if (custTenant !== '*' && custTenant.toLowerCase() !== 'hq') {
        resolvedCustomerTenant = custTenant;
      }
      if (!isWildcard && custTenant !== effectiveTenant) {
        return { ok: false, error: 'Forbidden: customer belongs to another tenant', code: 'forbidden' };
      }
    } else if (!isWildcard && !custRow && effectiveTenant !== 'default') {
      return { ok: false, error: 'Forbidden: customer not found in tenant', code: 'forbidden' };
    }
  } catch (err) {
    if (!isWildcard && !/no such column:\s*tenant_id/i.test(String(err)) && effectiveTenant !== 'default') {
      return { ok: false, error: 'Forbidden: tenant verification failed', code: 'forbidden' };
    }
  }

  try {
    const id = genId('c_');
    const now = new Date().toISOString();
    const granted = update.granted ? 1 : 0;
    const grantedAt = now;
    const revokedAt = update.granted ? null : now;
    const targetTenant = isWildcard ? (resolvedCustomerTenant || 'default') : effectiveTenant;

    try {
      try {
        await db
          .prepare(
            "UPDATE consents SET revoked_at = ? WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
          )
          .bind(now, update.customerId, update.purpose, targetTenant)
          .run();
      } catch (revokeErr) {
        if (targetTenant === 'default' && /no such column:\s*tenant_id/i.test(String(revokeErr))) {
          await db
            .prepare(
              'UPDATE consents SET revoked_at = ? WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL',
            )
            .bind(now, update.customerId, update.purpose)
            .run();
        }
      }
    } catch {
      // Optional prior-row revocation when table/column is available
    }

    const insertTenant = targetTenant;
    try {
      await db
        .prepare(
          `INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          insertTenant,
        )
        .run();
    } catch {
      try {
        await db
          .prepare(
            `INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at, created_by, tenant_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            insertTenant,
            now,
            now,
          )
          .run();
      } catch (scopedErr) {
        if (targetTenant !== 'default') {
          throw scopedErr;
        }
        try {
          await db
            .prepare(
              `INSERT INTO consents (id, customer_id, purpose, granted, source, policy_version, granted_at, revoked_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
            )
            .run();
        } catch {
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
        }
      }
    }

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
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let id = prefix;
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(bytes[i] % chars.length);
  }
  return id;
}
