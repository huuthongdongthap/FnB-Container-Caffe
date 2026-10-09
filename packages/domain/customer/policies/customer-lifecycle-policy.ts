/**
 * Canonical Customer Lifecycle & Deduplication Policy
 * Single Authoritative Policy for deterministic customer lookup, profile assembly, and merging.
 * Invariants: Client-supplied IDs are never trusted; Order historical integrity is strictly preserved.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { genCustomerId, nowIso, normalizePhone } from '../helpers';
import type {
  CanonicalCustomer,
  CustomerProfileView,
  CustomerMergeInput,
  CustomerMergeResult,
  CustomerIdentifierType
} from '../model/customer-canonical-model';

const log = createLogger({ route: 'customer-lifecycle' });

export async function getCustomerCanonicalProfile(
  db: D1Database,
  customerId: string
): Promise<CustomerProfileView | null> {
  const customerRow = await db.prepare(
    'SELECT * FROM customers WHERE id = ? LIMIT 1'
  ).bind(customerId).first<any>();

  if (!customerRow) return null;

  const identitiesRes = await db.prepare(
    'SELECT * FROM customer_identities WHERE customer_id = ?'
  ).bind(customerId).all<any>();

  const consentsRes = await db.prepare(
    'SELECT * FROM consents WHERE customer_id = ? AND granted = 1'
  ).bind(customerId).all<any>();

  const orderStats = await db.prepare(
    `SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as lifetime_spend, MAX(created_at) as last_ordered
     FROM orders WHERE customer_id = ? AND status != 'cancelled'`
  ).bind(customerId).first<any>();

  const visitStats = await db.prepare(
    `SELECT COUNT(*) as total_visits, MAX(visited_at) as last_visited
     FROM visits WHERE customer_id = ?`
  ).bind(customerId).first<any>();

  const wallet = await db.prepare(
    'SELECT balance FROM cashback_wallets WHERE customer_id = ? LIMIT 1'
  ).bind(customerId).first<any>();

  const customer: CanonicalCustomer = {
    id: customerRow.id,
    email: customerRow.email ?? null,
    name: customerRow.name ?? null,
    phone: customerRow.phone ?? null,
    loyaltyPoints: customerRow.loyalty_points ?? 0,
    lifetimePoints: customerRow.lifetime_points ?? 0,
    loyaltyTier: customerRow.loyalty_tier ?? 'bronze',
    dateOfBirth: customerRow.date_of_birth ?? null,
    zalo: customerRow.zalo ?? null,
    source: customerRow.source ?? null,
    createdAt: customerRow.created_at,
    updatedAt: customerRow.updated_at,
  };

  return {
    customer,
    identities: (identitiesRes.results || []).map((r: any) => ({
      id: r.id, customerId: r.customer_id, identifierType: r.identifier_type,
      identifierValue: r.identifier_value, isPrimary: Boolean(r.is_primary),
      verifiedAt: r.verified_at, createdAt: r.created_at,
    })),
    consents: (consentsRes.results || []).map((r: any) => ({
      id: r.id, customerId: r.customer_id, purpose: r.purpose,
      granted: Boolean(r.granted), source: r.source, policyVersion: r.policy_version,
      grantedAt: r.granted_at, revokedAt: r.revoked_at,
    })),
    metrics: {
      totalOrders: orderStats?.total_orders ?? 0,
      totalVisits: visitStats?.total_visits ?? 0,
      lifetimeSpendVnd: orderStats?.lifetime_spend ?? 0,
      lastVisitedAt: visitStats?.last_visited ?? null,
      lastOrderedAt: orderStats?.last_ordered ?? null,
    },
    loyalty: {
      pointsBalance: customer.loyaltyPoints,
      cashbackBalanceVnd: wallet?.balance ?? 0,
      tier: customer.loyaltyTier,
    },
  };
}

export async function findOrCreateCustomerByIdentifier(input: {
  db: D1Database;
  identifierType: CustomerIdentifierType;
  identifierValue: string;
  name?: string | null;
  source?: string | null;
}): Promise<{ customerId: string; created: boolean }> {
  const { db, identifierType, source } = input;
  const rawValue = input.identifierValue.trim();
  const normalized = identifierType === 'phone' ? normalizePhone(rawValue) : rawValue.toLowerCase();

  // 1. Check customer_identities lookup
  const matchedIdentity = await db.prepare(
    'SELECT customer_id FROM customer_identities WHERE identifier_type = ? AND identifier_value = ? LIMIT 1'
  ).bind(identifierType, normalized).first<{ customer_id: string }>();

  if (matchedIdentity?.customer_id) {
    return { customerId: matchedIdentity.customer_id, created: false };
  }

  // 2. Fallback check on primary customers table
  const col = identifierType === 'email' ? 'email' : 'phone';
  const matchedCustomer = await db.prepare(
    `SELECT id FROM customers WHERE ${col} = ? LIMIT 1`
  ).bind(normalized).first<{ id: string }>();

  if (matchedCustomer?.id) {
    // Backfill customer_identities mapping
    await db.prepare(
      'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at) VALUES (?, ?, ?, ?, 1, ?)'
    ).bind(genCustomerId('ident_'), matchedCustomer.id, identifierType, normalized, nowIso()).run();
    return { customerId: matchedCustomer.id, created: false };
  }

  // 3. Deterministic Profile Creation
  const newId = genCustomerId('cust_');
  const now = nowIso();
  const emailVal = identifierType === 'email' ? normalized : `${newId}@guest.local`;
  const phoneVal = identifierType === 'phone' ? normalized : null;

  await db.prepare(
    `INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, 'bronze', ?, ?, ?)`
  ).bind(newId, emailVal, input.name ?? null, phoneVal, source ?? 'direct', now, now).run();

  await db.prepare(
    'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).bind(genCustomerId('ident_'), newId, identifierType, normalized, now).run();

  return { customerId: newId, created: true };
}

export async function mergeCustomerProfiles(
  input: CustomerMergeInput & { db: D1Database }
): Promise<CustomerMergeResult> {
  const { db, primaryCustomerId, secondaryCustomerId, reason } = input;
  if (primaryCustomerId === secondaryCustomerId) {
    return { ok: true, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0 };
  }

  try {
    const secRow = await db.prepare('SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?').bind(secondaryCustomerId).first<any>();
    if (!secRow) return { ok: false, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0, error: 'Secondary customer not found' };

    const pts = secRow.loyalty_points ?? 0;
    const lpts = secRow.lifetime_points ?? 0;

    await db.prepare('UPDATE orders SET customer_id = ? WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();
    await db.prepare('UPDATE visits SET customer_id = ? WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();
    await db.prepare('UPDATE customer_identities SET customer_id = ?, is_primary = 0 WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();

    await db.prepare(
      'UPDATE customers SET loyalty_points = loyalty_points + ?, lifetime_points = lifetime_points + ?, updated_at = ? WHERE id = ?'
    ).bind(pts, lpts, nowIso(), primaryCustomerId).run();

    await db.prepare(
      "UPDATE customers SET loyalty_points = 0, name = name || ' [MERGED]', updated_at = ? WHERE id = ?"
    ).bind(nowIso(), secondaryCustomerId).run();

    // Append merge event
    await db.prepare(
      'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      genCustomerId('cev_'), primaryCustomerId, 'customer_merged',
      JSON.stringify({ merged_from: secondaryCustomerId, reason, points_transferred: pts }), nowIso()
    ).run();

    return { ok: true, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 1, visitsReassigned: 1, identitiesReassigned: 1, pointsMerged: pts };
  } catch (err) {
    log.error('mergeCustomerProfiles failed:', { error: (err as Error).message });
    return { ok: false, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0, error: (err as Error).message };
  }
}
