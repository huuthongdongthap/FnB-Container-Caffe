/**
 * lookup-profile — read-side CRM lens over the customer tables.
 *
 * Given a phone (or identity value), return the unified profile:
 * customer record + latest identity + active consents summary +
 * recent visits (last N) + recent orders (last N).
 *
 * Pure D1 reads — no new state, no new tables. Errors are swallowed
 * and returned as an empty-but-typed profile so a lookup failure
 * never breaks a staff/owner surface.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'crm.lookup' });

export interface CrmProfile {
  customerId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  tier: string;
  totalVisits: number;
  lastVisitAt: string | null;
  consentMarketing: boolean;
  consentOrder: boolean;
  recentVisits: Array<{ visitedAt: string; channel: string }>;
  recentOrders: Array<{ id: string; totalCents: number; placedAt: string }>;
  found: boolean;
}

const EMPTY: CrmProfile = {
  customerId: null,
  name: null,
  phone: null,
  email: null,
  tier: 'anonymous',
  totalVisits: 0,
  lastVisitAt: null,
  consentMarketing: false,
  consentOrder: false,
  recentVisits: [],
  recentOrders: [],
  found: false,
};

export interface LookupOptions {
  visitLimit?: number;
  orderLimit?: number;
}

export async function lookupProfile(
  db: D1Database,
  phone: string,
  opts: LookupOptions = {},
): Promise<CrmProfile> {
  const visitLimit = opts.visitLimit ?? 5;
  const orderLimit = opts.orderLimit ?? 5;

  try {
    const identity = await db
      .prepare(
        `SELECT customer_id, value FROM customer_identities
         WHERE type = 'phone' AND value = ?1
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(phone)
      .first<{ customer_id: string; value: string }>();

    if (!identity?.customer_id) {
      return EMPTY;
    }

    const customer = await db
      .prepare(
        `SELECT id, name, phone, email, tier, total_visits, last_visit_at
         FROM customers WHERE id = ?1`,
      )
      .bind(identity.customer_id)
      .first<{
        id: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        tier: string;
        total_visits: number;
        last_visit_at: string | null;
      }>();

    if (!customer) {
      return EMPTY;
    }

    const consents = await db
      .prepare(
        `SELECT purpose, granted FROM consents
         WHERE customer_id = ?1 AND revoked_at IS NULL`,
      )
      .bind(customer.id)
      .all<{ purpose: string; granted: number | boolean }>();

    const consentMarketing = consents.results.some(
      (c) => c.purpose === 'marketing' && (c.granted === 1 || c.granted === true),
    );
    const consentOrder = consents.results.some(
      (c) => c.purpose === 'order' && (c.granted === 1 || c.granted === true),
    );

    const visits = await db
      .prepare(
        `SELECT visited_at, channel FROM visits
         WHERE customer_id = ?1
         ORDER BY visited_at DESC LIMIT ?2`,
      )
      .bind(customer.id, visitLimit)
      .all<{ visited_at: string; channel: string }>();

    const orders = await db
      .prepare(
        `SELECT id, total_cents, placed_at FROM orders
         WHERE customer_id = ?1
         ORDER BY placed_at DESC LIMIT ?2`,
      )
      .bind(customer.id, orderLimit)
      .all<{ id: string; total_cents: number; placed_at: string }>();

    return {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      tier: customer.tier,
      totalVisits: customer.total_visits,
      lastVisitAt: customer.last_visit_at,
      consentMarketing,
      consentOrder,
      recentVisits: visits.results.map((v) => ({
        visitedAt: v.visited_at,
        channel: v.channel,
      })),
      recentOrders: orders.results.map((o) => ({
        id: o.id,
        totalCents: o.total_cents,
        placedAt: o.placed_at,
      })),
      found: true,
    };
  } catch (err) {
    log.error('lookup_failed', { phone, error: String(err) });
    return EMPTY;
  }
}
