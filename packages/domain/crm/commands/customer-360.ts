/**
 * customer-360.ts
 *
 * Unified CRM read model for owner/staff dashboards. Composes
 * account + tier + frequency band + preferences + recent events into
 * one payload.
 *
 * Partial-but-typed fallbacks: a read failure in any sub-lens never
 * breaks the surface — missing data is empty/null, not an exception.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { KVNamespace } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { getCustomerAccount, type CustomerAccount } from './get-customer-account';
import {
  computeFrequencyBand,
  resolveBandPolicy,
  type FrequencyBand,
  type BandPolicy,
} from './frequency-band';
import { extractPreferences, type CustomerPreferences } from './preferences';
import { aggregateEvents, type AggregateResult } from './aggregate-events';

const log = createLogger({ route: 'crm.360' });

export interface Customer360 {
  customerId: string;
  account: CustomerAccount | null;
  tier: {
    name: string;
    cashbackRate: number;
    pointMultiplier: number;
  };
  band: FrequencyBand;
  preferences: CustomerPreferences;
  recentEvents: AggregateResult;
}

export interface Customer360Options {
  /** Max recent events to include (default 5). */
  eventLimit?: number;
  /** Max orders to scan for preferences (default 100). */
  orderLimit?: number;
  /** Tenant scope for multi-tenant isolation. */
  tenantId?: string;
}

const EMPTY_EVENTS: AggregateResult = { customerId: '', events: [], total: 0 };

/**
 * Build the 360-view. Parallel reads across account + events + orders
 * (preferences needs the order rows).
 */
export async function getCustomer360(
  db: D1Database,
  customerId: string,
  kv?: KVNamespace,
  options: Customer360Options = {},
): Promise<Customer360> {
  const rawEventLimit = Number(options.eventLimit ?? 5);
  const eventLimit = Number.isFinite(rawEventLimit) ? Math.min(Math.max(1, Math.floor(rawEventLimit)), 200) : 5;
  const rawOrderLimit = Number(options.orderLimit ?? 100);
  const orderLimit = Number.isFinite(rawOrderLimit) ? Math.min(Math.max(1, Math.floor(rawOrderLimit)), 200) : 100;
  const effectiveTenant =
    options.tenantId && options.tenantId !== '*'
      ? options.tenantId.trim() || 'default'
      : null;

  const [account, events, bandPolicy] = await Promise.all([
    getCustomerAccount(db, customerId, { tenantId: options.tenantId }).catch((err) => {
      log.error('360_account_failed', { customerId, error: String(err) });
      return null;
    }),
    aggregateEvents(db, customerId, { limit: eventLimit, tenantId: options.tenantId }).catch((err) => {
      log.error('360_events_failed', { customerId, error: String(err) });
      return { ...EMPTY_EVENTS, customerId };
    }),
    resolveBandPolicy(kv).catch(() => undefined),
  ]);

  const tierInfo = resolveTierInfo(account, db, kv);

  const orders = await (effectiveTenant
    ? db
        .prepare(
          `SELECT o.total, o.items, o.order_type as channel, o.payment_method, o.created_at
           FROM orders o
           LEFT JOIN customers c ON c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
           WHERE (
             o.customer_id = ?
             OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)
           )
           AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
           ORDER BY o.created_at DESC LIMIT ?`,
        )
        .bind(customerId, effectiveTenant, customerId, effectiveTenant, orderLimit)
        .all<{
          total: number | null;
          items: string | null;
          channel: string | null;
          payment_method: string | null;
          created_at: string | null;
        }>()
    : db
        .prepare(
          `SELECT o.total, o.items, o.order_type as channel, o.payment_method, o.created_at
           FROM orders o
           LEFT JOIN customers c ON c.id = ?
           WHERE (
             o.customer_id = ?
             OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)
           )
           AND (c.id IS NULL OR COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default') OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default'))
           ORDER BY o.created_at DESC LIMIT ?`,
        )
        .bind(customerId, customerId, orderLimit)
        .all<{
          total: number | null;
          items: string | null;
          channel: string | null;
          payment_method: string | null;
          created_at: string | null;
        }>()
  )
    .catch(() =>
      (effectiveTenant
        ? db
            .prepare(
              `SELECT total, items, order_type as channel, payment_method, created_at
               FROM orders
               WHERE (customer_id = ? OR customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?))
                 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
               ORDER BY created_at DESC LIMIT ?`,
            )
            .bind(customerId, customerId, effectiveTenant, effectiveTenant, orderLimit)
            .all<{
              total: number | null;
              items: string | null;
              channel: string | null;
              payment_method: string | null;
              created_at: string | null;
            }>()
            .catch((err) =>
              !/no such column:\s*tenant_id/i.test(String(err))
                ? db
                    .prepare(
                      `SELECT total, items, channel, payment_method, created_at
                       FROM orders
                       WHERE (customer_id = ? OR customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?))
                         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                       ORDER BY created_at DESC LIMIT ?`,
                    )
                    .bind(customerId, customerId, effectiveTenant, effectiveTenant, orderLimit)
                    .all<{
                      total: number | null;
                      items: string | null;
                      channel: string | null;
                      payment_method: string | null;
                      created_at: string | null;
                    }>()
                    .catch(() =>
                      db
                        .prepare(
                          `SELECT COALESCE(total, total_amount, 0) AS total, items, payment_method, created_at
                           FROM orders
                           WHERE (customer_id = ? OR customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?))
                             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                           ORDER BY created_at DESC LIMIT ?`,
                        )
                        .bind(customerId, customerId, effectiveTenant, effectiveTenant, orderLimit)
                        .all<{
                          total: number | null;
                          items: string | null;
                          channel?: string | null;
                          payment_method: string | null;
                          created_at: string | null;
                        }>(),
                    )
                : Promise.reject(err),
            )
        : Promise.reject(new Error('skip_scoped_fallback'))
      ).catch(() =>
        db
          .prepare(
            `SELECT total, items, order_type as channel, payment_method, created_at
             FROM orders
             WHERE customer_id = ? OR customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ?)
             ORDER BY created_at DESC LIMIT ?`,
          )
          .bind(customerId, customerId, orderLimit)
          .all<{
            total: number | null;
            items: string | null;
            channel: string | null;
            payment_method: string | null;
            created_at: string | null;
          }>(),
      ),
    )
    .catch(() =>
      db
        .prepare(
          `SELECT total, items, channel, payment_method, created_at
           FROM orders
           WHERE customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ?)
           ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(customerId, orderLimit)
        .all<{
          total: number | null;
          items: string | null;
          channel: string | null;
          payment_method: string | null;
          created_at: string | null;
        }>(),
    )
    .catch(() =>
      db
        .prepare(
          `SELECT COALESCE(total, total_amount, 0) AS total, items, payment_method, created_at
           FROM orders
           WHERE customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ?)
           ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(customerId, orderLimit)
        .all<{
          total: number | null;
          items: string | null;
          channel?: string | null;
          payment_method: string | null;
          created_at: string | null;
        }>(),
    )
    .catch((err) => {
      log.error('360_orders_failed', { customerId, error: String(err) });
      return { results: [] as Array<Record<string, unknown>> };
    });

  const filteredOrderRows = (orders?.results ?? []).filter((r) => {
    if (!effectiveTenant) return true;
    const rec = r as Record<string, unknown>;
    if ('tenant_id' in rec && rec.tenant_id !== undefined) {
      const rowTenant = (rec.tenant_id && String(rec.tenant_id).trim()) || 'default';
      return rowTenant === effectiveTenant;
    }
    return true;
  });

  const orderRows = filteredOrderRows.map((r) => ({
    total: Number((r as Record<string, unknown>).total ?? (r as Record<string, unknown>).total_amount ?? 0),
    items: (r.items as string | null) ?? undefined,
    channel: (r.channel as string | undefined) ?? undefined,
    payment_method: (r.payment_method as string | undefined) ?? undefined,
    created_at: (r.created_at as string | undefined) ?? undefined,
  }));

  const preferences = extractPreferences(orderRows);

  const band = computeBandFromOrders(orderRows, bandPolicy);

  return {
    customerId,
    account,
    tier: tierInfo,
    band,
    preferences,
    recentEvents: events,
  };
}

function resolveTierInfo(
  account: CustomerAccount | null | undefined,
  _db: D1Database,
  _kv?: KVNamespace,
): { name: string; cashbackRate: number; pointMultiplier: number } {
  // get-customer-account returns EMPTY shape (tier='member') on miss —
  // normalize to bronze display values for the 360 lens.
  const tier = (account && account.tier !== 'member') ? account.tier : 'bronze';
  return {
    name: tier,
    cashbackRate: rateForTier(tier),
    pointMultiplier: multiplierForTier(tier),
  };
}

function rateForTier(tier: string): number {
  switch (tier) {
    case 'silver': return 0.05;
    case 'gold': return 0.07;
    case 'platinum': return 0.10;
    default: return 0.03;
  }
}

function multiplierForTier(tier: string): number {
  switch (tier) {
    case 'silver': return 1.1;
    case 'gold': return 1.3;
    case 'platinum': return 1.5;
    default: return 1.0;
  }
}

function computeBandFromOrders(
  orders: Array<{ total: number; items?: string; channel?: string; payment_method?: string; created_at?: string }>,
  policy?: BandPolicy,
): FrequencyBand {
  if (orders.length === 0) return 'new';

  const timestamps = orders
    .map((o) => o.created_at)
    .filter((t): t is string => Boolean(t))
    .sort();

  if (timestamps.length === 0) return 'new';

  const firstOrderAt = timestamps[0];
  const lastOrderAt = timestamps[timestamps.length - 1];
  const previousOrderAt = timestamps.length >= 2 ? timestamps[timestamps.length - 2] : undefined;

  return computeFrequencyBand(
    {
      firstOrderAt,
      lastOrderAt,
      orderCount: orders.length,
      previousOrderAt,
    },
    policy,
  );
}
