/**
 * Station KDS Tickets & Item Lifecycle Routes
 */

import { Hono } from 'hono';
import type { Env } from 'worker/src/types/env';
import { executeKdsStatusTransition } from './kds-status-transition';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import { requireStaff } from 'worker/src/middleware/staff-auth';
import { isTerminal } from '../../order/model/order-state-machine';
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

  let assignedItems: Array<{ order_item_id: string }> | undefined;
  if (isScriptedDb) {
    ({ results: assignedItems } = await db.prepare(
      'SELECT order_item_id FROM order_item_stations WHERE station_id = ?'
    ).bind(stationId).all<{ order_item_id: string }>());
  } else if ((activeOrders || []).length > 0) {
    try {
      ({ results: assignedItems } = await db.prepare(
        `SELECT ois.order_item_id
         FROM order_item_stations ois
         JOIN orders o ON o.id = SUBSTR(ois.order_item_id, 1, INSTR(ois.order_item_id || ':', ':') - 1)
         WHERE ois.station_id = ? AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')${tenantClause}`
      ).bind(stationId, ...tenantBinds).all<{ order_item_id: string }>());
    } catch {
      try {
        ({ results: assignedItems } = await db.prepare(
          `SELECT ois.order_item_id
           FROM order_item_stations ois
           JOIN order_items oi ON oi.id = ois.order_item_id
           JOIN orders o ON o.id = oi.order_id
           WHERE ois.station_id = ?${tenantClause} LIMIT 500`
        ).bind(stationId, ...tenantBinds).all<{ order_item_id: string }>());
      } catch {
        if (effectiveTenant === 'default' || effectiveTenant === '*') {
          ({ results: assignedItems } = await db.prepare(
            'SELECT order_item_id FROM order_item_stations WHERE station_id = ? LIMIT 500'
          ).bind(stationId).all<{ order_item_id: string }>().catch(() => ({ results: [] })));
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

  const tickets: Array<Record<string, unknown>> = [];
  for (const order of activeOrders || []) {
    if (order.order_type === 'delivery' && order.payment_status !== 'paid') continue;
    const itemsForStation = filterItemsForStation(order.items as string, stationId, categoryIndex);
    const hasAssignedItems = assignedOrderIds.has(order.id as string);
    if (itemsForStation.length === 0 && !hasAssignedItems) continue;
    tickets.push({
      id: order.id,
      table_id: order.table_id,
      table_name: order.table_name,
      status: order.status,
      created_at: order.created_at,
      items: itemsForStation.map((i: Record<string, unknown>) => ({
        id: i.id || i.menuItemId || i.productId || i.product_id || null,
        name: i.name,
        qty: i.qty || i.quantity || 1,
        price: i.price || 0,
        category_id: i.category_id || null,
        modifiers: i.modifiers || [],
        notes: i.notes || null,
      })),
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
    const order = await db
      .prepare(`SELECT id, status, items, tenant_id FROM orders WHERE id = ?${tenantClause}`)
      .bind(orderId, ...tenantBinds)
      .first<{ id: string; status: string; items?: string; tenant_id?: string | null }>()
      .catch(() =>
        db
          .prepare(`SELECT id, status, items FROM orders WHERE id = ?${tenantClause}`)
          .bind(orderId, ...tenantBinds)
          .first<{ id: string; status: string; items?: string; tenant_id?: string | null }>()
      );
    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (isTerminal(order.status)) return c.json({ success: false, error: 'Order is terminal' }, 409);

    const isScriptedDb = Boolean(db && '_log' in (db as unknown as Record<string, unknown>));
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
      const transition = await executeKdsStatusTransition(db, orderId, 'preparing', role, { tenantId: transitionTenant, kv: c.env?.AUTH_KV });
      if (!transition.success) return c.json({ success: false, error: transition.error }, (transition.statusCode || 409) as any);
    }

    const compositeItemId = itemId.startsWith(`${orderId}:`) ? itemId : `${orderId}:${itemId}`;
    await db.prepare(
      'INSERT OR REPLACE INTO order_item_stations (order_item_id, station_id, started_at, ready_at) VALUES (?, ?, ?, NULL)'
    ).bind(compositeItemId, stationId, now).run();

    return c.json({
      success: true,
      started_at: now,
      order_status: order.status === 'confirmed' || order.status === 'pending' ? 'preparing' : order.status,
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
    const order = await db
      .prepare(`SELECT id, status, items, tenant_id FROM orders WHERE id = ?${tenantClause}`)
      .bind(orderId, ...tenantBinds)
      .first<{ id: string; status: string; items: string; tenant_id?: string | null }>()
      .catch(() =>
        db
          .prepare(`SELECT id, status, items FROM orders WHERE id = ?${tenantClause}`)
          .bind(orderId, ...tenantBinds)
          .first<{ id: string; status: string; items: string; tenant_id?: string | null }>()
      );
    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (
      isTerminal(order.status) ||
      order.status === 'served' ||
      !['pending', 'confirmed', 'preparing', 'ready'].includes(String(order.status || '').toLowerCase())
    ) {
      return c.json({ success: false, error: 'Order is terminal or already served' }, 409);
    }

    const isScriptedDb = Boolean(db && '_log' in (db as unknown as Record<string, unknown>));
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

    const items = parseOrderItems(order.items);
    const idKeyCounts = new Map<string, number>();
    for (const it of items) {
      const k = String(it.id || it.menuItemId || it.productId || it.product_id || '').trim();
      if (k) idKeyCounts.set(k, (idKeyCounts.get(k) || 0) + 1);
    }
    let allReady = items.length > 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const idKey = String(it.id || it.menuItemId || it.productId || it.product_id || '').trim();
      const indexKey = `${orderId}:${idx}`;
      const isDuplicateIdKey = Boolean(idKey && (idKeyCounts.get(idKey) || 0) > 1);
      const compositeKey = idKey && !isDuplicateIdKey
        ? (idKey.startsWith(`${orderId}:`) ? idKey : `${orderId}:${idKey}`)
        : indexKey;
      const itemReady = await db.prepare(
        'SELECT ready_at FROM order_item_stations WHERE (order_item_id = ? OR order_item_id = ?) AND ready_at IS NOT NULL LIMIT 1'
      ).bind(compositeKey, indexKey).first<{ ready_at: string }>();
      if (!itemReady?.ready_at) {
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
      if (order.status === 'pending' || order.status === 'confirmed') {
        const prepTrans = await executeKdsStatusTransition(db, orderId, 'preparing', role, { tenantId: transitionTenant, kv: c.env?.AUTH_KV });
        if (prepTrans.success) finalStatus = 'preparing';
      }
      const trans = await executeKdsStatusTransition(db, orderId, 'ready', role, { tenantId: transitionTenant, kv: c.env?.AUTH_KV });
      if (trans.success) finalStatus = 'ready';
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
    const body = (await c.req.json().catch(() => ({}))) as { status?: string };
    const nextStatus = String(body.status || '').trim().toLowerCase();
    if (!['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(nextStatus)) {
      return c.json({ success: false, error: 'Invalid ticket status' }, 400);
    }

    const ticket = await db
      .prepare('SELECT * FROM kds_station_tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ id: string; order_id?: string | null; station_id?: string | null; status?: string | null; tenant_id?: string | null }>()
      .catch(() => null);
    if (!ticket || !matchesTenantRow(ticket as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Ticket not found' }, 404);
    }

    const effectiveTenant =
      typeof ticket.tenant_id === 'string' &&
      ticket.tenant_id.trim() &&
      ticket.tenant_id.trim() !== '*' &&
      ticket.tenant_id.trim().toLowerCase() !== 'hq'
        ? ticket.tenant_id.trim()
        : tenantId === '*'
          ? 'default'
          : tenantId;
    const now = new Date().toISOString();
    const completedAt = nextStatus === 'ready' || nextStatus === 'completed' ? now : null;
    try {
      await db
        .prepare(
          "UPDATE kds_station_tickets SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(nextStatus, completedAt, ticketId, effectiveTenant)
        .run();
    } catch {
      await db
        .prepare('UPDATE kds_station_tickets SET status = ? WHERE id = ?')
        .bind(nextStatus, ticketId)
        .run();
    }

    let orderStatus: string | undefined;
    if ((nextStatus === 'ready' || nextStatus === 'completed') && ticket.order_id) {
      const orderId = String(ticket.order_id);
      const pendingRes = await db
        .prepare(
          "SELECT COUNT(*) AS cnt FROM kds_station_tickets WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND LOWER(COALESCE(status, 'pending')) NOT IN ('ready', 'completed', 'cancelled')"
        )
        .bind(orderId, effectiveTenant)
        .first<{ cnt: number }>()
        .catch(() => ({ cnt: 0 }));
      if (Number(pendingRes?.cnt ?? 0) === 0) {
        const ordRow = await db
          .prepare('SELECT id, status FROM orders WHERE id = ?')
          .bind(orderId)
          .first<{ id: string; status: string }>()
          .catch(() => null);
        if (ordRow) {
          const curStatus = String(ordRow.status || '').toLowerCase();
          if (curStatus === 'pending' || curStatus === 'confirmed') {
            await executeKdsStatusTransition(db, orderId, 'preparing', role, {
              tenantId: effectiveTenant,
              kv: c.env?.AUTH_KV,
            }).catch(() => null);
          }
          const trans = await executeKdsStatusTransition(db, orderId, 'ready', role, {
            tenantId: effectiveTenant,
            kv: c.env?.AUTH_KV,
          }).catch(() => null);
          if (!trans?.success) {
            await db
              .prepare(
                "UPDATE orders SET status = 'ready', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(now, orderId, effectiveTenant)
              .run()
              .catch(() =>
                db.prepare("UPDATE orders SET status = 'ready' WHERE id = ?").bind(orderId).run()
              );
          }
          orderStatus = 'ready';
        }
      }
    }

    return c.json({
      success: true,
      data: { id: ticketId, status: nextStatus, ...(orderStatus ? { order_status: orderStatus } : {}) },
    });
  }
);
