/**
 * get-customer-account — self-service read model for customer-facing
 * account surfaces (M4 Online). Aggregates profile, loyalty, recent
 * orders, active consents, and tier progress into one view.
 *
 * Pure D1 reads — no writes, no side effects. Failures swallowed and
 * returned as a partial-but-typed account so a read failure never
 * breaks the customer journey.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { computeTier } from './compute-tier';
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
}

export async function getCustomerAccount(
  db: D1Database,
  customerId: string,
  opts: AccountOptions = {},
): Promise<CustomerAccount> {
  const orderLimit = Math.min(opts.orderLimit ?? 10, 50);

  try {
    const customer = await db
      .prepare('SELECT id, name, phone, email, loyalty_tier, loyalty_points, lifetime_points FROM customers WHERE id = ?')
      .bind(customerId)
      .first<{ id: string; name: string | null; phone: string | null; email: string | null; loyalty_tier: string | null; loyalty_points: number | null; lifetime_points: number | null }>();

    if (!customer) {
      return { ...EMPTY, customerId };
    }

    const [orders, consents, policy] = await Promise.all([
      db.prepare(
        `SELECT id, total_cents, status, created_at FROM orders
         WHERE customer_phone = ? ORDER BY created_at DESC LIMIT ?`,
      ).bind(customer.phone, orderLimit).all<{ id: string; total_cents: number; status: string; created_at: string }>(),

      db.prepare(
        `SELECT purpose, granted, updated_at FROM consents
         WHERE customer_id = ? AND revoked_at IS NULL ORDER BY updated_at DESC`,
      ).bind(customerId).all<{ purpose: string; granted: number; updated_at: string }>(),

      loadPolicy(db).catch(() => null),
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
      recentOrders: (orders.results || []).map((o) => ({
        id: o.id,
        totalCents: o.total_cents,
        status: o.status,
        placedAt: o.created_at,
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
