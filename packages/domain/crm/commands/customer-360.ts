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
import { loadPolicy, tierByName } from './loyalty-policy';
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
}

const EMPTY_PREFERENCES: CustomerPreferences = {
  favouriteCategories: [],
  favouriteItems: [],
  avgOrderCents: 0,
  preferredChannel: null,
  orderCount: 0,
  totalSpentCents: 0,
};

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
  const eventLimit = options.eventLimit ?? 5;
  const orderLimit = options.orderLimit ?? 100;

  const [account, events, bandPolicy] = await Promise.all([
    getCustomerAccount(db, customerId).catch((err) => {
      log.error('360_account_failed', { customerId, error: String(err) });
      return null;
    }),
    aggregateEvents(db, customerId, { limit: eventLimit }).catch((err) => {
      log.error('360_events_failed', { customerId, error: String(err) });
      return { ...EMPTY_EVENTS, customerId };
    }),
    resolveBandPolicy(kv).catch(() => undefined),
  ]);

  const tierInfo = resolveTierInfo(account, db, kv);

  const orders = await db
    .prepare(
      `SELECT total, items, channel, payment_method, created_at
       FROM orders
       WHERE customer_phone = (SELECT phone FROM customers WHERE id = ?)
       ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(customerId, orderLimit)
    .all<{
      total: number | null;
      items: string | null;
      channel: string | null;
      payment_method: string | null;
      created_at: string | null;
    }>()
    .catch((err) => {
      log.error('360_orders_failed', { customerId, error: String(err) });
      return { results: [] as Array<Record<string, unknown>> };
    });

  const orderRows = (orders?.results ?? []).map((r) => ({
    total: (r.total as number) ?? 0,
    items: r.items ?? undefined,
    channel: r.channel as string | undefined,
    payment_method: r.payment_method as string | undefined,
    created_at: r.created_at as string | undefined,
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
