/**
 * linkOrder — append an OrderLinked event tying an order to a customer
 * on the golden-loop spine. Orders already carry customer_phone /
 * customer_id; this event makes the linkage explicit and queryable on
 * the event timeline without re-scanning orders.
 *
 * Idempotent per (customer, order): the same pair is only written once.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from '../../middleware/logger';
import { genCustomerId, nowIso } from './helpers';

const log = createLogger({ route: 'customer' });

export interface LinkOrderInput {
  db: D1Database;
  customerId: string;
  orderId: string;
  total?: number | null;         // VND integer, snapshot for the timeline
  orderType?: string | null;
}

export interface LinkOrderResult {
  ok: boolean;
  created?: boolean;              // false = already linked
}

export async function linkOrder(input: LinkOrderInput): Promise<LinkOrderResult> {
  const { db, customerId, orderId } = input;
  try {
    const existing = await db.prepare(
      "SELECT id FROM customer_events WHERE customer_id = ? AND event_type = 'OrderLinked' AND payload LIKE ? LIMIT 1"
    ).bind(customerId, `%"order_id":"${orderId}"%`).first<{ id: string }>();
    if (existing) {
      return { ok: true, created: false };
    }

    await db.prepare(
      'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      genCustomerId('cev_'), customerId, 'OrderLinked',
      JSON.stringify({
        order_id: orderId,
        total: input.total ?? null,
        order_type: input.orderType ?? null
      }),
      nowIso()
    ).run();
    return { ok: true, created: true };
  } catch (err) {
    // Linkage must never break the order path.
    log.warn('linkOrder failed (non-blocking):', {
      message: (err as Error).message, customerId, orderId
    });
    return { ok: false };
  }
}
