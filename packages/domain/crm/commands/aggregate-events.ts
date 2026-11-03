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
  options: { limit?: number; tenantId?: string } = {},
): Promise<AggregateResult> {
  const rawLimit = Number(options.limit ?? 100);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 500) : 100;
  const effectiveTenant =
    options.tenantId && options.tenantId !== '*'
      ? options.tenantId.trim() || 'default'
      : null;

  try {
    if (effectiveTenant) {
      try {
        const custStmt = db.prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1');
        const boundCust = typeof custStmt.bind === 'function' ? custStmt.bind(customerId) : custStmt;
        if (typeof boundCust.first === 'function') {
          const custRow = await boundCust.first<{ id: string; tenant_id?: string | null }>();
          if (custRow && 'tenant_id' in custRow && custRow.tenant_id !== undefined) {
            const custTenant = (custRow.tenant_id && String(custRow.tenant_id).trim()) || 'default';
            if (custTenant !== effectiveTenant) {
              return { ...EMPTY, customerId };
            }
          }
        }
      } catch {
        // Proceed when customers table or first() helper is not stubbed
      }
    }

    // Parallel reads across event sources.
    const [identityRows, consentRows, visitRows, orderRows, loyaltyRows] = await Promise.all([
      (effectiveTenant
        ? db.prepare(
            `SELECT id, 'CustomerIdentified' as type, 'identity' as source, created_at as timestamp,
                    json_object('identifier_type', identifier_type, 'identifier_value', identifier_value, 'is_primary', is_primary) as payload
             FROM customer_identities
             WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             ORDER BY created_at DESC LIMIT ?`,
          ).bind(customerId, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
        : Promise.reject(new Error('unscoped'))
      )
        .catch(() =>
          db.prepare(
            `SELECT id, 'CustomerIdentified' as type, 'identity' as source, created_at as timestamp,
                    json_object('identifier_type', identifier_type, 'identifier_value', identifier_value, 'is_primary', is_primary) as payload
             FROM customer_identities WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
          ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
        )
        .catch(() => ({ results: [] })),

      (effectiveTenant
        ? db.prepare(
            `SELECT id, CASE WHEN granted = 1 THEN 'ConsentGiven' ELSE 'ConsentRevoked' END as type,
                    'consent' as source, COALESCE(revoked_at, granted_at) as timestamp,
                    json_object('purpose', purpose, 'granted', granted, 'source', source) as payload
             FROM consents
             WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             ORDER BY COALESCE(revoked_at, granted_at) DESC LIMIT ?`,
          ).bind(customerId, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
            .catch((err) =>
              !/no such column:\s*tenant_id/i.test(String(err))
                ? db.prepare(
                    `SELECT id, CASE WHEN granted = 1 THEN 'ConsentGiven' ELSE 'ConsentRevoked' END as type,
                            'consent' as source, COALESCE(revoked_at, granted_at) as timestamp,
                            json_object('purpose', purpose, 'granted', granted, 'source', source) as payload
                     FROM consents
                     WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                     ORDER BY created_at DESC LIMIT ?`,
                  ).bind(customerId, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
                : Promise.reject(err),
            )
        : Promise.reject(new Error('unscoped'))
      )
        .catch(() =>
          db.prepare(
            `SELECT id, CASE WHEN granted = 1 THEN 'ConsentGiven' ELSE 'ConsentRevoked' END as type,
                    'consent' as source, COALESCE(revoked_at, granted_at) as timestamp,
                    json_object('purpose', purpose, 'granted', granted, 'source', source) as payload
             FROM consents WHERE customer_id = ? ORDER BY COALESCE(revoked_at, granted_at) DESC LIMIT ?`,
          ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
        )
        .catch(() =>
          db.prepare(
            `SELECT id, CASE WHEN granted = 1 THEN 'ConsentGiven' ELSE 'ConsentRevoked' END as type,
                    'consent' as source, COALESCE(revoked_at, granted_at) as timestamp,
                    json_object('purpose', purpose, 'granted', granted, 'source', source) as payload
             FROM consents WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
          ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
            .catch(() => ({ results: [] })),
        ),

      (effectiveTenant
        ? db.prepare(
            `SELECT id, 'VisitRecorded' as type, 'visit' as source, visited_at as timestamp,
                    json_object('channel', channel, 'order_id', order_id, 'spent', spent) as payload
             FROM visits
             WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             ORDER BY visited_at DESC LIMIT ?`,
          ).bind(customerId, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
        : Promise.reject(new Error('unscoped'))
      )
        .catch(() =>
          db.prepare(
            `SELECT id, 'VisitRecorded' as type, 'visit' as source, visited_at as timestamp,
                    json_object('channel', channel, 'order_id', order_id, 'spent', spent) as payload
             FROM visits WHERE customer_id = ? ORDER BY visited_at DESC LIMIT ?`,
          ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
        )
        .catch(() => ({ results: [] })),

      (effectiveTenant
        ? db.prepare(
            `SELECT o.id, 'OrderLinked' as type, 'order' as source, o.created_at as timestamp,
                    json_object('total', o.total, 'status', o.status, 'payment_method', o.payment_method) as payload
             FROM orders o
             LEFT JOIN customers c ON c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
             WHERE (
               o.customer_id = ?
               OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)
             )
             AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
             ORDER BY o.created_at DESC LIMIT ?`,
          ).bind(customerId, effectiveTenant, customerId, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
        : db.prepare(
            `SELECT o.id, 'OrderLinked' as type, 'order' as source, o.created_at as timestamp,
                    json_object('total', o.total, 'status', o.status, 'payment_method', o.payment_method) as payload
             FROM orders o
             LEFT JOIN customers c ON c.id = ?
             WHERE (
               o.customer_id = ?
               OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone)
             )
             AND (c.id IS NULL OR COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default') OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default'))
             ORDER BY o.created_at DESC LIMIT ?`,
          ).bind(customerId, customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
      )
        .catch(() =>
          (effectiveTenant
            ? db.prepare(
                `SELECT id, 'OrderLinked' as type, 'order' as source, created_at as timestamp,
                        json_object('total', total, 'status', status, 'payment_method', payment_method) as payload
                 FROM orders
                 WHERE (customer_id = ? OR customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?))
                   AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                 ORDER BY created_at DESC LIMIT ?`,
              ).bind(customerId, customerId, effectiveTenant, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
            : Promise.reject(new Error('skip_scoped_fallback'))
          ).catch(() =>
            db.prepare(
              `SELECT id, 'OrderLinked' as type, 'order' as source, created_at as timestamp,
                      json_object('total', total, 'status', status, 'payment_method', payment_method) as payload
               FROM orders
               WHERE customer_id = ? OR customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ?)
               ORDER BY created_at DESC LIMIT ?`,
            ).bind(customerId, customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
          )
            .catch(() =>
              db.prepare(
                `SELECT id, 'OrderLinked' as type, 'order' as source, created_at as timestamp,
                        json_object('total', total, 'status', status, 'payment_method', payment_method) as payload
                 FROM orders WHERE customer_phone = (SELECT NULLIF(TRIM(phone), '') FROM customers WHERE id = ?) ORDER BY created_at DESC LIMIT ?`,
              ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
                .catch(() => ({ results: [] })),
            ),
        ),

      (effectiveTenant
        ? db.prepare(
            `SELECT id, CASE WHEN points_change > 0 THEN 'PointsEarned' ELSE 'PointsRedeemed' END as type,
                    'loyalty' as source, created_at as timestamp,
                    json_object('points', points_change, 'reason', COALESCE(reason, 'unknown')) as payload
             FROM loyalty_point_logs
             WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             ORDER BY created_at DESC LIMIT ?`,
          ).bind(customerId, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
            .catch((err) =>
              !/no such column:\s*tenant_id/i.test(String(err))
                ? db.prepare(
                    `SELECT id, CASE WHEN points > 0 THEN 'PointsEarned' ELSE 'PointsRedeemed' END as type,
                            'loyalty' as source, created_at as timestamp,
                            json_object('points', points, 'reason', COALESCE(reason, 'unknown')) as payload
                     FROM loyalty_point_logs
                     WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                     ORDER BY created_at DESC LIMIT ?`,
                  ).bind(customerId, effectiveTenant, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
                : Promise.reject(err),
            )
        : Promise.reject(new Error('unscoped'))
      )
        .catch(() =>
          db.prepare(
            `SELECT id, CASE WHEN points_change > 0 THEN 'PointsEarned' ELSE 'PointsRedeemed' END as type,
                    'loyalty' as source, created_at as timestamp,
                    json_object('points', points_change, 'reason', COALESCE(reason, 'unknown')) as payload
             FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
          ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
        )
        .catch(() =>
          db.prepare(
            `SELECT id, CASE WHEN points > 0 THEN 'PointsEarned' ELSE 'PointsRedeemed' END as type,
                    'loyalty' as source, created_at as timestamp,
                    json_object('points', points, 'reason', COALESCE(reason, 'unknown')) as payload
             FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
          ).bind(customerId, limit).all<{ id: string; type: string; source: string; timestamp: string; payload: string }>()
            .catch(() => ({ results: [] })),
        ),
    ]);

    const matchesEffectiveTenant = (row: Record<string, unknown>): boolean => {
      if (!effectiveTenant) return true;
      if ('tenant_id' in row && row.tenant_id !== undefined) {
        const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
        return rowTenant === effectiveTenant;
      }
      return true;
    };

    // Normalize row shapes — handle both D1 .results and direct arrays.
    const collect = (rows: { results?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
      const list = Array.isArray(rows) ? rows : ((rows as { results?: Array<Record<string, unknown>> }).results ?? []);
      return list.filter(matchesEffectiveTenant);
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
