/**
 * Kitchen / KDS Contract — Lifecycle & Item State Machine Tests
 * Verifies:
 * - Multi-item READY coordination
 * - KDS status transition canonical validation & idempotency
 * - Role authorization enforcement
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { stationTicketsRouter, executeKdsStatusTransition } from '@aura/domain-kitchen';
import { handleUpdateOrderStatus } from '../../routes/orders-hono-handlers/kds-handlers';

function makeMockLifecycleDb(initialOrders: Array<Record<string, unknown>> = []) {
  const orders = [...initialOrders];
  const itemStations: Array<{ order_item_id: string; station_id: string; started_at?: string; ready_at?: string | null }> = [];

  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => { binds = args; return stmt; },
        first: async <T = unknown>() => {
          if (sql.includes('FROM kitchen_stations WHERE id = ?')) return { id: binds[0] as string } as T;
          if (sql.includes('FROM orders WHERE id = ?')) return orders.find(o => o.id === binds[0]) as T || null as T;
          if (sql.includes('FROM order_item_stations WHERE') && sql.includes('ready_at IS NOT NULL')) {
            const [id1, id2] = binds as [string, string];
            return itemStations.find(s => (s.order_item_id === id1 || s.order_item_id === id2) && s.ready_at) as T || null as T;
          }
          return null as T;
        },
        all: async <T = unknown>() => ({ results: [] as unknown as T[] }),
        run: async () => {
          if (sql.includes('UPDATE orders SET status = ?')) {
            const [targetStatus, , orderId] = binds as [string, string, string];
            const o = orders.find(x => x.id === orderId);
            if (o) o.status = targetStatus;
          }
          if (sql.includes('INSERT OR REPLACE INTO order_item_stations')) {
            const [itemId, stationId, now] = binds as [string, string, string];
            const ex = itemStations.find(x => x.order_item_id === itemId && x.station_id === stationId);
            if (ex) { ex.started_at = now; } else itemStations.push({ order_item_id: itemId, station_id: stationId, started_at: now, ready_at: null });
          }
          if (sql.includes('UPDATE order_item_stations SET ready_at = ?')) {
            const [now, itemId, stationId] = binds as [string, string, string];
            const ex = itemStations.find(x => x.order_item_id === itemId && x.station_id === stationId);
            if (ex) { ex.ready_at = now; } else itemStations.push({ order_item_id: itemId, station_id: stationId, ready_at: now });
          }
          return { success: true, changes: 1 };
        },
      };
      return stmt as any;
    },
  };

  const app = new Hono<{ Bindings: any }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'usr_staff', role: 'staff' });
    await next();
  });
  app.route('/kitchen-stations', stationTicketsRouter);
  app.patch('/kds/:id/status', handleUpdateOrderStatus);

  return { app, db, orders, itemStations };
}

describe('Kitchen / KDS Lifecycle & Coordination Contract', () => {
  it('coordinates multi-item ready transition without premature completion', async () => {
    const multiItemOrder = {
      id: 'ORD_MULTI_1',
      status: 'confirmed',
      items: JSON.stringify([
        { id: 'it_coffee', name: 'Espresso', category_id: 'cat_beverage' },
        { id: 'it_pastry', name: 'Muffin', category_id: 'cat_pastry' },
      ]),
      created_at: new Date().toISOString(),
    };

    const { app, db, orders } = makeMockLifecycleDb([multiItemOrder]);
    const env = { AURA_DB: db };

    // 1. Start coffee item -> order moves confirmed -> preparing
    const startRes = await app.fetch(
      new Request('https://test.aura/kitchen-stations/tickets/ORD_MULTI_1/items/it_coffee/start?station_id=KS_COFFEE', { method: 'POST' }),
      env
    );
    expect(startRes.status).toBe(200);
    expect(orders[0].status).toBe('preparing');

    // 2. Coffee station marks item ready -> bakery item is NOT ready yet -> order remains preparing
    const ready1Res = await app.fetch(
      new Request('https://test.aura/kitchen-stations/tickets/ORD_MULTI_1/items/it_coffee/ready?station_id=KS_COFFEE', { method: 'POST' }),
      env
    );
    expect(ready1Res.status).toBe(200);
    const body1 = await ready1Res.json() as any;
    expect(body1.all_items_ready).toBe(false);
    expect(orders[0].status).toBe('preparing');

    // 3. Bakery station marks item ready -> all items now ready -> order advances to ready
    const ready2Res = await app.fetch(
      new Request('https://test.aura/kitchen-stations/tickets/ORD_MULTI_1/items/it_pastry/ready?station_id=KS_BAKERY', { method: 'POST' }),
      env
    );
    expect(ready2Res.status).toBe(200);
    const body2 = await ready2Res.json() as any;
    expect(body2.all_items_ready).toBe(true);
    expect(orders[0].status).toBe('ready');
  });

  it('enforces canonical state machine & idempotency on direct KDS transitions', async () => {
    const order = { id: 'ORD_KDS_1', status: 'preparing', items: '[]', created_at: new Date().toISOString() };
    const { app, db } = makeMockLifecycleDb([order]);
    const env = { AURA_DB: db };

    // Valid forward transition preparing -> ready
    const res = await app.fetch(
      new Request('https://test.aura/kds/ORD_KDS_1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      }),
      env
    );
    expect(res.status).toBe(200);

    // Duplicate transition ready -> ready is idempotent
    const resIdemp = await app.fetch(
      new Request('https://test.aura/kds/ORD_KDS_1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      }),
      env
    );
    expect(resIdemp.status).toBe(200);
    const bodyIdemp = await resIdemp.json() as any;
    expect(bodyIdemp.idempotent).toBe(true);
  });

  it('rejects illegal transitions and unauthorized roles via canonical runner', async () => {
    const order = { id: 'ORD_KDS_2', status: 'confirmed', items: '[]', created_at: new Date().toISOString() };
    const { db } = makeMockLifecycleDb([order]);

    // Customer role cannot transition order to preparing (403 Forbidden)
    const customerRes = await executeKdsStatusTransition(db, 'ORD_KDS_2', 'preparing', 'customer');
    expect(customerRes.success).toBe(false);
    expect(customerRes.statusCode).toBe(403);

    // Illegal skip confirmed -> completed rejected (400 Bad Request)
    const skipRes = await executeKdsStatusTransition(db, 'ORD_KDS_2', 'completed', 'staff');
    expect(skipRes.success).toBe(false);
    expect(skipRes.statusCode).toBe(400);
  });
});
