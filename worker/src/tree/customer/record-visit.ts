/**
 * recordVisit — materialize one store visit (order presential,
 * check-in, reservation completion) + VisitRecorded event.
 *
 * Frequency/value queries (CRM ladder) read this table instead of
 * re-scanning orders. A visit may exist without an order (walk-in).
 *
 * Idempotent per order: when order_id is set, an existing visit row for
 * that order is returned untouched (order updates can re-trigger the
 * completion path).
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from '../../middleware/logger';
import { genCustomerId, nowIso } from './helpers';

const log = createLogger({ route: 'customer' });

export type VisitChannel = 'in_store' | 'qr_table' | 'online_pickup' | 'online_delivery';

export interface RecordVisitInput {
  db: D1Database;
  customerId: string;
  visitedAt?: string;            // ISO — defaults to now
  channel?: VisitChannel;
  orderId?: string | null;
  spent?: number | null;         // VND integer
}

export interface VisitWriteResult {
  ok: boolean;
  visitId?: string;
  created?: boolean;             // false = already existed for this order
}

/** Append a VisitRecorded event row. */
async function appendVisitRecordedEvent(
  db: D1Database,
  customerId: string,
  visitId: string,
  channel: VisitChannel,
  orderId: string | null,
  spent: number | null
): Promise<void> {
  await db.prepare(
    'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    genCustomerId('cev_'), customerId, 'VisitRecorded',
    JSON.stringify({ visit_id: visitId, channel, order_id: orderId, spent }),
    nowIso()
  ).run();
}

export async function recordVisit(input: RecordVisitInput): Promise<VisitWriteResult> {
  const { db, customerId } = input;
  const channel: VisitChannel = input.channel || 'in_store';
  const visitedAt = input.visitedAt || nowIso();
  const orderId = input.orderId || null;
  const spent = input.spent ?? null;

  try {
    if (orderId) {
      const existing = await db.prepare(
        'SELECT id FROM visits WHERE order_id = ? LIMIT 1'
      ).bind(orderId).first<{ id: string }>();
      if (existing) {
        return { ok: true, visitId: existing.id, created: false };
      }
    }

    const visitId = genCustomerId('vis_');
    await db.prepare(
      'INSERT INTO visits (id, customer_id, visited_at, channel, order_id, spent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(visitId, customerId, visitedAt, channel, orderId, spent, nowIso()).run();

    await appendVisitRecordedEvent(db, customerId, visitId, channel, orderId, spent);
    return { ok: true, visitId, created: true };
  } catch (err) {
    // Visit capture must never break the order-completion path.
    log.warn('recordVisit failed (non-blocking):', {
      message: (err as Error).message, customerId, orderId
    });
    return { ok: false };
  }
}
