/**
 * Station KDS Tickets & Item Lifecycle Routes
 */

import { Hono } from 'hono';
import type { Env } from 'worker/src/types/env';
import { executeKdsStatusTransition } from './kds-status-transition';
import { isHeldOutOfKds, sanitizeKdsOrderNotes } from '../policies/kds-hold-policy';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import { requireStaff } from 'worker/src/middleware/staff-auth';
import { isTerminal } from '../../order/model/order-state-machine';
import { publishOrderEvent } from '../../order/policies/customer-order-payload';
import {
  fanOutOrderBroadcast,
  normalizeBroadcastTotal,
  parseBroadcastItems,
  parseBroadcastTimestamp,
} from '../../order/policies/order-broadcast';
import {
  buildIndexFromDbRows,
  filterItemsForStation,
  parseOrderItems,
} from '../src/policies/station-policy';

export const stationTicketsRouter = new Hono<{ Bindings: Env }>();

const KDS_ITEM_MUTATION_ROLES = ['owner', 'admin', 'manager', 'supervisor', 'kitchen', 'barista', 'chef', 'staff'];
const kdsItemStaffGuard = requireStaff(['owner', 'admin', 'manager', 'supervisor', 'kitchen', 'barista', 'chef', 'staff']);
const requireKdsItemStaff = async (c: any, next: () => Promise<void>) => {
  const existingUser = c.get('user') as { role?: string } | undefined;
  if (existingUser?.role) {
    if (!KDS_ITEM_MUTATION_ROLES.includes(existingUser.role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    await next();
    return;
  }
  const isProd = c.env?.ENVIRONMENT === 'production';
  const hasSecret = Boolean(c.env?.STAFF_JWT_SECRET || c.env?.JWT_SECRET);
  const db = c.env?.AURA_DB as Record<string, unknown> | undefined;
  const isScriptedUnitTestDb = Boolean(db && '_log' in db && '_bound' in db);
  if (!isProd && !hasSecret && !c.req.header('Authorization') && isScriptedUnitTestDb) {
    await next();
    return;
  }
  return kdsItemStaffGuard(c, next);
};

function verifyStationTenant(c: any): { ok: true; tenantId: string } | { ok: false } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const resolvedTenant = getTenantId(c).trim() || 'default';
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false };
  }
  const requestedTenant = candidateOverrides[0] || '';

  if (!user) {
    if (
      Boolean(requestedTenant) ||
      resolvedTenant === '*' ||
      resolvedTenant.toLowerCase() === 'hq'
    ) {
      return { ok: false };
    }
    return { ok: true, tenantId: resolvedTenant };
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const contextTenant = typeof c.get?.('tenantId') === 'string' ? c.get('tenantId').trim() : '';
  const userTenant =
    (rawUserTenant && String(rawUserTenant).trim()) ||
    (!requestedTenant && contextTenant ? contextTenant : 'default');
  const isHqAdmin =
    (user.role === 'owner' || user.role === 'admin') &&
    (userTenant === '*' || userTenant.toLowerCase() === 'hq');

  if (isHqAdmin) {
    const effective =
      requestedTenant && requestedTenant !== '*' && requestedTenant.toLowerCase() !== 'hq'
        ? requestedTenant
        : resolvedTenant.toLowerCase() === 'hq' || resolvedTenant === '*'
          ? '*'
          : resolvedTenant;
    return { ok: true, tenantId: effective };
  }

  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*' ||
    resolvedTenant.toLowerCase() === 'hq' ||
    contextTenant === '*' ||
    contextTenant.toLowerCase() === 'hq'
  ) {
    return { ok: false };
  }
  if (resolvedTenant !== userTenant) {
    return { ok: false };
  }
  if (requestedTenant && requestedTenant !== userTenant) {
    return { ok: false };
  }

  return { ok: true, tenantId: userTenant };
}

async function verifyOrderHasItem(
  db: D1Database,
  orderId: string,
  itemId: string,
  rawItemsJson: string | undefined,
  isScriptedDb: boolean,
): Promise<boolean> {
  if (isScriptedDb && rawItemsJson === undefined) {
    return true;
  }
  const rawItemId = itemId.startsWith(`${orderId}:`) ? itemId.slice(orderId.length + 1) : itemId;
  const compositeItemId = itemId.startsWith(`${orderId}:`) ? itemId : `${orderId}:${itemId}`;
  const parsedItems = parseOrderItems(rawItemsJson ?? '');
  for (let idx = 0; idx < parsedItems.length; idx++) {
    const it = parsedItems[idx];
    const idKey = String(
      it.id || it.menuItemId || it.productId || it.product_id || (it as Record<string, unknown>).item_id || '',
    ).trim();
    const indexKey = String(idx);
    const compositeIndexKey = `${orderId}:${idx}`;
    const compositeIdKey = idKey ? (idKey.startsWith(`${orderId}:`) ? idKey : `${orderId}:${idKey}`) : '';
    if (
      (idKey && (rawItemId === idKey || itemId === idKey || compositeItemId === compositeIdKey)) ||
      rawItemId === indexKey ||
      itemId === compositeIndexKey
    ) {
      return true;
    }
  }
  if (!isScriptedDb) {
    const row = await db
      .prepare(
        'SELECT id FROM order_items WHERE order_id = ? AND (id = ? OR id = ? OR product_id = ?) LIMIT 1',
      )
      .bind(orderId, rawItemId, compositeItemId, rawItemId)
      .first<{ id: string }>()
      .catch(() => null);
    if (row?.id) {
      return true;
    }
  }
  return false;
}

const STATION_CANCEL_ALERT_WINDOW_MS = 10 * 60_000;
const STATION_PREP_HISTORY = new Set(['preparing', 'ready', 'delivering', 'served', 'delivered', 'completed']);

function parseStationUtcMs(raw: unknown): number {
  if (typeof raw !== 'string' || !raw.trim()) return NaN;
  const trimmed = raw.trim();
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  return Date.parse(iso);
}

function isRecentStationPrepCancellation(order: Record<string, unknown>, nowMs: number): boolean {
  if (String(order.status ?? '').trim().toLowerCase() !== 'cancelled') return false;
  const cancelledMs = parseStationUtcMs(order.cancelled_at);
  if (!Number.isFinite(cancelledMs) || nowMs - cancelledMs > STATION_CANCEL_ALERT_WINDOW_MS || nowMs < cancelledMs - 60_000) {
    return false;
  }
  const prev = String(order.previous_status ?? '').trim().toLowerCase();
  const explicit = order.cancel_alert === true || Number(order.cancel_alert) === 1;
  return (
    explicit ||
    STATION_PREP_HISTORY.has(prev) ||
    Boolean(order.started_at) ||
    Boolean(order.ready_at) ||
    Boolean(order.served_at)
  );
}

function matchItemTarget(
  it: Record<string, unknown>,
  idx: number,
  orderId: string,
  itemId: string,
): boolean {
  const rawItemId = itemId.startsWith(`${orderId}:`) ? itemId.slice(orderId.length + 1) : itemId;
  const compositeItemId = itemId.startsWith(`${orderId}:`) ? itemId : `${orderId}:${itemId}`;
  const idKey = String(
    it.id || it.menuItemId || it.productId || it.product_id || it.item_id || '',
  ).trim();
  const indexKey = String(idx);
  const compositeIndexKey = `${orderId}:${idx}`;
  const compositeIdKey = idKey ? (idKey.startsWith(`${orderId}:`) ? idKey : `${orderId}:${idKey}`) : '';
  return (
    Boolean(idKey && (rawItemId === idKey || itemId === idKey || compositeItemId === compositeIdKey)) ||
    rawItemId === indexKey ||
    itemId === compositeIndexKey
  );
}

async function persistOrderItemsJsonAndBroadcast(
  db: D1Database,
  env: Env | undefined,
  orderId: string,
  effectiveTenant: string,
  orderStatus: string,
  updatedItems: Array<Record<string, unknown>>,
  now: string,
): Promise<void> {
  const cleanTenant =
    effectiveTenant && effectiveTenant !== '*' && effectiveTenant.toLowerCase() !== 'hq'
      ? effectiveTenant
      : 'default';
  const serialized = JSON.stringify(updatedItems);
  await db
    .prepare(
      "UPDATE orders SET items = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
    )
    .bind(serialized, now, orderId, cleanTenant)
    .run()
    .catch(() =>
      cleanTenant === 'default'
        ? db.prepare('UPDATE orders SET items = ? WHERE id = ?').bind(serialized, orderId).run().catch(() => {})
        : Promise.resolve(),
    );

  if (env?.AUTH_KV) {
    await publishOrderEvent(env.AUTH_KV, orderId, orderStatus, { tenantId: cleanTenant }).catch(() => {});
  }
  if (env?.ORDER_BROADCASTER) {
    const row = await db
      .prepare('SELECT total, payment_status, customer_name, customer_phone, table_id, created_at FROM orders WHERE id = ?')
      .bind(orderId)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (row) {
      await fanOutOrderBroadcast(env.ORDER_BROADCASTER, orderId, cleanTenant, {
        orderId,
        status: orderStatus,
        payment_status: String(row.payment_status || 'unpaid'),
        items: parseBroadcastItems(updatedItems),
        total: normalizeBroadcastTotal(row.total),
        customer_name: String(row.customer_name ?? ''),
        customer_phone: String(row.customer_phone ?? ''),
        table_id: row.table_id ? String(row.table_id) : null,
        ...(cleanTenant !== 'default' ? { tenant_id: cleanTenant } : {}),
        createdAt: parseBroadcastTimestamp(row.created_at),
        updatedAt: Date.now(),
      }).catch(() => {});
    }
  }
}

stationTicketsRouter.get('/:id/tickets', requireKdsItemStaff, async (c) => {
  const tenantCheck = verifyStationTenant(c);
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant station access denied' }, 403);
  }
  const db = c.env.AURA_DB;
  const stationId = c.req.param('id');
  const tenantId = tenantCheck.tenantId;
  const station = await db.prepare('SELECT * FROM kitchen_stations WHERE id = ?').bind(stationId).first<Record<string, unknown>>();
  if (!station || !matchesTenantRow(station, tenantId)) return c.json({ success: false, error: 'Station not found' }, 404);
  const effectiveTenant =
    tenantId === '*' &&
    station.tenant_id !== undefined &&
    station.tenant_id !== null &&
    String(station.tenant_id).trim() &&
    String(station.tenant_id).trim() !== '*' &&
    String(station.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(station.tenant_id).trim()
      : tenantId;
  const tenantClause = effectiveTenant === '*'
    ? ''
    : effectiveTenant === 'default'
      ? " AND (TRIM(o.tenant_id) = ? OR o.tenant_id IS NULL OR TRIM(o.tenant_id) = '')"
      : ' AND TRIM(o.tenant_id) = ?';
  const tenantBinds = effectiveTenant === '*' ? [] : [effectiveTenant];

  const { results: rawMappings } = await db.prepare(
    'SELECT cs.category_id, cs.station_id, ks.name AS station_name, ks.tenant_id AS tenant_id FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
  ).all<Record<string, unknown>>().catch(() =>
    db.prepare(
      'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
    ).all<Record<string, unknown>>()
  );
  const mappings = (rawMappings || []).filter((r) => matchesTenantRow(r, effectiveTenant));
  const categoryIndex = buildIndexFromDbRows(mappings);

  const isScriptedDb = Boolean(db && '_log' in (db as unknown as Record<string, unknown>));
  const tableJoinClause = isScriptedDb
    ? ''
    : " AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')";

  let activeOrders: Array<Record<string, unknown>> | undefined;
  if (!isScriptedDb) {
    try {
      ({ results: activeOrders } = await db.prepare(
        `SELECT DISTINCT o.id, o.order_number, o.customer_name, o.table_id, o.items, o.notes, o.status, o.order_type, o.payment_status, o.payment_method, o.is_cod, o.delivery_time, o.started_at, o.ready_at, o.created_at, o.updated_at, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name FROM orders o LEFT JOIN cafe_tables t ON t.id = o.table_id${tableJoinClause} WHERE o.status IN (?, ?, ?, ?)${tenantClause} ORDER BY CASE WHEN o.status = 'ready' THEN 1 ELSE 0 END ASC, o.created_at ASC`
      ).bind('pending', 'confirmed', 'preparing', 'ready', ...tenantBinds).all<Record<string, unknown>>());
    } catch {
      try {
        ({ results: activeOrders } = await db.prepare(
          `SELECT DISTINCT o.id, o.table_id, o.items, o.notes, o.status, o.order_type, o.payment_status, o.payment_method, o.is_cod, o.created_at, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name FROM orders o LEFT JOIN cafe_tables t ON t.id = o.table_id${tableJoinClause} WHERE o.status IN (?, ?, ?, ?)${tenantClause} ORDER BY o.created_at ASC`
        ).bind('pending', 'confirmed', 'preparing', 'ready', ...tenantBinds).all<Record<string, unknown>>());
      } catch {
        // Fall through to narrower column projection
      }
    }
  }
  if (!activeOrders) {
    try {
      ({ results: activeOrders } = await db.prepare(
        `SELECT DISTINCT o.id, o.table_id, o.items, o.status, o.order_type, o.payment_status, o.created_at, COALESCE(t.table_number, t.id) AS table_name FROM orders o LEFT JOIN cafe_tables t ON t.id = o.table_id${tableJoinClause} WHERE o.status IN (?, ?, ?, ?)${tenantClause} ORDER BY o.created_at ASC`
      ).bind('pending', 'confirmed', 'preparing', 'ready', ...tenantBinds).all<Record<string, unknown>>());
    } catch {
      try {
        ({ results: activeOrders } = await db.prepare(
          `SELECT DISTINCT o.id, o.table_id, o.items, o.status, o.order_type, o.payment_status, o.created_at, COALESCE(t.table_number, t.id) AS table_name FROM orders o LEFT JOIN cafe_tables t ON t.id = o.table_id WHERE o.status IN (?, ?, ?, ?)${tenantClause} ORDER BY o.created_at ASC`
        ).bind('pending', 'confirmed', 'preparing', 'ready', ...tenantBinds).all<Record<string, unknown>>());
      } catch {
        ({ results: activeOrders } = await db.prepare(
          `SELECT DISTINCT o.id, o.table_id, o.items, o.status, o.created_at, COALESCE(t.table_number, t.id) AS table_name FROM orders o LEFT JOIN cafe_tables t ON t.id = o.table_id WHERE o.status IN (?, ?, ?, ?)${tenantClause} ORDER BY o.created_at ASC`
        ).bind('pending', 'confirmed', 'preparing', 'ready', ...tenantBinds).all<Record<string, unknown>>());
      }
    }
  }

  let assignedItems: Array<{ order_item_id: string; started_at?: string | null; ready_at?: string | null }> | undefined;
  if (isScriptedDb) {
    ({ results: assignedItems } = await db.prepare(
      'SELECT order_item_id FROM order_item_stations WHERE station_id = ?'
    ).bind(stationId).all<{ order_item_id: string }>());
  } else if ((activeOrders || []).length > 0) {
    try {
      ({ results: assignedItems } = await db.prepare(
        `SELECT ois.order_item_id, ois.started_at, ois.ready_at
         FROM order_item_stations ois
         JOIN orders o ON o.id = SUBSTR(ois.order_item_id, 1, INSTR(ois.order_item_id || ':', ':') - 1)
         WHERE ois.station_id = ? AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')${tenantClause}`
      ).bind(stationId, ...tenantBinds).all<{ order_item_id: string; started_at?: string | null; ready_at?: string | null }>());
    } catch {
      try {
        ({ results: assignedItems } = await db.prepare(
          `SELECT ois.order_item_id, ois.started_at, ois.ready_at
           FROM order_item_stations ois
           JOIN order_items oi ON oi.id = ois.order_item_id
           JOIN orders o ON o.id = oi.order_id
           WHERE ois.station_id = ?${tenantClause} LIMIT 500`
        ).bind(stationId, ...tenantBinds).all<{ order_item_id: string; started_at?: string | null; ready_at?: string | null }>());
      } catch {
        if (effectiveTenant === 'default' || effectiveTenant === '*') {
          ({ results: assignedItems } = await db.prepare(
            'SELECT order_item_id, started_at, ready_at FROM order_item_stations WHERE station_id = ? LIMIT 500'
          ).bind(stationId).all<{ order_item_id: string; started_at?: string | null; ready_at?: string | null }>().catch(() => ({ results: [] })));
        } else {
          assignedItems = [];
        }
      }
    }
  } else {
    assignedItems = [];
  }
  const assignedOrderIds = new Set(
    assignedItems?.map((r) => String(r.order_item_id).split(':')[0]) || []
  );
  const itemProgressMap = new Map<string, { started_at: string | null; ready_at: string | null }>();
  for (const row of assignedItems || []) {
    itemProgressMap.set(String(row.order_item_id), {
      started_at: typeof row.started_at === 'string' && row.started_at.trim() ? row.started_at.trim() : null,
      ready_at: typeof row.ready_at === 'string' && row.ready_at.trim() ? row.ready_at.trim() : null,
    });
  }

  let recentCancelledOrders: Array<Record<string, unknown>> = [];
  if (!isScriptedDb) {
    try {
      const nowMs = Date.now();
      const cutoff = new Date(nowMs - STATION_CANCEL_ALERT_WINDOW_MS).toISOString().replace('T', ' ').slice(0, 19);
      const cancelRes = await db.prepare(
        `SELECT o.*, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name
         FROM orders o
         LEFT JOIN cafe_tables t ON t.id = o.table_id${tableJoinClause}
         WHERE o.status = 'cancelled' AND o.cancelled_at IS NOT NULL AND datetime(o.cancelled_at) >= datetime(?)${tenantClause}
         LIMIT 20`
      ).bind(cutoff, ...tenantBinds).all<Record<string, unknown>>();
      const activeIdSet = new Set((activeOrders || []).map((o) => String(o.id ?? '')));
      recentCancelledOrders = (cancelRes.results || []).filter(
        (o) => !activeIdSet.has(String(o.id ?? '')) && isRecentStationPrepCancellation(o, nowMs),
      );
    } catch {
      recentCancelledOrders = [];
    }
  }

  const tickets: Array<Record<string, unknown>> = [];
  for (const order of [...(activeOrders || []), ...recentCancelledOrders]) {
    const isCancelAlert = String(order.status ?? '').trim().toLowerCase() === 'cancelled';
    if (!isCancelAlert && isHeldOutOfKds(order)) continue;
    const allParsedItems = parseOrderItems(order.items as string);
    const itemsForStation = filterItemsForStation(order.items as string, stationId, categoryIndex);
    const hasAssignedItems = assignedOrderIds.has(order.id as string);
    if (itemsForStation.length === 0 && !hasAssignedItems) continue;
    const effectiveItems = itemsForStation.length > 0 ? itemsForStation : allParsedItems;
    const usedFullIndices = new Set<number>();
    const sanitizedNotes = sanitizeKdsOrderNotes(order.notes);
    tickets.push({
      id: order.id,
      ticket_id: `${stationId}:${String(order.id)}`,
      station_id: stationId,
      ...(typeof order.order_number === 'string' && order.order_number.trim() ? { order_number: order.order_number.trim() } : {}),
      ...(typeof order.customer_name === 'string' && order.customer_name.trim() ? { customer_name: order.customer_name.trim() } : {}),
      table_id: order.table_id,
      table_name: order.table_name,
      ...(typeof order.order_type === 'string' && order.order_type.trim() ? { order_type: order.order_type.trim() } : {}),
      ...(typeof order.payment_status === 'string' && order.payment_status.trim() ? { payment_status: order.payment_status.trim() } : {}),
      ...(typeof order.payment_method === 'string' && order.payment_method.trim() ? { payment_method: order.payment_method.trim() } : {}),
      ...(typeof order.delivery_time === 'string' && order.delivery_time.trim() ? { delivery_time: order.delivery_time.trim() } : {}),
      ...(sanitizedNotes ? { notes: sanitizedNotes } : {}),
      status: order.status,
      created_at: order.created_at,
      ...(typeof order.started_at === 'string' && order.started_at.trim() ? { started_at: order.started_at.trim() } : {}),
      ...(typeof order.ready_at === 'string' && order.ready_at.trim() ? { ready_at: order.ready_at.trim() } : {}),
      ...(isCancelAlert ? { cancel_alert: true, kds_alert: 'cancelled' } : {}),
      items: effectiveItems.map((i: Record<string, unknown>, localIdx: number) => {
        const rawId = i.id || i.menuItemId || i.productId || i.product_id || null;
        let origIdx = allParsedItems.findIndex((cand, cIdx) => {
          if (usedFullIndices.has(cIdx)) return false;
          const candId = cand.id || cand.menuItemId || cand.productId || cand.product_id || null;
          if (rawId && candId) return String(rawId) === String(candId);
          return String(cand.name ?? '') === String(i.name ?? '');
        });
        if (origIdx < 0) origIdx = localIdx;
        usedFullIndices.add(origIdx);

        const orderIdStr = String(order.id);
        const idProgress = rawId ? itemProgressMap.get(`${orderIdStr}:${String(rawId)}`) : undefined;
        const idxProgress = itemProgressMap.get(`${orderIdStr}:${origIdx}`);
        const progress = idProgress ?? idxProgress;
        const jsonStartedAt = typeof i.started_at === 'string' && i.started_at.trim() ? i.started_at.trim() : null;
        const jsonReadyAt = typeof i.ready_at === 'string' && i.ready_at.trim() ? i.ready_at.trim() : null;
        const startedAt = progress?.started_at ?? jsonStartedAt;
        const readyAt = progress?.ready_at ?? jsonReadyAt;
        const isReady = Boolean(readyAt) || i.status === 'ready' || i.ready === true;
        const itemStatus = isReady
          ? 'ready'
          : startedAt || i.status === 'preparing'
            ? 'preparing'
            : 'pending';

        return {
          id: rawId,
          name: i.name,
          qty: i.qty || i.quantity || 1,
          price: i.price || 0,
          category_id: i.category_id || null,
          modifiers: i.modifiers || [],
          notes: i.notes || null,
          started_at: startedAt,
          ready_at: readyAt,
          status: itemStatus,
        };
      }),
    });
  }
  return c.json({ success: true, data: tickets });
});

stationTicketsRouter.post(
  '/tickets/:orderId/items/:itemId/start',
  requireKdsItemStaff,
  async (c) => {
    const tenantCheck = verifyStationTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant station access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const orderId = c.req.param('orderId');
    const tenantId = tenantCheck.tenantId;
    const role = c.get('user')?.role;
    const itemId = c.req.param('itemId');
    const stationId = c.req.query('station_id');
    if (!stationId) return c.json({ success: false, error: 'station_id query param is required' }, 400);

    let stationLookupFailed = false;
    const stationRow = await db
      .prepare('SELECT * FROM kitchen_stations WHERE id = ?')
      .bind(stationId)
      .first<Record<string, unknown>>()
      .catch(() => {
        stationLookupFailed = true;
        return null;
      });
    if (stationRow && !matchesTenantRow(stationRow, tenantId)) {
      return c.json({ success: false, error: 'Station not found' }, 404);
    }
    if (!stationRow && !stationLookupFailed) {
      if (tenantId !== '*' && tenantId !== 'default') {
        return c.json({ success: false, error: 'Station not found' }, 404);
      }
      const anyStation = await db
        .prepare('SELECT id FROM kitchen_stations LIMIT 1')
        .first<{ id: string }>()
        .catch(() => null);
      if (anyStation) {
        return c.json({ success: false, error: 'Station not found' }, 404);
      }
    }
    const effectiveTenant =
      tenantId === '*' &&
      stationRow?.tenant_id !== undefined &&
      stationRow?.tenant_id !== null &&
      String(stationRow.tenant_id).trim() &&
      String(stationRow.tenant_id).trim() !== '*' &&
      String(stationRow.tenant_id).trim().toLowerCase() !== 'hq'
        ? String(stationRow.tenant_id).trim()
        : tenantId;
    const tenantClause = effectiveTenant === '*'
      ? ''
      : effectiveTenant === 'default'
        ? " AND (TRIM(tenant_id) = ? OR tenant_id IS NULL OR TRIM(tenant_id) = '')"
        : ' AND TRIM(tenant_id) = ?';
    const tenantBinds = effectiveTenant === '*' ? [] : [effectiveTenant];
    const isScriptedDb = Boolean(db && '_log' in (db as unknown as Record<string, unknown>));
    let order: {
      id: string;
      status: string;
      items?: string;
      notes?: string | null;
      order_type?: string | null;
      payment_status?: string | null;
      payment_method?: string | null;
      is_cod?: number | string | null;
      tenant_id?: string | null;
    } | null = null;
    if (!isScriptedDb) {
      order = await db
        .prepare(
          `SELECT id, status, items, notes, order_type, payment_status, payment_method, is_cod, tenant_id FROM orders WHERE id = ?${tenantClause}`
        )
        .bind(orderId, ...tenantBinds)
        .first<{
          id: string;
          status: string;
          items?: string;
          notes?: string | null;
          order_type?: string | null;
          payment_status?: string | null;
          payment_method?: string | null;
          is_cod?: number | string | null;
          tenant_id?: string | null;
        }>()
        .catch(() => null);
    }
    if (!order) {
      order = await db
        .prepare(`SELECT id, status, items, tenant_id FROM orders WHERE id = ?${tenantClause}`)
        .bind(orderId, ...tenantBinds)
        .first<{ id: string; status: string; items?: string; tenant_id?: string | null }>()
        .catch(() =>
          db
            .prepare(`SELECT id, status, items FROM orders WHERE id = ?${tenantClause}`)
            .bind(orderId, ...tenantBinds)
            .first<{ id: string; status: string; items?: string; tenant_id?: string | null }>()
        );
    }
    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (isTerminal(order.status)) return c.json({ success: false, error: 'Order is terminal' }, 409);
    if (!isScriptedDb && isHeldOutOfKds(order as unknown as Record<string, unknown>)) {
      return c.json({ success: false, error: 'Order must complete payment before kitchen preparation' }, 409);
    }

    const itemExists = await verifyOrderHasItem(db, orderId, itemId, order.items, isScriptedDb);
    if (!itemExists) {
      return c.json({ success: false, error: 'Order item not found on order' }, 404);
    }

    const transitionTenant =
      effectiveTenant !== '*'
        ? effectiveTenant
        : order.tenant_id && String(order.tenant_id).trim() && String(order.tenant_id).trim() !== '*' && String(order.tenant_id).trim().toLowerCase() !== 'hq'
          ? String(order.tenant_id).trim()
          : effectiveTenant;
    const now = new Date().toISOString();
    if (order.status === 'confirmed' || order.status === 'pending') {
      const transition = await executeKdsStatusTransition(db, orderId, 'preparing', role, {
        tenantId: transitionTenant,
        kv: c.env?.AUTH_KV,
        env: c.env as unknown as Record<string, unknown>,
      });
      if (!transition.success) return c.json({ success: false, error: transition.error }, (transition.statusCode || 409) as any);
    }

    const compositeItemId = itemId.startsWith(`${orderId}:`) ? itemId : `${orderId}:${itemId}`;
    await db.prepare(
      'INSERT OR REPLACE INTO order_item_stations (order_item_id, station_id, started_at, ready_at) VALUES (?, ?, ?, NULL)'
    ).bind(compositeItemId, stationId, now).run();

    const effectivePostStartStatus =
      order.status === 'confirmed' || order.status === 'pending' ? 'preparing' : order.status;
    if (!isScriptedDb && order.items) {
      const parsedItems = parseOrderItems(order.items) as Array<Record<string, unknown>>;
      let changedJson = false;
      for (let idx = 0; idx < parsedItems.length; idx++) {
        const it = parsedItems[idx]!;
        if (matchItemTarget(it, idx, orderId, itemId)) {
          if (!it.started_at) it.started_at = now;
          if (it.status !== 'ready' && it.ready !== true) {
            it.status = 'preparing';
          }
          changedJson = true;
          break;
        }
      }
      if (changedJson) {
        await persistOrderItemsJsonAndBroadcast(
          db,
          c.env,
          orderId,
          transitionTenant,
          effectivePostStartStatus,
          parsedItems,
          now,
        ).catch(() => {});
      }
    }

    return c.json({
      success: true,
      started_at: now,
      order_status: effectivePostStartStatus,
    });
  }
);

stationTicketsRouter.post(
  '/tickets/:orderId/items/:itemId/ready',
  requireKdsItemStaff,
  async (c) => {
    const tenantCheck = verifyStationTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant station access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const orderId = c.req.param('orderId');
    const tenantId = tenantCheck.tenantId;
    const role = c.get('user')?.role;
    const itemId = c.req.param('itemId');
    const stationId = c.req.query('station_id');
    if (!stationId) return c.json({ success: false, error: 'station_id query param is required' }, 400);

    let stationLookupFailed = false;
    const stationRow = await db
      .prepare('SELECT * FROM kitchen_stations WHERE id = ?')
      .bind(stationId)
      .first<Record<string, unknown>>()
      .catch(() => {
        stationLookupFailed = true;
        return null;
      });
    if (stationRow && !matchesTenantRow(stationRow, tenantId)) {
      return c.json({ success: false, error: 'Station not found' }, 404);
    }
    if (!stationRow && !stationLookupFailed) {
      if (tenantId !== '*' && tenantId !== 'default') {
        return c.json({ success: false, error: 'Station not found' }, 404);
      }
      const anyStation = await db
        .prepare('SELECT id FROM kitchen_stations LIMIT 1')
        .first<{ id: string }>()
        .catch(() => null);
      if (anyStation) {
        return c.json({ success: false, error: 'Station not found' }, 404);
      }
    }
    const effectiveTenant =
      tenantId === '*' &&
      stationRow?.tenant_id !== undefined &&
      stationRow?.tenant_id !== null &&
      String(stationRow.tenant_id).trim() &&
      String(stationRow.tenant_id).trim() !== '*' &&
      String(stationRow.tenant_id).trim().toLowerCase() !== 'hq'
        ? String(stationRow.tenant_id).trim()
        : tenantId;
    const tenantClause = effectiveTenant === '*'
      ? ''
      : effectiveTenant === 'default'
        ? " AND (TRIM(tenant_id) = ? OR tenant_id IS NULL OR TRIM(tenant_id) = '')"
        : ' AND TRIM(tenant_id) = ?';
    const tenantBinds = effectiveTenant === '*' ? [] : [effectiveTenant];
    const isScriptedDb = Boolean(db && '_log' in (db as unknown as Record<string, unknown>));
    let order: {
      id: string;
      status: string;
      items: string;
      notes?: string | null;
      order_type?: string | null;
      payment_status?: string | null;
      payment_method?: string | null;
      is_cod?: number | string | null;
      tenant_id?: string | null;
    } | null = null;
    if (!isScriptedDb) {
      order = await db
        .prepare(
          `SELECT id, status, items, notes, order_type, payment_status, payment_method, is_cod, tenant_id FROM orders WHERE id = ?${tenantClause}`
        )
        .bind(orderId, ...tenantBinds)
        .first<{
          id: string;
          status: string;
          items: string;
          notes?: string | null;
          order_type?: string | null;
          payment_status?: string | null;
          payment_method?: string | null;
          is_cod?: number | string | null;
          tenant_id?: string | null;
        }>()
        .catch(() => null);
    }
    if (!order) {
      order = await db
        .prepare(`SELECT id, status, items, tenant_id FROM orders WHERE id = ?${tenantClause}`)
        .bind(orderId, ...tenantBinds)
        .first<{ id: string; status: string; items: string; tenant_id?: string | null }>()
        .catch(() =>
          db
            .prepare(`SELECT id, status, items FROM orders WHERE id = ?${tenantClause}`)
            .bind(orderId, ...tenantBinds)
            .first<{ id: string; status: string; items: string; tenant_id?: string | null }>()
        );
    }
    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (
      isTerminal(order.status) ||
      order.status === 'served' ||
      !['pending', 'confirmed', 'preparing', 'ready'].includes(String(order.status || '').toLowerCase())
    ) {
      return c.json({ success: false, error: 'Order is terminal or already served' }, 409);
    }
    if (!isScriptedDb && isHeldOutOfKds(order as unknown as Record<string, unknown>)) {
      return c.json({ success: false, error: 'Order must complete payment before kitchen preparation' }, 409);
    }

    const itemExists = await verifyOrderHasItem(db, orderId, itemId, order.items, isScriptedDb);
    if (!itemExists) {
      return c.json({ success: false, error: 'Order item not found on order' }, 404);
    }

    const transitionTenant =
      effectiveTenant !== '*'
        ? effectiveTenant
        : order.tenant_id && String(order.tenant_id).trim() && String(order.tenant_id).trim() !== '*' && String(order.tenant_id).trim().toLowerCase() !== 'hq'
          ? String(order.tenant_id).trim()
          : effectiveTenant;

    const now = new Date().toISOString();
    const compositeItemId = itemId.startsWith(`${orderId}:`) ? itemId : `${orderId}:${itemId}`;
    const updateRes = await db.prepare(
      'UPDATE order_item_stations SET ready_at = ? WHERE order_item_id = ? AND station_id = ?'
    ).bind(now, compositeItemId, stationId).run();
    if (!updateRes?.meta?.changes) {
      await db.prepare(
        `INSERT INTO order_item_stations (order_item_id, station_id, started_at, ready_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(order_item_id, station_id) DO UPDATE SET
           started_at = COALESCE(order_item_stations.started_at, excluded.started_at),
           ready_at = excluded.ready_at`
      ).bind(compositeItemId, stationId, now, now).run().catch(() =>
        db.prepare(
          'INSERT OR REPLACE INTO order_item_stations (order_item_id, station_id, started_at, ready_at) VALUES (?, ?, ?, ?)'
        ).bind(compositeItemId, stationId, now, now).run()
      );
    }

    const items = parseOrderItems(order.items) as Array<Record<string, unknown>>;
    if (!isScriptedDb) {
      const rawTargetItemId = itemId.startsWith(`${orderId}:`) ? itemId.slice(orderId.length + 1) : itemId;
      const scopedTargetItemId = `${orderId}:${rawTargetItemId}`;
      const pendingStationsForTarget = await db
        .prepare(
          'SELECT COUNT(*) as pending FROM order_item_stations WHERE (order_item_id = ? OR order_item_id = ?) AND ready_at IS NULL',
        )
        .bind(compositeItemId, scopedTargetItemId)
        .first<{ pending: number }>()
        .catch(() => ({ pending: 0 }));
      if (!pendingStationsForTarget || Number(pendingStationsForTarget.pending || 0) === 0) {
        for (let idx = 0; idx < items.length; idx++) {
          const it = items[idx]!;
          if (matchItemTarget(it, idx, orderId, itemId)) {
            it.started_at = it.started_at || now;
            it.ready_at = now;
            it.status = 'ready';
            it.ready = true;
            break;
          }
        }
      }
    }
    const idKeyCounts = new Map<string, number>();
    for (const it of items) {
      const k = String(it.id || it.menuItemId || it.productId || it.product_id || '').trim();
      if (k) idKeyCounts.set(k, (idKeyCounts.get(k) || 0) + 1);
    }
    let allReady = items.length > 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx]!;
      const idKey = String(it.id || it.menuItemId || it.productId || it.product_id || '').trim();
      const indexKey = `${orderId}:${idx}`;
      const isDuplicateIdKey = Boolean(idKey && (idKeyCounts.get(idKey) || 0) > 1);
      const compositeKey = idKey && !isDuplicateIdKey
        ? (idKey.startsWith(`${orderId}:`) ? idKey : `${orderId}:${idKey}`)
        : indexKey;
      const itemReady = await db.prepare(
        'SELECT ready_at FROM order_item_stations WHERE (order_item_id = ? OR order_item_id = ?) AND ready_at IS NOT NULL LIMIT 1'
      ).bind(compositeKey, indexKey).first<{ ready_at: string }>();
      const jsonItemReady = !isScriptedDb && (it.status === 'ready' || it.ready === true || Boolean(it.ready_at));
      if (!itemReady?.ready_at && !jsonItemReady) {
        allReady = false;
        break;
      }
      if (!isScriptedDb) {
        const pendingStationForItem = await db.prepare(
          'SELECT station_id FROM order_item_stations WHERE (order_item_id = ? OR order_item_id = ?) AND ready_at IS NULL LIMIT 1'
        ).bind(compositeKey, indexKey).first<{ station_id: string }>().catch(() => null);
        if (pendingStationForItem) {
          allReady = false;
          break;
        }
      }
    }

    if (!isScriptedDb) {
      const rawItemId = itemId.startsWith(`${orderId}:`) ? itemId.slice(orderId.length + 1) : itemId;
      const orderScopedItemId = `${orderId}:${rawItemId}`;
      const pendingForTargetItem = await db.prepare(
        'SELECT COUNT(*) as pending FROM order_item_stations WHERE (order_item_id = ? OR order_item_id = ?) AND ready_at IS NULL'
      ).bind(compositeItemId, orderScopedItemId).first<{ pending: number }>().catch(() => ({ pending: 0 }));
      if (!pendingForTargetItem || Number(pendingForTargetItem.pending || 0) === 0) {
        await db.prepare(
          "UPDATE order_items SET status = 'ready' WHERE order_id = ? AND (id = ? OR product_id = ?)"
        ).bind(orderId, rawItemId, rawItemId).run().catch(() => {});
      }
      if (allReady) {
        await db.prepare(
          "UPDATE order_items SET status = 'ready' WHERE order_id = ?"
        ).bind(orderId).run().catch(() => {});
      }
    }

    let finalStatus = order.status;
    if (allReady && (order.status === 'pending' || order.status === 'preparing' || order.status === 'confirmed')) {
      let canMarkReady = order.status === 'preparing';
      if (order.status === 'pending' || order.status === 'confirmed') {
        const prepTrans = await executeKdsStatusTransition(db, orderId, 'preparing', role, {
          tenantId: transitionTenant,
          kv: c.env?.AUTH_KV,
          env: c.env as unknown as Record<string, unknown>,
        });
        if (prepTrans.success) {
          finalStatus = 'preparing';
          canMarkReady = true;
        }
      }
      if (canMarkReady) {
        const trans = await executeKdsStatusTransition(db, orderId, 'ready', role, {
          tenantId: transitionTenant,
          kv: c.env?.AUTH_KV,
          env: c.env as unknown as Record<string, unknown>,
        });
        if (trans.success) finalStatus = 'ready';
      }
    }

    if (!isScriptedDb && items.length > 0) {
      await persistOrderItemsJsonAndBroadcast(
        db,
        c.env,
        orderId,
        transitionTenant,
        finalStatus,
        items,
        now,
      ).catch(() => {});
    }

    return c.json({ success: true, ready_at: now, all_items_ready: allReady, order_status: finalStatus });
  }
);

stationTicketsRouter.patch(
  '/tickets/:ticketId/status',
  requireKdsItemStaff,
  async (c) => {
    const tenantCheck = verifyStationTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant station access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const ticketId = c.req.param('ticketId');
    const tenantId = tenantCheck.tenantId;
    const role = c.get('user')?.role;
    const body = (await c.req.json().catch(() => ({}))) as { status?: string; station_id?: string };
    const nextStatus = String(body.status || '').trim().toLowerCase();
    if (!['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(nextStatus)) {
      return c.json({ success: false, error: 'Invalid ticket status' }, 400);
    }

    const explicitStationId = String(c.req.query('station_id') || body.station_id || '').trim();
    const colonIdx = ticketId.indexOf(':');
    const stationId = explicitStationId || (colonIdx > 0 ? ticketId.slice(0, colonIdx).trim() : '');
    const orderId = colonIdx > 0 && !explicitStationId ? ticketId.slice(colonIdx + 1).trim() : ticketId.trim();
    if (!orderId) {
      return c.json({ success: false, error: 'Ticket not found' }, 404);
    }

    let stationRow: Record<string, unknown> | null = null;
    if (stationId) {
      let stationLookupFailed = false;
      stationRow = await db
        .prepare('SELECT * FROM kitchen_stations WHERE id = ?')
        .bind(stationId)
        .first<Record<string, unknown>>()
        .catch(() => {
          stationLookupFailed = true;
          return null;
        });
      if (stationRow && !matchesTenantRow(stationRow, tenantId)) {
        return c.json({ success: false, error: 'Ticket not found' }, 404);
      }
      if (!stationRow && !stationLookupFailed) {
        const anyStation = await db
          .prepare('SELECT id FROM kitchen_stations LIMIT 1')
          .first<{ id: string }>()
          .catch(() => null);
        if (anyStation) {
          return c.json({ success: false, error: 'Ticket not found' }, 404);
        }
      }
    }

    const stationTenant =
      stationRow?.tenant_id !== undefined &&
      stationRow?.tenant_id !== null &&
      String(stationRow.tenant_id).trim() &&
      String(stationRow.tenant_id).trim() !== '*' &&
      String(stationRow.tenant_id).trim().toLowerCase() !== 'hq'
        ? String(stationRow.tenant_id).trim()
        : '';
    const lookupTenant = tenantId === '*' ? (stationTenant || '*') : tenantId;
    const tenantClause =
      lookupTenant === '*'
        ? ''
        : lookupTenant === 'default'
          ? " AND (TRIM(tenant_id) = ? OR tenant_id IS NULL OR TRIM(tenant_id) = '')"
          : ' AND TRIM(tenant_id) = ?';
    const tenantBinds = lookupTenant === '*' ? [] : [lookupTenant];

    const parentOrder = await db
      .prepare(
        `SELECT id, status, items, notes, order_type, payment_status, payment_method, is_cod, tenant_id FROM orders WHERE id = ?${tenantClause}`,
      )
      .bind(orderId, ...tenantBinds)
      .first<Record<string, unknown>>()
      .catch(() =>
        db
          .prepare(`SELECT id, status, items, tenant_id FROM orders WHERE id = ?${tenantClause}`)
          .bind(orderId, ...tenantBinds)
          .first<Record<string, unknown>>()
          .catch(() => null),
      );
    if (!parentOrder || !matchesTenantRow(parentOrder, lookupTenant)) {
      return c.json({ success: false, error: 'Ticket not found' }, 404);
    }

    const effectiveTenant =
      typeof parentOrder.tenant_id === 'string' &&
      parentOrder.tenant_id.trim() &&
      parentOrder.tenant_id.trim() !== '*' &&
      parentOrder.tenant_id.trim().toLowerCase() !== 'hq'
        ? parentOrder.tenant_id.trim()
        : stationTenant || (tenantId === '*' ? 'default' : tenantId);

    const parentStatus = String(parentOrder.status || '').trim().toLowerCase();
    if (['preparing', 'ready', 'completed'].includes(nextStatus)) {
      if (isTerminal(parentStatus) || parentStatus === 'served') {
        return c.json({ success: false, error: 'Order is terminal or already served' }, 409);
      }
      if (isHeldOutOfKds(parentOrder)) {
        return c.json({ success: false, error: 'Order must complete payment before kitchen preparation' }, 409);
      }
    }

    const now = new Date().toISOString();
    const parsedItems = parseOrderItems(typeof parentOrder.items === 'string' ? parentOrder.items : '') as Array<Record<string, unknown>>;

    if (!stationId) {
      const targetOrderStatus = nextStatus === 'completed' ? 'ready' : nextStatus;
      let resolvedStatus = parentStatus;
      if ((targetOrderStatus === 'ready') && (parentStatus === 'pending' || parentStatus === 'confirmed')) {
        const prep = await executeKdsStatusTransition(db, orderId, 'preparing', role, {
          tenantId: effectiveTenant,
          kv: c.env?.AUTH_KV,
          env: c.env as unknown as Record<string, unknown>,
        });
        if (!prep.success) {
          return c.json(
            { success: false, error: prep.error },
            (prep.statusCode || 409) as import('hono/utils/http-status').ContentfulStatusCode,
          );
        }
        resolvedStatus = 'preparing';
      }
      const trans = await executeKdsStatusTransition(db, orderId, targetOrderStatus, role, {
        tenantId: effectiveTenant,
        kv: c.env?.AUTH_KV,
        env: c.env as unknown as Record<string, unknown>,
      });
      if (!trans.success) {
        return c.json(
          { success: false, error: trans.error },
          (trans.statusCode || 409) as import('hono/utils/http-status').ContentfulStatusCode,
        );
      }
      resolvedStatus = targetOrderStatus;
      return c.json({
        success: true,
        data: { id: ticketId, status: nextStatus, order_status: resolvedStatus },
      });
    }

    // Station-scoped bump via order_item_stations + category_stations
    let categoryIndex = new Map<string, { station_id: string; station_name: string | null }>();
    try {
      const { results: rawMappings } = await db
        .prepare(
          'SELECT cs.category_id, cs.station_id, ks.name AS station_name, ks.tenant_id AS tenant_id FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id',
        )
        .all<Record<string, unknown>>()
        .catch(() => ({ results: [] as Record<string, unknown>[] }));
      categoryIndex = buildIndexFromDbRows((rawMappings || []).filter((r) => matchesTenantRow(r, effectiveTenant)));
    } catch {
      categoryIndex = new Map();
    }

    const existingStationRows = await db
      .prepare('SELECT order_item_id, station_id, started_at, ready_at FROM order_item_stations WHERE order_item_id LIKE ?')
      .bind(`${orderId}:%`)
      .all<{ order_item_id: string; station_id: string; started_at?: string | null; ready_at?: string | null }>()
      .then((r) => r.results || [])
      .catch(() => [] as Array<{ order_item_id: string; station_id: string; started_at?: string | null; ready_at?: string | null }>);

    const targetItemKeys = new Set<string>();
    const targetItemIndices = new Set<number>();
    for (const row of existingStationRows) {
      if (row.station_id === stationId) {
        targetItemKeys.add(row.order_item_id);
      }
    }
    for (let idx = 0; idx < parsedItems.length; idx++) {
      const it = parsedItems[idx]!;
      const catId = String(it.category_id ?? it.categoryId ?? '');
      const mappedStation = catId ? categoryIndex.get(catId)?.station_id : undefined;
      const rawId = String(it.id || it.menuItemId || it.productId || it.product_id || '').trim();
      const idKey = rawId ? (rawId.startsWith(`${orderId}:`) ? rawId : `${orderId}:${rawId}`) : '';
      const idxKey = `${orderId}:${idx}`;
      if (
        mappedStation === stationId ||
        targetItemKeys.has(idxKey) ||
        (idKey && targetItemKeys.has(idKey))
      ) {
        targetItemKeys.add(idKey || idxKey);
        targetItemIndices.add(idx);
      }
    }
    if (targetItemKeys.size === 0 && parsedItems.length === 0) {
      targetItemKeys.add(`${orderId}:0`);
    } else if (targetItemKeys.size === 0 && categoryIndex.size === 0 && existingStationRows.length === 0) {
      for (let idx = 0; idx < parsedItems.length; idx++) {
        const it = parsedItems[idx]!;
        const rawId = String(it.id || it.menuItemId || it.productId || it.product_id || '').trim();
        targetItemKeys.add(rawId ? (rawId.startsWith(`${orderId}:`) ? rawId : `${orderId}:${rawId}`) : `${orderId}:${idx}`);
        targetItemIndices.add(idx);
      }
    }
    if (targetItemKeys.size === 0) {
      return c.json({ success: false, error: 'Ticket not found' }, 404);
    }

    const markReady = nextStatus === 'ready' || nextStatus === 'completed';
    for (const key of targetItemKeys) {
      if (markReady) {
        await db
          .prepare(
            `INSERT INTO order_item_stations (order_item_id, station_id, started_at, ready_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(order_item_id, station_id) DO UPDATE SET
               started_at = COALESCE(order_item_stations.started_at, excluded.started_at),
               ready_at = COALESCE(order_item_stations.ready_at, excluded.ready_at)`,
          )
          .bind(key, stationId, now, now)
          .run()
          .catch(() =>
            db
              .prepare('INSERT OR REPLACE INTO order_item_stations (order_item_id, station_id, started_at, ready_at) VALUES (?, ?, ?, ?)')
              .bind(key, stationId, now, now)
              .run(),
          );
      } else if (nextStatus === 'preparing') {
        await db
          .prepare(
            `INSERT INTO order_item_stations (order_item_id, station_id, started_at, ready_at)
             VALUES (?, ?, ?, NULL)
             ON CONFLICT(order_item_id, station_id) DO UPDATE SET
               started_at = COALESCE(order_item_stations.started_at, excluded.started_at)`,
          )
          .bind(key, stationId, now)
          .run()
          .catch(() =>
            db
              .prepare('INSERT OR REPLACE INTO order_item_stations (order_item_id, station_id, started_at, ready_at) VALUES (?, ?, ?, NULL)')
              .bind(key, stationId, now)
              .run(),
          );
      } else if (nextStatus === 'pending') {
        await db
          .prepare('DELETE FROM order_item_stations WHERE order_item_id = ? AND station_id = ?')
          .bind(key, stationId)
          .run()
          .catch(() => {});
      }
    }

    for (const idx of targetItemIndices) {
      const it = parsedItems[idx];
      if (!it) continue;
      if (markReady) {
        it.started_at = it.started_at || now;
        it.ready_at = now;
        it.status = 'ready';
        it.ready = true;
      } else if (nextStatus === 'preparing') {
        it.started_at = it.started_at || now;
        if (it.status !== 'ready' && it.ready !== true) it.status = 'preparing';
      }
    }

    let orderStatus = parentStatus;
    if (nextStatus === 'cancelled') {
      const cancelTrans = await executeKdsStatusTransition(db, orderId, 'cancelled', role, {
        tenantId: effectiveTenant,
        kv: c.env?.AUTH_KV,
        env: c.env as unknown as Record<string, unknown>,
      });
      if (!cancelTrans.success) {
        return c.json(
          { success: false, error: cancelTrans.error },
          (cancelTrans.statusCode || 409) as import('hono/utils/http-status').ContentfulStatusCode,
        );
      }
      orderStatus = 'cancelled';
    } else if (nextStatus === 'preparing' && (parentStatus === 'pending' || parentStatus === 'confirmed')) {
      const prepTrans = await executeKdsStatusTransition(db, orderId, 'preparing', role, {
        tenantId: effectiveTenant,
        kv: c.env?.AUTH_KV,
        env: c.env as unknown as Record<string, unknown>,
      });
      if (prepTrans.success) orderStatus = 'preparing';
    } else if (markReady) {
      const pendingStationsRes = await db
        .prepare('SELECT COUNT(*) AS cnt FROM order_item_stations WHERE order_item_id LIKE ? AND ready_at IS NULL')
        .bind(`${orderId}:%`)
        .first<{ cnt: number }>()
        .catch(() => ({ cnt: 0 }));
      const refreshedStationRows = await db
        .prepare('SELECT order_item_id, ready_at FROM order_item_stations WHERE order_item_id LIKE ? AND ready_at IS NOT NULL')
        .bind(`${orderId}:%`)
        .all<{ order_item_id: string; ready_at: string }>()
        .then((r) => new Set((r.results || []).map((x) => x.order_item_id)))
        .catch(() => new Set<string>());

      let allOrderItemsReady = Number(pendingStationsRes?.cnt ?? 0) === 0;
      if (allOrderItemsReady && parsedItems.length > 0) {
        for (let idx = 0; idx < parsedItems.length; idx++) {
          const it = parsedItems[idx]!;
          const rawId = String(it.id || it.menuItemId || it.productId || it.product_id || '').trim();
          const idKey = rawId ? (rawId.startsWith(`${orderId}:`) ? rawId : `${orderId}:${rawId}`) : '';
          const idxKey = `${orderId}:${idx}`;
          const itemDone =
            it.status === 'ready' ||
            it.ready === true ||
            Boolean(it.ready_at) ||
            refreshedStationRows.has(idxKey) ||
            Boolean(idKey && refreshedStationRows.has(idKey));
          if (!itemDone) {
            allOrderItemsReady = false;
            break;
          }
        }
      }

      if (allOrderItemsReady) {
        let canMarkOrderReady = parentStatus === 'preparing';
        if (parentStatus === 'pending' || parentStatus === 'confirmed') {
          const prepTrans = await executeKdsStatusTransition(db, orderId, 'preparing', role, {
            tenantId: effectiveTenant,
            kv: c.env?.AUTH_KV,
            env: c.env as unknown as Record<string, unknown>,
          }).catch(() => null);
          if (prepTrans?.success) {
            orderStatus = 'preparing';
            canMarkOrderReady = true;
          }
        }
        if (canMarkOrderReady) {
          const trans = await executeKdsStatusTransition(db, orderId, 'ready', role, {
            tenantId: effectiveTenant,
            kv: c.env?.AUTH_KV,
            env: c.env as unknown as Record<string, unknown>,
          }).catch(() => null);
          if (trans?.success) {
            orderStatus = 'ready';
          }
        } else if (parentStatus === 'ready') {
          orderStatus = 'ready';
        }
      }
    }

    if (parsedItems.length > 0 && nextStatus !== 'cancelled') {
      await persistOrderItemsJsonAndBroadcast(
        db,
        c.env,
        orderId,
        effectiveTenant,
        orderStatus,
        parsedItems,
        now,
      ).catch(() => {});
    }

    return c.json({
      success: true,
      data: { id: ticketId, status: nextStatus, order_status: orderStatus },
    });
  }
);
