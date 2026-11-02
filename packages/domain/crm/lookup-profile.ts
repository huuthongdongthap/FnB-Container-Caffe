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
  tenantId?: string;
}

export async function lookupProfile(
  db: D1Database,
  phone: string,
  opts: LookupOptions = {},
): Promise<CrmProfile> {
  const visitLimit = opts.visitLimit ?? 5;
  const orderLimit = opts.orderLimit ?? 5;
  const targetTenant = opts.tenantId && opts.tenantId !== '*' ? opts.tenantId : null;

  try {
    const rawPhone = String(phone ?? '').trim();
    if (!rawPhone) {
      return EMPTY;
    }
    const digits = rawPhone.replace(/\D/g, '');
    const normalized =
      digits.startsWith('84') && digits.length >= 11 ? '0' + digits.slice(2) : (digits || rawPhone);

    let identity: { customer_id: string; value?: string } | null = null;
    try {
      identity = await db
        .prepare(
          `SELECT customer_id, identifier_value AS value FROM customer_identities
           WHERE identifier_type = 'phone' AND (identifier_value = ?1 OR identifier_value = ?2)
           ORDER BY created_at DESC LIMIT 1`,
        )
        .bind(rawPhone, normalized)
        .first<{ customer_id: string; value?: string }>();
    } catch {
      try {
        identity = await db
          .prepare(
            `SELECT customer_id, value FROM customer_identities
             WHERE type = 'phone' AND (value = ?1 OR value = ?2)
             ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(rawPhone, normalized)
          .first<{ customer_id: string; value?: string }>();
      } catch {
        identity = null;
      }
    }

    if (identity?.customer_id && targetTenant) {
      try {
        const idOwner = await db
          .prepare('SELECT id, tenant_id FROM customers WHERE id = ?1')
          .bind(identity.customer_id)
          .first<{ id: string; tenant_id?: string | null }>();
        if (!idOwner) {
          identity = null;
        } else if ('tenant_id' in idOwner && idOwner.tenant_id !== undefined) {
          const ownerTenant = (idOwner.tenant_id && String(idOwner.tenant_id).trim()) || 'default';
          if (ownerTenant !== targetTenant) {
            identity = null;
          }
        }
      } catch {
        identity = null;
      }
    }

    if (!identity?.customer_id) {
      try {
        identity = targetTenant
          ? await db
              .prepare(
                "SELECT id AS customer_id FROM customers WHERE (phone = ? OR phone = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
              )
              .bind(normalized, rawPhone, targetTenant)
              .first<{ customer_id: string; value?: string }>()
              .catch(() =>
                targetTenant === 'default'
                  ? db
                      .prepare('SELECT id AS customer_id FROM customers WHERE phone = ? OR phone = ? LIMIT 1')
                      .bind(normalized, rawPhone)
                      .first<{ customer_id: string; value?: string }>()
                  : null,
              )
          : await db
              .prepare('SELECT id AS customer_id FROM customers WHERE phone = ? OR phone = ? LIMIT 1')
              .bind(normalized, rawPhone)
              .first<{ customer_id: string; value?: string }>();
      } catch {
        identity = null;
      }
    }

    const resolvedCustomerId =
      identity?.customer_id ?? (identity as { id?: string } | null)?.id ?? null;
    if (!resolvedCustomerId) {
      return EMPTY;
    }

    const customer = await db
      .prepare(
        `SELECT * FROM customers WHERE id = ?1`,
      )
      .bind(resolvedCustomerId)
      .first<{
        id: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        tier?: string | null;
        loyalty_tier?: string | null;
        total_visits?: number | null;
        last_visit_at?: string | null;
        tenant_id?: string | null;
      }>();

    if (!customer) {
      return EMPTY;
    }
    if (targetTenant && 'tenant_id' in customer && customer.tenant_id !== undefined) {
      const custTenant = (customer.tenant_id && String(customer.tenant_id).trim()) || 'default';
      if (custTenant !== targetTenant) {
        return EMPTY;
      }
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

    const resolvedTenant =
      targetTenant ?? ((customer.tenant_id && String(customer.tenant_id).trim()) || 'default');
    const orders = await db
      .prepare(
        `SELECT * FROM orders
         WHERE customer_id = ?1
           AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?2
            OR customer_id = ?1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2
         ORDER BY created_at DESC LIMIT ?3`,
      )
      .bind(customer.id, resolvedTenant, orderLimit)
      .all<Record<string, unknown>>()
      .catch(() =>
        !targetTenant || targetTenant === 'default'
          ? db
              .prepare(
                `SELECT * FROM orders
                 WHERE customer_id = ?1
                 ORDER BY created_at DESC LIMIT ?2`,
              )
              .bind(customer.id, orderLimit)
              .all<Record<string, unknown>>()
              .catch(() =>
                db
                  .prepare(
                    `SELECT id, total_cents, placed_at FROM orders
                     WHERE customer_id = ?1
                     ORDER BY placed_at DESC LIMIT ?2`,
                  )
                  .bind(customer.id, orderLimit)
                  .all<Record<string, unknown>>(),
              )
          : { results: [] as Record<string, unknown>[] },
      );

    const scopedOrders = (orders.results ?? []).filter((o) => {
      if (targetTenant && 'tenant_id' in o && o.tenant_id !== undefined) {
        const ordTenant = (o.tenant_id && String(o.tenant_id).trim()) || 'default';
        return ordTenant === targetTenant;
      }
      return true;
    });

    return {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      tier: customer.tier ?? customer.loyalty_tier ?? 'member',
      totalVisits: customer.total_visits ?? visits.results.length,
      lastVisitAt: customer.last_visit_at ?? visits.results[0]?.visited_at ?? null,
      consentMarketing,
      consentOrder,
      recentVisits: visits.results.map((v) => ({
        visitedAt: v.visited_at,
        channel: v.channel,
      })),
      recentOrders: scopedOrders.map((o) => ({
        id: String(o.id ?? ''),
        totalCents: Number(o.total_cents ?? o.total ?? 0),
        placedAt: String(o.placed_at ?? o.created_at ?? ''),
      })),
      found: true,
    };
  } catch (err) {
    log.error('lookup_failed', { phone, error: String(err) });
    return EMPTY;
  }
}
