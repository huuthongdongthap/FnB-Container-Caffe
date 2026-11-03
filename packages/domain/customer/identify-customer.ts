/**
 * identifyCustomer — capture a verified identifier for a customer and
 * emit the CustomerIdentified event (capture ladder: anonymous →
 * identifier → profile → member).
 *
 * Idempotent: a customer may hold multiple identifiers, but the same
 * (type, value) pair is only written once. The identifier that created
 * the row stays is_primary.
 *
 * Never throws to the caller's critical path — callers wrap in
 * try/catch, but this module also swallows its own DB errors after
 * logging so a capture failure cannot break checkout.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { classifyIdentifier, genCustomerId, nowIso } from './helpers';
import type { IdentifierType } from './helpers';

const log = createLogger({ route: 'customer' });

export interface IdentifyCustomerInput {
  db: D1Database;
  customerId: string;
  phone?: string | null;
  email?: string | null;
  zalo?: string | null;
  verifiedAt?: string;          // ISO — defaults to now
  source: 'checkout' | 'signup' | 'setting' | 'staff';
  tenantId?: string;
}

export interface IdentifiedIdentity {
  id: string;
  identifier_type: IdentifierType;
  identifier_value: string;
  is_primary: number;
  created: boolean;              // false = already captured
}

/** Append a CustomerIdentified event row. */
export async function appendCustomerIdentifiedEvent(
  db: D1Database,
  customerId: string,
  identity: IdentifiedIdentity,
  source: string,
  tenantId?: string
): Promise<void> {
  const effectiveTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  const eventId = genCustomerId('cev_');
  const now = nowIso();
  const payload = JSON.stringify({
    identifier_type: identity.identifier_type,
    identifier_value: identity.identifier_value,
    source,
    ...(effectiveTenant !== 'default' && effectiveTenant !== '*' ? { tenant_id: effectiveTenant } : {}),
  });
  if (effectiveTenant !== '*') {
    try {
      await db.prepare(
        'INSERT INTO customer_events (id, customer_id, event_type, payload, tenant_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(eventId, customerId, 'CustomerIdentified', payload, effectiveTenant, now).run();
      return;
    } catch {
      // fallback to legacy schema without tenant_id
    }
  }
  await db.prepare(
    'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(eventId, customerId, 'CustomerIdentified', payload, now).run();
}

/**
 * Capture one identifier. Returns the identity row (created flag set)
 * or null when no plausible identifier was supplied.
 */
export async function identifyCustomer(
  input: IdentifyCustomerInput
): Promise<IdentifiedIdentity | null> {
  const classified = classifyIdentifier(input.phone, input.email, input.zalo);
  if (!classified) return null;

  const { db, customerId } = input;
  const effectiveTenant = input.tenantId && input.tenantId.trim()
    ? input.tenantId.trim()
    : 'default';
  try {
    let existing: { id: string; is_primary: number } | null = null;
    if (effectiveTenant !== '*') {
      try {
        existing = await db.prepare(
          "SELECT id, is_primary FROM customer_identities WHERE customer_id = ? AND identifier_type = ? AND identifier_value = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(customerId, classified.type, classified.value, effectiveTenant)
          .first<{ id: string; is_primary: number }>();
      } catch {
        // Fallback below
      }
      if (!existing && !input.tenantId) {
        const fallback = await db.prepare(
          'SELECT id, is_primary FROM customer_identities WHERE customer_id = ? AND identifier_type = ? AND identifier_value = ? LIMIT 1'
        ).bind(customerId, classified.type, classified.value)
          .first<{ id: string; is_primary: number; tenant_id?: string | null }>();
        if (
          fallback &&
          (!('tenant_id' in fallback) ||
            fallback.tenant_id == null ||
            String(fallback.tenant_id).trim() === '' ||
            String(fallback.tenant_id).trim() === effectiveTenant)
        ) {
          existing = fallback;
        }
      }
    } else {
      existing = await db.prepare(
        'SELECT id, is_primary FROM customer_identities WHERE customer_id = ? AND identifier_type = ? AND identifier_value = ? LIMIT 1'
      ).bind(customerId, classified.type, classified.value)
        .first<{ id: string; is_primary: number }>();
    }

    if (existing) {
      // Refresh verification timestamp only — never demote a primary.
      if (input.verifiedAt) {
        if (effectiveTenant !== '*') {
          try {
            await db.prepare(
              "UPDATE customer_identities SET verified_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(input.verifiedAt, existing.id, effectiveTenant).run();
          } catch {
            await db.prepare(
              'UPDATE customer_identities SET verified_at = ? WHERE id = ?'
            ).bind(input.verifiedAt, existing.id).run();
          }
        } else {
          await db.prepare(
            'UPDATE customer_identities SET verified_at = ? WHERE id = ?'
          ).bind(input.verifiedAt, existing.id).run();
        }
      }
      return {
        id: existing.id,
        identifier_type: classified.type,
        identifier_value: classified.value,
        is_primary: existing.is_primary,
        created: false
      };
    }

    // First identifier for this customer becomes primary.
    let anyRow: { id: string } | null = null;
    if (effectiveTenant !== '*') {
      try {
        anyRow = await db.prepare(
          "SELECT id FROM customer_identities WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(customerId, effectiveTenant).first<{ id: string }>();
      } catch {
        // Fallback below
      }
      if (!anyRow && !input.tenantId) {
        const fallback = await db.prepare(
          'SELECT id FROM customer_identities WHERE customer_id = ? LIMIT 1'
        ).bind(customerId).first<{ id: string; tenant_id?: string | null }>();
        if (
          fallback &&
          (!('tenant_id' in fallback) ||
            fallback.tenant_id == null ||
            String(fallback.tenant_id).trim() === '' ||
            String(fallback.tenant_id).trim() === effectiveTenant)
        ) {
          anyRow = fallback;
        }
      }
    } else {
      anyRow = await db.prepare(
        'SELECT id FROM customer_identities WHERE customer_id = ? LIMIT 1'
      ).bind(customerId).first<{ id: string }>();
    }
    const isPrimary = anyRow ? 0 : 1;

    const id = genCustomerId('cid_');
    const createdNow = nowIso();
    if (effectiveTenant !== '*') {
      try {
        await db.prepare(
          'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          id, customerId, classified.type, classified.value, isPrimary,
          input.verifiedAt ?? null, effectiveTenant, createdNow
        ).run();
      } catch {
        await db.prepare(
          'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          id, customerId, classified.type, classified.value, isPrimary,
          input.verifiedAt ?? null, createdNow
        ).run();
      }
    } else {
      await db.prepare(
        'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id, customerId, classified.type, classified.value, isPrimary,
        input.verifiedAt ?? null, createdNow
      ).run();
    }

    const identity: IdentifiedIdentity = {
      id,
      identifier_type: classified.type,
      identifier_value: classified.value,
      is_primary: isPrimary,
      created: true
    };
    await appendCustomerIdentifiedEvent(db, customerId, identity, input.source, effectiveTenant);
    return identity;
  } catch (err) {
    // Capture must never break the caller's flow (live-checkout law).
    log.warn('identifyCustomer failed (non-blocking):', {
      message: (err as Error).message, customerId
    });
    return null;
  }
}
