// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { handleGetKdsOrders } from '../../routes/orders-hono-handlers/kds-handlers';
import { transitionOrderStatus } from '@aura/domain-order/policies/order-status-transition';
import type { Env } from '../../types/env';

function createSqliteD1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const statement = {
        bind(...params: unknown[]) {
          bound = params;
          return statement;
        },
        async all<T = Record<string, unknown>>() {
          return { results: sqlite.prepare(sql).all(...(bound as never[])) as T[] };
        },
        async first<T = Record<string, unknown>>() {
          const row = sqlite.prepare(sql).get(...(bound as never[])) as T | undefined;
          return row ?? null;
        },
        async run() {
          const info = sqlite.prepare(sql).run(...(bound as never[]));
          return { success: true, meta: { changes: Number(info.changes ?? 0) } };
        },
      };
      return statement;
    },
  };
}

function buildKdsApp(tenantId = 'store-a') {
  const app = new Hono<{ Bindings: Env }>();
  app.get('/api/kds/orders', (c) => {
    c.set('user' as never, { id: 'staff-1', role: 'barista', tenant_id: tenantId } as never);
    c.set('tenantId' as never, tenantId as never);
    return handleGetKdsOrders(c);
  });
  return app;
}

describe('KDS station normalization, cancelled table_name resolution, and prep timestamps', () => {
  it('treats station=all as unfiltered, preserves tenant-scoped station denial, and resolves table_name on cancelled alerts', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (id TEXT NOT NULL, tenant_id TEXT NOT NULL, table_number TEXT, name TEXT);
      CREATE TABLE kitchen_stations (id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT);
      CREATE TABLE category_stations (category_id TEXT, station_id TEXT);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, customer_name TEXT, table_id TEXT,
        order_number TEXT, items TEXT, notes TEXT, status TEXT, order_type TEXT,
        payment_status TEXT, payment_method TEXT, is_cod INTEGER,
        created_at TEXT, updated_at TEXT, started_at TEXT, ready_at TEXT,
        cancelled_at TEXT, previous_status TEXT
      );
    `);

    const nowIso = new Date().toISOString();
    sqlite.exec(`
      INSERT INTO cafe_tables VALUES ('tbl-1', 'store-a', 'A-12', 'Patio'), ('tbl-1', 'store-b', 'B-99', 'Other');
      INSERT INTO kitchen_stations VALUES ('ks-bar-a', 'Coffee Bar', 'store-a'), ('ks-bar-b', 'Foreign Bar', 'store-b');
      INSERT INTO category_stations VALUES ('cat-coffee', 'ks-bar-a'), ('cat-food', 'ks-bar-b');
    `);
    sqlite.prepare(`
      INSERT INTO orders (
        id, tenant_id, customer_name, table_id, order_number, items, notes, status,
        order_type, payment_status, payment_method, is_cod, created_at, updated_at, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ord-active', 'store-a', 'An', 'tbl-1', 'ORD-101',
      JSON.stringify([{ name: 'Latte', quantity: 1, category_id: 'cat-coffee' }]), '',
      'preparing', 'dine_in', 'paid', 'cash', 0, nowIso, nowIso, nowIso,
    );
    sqlite.prepare(`
      INSERT INTO orders (
        id, tenant_id, customer_name, table_id, order_number, items, notes, status,
        order_type, payment_status, payment_method, is_cod, created_at, updated_at,
        cancelled_at, previous_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ord-cancel', 'store-a', 'Binh', 'tbl-1', 'ORD-102',
      JSON.stringify([{ name: 'Latte', quantity: 1, category_id: 'cat-coffee' }]), '',
      'cancelled', 'dine_in', 'unpaid', 'cash', 0, nowIso, nowIso, nowIso, 'preparing',
    );

    const db = createSqliteD1(sqlite);
    const app = buildKdsApp('store-a');

    // ?station=all and ?station_id=ALL must bypass station filtering and resolve cancelled table_name
    for (const qs of ['?station=all', '?station_id=ALL']) {
      const res = await app.request(
        `http://localhost/api/kds/orders${qs}`,
        { headers: { 'X-Tenant-Id': 'store-a' } },
        { AURA_DB: db } as unknown as Env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string; table_name?: string; started_at?: string }> };
      expect(body.data.map((o) => o.id)).toEqual(['ord-active', 'ord-cancel']);
      expect(body.data[0]?.started_at).toBe(nowIso);
      expect(body.data[1]?.table_name).toBe('A-12');
    }

    // Foreign tenant station returns empty because tenant-scoped mapping query succeeded with 0 matches for ks-bar-b
    const foreignRes = await app.request(
      'http://localhost/api/kds/orders?station_id=ks-bar-b',
      { headers: { 'X-Tenant-Id': 'store-a' } },
      { AURA_DB: db } as unknown as Env,
    );
    expect(foreignRes.status).toBe(200);
    const foreignBody = (await foreignRes.json()) as { data: unknown[] };
    expect(foreignBody.data).toEqual([]);

    sqlite.close();
  });

  it('does not drop orders for non-default tenant when category_stations table is absent', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, customer_name TEXT, table_id TEXT,
        items TEXT, notes TEXT, status TEXT, created_at TEXT
      );
      INSERT INTO orders VALUES (
        'ord-1', 'store-a', 'An', 'T1', '[{"name":"Espresso","quantity":1,"category_id":"cat-coffee"}]',
        '', 'pending', '2026-11-24T01:00:00Z'
      );
    `);

    const db = createSqliteD1(sqlite);
    const app = buildKdsApp('store-a');
    const res = await app.request(
      'http://localhost/api/kds/orders?station_id=ks-bar',
      { headers: { 'X-Tenant-Id': 'store-a' } },
      { AURA_DB: db } as unknown as Env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((o) => o.id)).toEqual(['ord-1']);
    sqlite.close();
  });

  it('persists started_at and ready_at via COALESCE and falls back cleanly on minimal schemas', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT, status TEXT, order_type TEXT,
        payment_status TEXT, payment_method TEXT, is_cod INTEGER,
        updated_at TEXT, started_at TEXT, ready_at TEXT
      );
      INSERT INTO orders VALUES ('ord-ts', 'store-a', 'pending', 'dine_in', 'paid', 'cash', 0, NULL, NULL, NULL);
    `);
    const db = createSqliteD1(sqlite);

    const startRes = await transitionOrderStatus(db as never, 'ord-ts', 'preparing', 'barista', { tenantId: 'store-a' });
    expect(startRes.success).toBe(true);
    const afterStart = sqlite.prepare('SELECT status, started_at, ready_at FROM orders WHERE id = ?').get('ord-ts') as {
      status: string; started_at: string | null; ready_at: string | null;
    };
    expect(afterStart.status).toBe('preparing');
    expect(afterStart.started_at).toBeTruthy();
    expect(afterStart.ready_at).toBeNull();

    const readyRes = await transitionOrderStatus(db as never, 'ord-ts', 'ready', 'barista', { tenantId: 'store-a' });
    expect(readyRes.success).toBe(true);
    const afterReady = sqlite.prepare('SELECT status, started_at, ready_at FROM orders WHERE id = ?').get('ord-ts') as {
      status: string; started_at: string | null; ready_at: string | null;
    };
    expect(afterReady.status).toBe('ready');
    expect(afterReady.started_at).toBe(afterStart.started_at);
    expect(afterReady.ready_at).toBeTruthy();

    // Existing started_at is preserved via COALESCE
    sqlite.exec(`
      INSERT INTO orders VALUES ('ord-existing-ts', 'store-a', 'confirmed', 'dine_in', 'paid', 'cash', 0, NULL, '2026-11-24T00:00:00.000Z', NULL);
    `);
    const preserveRes = await transitionOrderStatus(db as never, 'ord-existing-ts', 'preparing', 'barista', { tenantId: 'store-a' });
    expect(preserveRes.success).toBe(true);
    const preserved = sqlite.prepare('SELECT started_at FROM orders WHERE id = ?').get('ord-existing-ts') as { started_at: string };
    expect(preserved.started_at).toBe('2026-11-24T00:00:00.000Z');
    sqlite.close();

    // Minimal schema without started_at / ready_at columns
    const minimal = new DatabaseSync(':memory:');
    minimal.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, tenant_id TEXT, status TEXT, updated_at TEXT);
      INSERT INTO orders VALUES ('ord-min', 'store-a', 'confirmed', NULL);
    `);
    const minRes = await transitionOrderStatus(createSqliteD1(minimal) as never, 'ord-min', 'preparing', 'barista', {
      tenantId: 'store-a',
    });
    expect(minRes.success).toBe(true);
    const minRow = minimal.prepare('SELECT status FROM orders WHERE id = ?').get('ord-min') as { status: string };
    expect(minRow.status).toBe('preparing');
    minimal.close();
  });
});
