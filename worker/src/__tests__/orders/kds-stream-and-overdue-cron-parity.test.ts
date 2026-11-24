// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { kdsStreamRouter } from '@aura/domain-kitchen';
import { checkOverdueOrders } from '../../routes/cron-handlers/order-checks';
import { generateJWT } from '../../lib/jwt';
import { TEST_JWT_SECRET, staffSessionClaims } from '../test-utils';
import type { Env } from '../../types/env';

function createSqliteD1(sqlite: DatabaseSync) {
  const prepare = (sql: string) => {
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
  };
  return {
    prepare,
    batch: async (stmts: Array<{ run(): Promise<unknown> }>) => Promise.all(stmts.map((s) => s.run())),
  };
}

async function readFirstSnapshot(response: Response): Promise<Array<Record<string, unknown>>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const match = buffer.match(/event: snapshot\ndata: ([^\n]+)\n/);
      if (match) {
        return JSON.parse(match[1]!) as Array<Record<string, unknown>>;
      }
    }
  } finally {
    await reader.cancel();
  }
  throw new Error(`No snapshot event received: ${buffer}`);
}

async function issueStaffToken(tenantId = 'store-a') {
  const issuedAt = Math.floor(Date.now() / 1000);
  return generateJWT(
    {
      id: 'staff-1',
      sub: 'staff-1',
      email: 'staff-1@test.aura',
      name: 'Barista',
      role: 'barista',
      tenantId,
      ...staffSessionClaims({ authTime: issuedAt }),
    } as never,
    TEST_JWT_SECRET,
    3600,
    issuedAt,
  );
}

describe('KDS SSE stream parity and cron overdue payment-hold fallbacks', () => {
  it('emits started_at/ready_at, resolves cancelled table_name, and filters cancelled alerts by station', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const nowIso = new Date().toISOString();
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER, auth_version INTEGER);
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
      INSERT INTO users VALUES ('staff-1', 'Barista', NULL, 'barista', 'store-a', 1, 1);
      INSERT INTO cafe_tables VALUES ('tbl-1', 'store-a', 'A-07', 'Bar'), ('tbl-1', 'store-b', 'B-99', 'Foreign');
      INSERT INTO kitchen_stations VALUES ('ks-coffee', 'Coffee', 'store-a'), ('ks-bakery', 'Bakery', 'store-a');
      INSERT INTO category_stations VALUES ('cat-coffee', 'ks-coffee'), ('cat-pastry', 'ks-bakery');
    `);
    sqlite.prepare(`
      INSERT INTO orders (
        id, tenant_id, customer_name, table_id, order_number, items, notes, status,
        order_type, payment_status, payment_method, is_cod, created_at, updated_at, started_at, ready_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ord-coffee', 'store-a', 'An', 'tbl-1', 'ORD-201',
      JSON.stringify([{ name: 'Latte', quantity: 1, category_id: 'cat-coffee' }]), '',
      'ready', 'dine_in', 'paid', 'cash', 0, nowIso, nowIso, nowIso, nowIso,
    );
    sqlite.prepare(`
      INSERT INTO orders (
        id, tenant_id, customer_name, table_id, order_number, items, notes, status,
        order_type, payment_status, payment_method, is_cod, created_at, updated_at,
        cancelled_at, previous_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ord-cancel-pastry', 'store-a', 'Binh', 'tbl-1', 'ORD-202',
      JSON.stringify([{ name: 'Croissant', quantity: 1, category_id: 'cat-pastry' }]), '',
      'cancelled', 'dine_in', 'unpaid', 'cash', 0, nowIso, nowIso, nowIso, 'preparing',
    );
    sqlite.prepare(`
      INSERT INTO orders (
        id, tenant_id, customer_name, table_id, order_number, items, notes, status,
        order_type, payment_status, payment_method, is_cod, created_at, updated_at,
        cancelled_at, previous_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ord-cancel-coffee', 'store-a', 'Chi', 'tbl-1', 'ORD-203',
      JSON.stringify([{ name: 'Espresso', quantity: 1, category_id: 'cat-coffee' }]), '',
      'cancelled', 'dine_in', 'unpaid', 'cash', 0, nowIso, nowIso, nowIso, 'preparing',
    );

    const token = await issueStaffToken('store-a');
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'staff-1', role: 'barista', tenant_id: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    app.route('/api/kds/orders', kdsStreamRouter);

    const env = { AURA_DB: createSqliteD1(sqlite), JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;

    // Station ks-coffee receives coffee active order + coffee cancelled alert only, with table_name and timestamps
    const stationRes = await app.request(
      'http://localhost/api/kds/orders/stream?station_id=ks-coffee',
      { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': 'store-a' } },
      env,
    );
    expect(stationRes.status).toBe(200);
    const stationSnap = await readFirstSnapshot(stationRes);
    expect(stationSnap.map((o) => o.id)).toEqual(['ord-coffee', 'ord-cancel-coffee']);
    expect(stationSnap[0]?.started_at).toBe(nowIso);
    expect(stationSnap[0]?.ready_at).toBe(nowIso);
    expect(stationSnap[1]?.table_name).toBe('A-07');

    // ?station=all returns unfiltered orders + all cancelled alerts
    const allRes = await app.request(
      'http://localhost/api/kds/orders/stream?station=all',
      { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': 'store-a' } },
      env,
    );
    expect(allRes.status).toBe(200);
    const allSnap = await readFirstSnapshot(allRes);
    expect(allSnap.map((o) => o.id)).toEqual(['ord-coffee', 'ord-cancel-pastry', 'ord-cancel-coffee']);
    sqlite.close();
  });

  it('preserves isHeldOutOfKds in SSE stream when schema lacks cafe_tables, order_type, and is_cod', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const nowIso = new Date().toISOString();
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, tenant_id TEXT, is_active INTEGER, auth_version INTEGER);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT, customer_name TEXT, table_id TEXT,
        items TEXT, notes TEXT, status TEXT, payment_status TEXT, payment_method TEXT, created_at TEXT
      );
      INSERT INTO users VALUES ('staff-1', 'Barista', NULL, 'barista', 'store-a', 1, 1);
      INSERT INTO orders VALUES
        ('ord-held-payos', 'store-a', 'Held', 'T1', '[{"name":"Latte","quantity":1}]', '', 'pending', 'unpaid', 'payos', '${nowIso}'),
        ('ord-ready-cash', 'store-a', 'Visible', 'T2', '[{"name":"Latte","quantity":1}]', '', 'pending', 'paid', 'cash', '${nowIso}');
    `);

    const token = await issueStaffToken('store-a');
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'staff-1', role: 'barista', tenant_id: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      await next();
    });
    app.route('/api/kds/orders', kdsStreamRouter);

    const res = await app.request(
      'http://localhost/api/kds/orders/stream',
      { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': 'store-a' } },
      { AURA_DB: createSqliteD1(sqlite), JWT_SECRET: TEST_JWT_SECRET } as unknown as Env,
    );
    expect(res.status).toBe(200);
    const snap = await readFirstSnapshot(res);
    expect(snap.map((o) => o.id)).toEqual(['ord-ready-cash']);
    sqlite.close();
  });

  it('enforces isHeldOutOfKds in checkOverdueOrders on partial schemas missing order_type/is_cod and legacy default schema', async () => {
    const oldIso = new Date(Date.now() - 45 * 60_000).toISOString();

    // Partial tenant schema missing order_type and is_cod
    const partial = new DatabaseSync(':memory:');
    partial.exec(`
      CREATE TABLE _metrics (name TEXT, value REAL, tags TEXT, created_at TEXT);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, tenant_id TEXT, customer_name TEXT, status TEXT,
        created_at TEXT, updated_at TEXT, items TEXT, notes TEXT,
        payment_method TEXT, payment_status TEXT
      );
      INSERT INTO orders VALUES
        ('ord-payos-held', 'store-a', 'Unpaid', 'pending', '${oldIso}', NULL, '[{"name":"Latte"}]', NULL, 'payos', 'unpaid'),
        ('ord-qr-empty', 'store-a', 'QR', 'pending', '${oldIso}', NULL, '[]', 'Khách QR - cho don mon', 'cash', 'unpaid'),
        ('ord-overdue-ok', 'store-a', 'Eligible', 'preparing', '${oldIso}', NULL, '[{"name":"Latte"}]', NULL, 'cash', 'paid');
    `);
    await checkOverdueOrders({ AURA_DB: createSqliteD1(partial) }, 'store-a');
    const partialRows = partial.prepare('SELECT id, notes FROM orders ORDER BY id').all() as Array<{ id: string; notes: string | null }>;
    expect(partialRows).toEqual([
      { id: 'ord-overdue-ok', notes: null },
      { id: 'ord-payos-held', notes: null },
      { id: 'ord-qr-empty', notes: 'Khách QR - cho don mon' },
    ]);
    const partialMetrics = partial.prepare('SELECT name, value, tags FROM _metrics').all() as Array<{ name: string; value: number; tags: string }>;
    expect(partialMetrics).toEqual([
      { name: 'order_stuck', value: 1, tags: JSON.stringify({ tenant_id: 'store-a' }) },
    ]);
    partial.close();

    // Legacy default schema missing tenant_id and is_cod
    const legacy = new DatabaseSync(':memory:');
    legacy.exec(`
      CREATE TABLE _metrics (name TEXT, value REAL, tags TEXT, created_at TEXT);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, customer_name TEXT, status TEXT,
        created_at TEXT, updated_at TEXT, items TEXT, notes TEXT,
        payment_method TEXT, payment_status TEXT
      );
      INSERT INTO orders VALUES
        ('ord-leg-held', 'Held', 'pending', '${oldIso}', NULL, '[{"name":"Latte"}]', NULL, 'payos', 'pending'),
        ('ord-leg-ok', 'Overdue', 'pending', '${oldIso}', NULL, '[{"name":"Latte"}]', NULL, 'cash', 'unpaid');
    `);
    await checkOverdueOrders({ AURA_DB: createSqliteD1(legacy) }, 'default');
    const legacyRows = legacy.prepare('SELECT id, notes FROM orders ORDER BY id').all() as Array<{ id: string; notes: string | null }>;
    expect(legacyRows).toEqual([
      { id: 'ord-leg-held', notes: null },
      { id: 'ord-leg-ok', notes: null },
    ]);
    const legacyMetrics = legacy.prepare('SELECT name, value, tags FROM _metrics').all() as Array<{ name: string; value: number; tags: string }>;
    expect(legacyMetrics).toEqual([
      { name: 'order_stuck', value: 1, tags: JSON.stringify({ tenant_id: 'default' }) },
    ]);
    legacy.close();
  });
});
