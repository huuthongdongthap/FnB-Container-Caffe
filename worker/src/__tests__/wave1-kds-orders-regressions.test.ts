// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import app from '../index';
import type { Env } from '../types/env';
import { OrderBroadcaster } from '../do/OrderBroadcaster';
import type { D1Database } from '@cloudflare/workers-types';
import { checkOverdueOrders } from '../routes/cron-handlers/order-checks';
import { isHeldOutOfKds, isPaidPaymentStatus, isCodOrCashDelivery } from '../../../packages/domain/kitchen';
import {
  createOrder,
  updateOrder,
  splitOrders,
  getAdminOrders,
  getOrder,
} from '../../../packages/domain/order';
import { transitionOrderStatus } from '../../../packages/domain/order/policies/order-status-transition';
import { executeKdsStatusTransition, stationTicketsRouter, getKdsMobile } from '../../../packages/domain/kitchen';
import { reconcilePayOSPayment } from '../../../packages/domain/payment/commands/payos-reconcile';

const TEST_JWT_SECRET = 'wave1-kds-orders-regression-secret-32chars!';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        return col ? ((row[col] as T) ?? null) : (row as unknown as T);
      },
      async all<T = Record<string, unknown>>() {
        return { results: sqlite.prepare(sql).all(...(params as never[])) as unknown as T[], success: true };
      },
      async run() {
        const info = sqlite.prepare(sql).run(...(params as never[]));
        return {
          success: true,
          meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
        };
      },
    };
    return stmt;
  };
  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => Promise.all(stmts.map((s) => s.run())),
  } as unknown as D1Database;
}

function createProductionSchemaDb() {
  const sqlite = new DatabaseSync(':memory:');
  const schemaSql = readFileSync(resolve(__dirname, '../../schema.sql'), 'utf8');
  sqlite.exec(schemaSql);
  return { sqlite, db: createSqliteD1(sqlite) };
}

function createMemoryKv() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, val: string) => {
      store.set(key, val);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return { kv, store };
}

function createInMemoryBroadcasterNamespace() {
  const instances = new Map<string, OrderBroadcaster>();
  const calls: Array<{ channel: string; url: string; method: string }> = [];
  const getOrCreate = (channel: string) => {
    let inst = instances.get(channel);
    if (!inst) {
      const storageMap = new Map<string, unknown>();
      inst = new OrderBroadcaster({
        storage: {
          get: async <T>(k: string) => structuredClone(storageMap.get(k)) as T | undefined,
          put: async (k: string, v: unknown) => {
            storageMap.set(k, structuredClone(v));
          },
        },
        blockConcurrencyWhile: async <T>(cb: () => Promise<T>) => cb(),
      } as unknown as DurableObjectState);
      instances.set(channel, inst);
    }
    return inst;
  };
  return {
    instances,
    calls,
    namespace: {
      idFromName: (name: string) => name as unknown as DurableObjectId,
      get: (id: unknown) => {
        const channel = String(id);
        const inst = getOrCreate(channel);
        return {
          fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
            const req = input instanceof Request ? input : new Request(String(input), init);
            calls.push({ channel, url: req.url, method: req.method });
            return inst.fetch(req);
          },
        };
      },
    },
  };
}

function seedStaffAccount(
  sqlite: DatabaseSync,
  id: string,
  role: string,
  tenantId: string = 'default',
) {
  sqlite
    .prepare(
      `INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))`,
    )
    .run(id, `Staff ${id}`, `${id}@aura.test`, role, tenantId);
}

async function signStaffJwt(id: string, role: string, tenantId: string = 'default'): Promise<string> {
  const encoder = new TextEncoder();
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const b64Bytes = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    id,
    sub: id,
    role,
    tenantId,
    authVersion: 1,
    authTime: now,
    sessionType: 'staff-web',
    iat: now,
    exp: now + 3600,
  })}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TEST_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
  return `${data}.${b64Bytes(sig)}`;
}

async function readFirstSseSnapshot(res: Response): Promise<Array<Record<string, unknown>>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (let i = 0; i < 8; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const idx = buf.indexOf('\n\n');
      if (idx !== -1) {
        const frame = buf.slice(0, idx);
        const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
        if (dataLine) {
          return JSON.parse(dataLine.slice(5).trim()) as Array<Record<string, unknown>>;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return [];
}

describe('Wave 1 KDS & Orders Regressions (#213, #216, #219, #220, #221, #235)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('#219 & #235: persists cancel_alert + previous_status + cancelled_at + failure_reason on real production schema and surfaces cancel_alert across REST, SSE, and Mobile KDS', async () => {
    const { sqlite, db } = createProductionSchemaDb();
    const { kv } = createMemoryKv();
    const { namespace } = createInMemoryBroadcasterNamespace();
    try {
      seedStaffAccount(sqlite, 'mgr-1', 'manager', 'store-a');
      seedStaffAccount(sqlite, 'bar-1', 'barista', 'store-a');
      const env = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: kv,
        ORDER_BROADCASTER: namespace,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_JWT_SECRET: TEST_JWT_SECRET,
        ENVIRONMENT: 'test',
      } as unknown as Env;

      const mgrToken = await signStaffJwt('mgr-1', 'manager', 'store-a');
      const baristaToken = await signStaffJwt('bar-1', 'barista', 'store-a');

      sqlite
        .prepare(
          `INSERT INTO orders (id, order_number, items, total, status, customer_name, customer_phone, payment_method, payment_status, order_type, tenant_id, created_at, updated_at)
           VALUES ('ord-prep-cancel', 'ORD-C01', ?, 45000, 'pending', 'Khách Huỷ', '0901234567', 'cash', 'unpaid', 'dine_in', 'store-a', datetime('now'), datetime('now'))`,
        )
        .run(JSON.stringify([{ id: 'itm-1', name: 'Cà phê sữa đá', quantity: 2, price: 22500 }]));

      // Transition pending -> preparing via canonical status endpoint
      const prepRes = await app.fetch(
        new Request('http://localhost/api/orders/ord-prep-cancel/status', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${baristaToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'preparing' }),
        }),
        env,
      );
      expect(prepRes.status).toBe(200);

      // Cancel order via POST /api/orders/:id/cancel with reason
      const cancelRes = await app.fetch(
        new Request('http://localhost/api/orders/ord-prep-cancel/cancel', {
          method: 'POST',
          headers: { Authorization: `Bearer ${mgrToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Khách đổi ý' }),
        }),
        env,
      );
      expect(cancelRes.status).toBe(200);

      const dbRow = sqlite
        .prepare('SELECT status, previous_status, cancel_alert, cancelled_at, started_at, failure_reason FROM orders WHERE id = ?')
        .get('ord-prep-cancel') as Record<string, unknown>;
      expect(dbRow.status).toBe('cancelled');
      expect(dbRow.previous_status).toBe('preparing');
      expect(Number(dbRow.cancel_alert)).toBe(1);
      expect(typeof dbRow.cancelled_at).toBe('string');
      expect(typeof dbRow.started_at).toBe('string');
      expect(dbRow.failure_reason).toBe('Khách đổi ý');

      // 1. Desktop KDS REST
      const kdsRestRes = await app.fetch(
        new Request('http://localhost/api/kds/orders', {
          headers: { Authorization: `Bearer ${baristaToken}` },
        }),
        env,
      );
      expect(kdsRestRes.status).toBe(200);
      const kdsRestJson = (await kdsRestRes.json()) as { data: Array<Record<string, unknown>> };
      expect(kdsRestJson.data.find((o) => o.id === 'ord-prep-cancel')).toMatchObject({
        id: 'ord-prep-cancel',
        status: 'cancelled',
        cancel_alert: true,
      });

      // 2. Desktop KDS SSE Stream
      const kdsSseRes = await app.fetch(
        new Request('http://localhost/api/kds/orders/stream', {
          headers: { Authorization: `Bearer ${baristaToken}` },
        }),
        env,
      );
      expect(kdsSseRes.status).toBe(200);
      const sseSnap = await readFirstSseSnapshot(kdsSseRes);
      expect(sseSnap.find((o) => o.id === 'ord-prep-cancel')).toMatchObject({
        id: 'ord-prep-cancel',
        status: 'cancelled',
        cancel_alert: true,
      });

      // 3. Mobile KDS
      const mobApp = new Hono<{ Bindings: Env }>();
      mobApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'bar-1', role: 'barista', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      mobApp.get('/mobile/kds/orders', (c) => getKdsMobile(c));
      const mobRes = await mobApp.fetch(new Request('http://localhost/mobile/kds/orders'), env);
      expect(mobRes.status).toBe(200);
      const mobJson = (await mobRes.json()) as { orders: Array<Record<string, unknown>> };
      expect(mobJson.orders.find((o) => o.id === 'ord-prep-cancel')).toMatchObject({
        id: 'ord-prep-cancel',
        cancel_alert: true,
      });
    } finally {
      sqlite.close();
    }
  });

  it('#235: Station tickets operate natively without kds_station_tickets and synchronize item-ready progress across station and mobile KDS endpoints', async () => {
    const { sqlite, db } = createProductionSchemaDb();
    const { kv } = createMemoryKv();
    try {
      sqlite.exec(`
        INSERT INTO kitchen_stations (id, name, slug, tenant_id)
        VALUES ('st-espresso', 'Espresso Bar', 'espresso', 'store-a'),
               ('st-bakery', 'Bakery', 'bakery', 'store-a');
        INSERT INTO category_stations (category_id, station_id)
        VALUES ('cat-coffee', 'st-espresso'), ('cat-pastry', 'st-bakery');
      `);
      sqlite
        .prepare(
          `INSERT INTO orders (id, order_number, items, total, status, customer_name, customer_phone, payment_method, payment_status, order_type, tenant_id, created_at, updated_at)
           VALUES ('ord-sync-1', 'ORD-S01', ?, 85000, 'pending', 'Lan', '0909888777', 'cash', 'paid', 'dine_in', 'store-a', datetime('now'), datetime('now'))`,
        )
        .run(
          JSON.stringify([
            { id: 'itm-latte', name: 'Latte', quantity: 1, price: 45000, category_id: 'cat-coffee' },
            { id: 'itm-croissant', name: 'Croissant', quantity: 1, price: 40000, category_id: 'cat-pastry' },
          ]),
        );

      seedStaffAccount(sqlite, 'bar-st', 'barista', 'store-a');
      const env = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: kv,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_JWT_SECRET: TEST_JWT_SECRET,
        ENVIRONMENT: 'test',
      } as unknown as Env;
      const token = await signStaffJwt('bar-st', 'barista', 'store-a');

      const stApp = new Hono<{ Bindings: Env }>();
      stApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'bar-st', role: 'barista', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      stApp.route('/stations', stationTicketsRouter);

      // Start item 0 on espresso station -> GET /:id/tickets returns started_at + status: 'preparing'
      const startRes = await stApp.fetch(
        new Request('http://localhost/stations/tickets/ord-sync-1/items/itm-latte/start?station_id=st-espresso', {
          method: 'POST',
        }),
        env,
      );
      expect(startRes.status).toBe(200);

      const listRes = await stApp.fetch(new Request('http://localhost/stations/st-espresso/tickets'), env);
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as { data: Array<{ ticket_id: string; items: Array<Record<string, unknown>> }> };
      expect(listJson.data).toHaveLength(1);
      expect(listJson.data[0]?.ticket_id).toBe('st-espresso:ord-sync-1');
      expect(listJson.data[0]?.items[0]).toMatchObject({
        id: 'itm-latte',
        status: 'preparing',
      });
      expect(typeof listJson.data[0]?.items[0]?.started_at).toBe('string');

      // Mark item 1 (Croissant) ready via /api/kds/orders/:id/ready (JSON path)
      const kdsItemRes = await app.fetch(
        new Request('http://localhost/api/kds/orders/ord-sync-1/ready', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIndex: 1 }),
        }),
        env,
      );
      expect(kdsItemRes.status).toBe(200);
      const kdsItemJson = (await kdsItemRes.json()) as { all_items_ready: boolean; order_status: string };
      expect(kdsItemJson.all_items_ready).toBe(false);
      expect(kdsItemJson.order_status).toBe('preparing');

      // Now bump espresso station ticket via PATCH /stations/tickets/st-espresso:ord-sync-1/status -> auto-ready triggers!
      const bumpRes = await stApp.fetch(
        new Request('http://localhost/stations/tickets/st-espresso:ord-sync-1/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ready' }),
        }),
        env,
      );
      expect(bumpRes.status).toBe(200);
      const bumpJson = (await bumpRes.json()) as { data: { order_status: string } };
      expect(bumpJson.data.order_status).toBe('ready');

      const finalOrder = sqlite.prepare('SELECT status, ready_at FROM orders WHERE id = ?').get('ord-sync-1') as {
        status: string;
        ready_at: string | null;
      };
      expect(finalOrder.status).toBe('ready');
      expect(typeof finalOrder.ready_at).toBe('string');
    } finally {
      sqlite.close();
    }
  });

  it('#219 & #235: fans out OrderBroadcaster events to store-wide channel and routes /api/realtime/{kds,orders,pos,kitchen} aliases consistently', async () => {
    const { sqlite, db } = createProductionSchemaDb();
    const { kv } = createMemoryKv();
    const { namespace, instances } = createInMemoryBroadcasterNamespace();
    try {
      sqlite.exec(`
        INSERT INTO categories (id, name, slug, tenant_id)
        VALUES ('cat-1', 'Coffee', 'coffee', 'store-a');
      `);
      sqlite
        .prepare(
          `INSERT INTO products (id, name, slug, price, category_id, available, tenant_id)
           VALUES ('prod-cf', 'Espresso', 'espresso', 35000, 'cat-1', 1, 'store-a'),
                  ('prod-def', 'Americano', 'americano', 30000, 'cat-1', 1, 'default')`,
        )
        .run();
      seedStaffAccount(sqlite, 'staff-def', 'barista', 'default');
      seedStaffAccount(sqlite, 'staff-sa', 'manager', 'store-a');
      const env = {
        AURA_DB: db,
        DB: db,
        AUTH_KV: kv,
        ORDER_BROADCASTER: namespace,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_JWT_SECRET: TEST_JWT_SECRET,
        ENVIRONMENT: 'test',
      } as unknown as Env;

      const defToken = await signStaffJwt('staff-def', 'barista', 'default');
      const saToken = await signStaffJwt('staff-sa', 'manager', 'store-a');

      // Default tenant store-wide aliases (/api/realtime/kds, /orders, /pos, /kitchen) all succeed (200) and map to 'kitchen'
      for (const alias of ['kds', 'orders', 'pos', 'kitchen']) {
        const wsRes = await app.fetch(
          new Request(`http://localhost/api/realtime/${alias}`, {
            headers: { Authorization: `Bearer ${defToken}` },
          }),
          env,
        );
        expect(wsRes.status).toBe(200);
      }
      expect(instances.has('kitchen')).toBe(true);

      // Non-default tenant store-wide aliases (/api/realtime/store-a:kds, /store-a:orders) map to 'store-a:kitchen'
      for (const alias of ['store-a:kds', 'store-a:orders', 'store-a:kitchen']) {
        const wsRes = await app.fetch(
          new Request(`http://localhost/api/realtime/${alias}`, {
            headers: { Authorization: `Bearer ${saToken}` },
          }),
          env,
        );
        expect(wsRes.status).toBe(200);
      }
      expect(instances.has('store-a:kitchen')).toBe(true);

      // Creating an order in store-a fans out to BOTH 'store-a:<orderId>' and 'store-a:kitchen'
      const createRes = await createOrder(
        new Request('http://localhost/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Minh',
            customer_phone: '0901112222',
            payment_method: 'cod',
            order_type: 'takeaway',
            total: 35000,
            items: [{ product_id: 'prod-cf', name: 'Espresso', price: 35000, quantity: 1 }],
          }),
        }),
        env as unknown as Record<string, unknown>,
        undefined,
        { id: 'staff-sa', role: 'manager', tenantId: 'store-a' },
      );
      expect(createRes.status).toBe(201);
      const createdBody = (await createRes.json()) as { order?: { id: string; order_number: string }; data?: { id: string; order_number: string } };
      const createdOrder = (createdBody.order ?? createdBody.data)!;
      expect(createdOrder.order_number).toMatch(/^ORD-[A-Z0-9]{4,}$/);
      expect(instances.get(`store-a:${createdOrder.id}`)?.getState(0)).toHaveLength(1);
      expect(instances.get('store-a:kitchen')?.getState(0, 'store-a')).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it('#219: rejects splitting orders already in preparing/ready/served (409) and unifies cancel side-effects in executeKdsStatusTransition', async () => {
    const { sqlite, db } = createProductionSchemaDb();
    try {
      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, table_number, name, zone, status, capacity, tenant_id)
           VALUES ('tbl-1', 1, 'Bàn 1', 'Garden', 'Occupied', 4, 'default')`,
        )
        .run();
      sqlite.exec(`
        INSERT INTO categories (id, name, slug, tenant_id)
        VALUES ('cat-1', 'Coffee', 'coffee', 'default');
      `);
      sqlite
        .prepare(
          `INSERT INTO products (id, name, slug, price, category_id, available, tenant_id)
           VALUES ('prod-1', 'Latte', 'latte', 40000, 'cat-1', 1, 'default')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO orders (id, order_number, items, total, status, customer_name, customer_phone, payment_method, payment_status, table_id, tenant_id)
           VALUES ('ord-in-prep', 'ORD-P01', '[]', 80000, 'preparing', 'An', '0901234567', 'cod', 'unpaid', 'tbl-1', 'default')`,
        )
        .run();

      const splitRes = await splitOrders(
        new Request('http://localhost/api/orders/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parent_order_id: 'ord-in-prep',
            table_id: 'tbl-1',
            orders: [
              { customer_name: 'A', customer_phone: '0901234567', payment_method: 'cod', items: [{ product_id: 'prod-1', name: 'Latte', quantity: 1, price: 40000 }] },
              { customer_name: 'B', customer_phone: '0901234568', payment_method: 'cod', items: [{ product_id: 'prod-1', name: 'Latte', quantity: 1, price: 40000 }] },
            ],
          }),
        }),
        { AURA_DB: db },
        undefined,
        { id: 'cashier-1', role: 'cashier', tenantId: 'default' },
      );
      expect(splitRes.status).toBe(409);

      // Verify executeKdsStatusTransition decrements total_spent, refunds loyalty_points_redeemed, and updates table_sessions on paid cancellation
      sqlite
        .prepare(
          `INSERT INTO customers (id, email, name, phone, loyalty_points, total_spent, tenant_id)
           VALUES ('cust-1', 'c1@aura.test', 'Cust 1', '0905556666', 50, 100000, 'default')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO table_sessions (id, table_id, status, order_count, total_amount, current_order_id, tenant_id)
           VALUES ('sess-1', 'tbl-1', 'active', 1, 60000, 'ord-paid-cancel', 'default')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO orders (id, order_number, items, total, status, customer_id, customer_name, customer_phone, payment_method, payment_status, loyalty_points_redeemed, table_id, session_id, tenant_id)
           VALUES ('ord-paid-cancel', 'ORD-PC1', '[]', 60000, 'preparing', 'cust-1', 'Cust 1', '0905556666', 'cash', 'paid', 20, 'tbl-1', 'sess-1', 'default')`,
        )
        .run();

      const cancelKds = await executeKdsStatusTransition(db, 'ord-paid-cancel', 'cancelled', 'manager', {
        tenantId: 'default',
        allowPaidCompensation: true,
      });
      expect(cancelKds.success).toBe(true);

      const custRow = sqlite.prepare('SELECT loyalty_points, total_spent FROM customers WHERE id = ?').get('cust-1') as {
        loyalty_points: number;
        total_spent: number;
      };
      expect(custRow.loyalty_points).toBe(70);
      expect(custRow.total_spent).toBe(40000);

      const sessRow = sqlite.prepare('SELECT order_count, total_amount, current_order_id FROM table_sessions WHERE id = ?').get('sess-1') as {
        order_count: number;
        total_amount: number;
        current_order_id: string | null;
      };
      expect(sessRow.order_count).toBe(0);
      expect(sessRow.total_amount).toBe(0);
      expect(sessRow.current_order_id).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('#220: unifies hold policy (delivery+cash COD, completed paid, fail-closed null payment_status), PayOS reconcile notifications, updateOrder payment_method, and rider list RBAC', async () => {
    // 1. Hold policy unit checks
    expect(isHeldOutOfKds({ order_type: 'delivery', payment_method: 'cash', payment_status: 'unpaid', status: 'pending' })).toBe(false);
    expect(isHeldOutOfKds({ order_type: 'delivery', payment_method: 'payos', payment_status: 'completed', status: 'pending' })).toBe(false);
    expect(isHeldOutOfKds({ order_type: 'takeaway', payment_method: 'payos', payment_status: '', status: 'pending' })).toBe(true);
    expect(isPaidPaymentStatus('completed')).toBe(true);
    expect(isPaidPaymentStatus('partially_refunded')).toBe(true);
    expect(isCodOrCashDelivery({ payment_method: 'cash' })).toBe(true);

    const { sqlite, db } = createProductionSchemaDb();
    try {
      // 2. Fail-closed transition to preparing when payment_status is NULL on PayOS order
      sqlite
        .prepare(
          `INSERT INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, order_type, tenant_id)
           VALUES ('ord-null-pay', '[]', 50000, 'pending', 'Guest', '0901112222', 'payos', NULL, 'takeaway', 'default'),
                  ('ord-deliv-cash', '[]', 50000, 'pending', 'Guest 2', '0901112223', 'payos', 'unpaid', 'delivery', 'default')`,
        )
        .run();

      const blockedPrep = await transitionOrderStatus(db, 'ord-null-pay', 'preparing', 'barista', { tenantId: 'default' });
      expect(blockedPrep.success).toBe(false);
      expect(blockedPrep.statusCode).toBe(409);

      // 3. updateOrder allows switching unpaid delivery order payment_method from payos -> cash and then preparing succeeds
      const switchRes = await updateOrder(
        new Request('http://localhost/api/orders/ord-deliv-cash', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: 'cash' }),
        }),
        { AURA_DB: db },
        'ord-deliv-cash',
        'cashier',
        'default',
      );
      expect(switchRes.status).toBe(200);

      const allowedPrep = await transitionOrderStatus(db, 'ord-deliv-cash', 'preparing', 'barista', { tenantId: 'default' });
      expect(allowedPrep.success).toBe(true);

      // 4. Rider role can read GET /api/orders (not empty WHERE 1=0)
      seedStaffAccount(sqlite, 'rider-1', 'rider', 'default');
      const riderToken = await signStaffJwt('rider-1', 'rider', 'default');
      const riderOrdersRes = await app.fetch(
        new Request('http://localhost/api/orders', {
          headers: { Authorization: `Bearer ${riderToken}` },
        }),
        {
          AURA_DB: db,
          DB: db,
          JWT_SECRET: TEST_JWT_SECRET,
          STAFF_JWT_SECRET: TEST_JWT_SECRET,
          ENVIRONMENT: 'test',
        } as unknown as Env,
      );
      expect(riderOrdersRes.status).toBe(200);
      const riderJson = (await riderOrdersRes.json()) as {
        data?: unknown[] | { orders?: unknown[] };
        orders?: unknown[];
      };
      const list = Array.isArray(riderJson.data)
        ? riderJson.data
        : riderJson.data?.orders ?? riderJson.orders ?? [];
      expect(list.length).toBeGreaterThanOrEqual(2);

      // 5. PayOS reconcile triggers DO fan-out cleanly
      const { namespace, instances } = createInMemoryBroadcasterNamespace();
      sqlite
        .prepare(
          `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, tenant_id)
           VALUES ('pay-null-1', 'ord-null-pay', 'payos', 50000, 'pending', '123456', 'default')`,
        )
        .run();
      const recRes = await reconcilePayOSPayment({
        db,
        env: { ORDER_BROADCASTER: namespace },
        paymentId: 'pay-null-1',
        tenantId: 'default',
        clientId: 'cid',
        apiKey: 'key',
        checksumKey: 'chk',
        source: 'cron',
        preVerified: {
          ok: true,
          status: 'PAID',
          amount: 50000,
          amountPaid: 50000,
          amountRemaining: 0,
          orderCode: 123456,
          id: 'pl_123',
        },
      });
      expect(recRes.ok).toBe(true);
      expect(instances.get('kitchen')?.getState(0)).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it('#221 & #216: exposes full contract fields in admin-orders, fixes order-summary metrics, bounds cron overdue window without [OVERDUE] filter, strips [OVERDUE] on reads, and supports KDS recall', async () => {
    const { sqlite, db } = createProductionSchemaDb();
    try {
      const recentOverdueIso = new Date(Date.now() - 30 * 60_000).toISOString();
      const zombieAncientIso = new Date(Date.now() - 5 * 86_400_000).toISOString();
      const startedIso = new Date(Date.now() - 10 * 60_000).toISOString();
      const readyIso = new Date(Date.now() - 4 * 60_000).toISOString();

      sqlite
        .prepare(
          `INSERT INTO orders (
             id, order_number, items, total, status, customer_name, customer_phone,
             payment_method, payment_status, notes, delivery_time, assigned_shipper_id,
             shipper_name, failure_reason, started_at, ready_at, order_type, tenant_id, created_at, updated_at
           ) VALUES
             ('ord-legacy-tag', 'ORD-T01', '[{"name":"Latte","quantity":1}]', 50000, 'preparing', 'Khách A', '0901111111', 'cash', 'paid', 'Ít đá | [OVERDUE]', '15:00', 'ship-1', 'Anh Tư', NULL, ?, NULL, 'delivery', 'default', ?, ?),
             ('ord-zombie-old', 'ORD-Z99', '[{"name":"Espresso","quantity":1}]', 30000, 'pending', 'Zombie', '0902222222', 'cash', 'unpaid', NULL, 'now', NULL, NULL, NULL, NULL, NULL, 'dine_in', 'default', ?, ?),
             ('ord-done-part', 'ORD-D02', '[{"name":"Matcha","quantity":1}]', 100000, 'ready', 'Khách B', '0903333333', 'payos', 'partially_refunded', '[OVERDUE]', 'now', NULL, NULL, NULL, ?, ?, 'takeaway', 'default', ?, ?),
             ('ord-held-payos', 'ORD-H03', '[{"name":"Trà đào","quantity":1}]', 45000, 'pending', 'Khách Hold', '0904444444', 'payos', 'unpaid', NULL, 'now', NULL, NULL, NULL, NULL, NULL, 'takeaway', 'default', ?, ?)`,
        )
        .run(
          recentOverdueIso, recentOverdueIso, recentOverdueIso,
          zombieAncientIso, zombieAncientIso,
          startedIso, readyIso, startedIso, readyIso,
          startedIso, startedIso,
        );
      sqlite
        .prepare(
          `INSERT INTO payments (id, order_id, method, amount, status, refund_status, refund_amount, tenant_id)
           VALUES ('pay-part-1', 'ord-done-part', 'payos', 100000, 'partially_refunded', 'partial', 25000, 'default')`,
        )
        .run();

      // 1. Cron checkOverdueOrders includes ord-legacy-tag (even though notes had [OVERDUE]) and excludes 5-day-old ord-zombie-old and held ord-held-payos
      await checkOverdueOrders({ AURA_DB: db }, 'default');
      const stuckMetric = sqlite
        .prepare("SELECT value FROM _metrics WHERE name = 'order_stuck' ORDER BY rowid DESC LIMIT 1")
        .get() as { value: number } | undefined;
      expect(stuckMetric?.value).toBe(1);

      // 2. getOrder and getAdminOrders strip [OVERDUE] and expose full allowlisted contract fields
      const singleRes = await getOrder(new Request('http://localhost/api/orders/ord-legacy-tag'), { AURA_DB: db }, 'ord-legacy-tag', 'default');
      const singleJson = (await singleRes.json()) as { order: Record<string, unknown> };
      expect(singleJson.order.notes).toBe('Ít đá');
      expect(singleJson.order.order_number).toBe('ORD-T01');

      const adminRes = await getAdminOrders(new Request('http://localhost/api/admin/orders'), { AURA_DB: db }, 'default');
      const adminJson = (await adminRes.json()) as { orders: Array<Record<string, unknown>> };
      const taggedRow = adminJson.orders.find((o) => o.id === 'ord-legacy-tag')!;
      expect(taggedRow).toMatchObject({
        order_number: 'ORD-T01',
        notes: 'Ít đá',
        delivery_time: '15:00',
        assigned_shipper_id: 'ship-1',
        shipper_name: 'Anh Tư',
      });
      expect(taggedRow).not.toHaveProperty('guest_token_hash');
      const heldRow = adminJson.orders.find((o) => o.id === 'ord-held-payos')!;
      expect(heldRow.is_held_out_of_kds).toBe(true);

      // 3. /api/orders/summary groups ordersByPaymentMethod by payment_method, nets partially_refunded revenue, computes ready_at - started_at lead time (6m), and excludes held orders from kdsByStatus
      seedStaffAccount(sqlite, 'mgr-sum', 'manager', 'default');
      const mgrToken = await signStaffJwt('mgr-sum', 'manager', 'default');
      const env = {
        AURA_DB: db,
        DB: db,
        JWT_SECRET: TEST_JWT_SECRET,
        STAFF_JWT_SECRET: TEST_JWT_SECRET,
        ENVIRONMENT: 'test',
      } as unknown as Env;

      const sumRes = await app.fetch(
        new Request('http://localhost/api/orders/summary', {
          headers: { Authorization: `Bearer ${mgrToken}` },
        }),
        env,
      );
      expect(sumRes.status).toBe(200);
      const sumJson = (await sumRes.json()) as {
        data: {
          totalRevenue: number;
          ordersByPaymentMethod: Record<string, number>;
          avgLeadTimeMinutes: number | null;
          kdsByStatus: Record<string, number>;
          heldOrdersCount: number;
        };
      };
      // 50,000 (ord-legacy-tag paid) + (100,000 - 25,000 = 75,000 net on ord-done-part) = 125,000
      expect(sumJson.data.totalRevenue).toBe(125000);
      expect(sumJson.data.ordersByPaymentMethod).toEqual({ cash: 2, payos: 2 });
      expect(sumJson.data.avgLeadTimeMinutes).toBe(6);
      expect(sumJson.data.heldOrdersCount).toBe(1);
      expect(sumJson.data.kdsByStatus.pending ?? 0).toBe(0);

      // 4. Recall endpoint moves ord-done-part from 'ready' back to 'preparing' and clears ready_at
      const recallRes = await app.fetch(
        new Request('http://localhost/api/kds/orders/ord-done-part/recall', {
          method: 'POST',
          headers: { Authorization: `Bearer ${mgrToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_status: 'preparing' }),
        }),
        env,
      );
      expect(recallRes.status).toBe(200);
      const recalledOrd = sqlite.prepare('SELECT status, ready_at FROM orders WHERE id = ?').get('ord-done-part') as {
        status: string;
        ready_at: string | null;
      };
      expect(recalledOrd).toEqual({ status: 'preparing', ready_at: null });
    } finally {
      sqlite.close();
    }
  });
});
