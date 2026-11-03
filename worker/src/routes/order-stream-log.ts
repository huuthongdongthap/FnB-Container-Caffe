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
}

export async function appendEventToLog(
  kv: { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<unknown> },
  orderId: string,
  event: EventLogEntry
): Promise<void> {
  try {
    const raw = await kv.get(`order_events_log:${orderId}`);
    const list: EventLogEntry[] = raw ? JSON.parse(raw) : [];
    list.push(event);
    const trimmed = list.slice(-20);
    await kv.put(`order_events_log:${orderId}`, JSON.stringify(trimmed), { expirationTtl: 3600 });
  } catch {
    // Ignore KV write errors
  }
}

export async function getEventsAfter(
  kv: { get: (k: string) => Promise<string | null> },
  orderId: string,
  afterEventId: string
): Promise<EventLogEntry[]> {
  try {
    const raw = await kv.get(`order_events_log:${orderId}`);
    if (!raw) return [];
    const list: EventLogEntry[] = JSON.parse(raw);
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

export async function fetchOrderRecord(
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: () => Promise<unknown> } } },
  orderId: string,
  tenantId?: string
): Promise<Record<string, unknown> | null> {
  const effectiveTenant = tenantId === '*' ? undefined : tenantId;
  const joinScope = effectiveTenant === undefined
    ? ''
    : effectiveTenant === 'default'
      ? " AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '' OR TRIM(o.tenant_id) = '')"
      : ' AND (o.tenant_id = ? OR TRIM(o.tenant_id) = ?2)';
  const bareScope = effectiveTenant === undefined
    ? ''
    : effectiveTenant === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?2)';
  const values = effectiveTenant === undefined ? [orderId] : [orderId, effectiveTenant];
  const withTable = (await db.prepare(
    `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
     FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE o.id = ?${joinScope}`
  ).bind(...values).first()) as Record<string, unknown> | null;

  if (withTable) return withTable;
  return (await db.prepare(`SELECT * FROM orders WHERE id = ?${bareScope}`).bind(...values).first()) as Record<string, unknown> | null;
}
