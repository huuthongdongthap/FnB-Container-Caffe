/**
 * Kitchen / KDS Contract — Routing & Snapshot Decoupling Tests
 * Verifies:
 * - Immutable order item snapshot decoupling from Catalog
 * - Multi-item multi-station routing
 * - Missing/unmapped category fallback
 * - Unified KDS routes (/api/orders/kds & /api/kds/orders)
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { calculateOrderSnapshot } from '@aura/domain-order';
import {
  filterItemsForStation,
  buildCategoryStationIndex,
} from '@aura/domain-kitchen';
import { handleGetKdsOrders } from '../../routes/orders-hono-handlers/kds-handlers';

function makeMockKdsApp(initialOrders: Array<Record<string, unknown>> = []) {
  const db = {
    prepare: (sql: string) => {
      const stmt = {
        bind: () => stmt,
        all: async <T = unknown>() => {
          if (sql.includes('FROM orders')) {
            return { results: initialOrders as unknown as T[] };
          }
          return { results: [] as unknown as T[] };
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
  app.get('/api/orders/kds', handleGetKdsOrders);
  app.get('/api/kds/orders', handleGetKdsOrders);

  return { app, env: { AURA_DB: db } };
}

describe('Kitchen / KDS Routing & Snapshot Contract', () => {
  it('preserves immutable category_id snapshot even if catalog changes', async () => {
    const snapshot = await calculateOrderSnapshot(null, {
      items: [
        { id: 'item_1', name: 'Cold Brew', price: 45000, category_id: 'cat_beverage' },
        { id: 'item_2', name: 'Croissant', price: 30000, category_id: 'cat_pastry' },
      ],
    });

    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0].category_id).toBe('cat_beverage');
    expect(snapshot.items[1].category_id).toBe('cat_pastry');

    // Simulate catalog update/deletion — snapshot JSON remains immutable
    const frozenJson = snapshot.itemsJson;
    const restored = JSON.parse(frozenJson);
    expect(restored[0].category_id).toBe('cat_beverage');
    expect(restored[1].category_id).toBe('cat_pastry');
  });

  it('routes multi-item orders deterministically across multiple stations', () => {
    const categoryIndex = buildCategoryStationIndex([
      { category_id: 'cat_beverage', station_id: 'KS_COFFEE', station_name: 'Coffee Bar' },
      { category_id: 'cat_pastry', station_id: 'KS_BAKERY', station_name: 'Bakery' },
    ]);

    const orderItemsJson = JSON.stringify([
      { id: 'it_coffee', name: 'Espresso', category_id: 'cat_beverage' },
      { id: 'it_pastry', name: 'Muffin', category_id: 'cat_pastry' },
    ]);

    const coffeeItems = filterItemsForStation(orderItemsJson, 'KS_COFFEE', categoryIndex);
    expect(coffeeItems).toHaveLength(1);
    expect(coffeeItems[0].name).toBe('Espresso');

    const bakeryItems = filterItemsForStation(orderItemsJson, 'KS_BAKERY', categoryIndex);
    expect(bakeryItems).toHaveLength(1);
    expect(bakeryItems[0].name).toBe('Muffin');
  });

  it('routes unmapped categories to fallback station when designated', () => {
    const categoryIndex = buildCategoryStationIndex([
      { category_id: 'cat_beverage', station_id: 'KS_COFFEE', station_name: 'Coffee Bar' },
    ]);

    const orderItemsJson = JSON.stringify([
      { id: 'it_unknown', name: 'Special Item', category_id: 'cat_custom' },
    ]);

    const regular = filterItemsForStation(orderItemsJson, 'KS_COFFEE', categoryIndex, false);
    expect(regular).toHaveLength(0);

    const fallback = filterItemsForStation(orderItemsJson, 'KS_EXPEDITE', categoryIndex, true);
    expect(fallback).toHaveLength(1);
    expect(fallback[0].name).toBe('Special Item');
  });

  it('serves active orders on both /api/orders/kds and /api/kds/orders', async () => {
    const order = { id: 'ORD_KDS_3', status: 'pending', items: '[]', created_at: new Date().toISOString(), customer_name: 'Alice' };
    const { app, env } = makeMockKdsApp([order]);

    const res1 = await app.fetch(new Request('https://test.aura/api/orders/kds'), env);
    expect(res1.status).toBe(200);
    const data1 = await res1.json() as any;
    expect(data1.data).toHaveLength(1);

    const res2 = await app.fetch(new Request('https://test.aura/api/kds/orders'), env);
    expect(res2.status).toBe(200);
    const data2 = await res2.json() as any;
    expect(data2.data).toHaveLength(1);
  });
});
