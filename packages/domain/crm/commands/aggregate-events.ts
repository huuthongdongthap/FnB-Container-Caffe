/**
 * aggregateEvents — read-side lens that assembles a customer's event
 * timeline from customer_events + consents + visits + orders + loyalty logs.
 *
 * Pure D1 reads — no new state, no new tables. Returns events sorted
 * descending by timestamp so the UI can render a chronological feed.
 *
 * Failures are swallowed and returned as a partial result so a read
 * failure never breaks a staff/owner surface.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'crm.aggregate-events' });

export interface CustomerEvent {
  id: string;
  type: string;
  source: 'identity' | 'consent' | 'visit' | 'order' | 'loyalty' | 'system';
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface AggregateResult {
  customerId: string;
  events: CustomerEvent[];
  total: number;
}

const EMPTY: AggregateResult = { customerId: '', events: [], total: 0 };

export async function aggregateEvents(
  db: D1Database,
  customerId: string,
  options: { limit?: number } = {},
): Promise<AggregateResult> {
  const limit = Math.min(options.limit ?? 100, 500);

  try {
    // Parallel reads across event sources.
    const [identityRows, consentRows, visitRows, orderRows, loyaltyRows] = await Promise.all([
      db.prepare(
        `SELECT id, 'CustomerIdentified' as type, 'identity' as source, created_at as timestamp,
                json_object('identifier_type', identifier_type, 'identifier_value', identifier_value, 'is_primary', is_primary) as payload
         FROM customer_identities WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
      ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>(),

      db.prepare(
        `SELECT id, CASE WHEN granted = 1 THEN 'ConsentGiven' ELSE 'ConsentRevoked' END as type,
                'consent' as source, COALESCE(revoked_at, granted_at) as timestamp,
                json_object('purpose', purpose, 'granted', granted, 'source', source) as payload
         FROM consents WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
      ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>(),

      db.prepare(
        `SELECT id, 'VisitRecorded' as type, 'visit' as source, visited_at as timestamp,
                json_object('channel', channel, 'order_id', order_id, 'spent', spent) as payload
         FROM visits WHERE customer_id = ? ORDER BY visited_at DESC LIMIT ?`,
      ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>(),

      db.prepare(
        `SELECT id, 'OrderLinked' as type, 'order' as source, created_at as timestamp,
                json_object('total', total, 'status', status, 'payment_method', payment_method) as payload
         FROM orders WHERE customer_phone = (SELECT phone FROM customers WHERE id = ?) ORDER BY created_at DESC LIMIT ?`,
      ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>(),

      db.prepare(
        `SELECT id, CASE WHEN points > 0 THEN 'PointsEarned' ELSE 'PointsRedeemed' END as type,
                'loyalty' as source, created_at as timestamp,
                json_object('points', points, 'reason', COALESCE(reason, 'unknown')) as payload
         FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
      ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>(),
    ]);

    // Normalize row shapes — handle both D1 .results and direct arrays.
    const collect = (rows: { results?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
      if (Array.isArray(rows)) return rows;
      return (rows as { results?: Array<Record<string, unknown>> }).results ?? [];
    };

    const events: CustomerEvent[] = [
      ...collect(identityRows as { results?: Array<Record<string, unknown>> }).map(normalizeRow),
      ...collect(consentRows as { results?: Array<Record<string, unknown>> }).map(normalizeRow),
      ...collect(visitRows as { results?: Array<Record<string, unknown>> }).map(normalizeRow),
      ...collect(orderRows as { results?: Array<Record<string, unknown>> }).map(normalizeRow),
      ...collect(loyaltyRows as { results?: Array<Record<string, unknown>> }).map(normalizeRow),
    ];

    // Sort descending by timestamp, trim to limit.
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const trimmed = events.slice(0, limit);

    return { customerId, events: trimmed, total: trimmed.length };
  } catch (err) {
    log.error('aggregate_events_failed', { customerId, error: String(err) });
    return { ...EMPTY, customerId };
  }
}

function normalizeRow(row: Record<string, unknown>): CustomerEvent {
  let payload: Record<string, unknown> = {};
  try {
    const raw = (row.payload ?? '{}') as string;
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return {
    id: (row.id ?? '') as string,
    type: (row.type ?? 'Unknown') as string,
    source: (row.source ?? 'system') as CustomerEvent['source'],
    timestamp: (row.timestamp ?? '') as string,
    payload,
  };
}
