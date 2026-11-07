/**
 * get-customer-account — self-service read model for customer-facing
 * account surfaces (M4 Online). Aggregates profile, loyalty, recent
 * orders, active consents, and tier progress into one view.
 */
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { loadPolicy, type LoyaltyPolicy } from './loyalty-policy';

const log = createLogger({ route: 'crm.account' });

export interface CustomerAccount {
  customerId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  tier: string;
  points: number;
  lifetimePoints: number;
  nextTier: { name: string; minPoints: number; pointsNeeded: number } | null;
  recentOrders: Array<{ id: string; totalCents: number; status: string; placedAt: string }>;
  consents: Array<{ purpose: string; granted: boolean; updatedAt: string }>;
}

const EMPTY: CustomerAccount = {
  customerId: '',
  name: null,
  phone: null,
  email: null,
  tier: 'member',
  points: 0,
  lifetimePoints: 0,
  nextTier: null,
  recentOrders: [],
  consents: [],
};

export interface AccountOptions {
  orderLimit?: number;
  tenantId?: string;
  kv?: KVNamespace;
}

export async function getCustomerAccount(
  db: D1Database,
  customerId: string,
  opts: AccountOptions | string = {},
): Promise<CustomerAccount> {
  const normalizedOpts: AccountOptions = typeof opts === 'string' ? { tenantId: opts } : (opts || {});
  const rawLimit = Number(normalizedOpts.orderLimit ?? 10);
  const orderLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 50) : 10;
  const requestedTenant =
    typeof normalizedOpts.tenantId === 'string' && normalizedOpts.tenantId.trim()
      ? normalizedOpts.tenantId.trim()
      : null;

  try {
    const effectiveTenant =
      !requestedTenant
        ? 'default'
        : requestedTenant.toLowerCase() === 'hq' || requestedTenant === '*'
          ? '*'
          : requestedTenant;
    const customer = await db
      .prepare(
        "SELECT id, name, phone, email, loyalty_tier, loyalty_points, lifetime_points, tenant_id FROM customers WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)",
      )
      .bind(customerId, effectiveTenant, effectiveTenant === '*' ? 'default' : effectiveTenant)
      .first<{ id: string; name: string | null; phone: string | null; email: string | null; loyalty_tier: string | null; loyalty_points: number | null; lifetime_points: number | null; tenant_id?: string | null }>()
      .catch(() =>
        effectiveTenant === 'default'
          ? db
              .prepare('SELECT id, name, phone, email, loyalty_tier, loyalty_points, lifetime_points FROM customers WHERE id = ?')
              .bind(customerId)
              .first<{ id: string; name: string | null; phone: string | null; email: string | null; loyalty_tier: string | null; loyalty_points: number | null; lifetime_points: number | null; tenant_id?: string | null }>()
          : null,
      );

    if (!customer) {
      return { ...EMPTY, customerId };
    }

    const rawCustomerTenant = customer.tenant_id && String(customer.tenant_id).trim();
    const customerTenant = rawCustomerTenant || 'default';
    const effectiveTenantFilter = customerTenant;
    if (effectiveTenant !== '*' && 'tenant_id' in customer && customer.tenant_id !== undefined && effectiveTenantFilter !== effectiveTenant) {
      return { ...EMPTY, customerId };
    }
    const nonEmptyPhone = customer.phone && customer.phone.trim() ? customer.phone.trim() : null;

    const [orders, consents, policy] = await Promise.all([
      db
        .prepare(
          `SELECT * FROM orders
           WHERE ((customer_id = ?1 OR (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?2))
             AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?3
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3
             OR ((customer_id = ?1 OR (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?2))
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3))
           ORDER BY created_at DESC LIMIT ?4`,
        )
        .bind(customerId, nonEmptyPhone, effectiveTenantFilter, orderLimit)
        .all<Record<string, unknown>>()
        .catch(() =>
          customerTenant === 'default'
            ? db
                .prepare(
                  `SELECT * FROM orders
                   WHERE customer_id = ? OR (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
                   ORDER BY created_at DESC LIMIT ?`,
                )
                .bind(customerId, nonEmptyPhone, orderLimit)
                .all<Record<string, unknown>>()
                .catch(() =>
                  db
                    .prepare(
                      `SELECT id, COALESCE(total, total_amount, 0) AS total, status, created_at FROM orders
                       WHERE customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ? ORDER BY created_at DESC LIMIT ?`,
                    )
                    .bind(nonEmptyPhone, orderLimit)
                    .all<Record<string, unknown>>()
                    .catch(() =>
                      db
                        .prepare(
                          `SELECT id, total, status, created_at FROM orders
                           WHERE customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ? ORDER BY created_at DESC LIMIT ?`,
                        )
                        .bind(nonEmptyPhone, orderLimit)
                        .all<Record<string, unknown>>(),
                    ),
                )
            : Promise.resolve({ results: [] as Record<string, unknown>[] }),
        ),

      db
        .prepare(
          `SELECT purpose, granted, COALESCE(revoked_at, granted_at) AS updated_at FROM consents
           WHERE customer_id = ? AND revoked_at IS NULL
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
           ORDER BY granted_at DESC`,
        )
        .bind(customerId, customerTenant)
        .all<{ purpose: string; granted: number; updated_at: string }>()
        .catch(() =>
          customerTenant === 'default'
            ? db
                .prepare(
                  `SELECT purpose, granted, COALESCE(revoked_at, granted_at) AS updated_at FROM consents
                   WHERE customer_id = ? AND revoked_at IS NULL ORDER BY granted_at DESC`,
                )
                .bind(customerId)
                .all<{ purpose: string; granted: number; updated_at: string }>()
                .catch(() =>
                  db
                    .prepare(
                      `SELECT purpose, granted, updated_at FROM consents
                       WHERE customer_id = ? AND revoked_at IS NULL ORDER BY updated_at DESC`,
                    )
                    .bind(customerId)
                    .all<{ purpose: string; granted: number; updated_at: string }>(),
                )
            : Promise.resolve({ results: [] as { purpose: string; granted: number; updated_at: string }[] }),
        ),

      loadPolicy(db, normalizedOpts.kv, new Date(), customerTenant).catch(() => null),
    ]);

    const lifetimePoints = customer.lifetime_points ?? 0;
    const nextTier = resolveNextTier(policy, customer.loyalty_tier, lifetimePoints);

    return {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      tier: customer.loyalty_tier ?? 'member',
      points: customer.loyalty_points ?? 0,
      lifetimePoints,
      nextTier,
      recentOrders: (orders.results || [])
        .filter((o) => !('tenant_id' in o) || o.tenant_id === undefined || ((String(o.tenant_id ?? '').trim() || 'default') === customerTenant))
        .map((o) => ({
          id: String(o.id ?? ''),
          totalCents: Number(o.total_cents ?? o.total ?? o.total_amount ?? 0),
          status: String(o.status ?? 'pending'),
          placedAt: String(o.created_at ?? o.placed_at ?? ''),
        })),
      consents: (consents.results || []).map((c) => ({
        purpose: c.purpose,
        granted: c.granted === 1,
        updatedAt: c.updated_at,
      })),
    };
  } catch (err) {
    log.error('account_read_failed', { customerId, error: String(err) });
    return { ...EMPTY, customerId };
  }
}

function resolveNextTier(
  policy: LoyaltyPolicy | null,
  currentTier: string | null,
  lifetimePoints: number,
): { name: string; minPoints: number; pointsNeeded: number } | null {
  if (!policy || policy.tiers.length === 0) return null;
  const next = policy.tiers.find((t) => t.minPoints > lifetimePoints);
  if (!next) return null;
  return {
    name: next.tierName,
    minPoints: next.minPoints,
    pointsNeeded: Math.max(0, next.minPoints - lifetimePoints),
  };
}
