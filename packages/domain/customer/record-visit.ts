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
import { createLogger } from 'worker/src/middleware/logger';
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
  tenantId?: string;
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
  spent: number | null,
  tenantId?: string
): Promise<void> {
  const effectiveTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  const eventId = genCustomerId('cev_');
  const payload = JSON.stringify({
    visit_id: visitId,
    channel,
    order_id: orderId,
    spent,
    ...(effectiveTenant !== 'default' && effectiveTenant !== '*' ? { tenant_id: effectiveTenant } : {}),
  });
  const now = nowIso();
  if (effectiveTenant !== '*') {
    try {
      await db.prepare(
        'INSERT INTO customer_events (id, customer_id, event_type, payload, tenant_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(eventId, customerId, 'VisitRecorded', payload, effectiveTenant, now).run();
      return;
    } catch {
      // fallback to legacy schema
    }
  }
  await db.prepare(
    'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(eventId, customerId, 'VisitRecorded', payload, now).run();
}

export async function recordVisit(input: RecordVisitInput): Promise<VisitWriteResult> {
  const { db, customerId } = input;
  const channel: VisitChannel = input.channel || 'in_store';
  const visitedAt = input.visitedAt || nowIso();
  const orderId = input.orderId || null;
  const spent = input.spent ?? null;
  const effectiveTenant = input.tenantId && input.tenantId.trim()
    ? input.tenantId.trim()
    : 'default';

  try {
    if (orderId) {
      let existing: { id: string } | null = null;
      if (effectiveTenant !== '*') {
        try {
          existing = await db.prepare(
            "SELECT id FROM visits WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
          ).bind(orderId, effectiveTenant).first<{ id: string }>();
        } catch {
          // Fallback below
        }
        if (!existing && !input.tenantId) {
          const fallback = await db.prepare(
            'SELECT id FROM visits WHERE order_id = ? LIMIT 1'
          ).bind(orderId).first<{ id: string; tenant_id?: string | null }>();
          if (
            fallback &&
            (!('tenant_id' in fallback) ||
              fallback.tenant_id == null ||
              String(fallback.tenant_id).trim() === '' ||
              String(fallback.tenant_id).trim() === effectiveTenant)
          ) {
            existing = fallback;
          }
        }
      } else {
        existing = await db.prepare(
          'SELECT id FROM visits WHERE order_id = ? LIMIT 1'
        ).bind(orderId).first<{ id: string }>();
      }
      if (existing) {
        return { ok: true, visitId: existing.id, created: false };
      }
    }

    const visitId = genCustomerId('vis_');
    const createdNow = nowIso();
    if (effectiveTenant !== '*') {
      try {
        await db.prepare(
          'INSERT INTO visits (id, customer_id, visited_at, channel, order_id, spent, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(visitId, customerId, visitedAt, channel, orderId, spent, effectiveTenant, createdNow).run();
      } catch {
        await db.prepare(
          'INSERT INTO visits (id, customer_id, visited_at, channel, order_id, spent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(visitId, customerId, visitedAt, channel, orderId, spent, createdNow).run();
      }
    } else {
      await db.prepare(
        'INSERT INTO visits (id, customer_id, visited_at, channel, order_id, spent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(visitId, customerId, visitedAt, channel, orderId, spent, createdNow).run();
    }

    await appendVisitRecordedEvent(db, customerId, visitId, channel, orderId, spent, effectiveTenant);
    return { ok: true, visitId, created: true };
  } catch (err) {
    // Visit capture must never break the order-completion path.
    log.warn('recordVisit failed (non-blocking):', {
      message: (err as Error).message, customerId, orderId
    });
    return { ok: false };
  }
}
