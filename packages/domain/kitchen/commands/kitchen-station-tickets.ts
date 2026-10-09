/**
 * Station KDS Tickets & Item Lifecycle Routes
 */

import { Hono } from 'hono';
import type { Env } from 'worker/src/types/env';
import { executeKdsStatusTransition } from './kds-status-transition';
import {
  buildIndexFromDbRows,
  filterItemsForStation,
  parseOrderItems,
} from '../src/policies/station-policy';

export const stationTicketsRouter = new Hono<{ Bindings: Env }>();

stationTicketsRouter.get('/:id/tickets', async (c) => {
  const db = c.env.AURA_DB;
  const stationId = c.req.param('id');
  const station = await db.prepare('SELECT id FROM kitchen_stations WHERE id = ?').bind(stationId).first<{ id: string }>();
  if (!station) return c.json({ success: false, error: 'Station not found' }, 404);

  const { results: mappings } = await db.prepare(
    'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
  ).all<Record<string, unknown>>();
  const categoryIndex = buildIndexFromDbRows(mappings || []);

  const { results: activeOrders } = await db.prepare(
    'SELECT DISTINCT o.id, o.table_id, o.items, o.status, o.created_at, COALESCE(t.table_number, t.id) AS table_name FROM orders o LEFT JOIN cafe_tables t ON t.id = o.table_id WHERE o.status IN (?, ?, ?) ORDER BY o.created_at ASC'
  ).bind('pending', 'preparing', 'ready').all<Record<string, unknown>>();

  const { results: assignedItems } = await db.prepare(
    'SELECT order_item_id FROM order_item_stations WHERE station_id = ?'
  ).bind(stationId).all<{ order_item_id: string }>();
  const assignedOrderIds = new Set(assignedItems?.map((r) => r.order_item_id) || []);

  const tickets: Array<Record<string, unknown>> = [];
  for (const order of activeOrders || []) {
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
        id: i.id || i.menuItemId || i.productId || null,
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

stationTicketsRouter.post('/tickets/:orderId/items/:itemId/start', async (c) => {
  const db = c.env.AURA_DB;
  const orderId = c.req.param('orderId');
  const itemId = c.req.param('itemId');
  const stationId = c.req.query('station_id');
  if (!stationId) return c.json({ success: false, error: 'station_id query param is required' }, 400);

  const order = await db.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first<{ id: string; status: string }>();
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  const now = new Date().toISOString();
  await db.prepare(
    'INSERT OR REPLACE INTO order_item_stations (order_item_id, station_id, started_at, ready_at) VALUES (?, ?, ?, NULL)'
  ).bind(itemId, stationId, now).run();

  if (order.status === 'confirmed') {
    await executeKdsStatusTransition(db, orderId, 'preparing', 'staff');
  }

  return c.json({ success: true, started_at: now, order_status: order.status === 'confirmed' ? 'preparing' : order.status });
});

stationTicketsRouter.post('/tickets/:orderId/items/:itemId/ready', async (c) => {
  const db = c.env.AURA_DB;
  const orderId = c.req.param('orderId');
  const itemId = c.req.param('itemId');
  const stationId = c.req.query('station_id');
  if (!stationId) return c.json({ success: false, error: 'station_id query param is required' }, 400);

  const order = await db.prepare('SELECT id, status, items FROM orders WHERE id = ?').bind(orderId).first<{ id: string; status: string; items: string }>();
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  const now = new Date().toISOString();
  await db.prepare(
    'UPDATE order_item_stations SET ready_at = ? WHERE order_item_id = ? AND station_id = ?'
  ).bind(now, itemId, stationId).run();

  const items = parseOrderItems(order.items);
  let allReady = items.length > 0;
  for (const it of items) {
    const idKey = (it.id || it.menuItemId || it.productId || '') as string;
    if (!idKey) continue;
    const itemReady = await db.prepare(
      'SELECT ready_at FROM order_item_stations WHERE (order_item_id = ? OR order_item_id = ?) AND ready_at IS NOT NULL LIMIT 1'
    ).bind(idKey, `${orderId}:${idKey}`).first<{ ready_at: string }>();
    if (!itemReady?.ready_at) {
      allReady = false;
      break;
    }
  }

  let finalStatus = order.status;
  if (allReady && (order.status === 'preparing' || order.status === 'confirmed')) {
    const trans = await executeKdsStatusTransition(db, orderId, 'ready', 'staff');
    if (trans.success) finalStatus = 'ready';
  }

  return c.json({ success: true, ready_at: now, all_items_ready: allReady, order_status: finalStatus });
});
