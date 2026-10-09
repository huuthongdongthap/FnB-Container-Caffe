/**
 * Canonical Customer Event Dispatcher
 * Persists domain events into customer_events append-only log and dispatches to CRM.
 * Invariant: CRM consumer failures are isolated and never abort the caller's transaction.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import {
  type CanonicalCustomerEvent,
  type CanonicalEventType,
  createCanonicalCustomerEvent
} from './customer-crm-event-contract';
import { consumeCrmEvent, type CrmConsumeResult } from '@aura/domain-crm';

const log = createLogger({ route: 'customer-events' });

export interface DispatchCustomerEventInput {
  db: D1Database;
  eventType: CanonicalEventType;
  customerId: string | null;
  orderId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  env?: unknown;
}

export interface DispatchCustomerEventResult {
  ok: boolean;
  eventId?: string;
  created: boolean;
  crmResult?: CrmConsumeResult;
  error?: string;
}

/**
 * Checks if an event with identical idempotencyKey has already been recorded.
 */
async function findExistingEvent(
  db: D1Database,
  idempotencyKey: string
): Promise<string | null> {
  const row = await db.prepare(
    "SELECT id FROM customer_events WHERE payload LIKE ? LIMIT 1"
  ).bind(`%"idempotency_key":"${idempotencyKey}"%`).first<{ id: string }>();
  return row?.id ?? null;
}

/**
 * Dispatches a canonical customer event to D1 store and CRM consumers.
 */
export async function dispatchCustomerEvent(
  input: DispatchCustomerEventInput
): Promise<DispatchCustomerEventResult> {
  const { db, eventType, customerId, orderId, payload, env } = input;

  const event = createCanonicalCustomerEvent({
    eventType,
    customerId,
    orderId,
    payload: { ...payload, idempotency_key: input.idempotencyKey },
    idempotencyKey: input.idempotencyKey,
  });

  try {
    const existingId = await findExistingEvent(db, event.idempotencyKey);
    if (existingId) {
      return { ok: true, eventId: existingId, created: false };
    }

    // Persist to immutable append-only customer_events log
    const storageCustomerId = customerId || 'guest';
    await db.prepare(
      'INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      event.id,
      storageCustomerId,
      event.eventType,
      JSON.stringify(event.payload),
      event.recordedAt
    ).run();

    // Isolated CRM consumer dispatch
    let crmResult: CrmConsumeResult | undefined;
    try {
      crmResult = await consumeCrmEvent({ db, event, env });
    } catch (crmErr) {
      log.warn('CRM consumer execution failed (isolated):', {
        error: (crmErr as Error).message,
        eventId: event.id,
        eventType: event.eventType
      });
      crmResult = { ok: false, processed: false, error: (crmErr as Error).message };
    }

    return {
      ok: true,
      eventId: event.id,
      created: true,
      crmResult,
    };
  } catch (err) {
    log.error('Failed to dispatch customer event:', {
      error: (err as Error).message,
      eventType: input.eventType
    });
    return { ok: false, created: false, error: (err as Error).message };
  }
}
