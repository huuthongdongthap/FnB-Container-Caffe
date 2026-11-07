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

function normalizeTenantId(raw?: string | null): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return 'default';
  if (trimmed.toLowerCase() === 'hq' || trimmed === '*') return '*';
  return trimmed;
}

export async function getCustomerCanonicalProfile(
  db: D1Database,
  customerId: string,
  tenantId: string = 'default'
): Promise<CustomerProfileView | null> {
  const effectiveTenant = normalizeTenantId(tenantId);
  let customerRow: any = null;
  if (effectiveTenant === '*') {
    customerRow = await db.prepare(
      'SELECT * FROM customers WHERE id = ? LIMIT 1'
    ).bind(customerId).first<any>();
  } else {
    try {
      customerRow = await db.prepare(
        "SELECT * FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(customerId, effectiveTenant).first<any>();
    } catch {
      if (effectiveTenant === 'default') {
        customerRow = await db.prepare(
          'SELECT * FROM customers WHERE id = ? LIMIT 1'
        ).bind(customerId).first<any>();
      }
    }
  }

  if (!customerRow) return null;

  const rowTenant =
    typeof customerRow.tenant_id === 'string' && customerRow.tenant_id.trim()
      ? customerRow.tenant_id.trim()
      : 'default';
  if (effectiveTenant !== '*' && rowTenant !== effectiveTenant) {
    return null;
  }
  const targetTenant = effectiveTenant === '*' ? rowTenant : effectiveTenant;

  let identitiesRes: { results?: any[] } = { results: [] };
  try {
    identitiesRes = await db.prepare(
      "SELECT * FROM customer_identities WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(customerId, targetTenant).all<any>();
  } catch {
    if (targetTenant === 'default') {
      identitiesRes = await db.prepare(
        'SELECT * FROM customer_identities WHERE customer_id = ?'
      ).bind(customerId).all<any>();
    }
  }

  let consentsRes: { results?: any[] } = { results: [] };
  try {
    consentsRes = await db.prepare(
      "SELECT * FROM consents WHERE customer_id = ? AND granted = 1 AND revoked_at IS NULL AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(customerId, targetTenant).all<any>();
  } catch {
    if (targetTenant === 'default') {
      consentsRes = await db.prepare(
        'SELECT * FROM consents WHERE customer_id = ? AND granted = 1 AND revoked_at IS NULL'
      ).bind(customerId).all<any>();
    }
  }

  let orderStats: any = null;
  try {
    orderStats = await db.prepare(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as lifetime_spend, MAX(created_at) as last_ordered
       FROM orders WHERE customer_id = ? AND status != 'cancelled' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(customerId, targetTenant).first<any>();
  } catch {
    if (targetTenant === 'default') {
      orderStats = await db.prepare(
        `SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as lifetime_spend, MAX(created_at) as last_ordered
         FROM orders WHERE customer_id = ? AND status != 'cancelled'`
      ).bind(customerId).first<any>();
    }
  }

  let visitStats: any = null;
  try {
    visitStats = await db.prepare(
      `SELECT COUNT(*) as total_visits, MAX(visited_at) as last_visited
       FROM visits WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(customerId, targetTenant).first<any>();
  } catch {
    if (targetTenant === 'default') {
      visitStats = await db.prepare(
        `SELECT COUNT(*) as total_visits, MAX(visited_at) as last_visited
         FROM visits WHERE customer_id = ?`
      ).bind(customerId).first<any>();
    }
  }

  let wallet: any = null;
  try {
    wallet = await db.prepare(
      "SELECT balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(customerId, targetTenant).first<any>();
  } catch {
    if (targetTenant === 'default') {
      wallet = await db.prepare(
        'SELECT balance FROM cashback_wallets WHERE customer_id = ? LIMIT 1'
      ).bind(customerId).first<any>();
    }
  }

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
  tenantId?: string | null;
}): Promise<{ customerId: string; created: boolean }> {
  const { db, identifierType, source, tenantId } = input;
  const rawValue = input.identifierValue.trim();
  const normalized = identifierType === 'phone' ? normalizePhone(rawValue) : rawValue.toLowerCase();
  const normalizedInputTenant = normalizeTenantId(tenantId);
  const effectiveTenant = normalizedInputTenant === '*' ? 'default' : normalizedInputTenant;

  // 1. Check customer_identities lookup
  let matchedIdentity: { customer_id: string } | null = null;
  try {
    matchedIdentity = await db.prepare(
      "SELECT ci.customer_id FROM customer_identities ci JOIN customers c ON c.id = ci.customer_id WHERE ci.identifier_type = ? AND ci.identifier_value = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(identifierType, normalized, effectiveTenant).first<{ customer_id: string }>();
  } catch {
    if (effectiveTenant === 'default') {
      matchedIdentity = await db.prepare(
        'SELECT customer_id FROM customer_identities WHERE identifier_type = ? AND identifier_value = ? LIMIT 1'
      ).bind(identifierType, normalized).first<{ customer_id: string }>();
    }
  }

  if (matchedIdentity?.customer_id) {
    return { customerId: matchedIdentity.customer_id, created: false };
  }

  // 2. Fallback check on primary customers table
  const col = identifierType === 'email' ? 'email' : 'phone';
  let matchedCustomer: { id: string } | null = null;
  try {
    matchedCustomer = await db.prepare(
      `SELECT id FROM customers WHERE ${col} = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1`
    ).bind(normalized, effectiveTenant).first<{ id: string }>();
  } catch {
    if (effectiveTenant === 'default') {
      matchedCustomer = await db.prepare(
        `SELECT id FROM customers WHERE ${col} = ? LIMIT 1`
      ).bind(normalized).first<{ id: string }>();
    }
  }

  if (matchedCustomer?.id) {
    // Backfill customer_identities mapping without stamping verified_at without proof
    try {
      await db.prepare(
        'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at, tenant_id) VALUES (?, ?, ?, ?, 1, ?, ?)'
      ).bind(genCustomerId('ident_'), matchedCustomer.id, identifierType, normalized, null, effectiveTenant).run();
    } catch {
      if (effectiveTenant === 'default') {
        await db.prepare(
          'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at) VALUES (?, ?, ?, ?, 1, ?)'
        ).bind(genCustomerId('ident_'), matchedCustomer.id, identifierType, normalized, null).run().catch(() => {});
      }
    }
    return { customerId: matchedCustomer.id, created: false };
  }

  // 3. Deterministic Profile Creation
  const newId = genCustomerId('cust_');
  const now = nowIso();
  const emailVal = identifierType === 'email' ? normalized : `${newId}@guest.local`;
  const phoneVal = identifierType === 'phone' ? normalized : null;

  try {
    await db.prepare(
      `INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, source, created_at, updated_at, tenant_id)
       VALUES (?, ?, ?, ?, 0, 0, 'bronze', ?, ?, ?, ?)`
    ).bind(newId, emailVal, input.name ?? null, phoneVal, source ?? 'direct', now, now, effectiveTenant).run();
  } catch (err) {
    if (effectiveTenant === 'default') {
      await db.prepare(
        `INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, 'bronze', ?, ?, ?)`
      ).bind(newId, emailVal, input.name ?? null, phoneVal, source ?? 'direct', now, now).run();
    } else {
      throw err;
    }
  }

  try {
    await db.prepare(
      'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at, tenant_id) VALUES (?, ?, ?, ?, 1, ?, ?)'
    ).bind(genCustomerId('ident_'), newId, identifierType, normalized, null, effectiveTenant).run();
  } catch {
    if (effectiveTenant === 'default') {
      await db.prepare(
        'INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, is_primary, verified_at) VALUES (?, ?, ?, ?, 1, ?)'
      ).bind(genCustomerId('ident_'), newId, identifierType, normalized, null).run().catch(() => {});
    }
  }

  return { customerId: newId, created: true };
}

export async function mergeCustomerProfiles(
  input: CustomerMergeInput & { db: D1Database }
): Promise<CustomerMergeResult> {
  const { db, primaryCustomerId, secondaryCustomerId, reason, tenantId } = input;
  if (primaryCustomerId === secondaryCustomerId) {
    return { ok: true, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0 };
  }

  const callerTenant = normalizeTenantId(tenantId);

  try {
    const priRow = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(primaryCustomerId).first<{ id: string; tenant_id?: string | null }>().catch(() =>
      callerTenant === 'default'
        ? db.prepare('SELECT id FROM customers WHERE id = ?').bind(primaryCustomerId).first<{ id: string; tenant_id?: string | null }>()
        : null
    );
    if (!priRow) return { ok: false, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0, error: 'Primary customer not found' };

    const secRow = await db.prepare('SELECT loyalty_points, lifetime_points, tenant_id FROM customers WHERE id = ?').bind(secondaryCustomerId).first<any>().catch(() =>
      callerTenant === 'default'
        ? db.prepare('SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?').bind(secondaryCustomerId).first<any>()
        : null
    );
    if (!secRow) return { ok: false, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0, error: 'Secondary customer not found' };

    const rawPTenant = typeof priRow.tenant_id === 'string' ? priRow.tenant_id.trim() : '';
    const rawDTenant = typeof secRow.tenant_id === 'string' ? secRow.tenant_id.trim() : '';
    const pTenant = rawPTenant || 'default';
    const dTenant = rawDTenant || 'default';
    if (pTenant !== dTenant) {
      return { ok: false, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0, error: 'Cross-tenant customer merge forbidden' };
    }
    if (callerTenant !== '*' && (pTenant !== callerTenant || dTenant !== callerTenant)) {
      return { ok: false, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0, error: 'Cross-tenant customer merge forbidden' };
    }
    const effectiveTenant = callerTenant === '*' ? pTenant : callerTenant;

    const pts = secRow.loyalty_points ?? 0;
    const lpts = secRow.lifetime_points ?? 0;

    try {
      await db.prepare(
        "UPDATE orders SET customer_id = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(primaryCustomerId, secondaryCustomerId, effectiveTenant).run();
    } catch (err) {
      if (effectiveTenant === 'default') {
        await db.prepare('UPDATE orders SET customer_id = ? WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();
      } else {
        throw err;
      }
    }

    try {
      await db.prepare(
        "UPDATE visits SET customer_id = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(primaryCustomerId, secondaryCustomerId, effectiveTenant).run();
    } catch (err) {
      if (effectiveTenant === 'default') {
        await db.prepare('UPDATE visits SET customer_id = ? WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();
      } else {
        throw err;
      }
    }

    try {
      await db.prepare(
        "UPDATE customer_identities SET customer_id = ?, is_primary = 0 WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(primaryCustomerId, secondaryCustomerId, effectiveTenant).run();
    } catch (err) {
      if (effectiveTenant === 'default') {
        await db.prepare('UPDATE customer_identities SET customer_id = ?, is_primary = 0 WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();
      } else {
        throw err;
      }
    }

    try {
      await db.prepare(
        "UPDATE consents SET customer_id = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(primaryCustomerId, secondaryCustomerId, effectiveTenant).run();
    } catch {
      if (effectiveTenant === 'default') {
        await db.prepare('UPDATE consents SET customer_id = ? WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run().catch(() => {});
      }
    }

    try {
      try {
        await db.prepare(
          "UPDATE loyalty_point_logs SET customer_id = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(primaryCustomerId, secondaryCustomerId, effectiveTenant).run();
      } catch {
        if (effectiveTenant === 'default') {
          await db.prepare('UPDATE loyalty_point_logs SET customer_id = ? WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();
        }
      }
      try {
        await db.prepare(
          "UPDATE cashback_transactions SET customer_id = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(primaryCustomerId, secondaryCustomerId, effectiveTenant).run();
      } catch {
        if (effectiveTenant === 'default') {
          await db.prepare('UPDATE cashback_transactions SET customer_id = ? WHERE customer_id = ?').bind(primaryCustomerId, secondaryCustomerId).run();
        }
      }
      let secWallet: { balance?: number; total_earned?: number } | null = null;
      try {
        secWallet = await db.prepare(
          "SELECT balance, total_earned FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        ).bind(secondaryCustomerId, effectiveTenant).first<{ balance?: number; total_earned?: number }>();
      } catch {
        if (effectiveTenant === 'default') {
          secWallet = await db.prepare(
            'SELECT balance, total_earned FROM cashback_wallets WHERE customer_id = ? LIMIT 1'
          ).bind(secondaryCustomerId).first<{ balance?: number; total_earned?: number }>();
        }
      }
      const secBalance = Number(secWallet?.balance ?? 0);
      const secEarned = Number(secWallet?.total_earned ?? 0);
      if (secBalance > 0 || secEarned > 0) {
        const walletNow = nowIso();
        await db
          .prepare(
            'INSERT OR IGNORE INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at, tenant_id) VALUES (?, ?, 0, 0, 0, ?, ?, ?)',
          )
          .bind(genCustomerId('wal_'), primaryCustomerId, walletNow, walletNow, effectiveTenant)
          .run()
          .catch(() => {
            if (effectiveTenant === 'default') {
              return db
                .prepare(
                  'INSERT OR IGNORE INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)',
                )
                .bind(genCustomerId('wal_'), primaryCustomerId, walletNow, walletNow)
                .run()
                .catch(() => {});
            }
          });
        try {
          await db.prepare(
            "UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(secBalance, secEarned, walletNow, primaryCustomerId, effectiveTenant).run();
        } catch {
          if (effectiveTenant === 'default') {
            await db.prepare(
              'UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ?'
            ).bind(secBalance, secEarned, walletNow, primaryCustomerId).run();
          }
        }
        try {
          await db.prepare(
            "UPDATE cashback_wallets SET balance = 0, updated_at = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(walletNow, secondaryCustomerId, effectiveTenant).run();
        } catch {
          if (effectiveTenant === 'default') {
            await db.prepare(
              'UPDATE cashback_wallets SET balance = 0, updated_at = ? WHERE customer_id = ?'
            ).bind(walletNow, secondaryCustomerId).run();
          }
        }
      }
    } catch {
      // Optional loyalty tables in partial environments
    }

    try {
      await db.prepare(
        "UPDATE customers SET loyalty_points = loyalty_points + ?, lifetime_points = lifetime_points + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(pts, lpts, nowIso(), primaryCustomerId, effectiveTenant).run();
    } catch (err) {
      if (effectiveTenant === 'default') {
        await db.prepare(
          'UPDATE customers SET loyalty_points = loyalty_points + ?, lifetime_points = lifetime_points + ?, updated_at = ? WHERE id = ?'
        ).bind(pts, lpts, nowIso(), primaryCustomerId).run();
      } else {
        throw err;
      }
    }

    try {
      await db.prepare(
        "UPDATE customers SET loyalty_points = 0, name = name || ' [MERGED]', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(nowIso(), secondaryCustomerId, effectiveTenant).run();
    } catch (err) {
      if (effectiveTenant === 'default') {
        await db.prepare(
          "UPDATE customers SET loyalty_points = 0, name = name || ' [MERGED]', updated_at = ? WHERE id = ?"
        ).bind(nowIso(), secondaryCustomerId).run();
      } else {
        throw err;
      }
    }
    await db.prepare(
      "UPDATE customers SET name = '[MERGED]' WHERE id = ? AND name IS NULL AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(secondaryCustomerId, effectiveTenant).run().catch(() => {
      if (effectiveTenant === 'default') {
        return db.prepare("UPDATE customers SET name = '[MERGED]' WHERE id = ? AND name IS NULL").bind(secondaryCustomerId).run().catch(() => {});
      }
    });

    // Append merge event
    try {
      await db.prepare(
        'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        genCustomerId('cev_'), primaryCustomerId, 'customer_merged',
        JSON.stringify({ merged_from: secondaryCustomerId, reason, points_transferred: pts, tenant_id: effectiveTenant }), nowIso(), effectiveTenant
      ).run();
    } catch (err) {
      if (effectiveTenant === 'default') {
        await db.prepare(
          'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          genCustomerId('cev_'), primaryCustomerId, 'customer_merged',
          JSON.stringify({ merged_from: secondaryCustomerId, reason, points_transferred: pts }), nowIso()
        ).run();
      } else {
        throw err;
      }
    }

    return { ok: true, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 1, visitsReassigned: 1, identitiesReassigned: 1, pointsMerged: pts };
  } catch (err) {
    log.error('mergeCustomerProfiles failed:', { error: (err as Error).message });
    return { ok: false, primaryCustomerId, mergedCustomerId: secondaryCustomerId, ordersReassigned: 0, visitsReassigned: 0, identitiesReassigned: 0, pointsMerged: 0, error: (err as Error).message };
  }
}
