/**
 * Order Stream Event Log Replay Buffer & Fetch Helpers in KV / D1
 * Monotonically sequenced replay buffer for Last-Event-ID reconnection.
 */

export interface EventLogEntry {
  eventId: string;
  orderId: string;
  type: string;
  data: unknown;
  timestamp: string;
  tenantId?: string;
}

export type OrderStreamEvent = EventLogEntry;

function resolveEventLogKey(orderId: string, tenantId?: string): string {
  const normalizedTenant = tenantId ? String(tenantId).trim() : '';
  return normalizedTenant && normalizedTenant !== 'default' && normalizedTenant !== '*'
    ? `order_events_log:${normalizedTenant}:${orderId}`
    : `order_events_log:${orderId}`;
}

export async function appendEventToLog(
  kv: { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<unknown> },
  orderId: string,
  event: EventLogEntry,
  tenantId?: string
): Promise<void> {
  try {
    const normalizedTenant = (tenantId ?? event.tenantId) ? String(tenantId ?? event.tenantId).trim() : '';
    const key = resolveEventLogKey(orderId, normalizedTenant);
    const raw = await kv.get(key);
    const list: EventLogEntry[] = raw ? JSON.parse(raw) : [];
    const stampedEvent: EventLogEntry = normalizedTenant && !event.tenantId
      ? { ...event, tenantId: normalizedTenant }
      : event;
    list.push(stampedEvent);
    const trimmed = list.slice(-20);
    await kv.put(key, JSON.stringify(trimmed), { expirationTtl: 3600 });
  } catch {
    // Ignore KV write errors
  }
}

export async function getEventsAfter(
  kv: { get: (k: string) => Promise<string | null> },
  orderId: string,
  afterEventId: string,
  tenantId?: string
): Promise<EventLogEntry[]> {
  try {
    const normalizedTenant = tenantId ? String(tenantId).trim() : '';
    const key = resolveEventLogKey(orderId, normalizedTenant);
    const fallbackKey = `order_events_log:${orderId}`;
    const primaryRaw = await kv.get(key);
    const raw = primaryRaw ?? (key !== fallbackKey ? await kv.get(fallbackKey) : null);
    if (!raw) return [];
    const usedFallbackKey = primaryRaw === null && key !== fallbackKey;
    const parsed: EventLogEntry[] = JSON.parse(raw);
    const list = normalizedTenant && normalizedTenant !== '*'
      ? parsed.filter((e) => {
          if (e.tenantId !== undefined && String(e.tenantId).trim() !== '') {
            return String(e.tenantId).trim() === normalizedTenant;
          }
          return !usedFallbackKey || normalizedTenant === 'default';
        })
      : parsed;
    const index = list.findIndex((e) => e.eventId === afterEventId);
    if (index === -1) {
      const afterTs = Number(afterEventId) || new Date(afterEventId).getTime();
      if (!isNaN(afterTs)) {
        return list.filter((e) => (Number(e.eventId) || new Date(e.timestamp).getTime()) > afterTs);
      }
      return list;
    }
    return list.slice(index + 1);
  } catch {
    return [];
  }
}

export const replayEventsSince = getEventsAfter;
export const appendOrderEvent = appendEventToLog;

export async function fetchOrderRecord(
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: () => Promise<unknown> } } },
  orderId: string,
  tenantId?: string
): Promise<Record<string, unknown> | null> {
  const normalizedTenant = tenantId !== undefined ? (String(tenantId).trim() || 'default') : undefined;
  const effectiveTenant = normalizedTenant === '*' ? undefined : normalizedTenant;
  const tableJoinScope = normalizedTenant === undefined
    ? ''
    : " AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')";
  const joinScope = effectiveTenant === undefined
    ? ''
    : effectiveTenant === 'default'
      ? " AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '' OR TRIM(o.tenant_id) = '' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?2)"
      : " AND (o.tenant_id = ? OR TRIM(o.tenant_id) = ?2 OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?2)";
  const bareScope = effectiveTenant === undefined
    ? ''
    : effectiveTenant === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
      : " AND (tenant_id = ? OR TRIM(tenant_id) = ?2 OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)";
  const values = effectiveTenant === undefined ? [orderId] : [orderId, effectiveTenant];

  const matchesFetchedTenant = (row: Record<string, unknown> | null): Record<string, unknown> | null => {
    if (!row) return null;
    if (effectiveTenant !== undefined) {
      if ('tenant_id' in row && row.tenant_id !== undefined) {
        const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
        if (rowTenant !== effectiveTenant) return null;
      } else if (effectiveTenant !== 'default') {
        return null;
      }
    }
    return row;
  };

  try {
    const withTable = (await db.prepare(
      `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
       FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id${tableJoinScope} WHERE o.id = ?${joinScope}`
    ).bind(...values).first()) as Record<string, unknown> | null;
    if (withTable) return matchesFetchedTenant(withTable);
  } catch {
    if (tableJoinScope) {
      try {
        const withFallbackTable = (await db.prepare(
          `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
           FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE o.id = ?${joinScope}`
        ).bind(...values).first()) as Record<string, unknown> | null;
        if (withFallbackTable) return matchesFetchedTenant(withFallbackTable);
      } catch {
        // Fall through to bare orders select
      }
    }
  }

  try {
    const bare = (await db.prepare(`SELECT * FROM orders WHERE id = ?${bareScope}`).bind(...values).first()) as Record<string, unknown> | null;
    return matchesFetchedTenant(bare);
  } catch {
    const fallbackBare = (await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first()) as Record<string, unknown> | null;
    return matchesFetchedTenant(fallbackBare);
  }
}
