/**
 * KDS Stream — Server-Sent Events endpoint for the Kitchen Display System.
 * Clients subscribe via EventSource to receive full 'snapshot' payloads of
 * active kitchen orders (pending + preparing), replacing 5s polling per client
 * with one shared connection.
 *
 * Architecture (mirrors order-stream.ts):
 *   GET /kds/orders/stream → poll D1 every POLL_INTERVAL_MS,
 *   emit a snapshot whenever the result set changes, close after timeout;
 *   EventSource auto-reconnects on close.
 *
 * Snapshot-based (not event-based): KDS is a state dashboard — each tick
 * re-reads the authoritative D1 rows, so no events can be missed and there
 * is no KV TTL race between create and status-update producers.
 */

import { Hono } from 'hono';
import type { Env } from 'worker/src/types/env';
import { authenticateRequest } from 'worker/src/lib/staff-session-auth';
import { StaffSessionError } from 'worker/src/lib/staff-session';
import { getTenantId } from 'worker/src/middleware/tenant';
import { isHeldOutOfKds } from '../policies/kds-hold-policy';
import { buildIndexFromDbRows } from '../src/policies/station-policy';

// Max SSE connection duration: 120s — client reconnects naturally after.
const SSE_TIMEOUT_MS = 120_000;
// Poll D1 every 3 seconds for changes.
const POLL_INTERVAL_MS = 3_000;
const CANCEL_ALERT_WINDOW_MS = 10 * 60_000;
const PREP_HISTORY_STATUSES = new Set(['preparing', 'ready', 'delivering', 'served', 'delivered', 'completed']);

export function parseUtcTimestampMs(raw: unknown): number {
  if (typeof raw !== 'string' || !raw.trim()) return NaN;
  const trimmed = raw.trim();
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  return Date.parse(iso);
}

function isRecentPrepCancellation(order: Record<string, unknown>, nowMs: number): boolean {
  if (String(order.status ?? '').trim().toLowerCase() !== 'cancelled') return false;
  const cancelledMs = parseUtcTimestampMs(order.cancelled_at);
  if (!Number.isFinite(cancelledMs) || nowMs - cancelledMs > CANCEL_ALERT_WINDOW_MS || nowMs < cancelledMs - 60_000) {
    return false;
  }
  const prev = String(order.previous_status ?? '').trim().toLowerCase();
  const explicit = order.cancel_alert === true || Number(order.cancel_alert) === 1;
  return explicit || PREP_HISTORY_STATUSES.has(prev) || Boolean(order.served_at);
}

interface KdsStreamOrder {
  id: string;
  customer_name: string;
  table_id: string | null;
  table_name?: string | null;
  order_number?: string | null;
  order_type?: string | null;
  items: unknown[];
  notes?: string | null;
  status: string;
  elapsed_minutes: number;
  created_at: string;
  updated_at?: string | null;
  started_at?: string | null;
  ready_at?: string | null;
  cancel_alert?: boolean;
  kds_alert?: string;
}

interface OrderRecord {
  id: string;
  customer_name: string;
  table_id: string | null;
  table_name?: string | null;
  order_number?: string | null;
  items: string;
  notes?: string | null;
  status: string;
  order_type?: string | null;
  payment_status?: string | null;
  created_at: string;
  updated_at?: string | null;
  started_at?: string | null;
  ready_at?: string | null;
  cancelled_at?: string | null;
  previous_status?: string | null;
  cancel_alert?: number | boolean | null;
  served_at?: string | null;
}

export const kdsStreamRouter = new Hono<{ Bindings: Env }>();

export function hasCrossTenantOverride(
  c: { req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined }; get?: (k: string) => unknown },
  user?: { role?: string; tenantId?: string; tenant_id?: string }
): boolean {
  const resolvedTenant = getTenantId(c as any).trim() || 'default';
  const effectiveUser =
    user ?? (c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined);
  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) return true;
  const requestedTenant = candidateOverrides[0] || '';
  if (effectiveUser) {
    const rawUserTenant = effectiveUser.tenantId ?? effectiveUser.tenant_id;
    const userTenant = (rawUserTenant && String(rawUserTenant).trim()) || 'default';
    const isHqAdmin =
      (effectiveUser.role === 'owner' || effectiveUser.role === 'admin') &&
      (userTenant.toLowerCase() === 'hq' || userTenant === '*');
    if (isHqAdmin) return false;
    return (
      userTenant === '*' ||
      userTenant.toLowerCase() === 'hq' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      resolvedTenant === '*' ||
      resolvedTenant.toLowerCase() === 'hq' ||
      resolvedTenant !== userTenant ||
      Boolean(requestedTenant && requestedTenant !== userTenant)
    );
  }
  return (
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*' ||
    resolvedTenant.toLowerCase() === 'hq'
  );
}

function mapKdsOrder(
  order: OrderRecord,
  isCancelAlert = false,
  filteredItems?: unknown[],
): KdsStreamOrder {
  let items: unknown[] = [];
  if (filteredItems) {
    items = filteredItems;
  } else if (Array.isArray(order.items)) {
    items = order.items;
  } else {
    try {
      const parsed = JSON.parse(order.items);
      if (Array.isArray(parsed)) items = parsed;
    } catch { /* keep empty */ }
  }

  const createdMs = parseUtcTimestampMs(order.created_at);
  const elapsed = Number.isFinite(createdMs)
    ? Math.max(0, Math.round((Date.now() - createdMs) / 60000))
    : 0;

  return {
    id: order.id,
    customer_name: order.customer_name,
    table_id: order.table_id,
    ...(typeof order.table_name === 'string' && order.table_name.trim() ? { table_name: order.table_name.trim() } : {}),
    ...(typeof order.order_number === 'string' && order.order_number.trim() ? { order_number: order.order_number.trim() } : {}),
    ...(order.order_type ? { order_type: order.order_type } : {}),
    items,
    ...(order.notes ? { notes: order.notes } : {}),
    status: order.status,
    elapsed_minutes: elapsed,
    created_at: order.created_at,
    ...(typeof order.updated_at === 'string' && order.updated_at.trim() ? { updated_at: order.updated_at.trim() } : {}),
    ...(typeof order.started_at === 'string' && order.started_at.trim() ? { started_at: order.started_at.trim() } : {}),
    ...(typeof order.ready_at === 'string' && order.ready_at.trim() ? { ready_at: order.ready_at.trim() } : {}),
    ...(isCancelAlert ? { cancel_alert: true, kds_alert: 'cancelled' } : {}),
  };
}

/**
 * GET /kds/orders/stream — SSE endpoint (mounted under /api/kds/orders,
 * behind requireAuth(['owner', 'staff']) in index.ts).
 */
kdsStreamRouter.get('/stream', async(c) => {
  const db = c.env.AURA_DB;
  const resolvedTenant = getTenantId(c).trim() || 'default';
  const user = c.get('user' as never) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant KDS stream access denied' }, 403);
  }
  const requestedTenant = candidateOverrides[0] || '';
  let tenantId = resolvedTenant;
  if (user) {
    const rawUserTenant = user.tenantId ?? user.tenant_id;
    const userTenant = (rawUserTenant && String(rawUserTenant).trim()) || 'default';
    const isHqAdmin =
      (user.role === 'owner' || user.role === 'admin') &&
      (userTenant.toLowerCase() === 'hq' || userTenant === '*');
    if (!isHqAdmin) {
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        resolvedTenant === '*' ||
        resolvedTenant.toLowerCase() === 'hq' ||
        resolvedTenant !== userTenant ||
        (requestedTenant && requestedTenant !== userTenant)
      ) {
        return c.json({ success: false, error: 'Cross-tenant KDS stream access denied' }, 403);
      }
      tenantId = userTenant;
    } else {
      const cleanRequested =
        requestedTenant && requestedTenant !== '*' && requestedTenant.toLowerCase() !== 'hq'
          ? requestedTenant
          : '';
      const cleanResolved =
        resolvedTenant && resolvedTenant !== '*' && resolvedTenant.toLowerCase() !== 'hq'
          ? resolvedTenant
          : '';
      tenantId =
        requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq'
          ? '*'
          : cleanRequested || cleanResolved || '*';
    }
  } else if (
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*' ||
    resolvedTenant.toLowerCase() === 'hq'
  ) {
    return c.json({ success: false, error: 'Cross-tenant KDS stream access denied' }, 403);
  }
  if (!db) {
    return c.json({ error: 'DB not available' }, 500);
  }

  const rawStation = (c.req.query('station_id') || c.req.query('station') || '').trim();
  const stationId = rawStation && rawStation.toLowerCase() !== 'all' ? rawStation : '';

  let categoryIndex: Map<string, { station_id: string; station_name: string | null }> | null = null;
  if (stationId) {
    try {
      let mappings: Record<string, unknown>[] = [];
      let loadedMappings = false;
      if (tenantId === '*') {
        const res = await db.prepare(
          'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
        ).all<Record<string, unknown>>();
        mappings = res.results || [];
        loadedMappings = true;
      } else {
        try {
          const res = await db.prepare(
            "SELECT cs.category_id, cs.station_id, ks.name AS station_name, ks.tenant_id FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id WHERE COALESCE(NULLIF(TRIM(ks.tenant_id), ''), 'default') = ?"
          ).bind(tenantId).all<Record<string, unknown>>();
          mappings = res.results || [];
          loadedMappings = true;
        } catch {
          if (tenantId === 'default') {
            const res = await db.prepare(
              'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
            ).all<Record<string, unknown>>();
            mappings = res.results || [];
            loadedMappings = true;
          }
        }
      }
      if (loadedMappings) {
        categoryIndex = buildIndexFromDbRows(mappings);
      }
    } catch {
      // Table unseeded or mock DB
    }
  }

  const encoder = new TextEncoder();
  let closed = false;
  let warningTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const queryActiveOrders = async(): Promise<KdsStreamOrder[]> => {
        try {
          const session = await authenticateRequest(c.req.raw, c.env);
          if (!session || 'blocked' in session || !session.account) throw new StaffSessionError('SESSION_REVOKED');
          const accountRecord = session.account as unknown as { role?: string; tenant_id?: string | null; tenantId?: string | null };
          const rawAccountTenant = accountRecord.tenant_id ?? accountRecord.tenantId;
          if (rawAccountTenant !== undefined && rawAccountTenant !== null && String(rawAccountTenant).trim() !== '') {
            const accountTenant = String(rawAccountTenant).trim();
            const accountRole = String(accountRecord.role || '').trim().toLowerCase();
            const isAccountHq = (accountRole === 'owner' || accountRole === 'admin') && (accountTenant.toLowerCase() === 'hq' || accountTenant === '*');
            if (!isAccountHq && tenantId !== '*' && accountTenant !== tenantId) {
              throw new StaffSessionError('SESSION_REVOKED');
            }
          }
        } catch (error) {
          const code = error instanceof StaffSessionError ? error.code : 'AUTH_STATE_UNAVAILABLE';
          send('auth_error', { code, message: 'Phiên Staff không còn khả dụng' });
          closed = true;
          if (warningTimer) clearTimeout(warningTimer);
          if (closeTimer) clearTimeout(closeTimer);
          try { controller.close(); } catch { /* Disconnected. */ }
          throw error;
        }
        const tenantClauseO = tenantId === '*'
          ? ''
          : tenantId === 'default'
            ? " AND (TRIM(o.tenant_id) = ? OR o.tenant_id IS NULL OR TRIM(o.tenant_id) = '')"
            : ' AND TRIM(o.tenant_id) = ?';
        const tenantClause = tenantId === '*'
          ? ''
          : tenantId === 'default'
            ? " AND (TRIM(tenant_id) = ? OR tenant_id IS NULL OR TRIM(tenant_id) = '')"
            : ' AND TRIM(tenant_id) = ?';
        const activeQueries = [
          `SELECT o.id, o.customer_name, o.table_id, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name, o.order_number, o.items, o.notes, o.status, o.order_type, o.payment_status, o.payment_method, o.is_cod, o.created_at, o.updated_at, o.started_at, o.ready_at FROM orders o
           LEFT JOIN cafe_tables t ON t.id = o.table_id
             AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
           WHERE o.status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClauseO}
           AND NOT (TRIM(COALESCE(o.notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(o.items, '')) = '[]')
           ORDER BY CASE WHEN o.status = 'ready' THEN 1 ELSE 0 END ASC, o.created_at ASC LIMIT 200`,
          `SELECT o.id, o.customer_name, o.table_id, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name, o.order_number, o.items, o.notes, o.status, o.order_type, o.payment_status, o.payment_method, o.is_cod, o.created_at, o.updated_at FROM orders o
           LEFT JOIN cafe_tables t ON t.id = o.table_id
             AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
           WHERE o.status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClauseO}
           AND NOT (TRIM(COALESCE(o.notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(o.items, '')) = '[]')
           ORDER BY CASE WHEN o.status = 'ready' THEN 1 ELSE 0 END ASC, o.created_at ASC LIMIT 200`,
          `SELECT id, customer_name, table_id, order_number, items, notes, status, order_type, payment_status, payment_method, is_cod, created_at, updated_at, started_at, ready_at FROM orders
           WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClause}
           AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
           ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 200`,
          `SELECT id, customer_name, table_id, items, notes, status, order_type, payment_status, payment_method, is_cod, created_at FROM orders
           WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClause}
           AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
           ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 200`,
          `SELECT id, customer_name, table_id, items, notes, status, order_type, payment_status, payment_method, created_at FROM orders
           WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClause}
           AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
           ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 200`,
          `SELECT id, customer_name, table_id, items, notes, status, payment_status, payment_method, created_at FROM orders
           WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClause}
           AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
           ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 200`,
          `SELECT id, customer_name, table_id, items, notes, status, order_type, payment_status, created_at FROM orders
           WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClause}
           AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
           ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 200`,
          `SELECT id, customer_name, table_id, items, notes, status, created_at FROM orders
           WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
           ${tenantClause}
           AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
           ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 200`,
        ];
        let results: OrderRecord[] | undefined;
        let lastActiveQueryError: unknown;
        for (const sql of activeQueries) {
          try {
            const statement = db.prepare(sql);
            ({ results } = await (tenantId === '*' ? statement : statement.bind(tenantId)).all<OrderRecord>());
            lastActiveQueryError = undefined;
            break;
          } catch (err) {
            lastActiveQueryError = err;
          }
        }
        if (lastActiveQueryError) throw lastActiveQueryError;
        const activeOrders: KdsStreamOrder[] = [];
        for (const r of results || []) {
          if (isHeldOutOfKds(r as unknown as Record<string, unknown>)) continue;
          if (stationId && categoryIndex) {
            let parsedItems: Array<Record<string, unknown>> = [];
            if (Array.isArray(r.items)) {
              parsedItems = r.items as Array<Record<string, unknown>>;
            } else {
              try {
                const parsed = JSON.parse(r.items);
                if (Array.isArray(parsed)) parsedItems = parsed;
              } catch { /* keep empty */ }
            }
            const stationItems = parsedItems.filter((item) => {
              const catId = String(item.category_id ?? item.categoryId ?? '');
              return categoryIndex!.get(catId)?.station_id === stationId;
            });
            if (stationItems.length === 0) continue;
            activeOrders.push(mapKdsOrder(r, false, stationItems));
          } else {
            activeOrders.push(mapKdsOrder(r, false));
          }
        }

        const nowMs = Date.now();
        let recentCancelled: KdsStreamOrder[] = [];
        try {
          const cutoff = new Date(nowMs - CANCEL_ALERT_WINDOW_MS).toISOString().replace('T', ' ').slice(0, 19);
          let cancelledRes: { results?: OrderRecord[] } | undefined;
          try {
            const cancelledJoined = db.prepare(
              `SELECT o.*, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name
               FROM orders o
               LEFT JOIN cafe_tables t ON t.id = o.table_id
                 AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
               WHERE o.status = 'cancelled' AND o.cancelled_at IS NOT NULL AND datetime(o.cancelled_at) >= datetime(?)${tenantClauseO} LIMIT 20`
            );
            cancelledRes = await (tenantId === '*'
              ? cancelledJoined.bind(cutoff)
              : cancelledJoined.bind(cutoff, tenantId)).all<OrderRecord>();
          } catch {
            const cancelledStatement = db.prepare(
              `SELECT * FROM orders WHERE status = 'cancelled' AND cancelled_at IS NOT NULL AND datetime(cancelled_at) >= datetime(?)${tenantClause} LIMIT 20`
            );
            cancelledRes = await (tenantId === '*'
              ? cancelledStatement.bind(cutoff)
              : cancelledStatement.bind(cutoff, tenantId)).all<OrderRecord>();
          }
          const activeIds = new Set(activeOrders.map((o) => o.id));
          for (const o of cancelledRes?.results || []) {
            if (activeIds.has(o.id) || !isRecentPrepCancellation(o as unknown as Record<string, unknown>, nowMs)) {
              continue;
            }
            if (stationId && categoryIndex) {
              let parsedItems: Array<Record<string, unknown>> = [];
              if (Array.isArray(o.items)) {
                parsedItems = o.items as Array<Record<string, unknown>>;
              } else {
                try {
                  const parsed = JSON.parse(o.items);
                  if (Array.isArray(parsed)) parsedItems = parsed;
                } catch { /* keep empty */ }
              }
              const stationItems = parsedItems.filter((item) => {
                const catId = String(item.category_id ?? item.categoryId ?? '');
                return categoryIndex!.get(catId)?.station_id === stationId;
              });
              if (stationItems.length === 0) continue;
              recentCancelled.push(mapKdsOrder(o, true, stationItems));
            } else {
              recentCancelled.push(mapKdsOrder(o, true));
            }
          }
        } catch {
          // cancelled_at / previous_status absent in minimal schemas: no cancel alerts
        }

        return [...activeOrders, ...recentCancelled];
      };

      try {
        // Initial snapshot so the client renders immediately on connect.
        send('snapshot', await queryActiveOrders());
      } catch {
        send('error', { message: 'initial snapshot failed' });
      }

      if (closed) return;

      // Polling loop: emit only when the payload actually changes.
      let lastPayload = '';
      const run = async() => {
        while (!closed) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          if (closed) {
            break;
          }
          try {
            const orders = await queryActiveOrders();
            const payload = JSON.stringify(orders);
            if (payload !== lastPayload) {
              lastPayload = payload;
              send('snapshot', orders);
            }
          } catch {
            // Polling error — keep the connection alive, retry next tick.
          }
        }
      };

      const pollPromise = run();

      // Connection timeout — close cleanly; EventSource reconnects.
      closeTimer = setTimeout(() => {
        closed = true;
        try {
          controller.close();
        } catch { /* ignore */ }
      }, SSE_TIMEOUT_MS);

      // Cleanup on client disconnect.
      c.req.raw.signal.addEventListener('abort', () => {
        closed = true;
        if (warningTimer) clearTimeout(warningTimer);
        if (closeTimer) clearTimeout(closeTimer);
        try {
          controller.close();
        } catch { /* ignore */ }
      });

      await Promise.race([
        pollPromise,
        new Promise((resolve) => {
          warningTimer = setTimeout(resolve, SSE_TIMEOUT_MS);
        })
      ]);
    },
    cancel() {
      closed = true;
      if (warningTimer) clearTimeout(warningTimer);
      if (closeTimer) clearTimeout(closeTimer);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
});
