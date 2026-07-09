/**
 * Unit tests for src/tree/orders/create-order.ts
 * Tests: validation, order creation, table resolution, customer upsert, inventory
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vitest hoists vi.mock() to the top automatically.
// ---------------------------------------------------------------------------

vi.mock('../../../tree/orders/telegram', () => ({
  notifyTelegram: vi.fn(async() => {})
}));

vi.mock('../../../tree/push/notifier', () => ({
  sendPushToStaff: vi.fn(async() => ({ sent: 0, failed: 0 }))
}));

vi.mock('../../../lib/email', () => ({
  sendEmail: vi.fn(async() => true)
}));

vi.mock('../../../templates/order-confirm', () => ({
  renderOrderConfirm: vi.fn(() => '<html/>')
}));

vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} })
  })
}));

vi.mock('../../../lib/metrics-collector', () => ({
  createMetricsCollector: () => ({
    recordMetric: async() => {},
    recordAlert: async() => null,
    markAlertDispatched: async() => {},
    pruneOldMetrics: async() => 0
  })
}));

// ---------------------------------------------------------------------------
// Real imports
// ---------------------------------------------------------------------------

import { jsonResponse, errorResponse } from '../../../middleware/cors';
import { createOrder } from '../../../tree/orders/create-order.js';
import { createMockEnv, createMockDB } from '../../test-utils';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

type OrderBase = {
  items: Array<{ name: string; quantity?: number; price?: number }>;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  payment_method: 'cod' | 'payos';
  shipping_fee: number;
  discount: number;
  notes: string;
  delivery_time: string;
};

const ORDER_BASE: OrderBase = {
  items: [{ name: 'Cà phê sữa', quantity: 2, price: 25000 }],
  total: 50000,
  customer_name: 'Nguyen Van A',
  customer_phone: '0909123456',
  customer_email: '',
  customer_address: '',
  payment_method: 'cod',
  shipping_fee: 0,
  discount: 0,
  notes: '',
  delivery_time: 'now'
};

function makeBody(overrides: Partial<OrderBase> = {}): OrderBase {
  return { ...ORDER_BASE, ...overrides };
}

// ---------------------------------------------------------------------------
// DB stub helper
// Pattern-matches each prepared statement's SQL to return appropriate data.
// ---------------------------------------------------------------------------

function makeOrderDB(overrides: Record<string, unknown> = {}): ReturnType<typeof createMockDB> {
  const db = createMockDB();

  db.prepare = ((_sql: string) => {
    const stmt: Record<string, unknown> = {
      _sql,
      _binds: [] as unknown[],
      bind(this: typeof stmt, ...args: unknown[]) {
        this._binds = args;
        return this;
      },
      async first<T = unknown>() {
        const sql = stmt._sql as string;
        if (sql.includes('FROM cafe_tables WHERE table_number')) {
          if (overrides._tableNotFound) {
            return null as T;
          }
          return { id: (overrides._tableId ?? 'tbl-uuid-123') as T };
        }
        return null as T;
      },
      async run() {
        return { success: true, changes: 1, lastRowId: 1 } as unknown;
      },
      all: async() => ({ results: [], success: true } as never),
      raw: async() => []
    };
    return stmt as never;
  }) as typeof db.prepare;

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createOrder', () => {
  // Helper: call createOrder and expect 201 Created
  async function createAndAssert(req: Request, env: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    return res.json() as Promise<Record<string, unknown>>;
  }
  it('returns 400 with validation error when items is empty', async() => {
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ items: [] }))
    });
    const env = createMockEnv();
    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
    const data: unknown = await res.json();
    expect((data as Record<string, unknown>).success).toBe(false);
  });

  // Test 2: Happy path — 200, success flag, correct structure
  it('returns 200 with success flag and correct structure on valid order', async() => {
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ORDER_BASE)
    });
    const env = createMockEnv();
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const data: Record<string, unknown> = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Order created successfully');
    const order = data.order as Record<string, unknown>;
    expect(order.id).toBeDefined();
    expect(typeof order.id).toBe('string');
    expect((order.id as string).startsWith('ORD_')).toBe(true);
    expect(order.status).toBe('pending');
    expect(order.payment_status).toBe('unpaid');
  });

  // Test 3: Response includes all expected fields
  it('response includes customer, payment, numeric totals, table_id null', async() => {
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody())
    });
    const env = createMockEnv();
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);

    const data: Record<string, unknown> = await res.json();
    const order = data.order as Record<string, unknown>;
    const customer = order.customer as Record<string, unknown>;

    // Customer block
    expect(customer.full_name).toBe('Nguyen Van A');
    expect(customer.phone).toBe('0909123456');
    expect(customer.address).toBeNull();

    // Direct fields
    expect(order.customer_name).toBe('Nguyen Van A');
    expect(order.customer_phone).toBe('0909123456');
    expect(order.customer_address).toBeNull();
    expect(order.payment_method).toBe('cod');
    expect(order.table_id).toBeNull();

    // Numeric
    expect(typeof order.total).toBe('number');
    expect(typeof order.shipping_fee).toBe('number');
    expect(typeof order.discount).toBe('number');
    expect(order.delivery_time).toBe('now');

    // Items
    const items = order.items as Array<Record<string, unknown>>;
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Cà phê sữa');

    // ISO timestamp
    expect(order.created_at).toBeDefined();
    expect(new Date(order.created_at as string).toISOString()).toBe(order.created_at);
  });

  // Test 4: Resolves table_number -> UUID, marks table occupied
  it('resolves table_id to UUID and marks table occupied', async() => {
    const TABLE_UUID = 'tbl-uuid-abc';
    const db = makeOrderDB({ _tableId: TABLE_UUID });
    const env = createMockEnv({ AURA_DB: db });

    let tableLookupBinds: unknown[] = [];
    let tableUpdateBinds: unknown[] = [];

    const basePrepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const stmt = basePrepare(sql);
      const origBind = stmt.bind.bind(stmt);
      stmt.bind = (...args: unknown[]) => {
        if (sql.includes('SELECT id FROM cafe_tables')) {
          tableLookupBinds = args;
        }
        if (sql.includes('UPDATE cafe_tables')) {
          tableUpdateBinds = args;
        }
        return origBind(...args);
      };
      return stmt;
    }) as typeof db.prepare;

    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ table_id: '5' } as Partial<OrderBase> & { table_id: string }))
    });
    const res = await createOrder(req, env);

    expect(res.status).toBe(201);
    const data: Record<string, unknown> = await res.json();
    const order = data.order as Record<string, unknown>;
    expect(order.table_id).toBe(TABLE_UUID);
    expect(tableLookupBinds.length).toBeGreaterThanOrEqual(1);
    expect(tableUpdateBinds.length).toBeGreaterThanOrEqual(1);
    expect(tableLookupBinds[0]).toBe('5');
    expect(tableUpdateBinds[0]).toBe(TABLE_UUID);
  });

  // Test 5: table_id not found → resolvedTableId stays null
  it('ignores table_id when no matching table exists', async() => {
    const db = makeOrderDB({ _tableNotFound: true });
    const env = createMockEnv({ AURA_DB: db });

    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ table_number: '999' } as Partial<OrderBase> & { table_number: string }))
    });
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const data: Record<string, unknown> = await res.json();
    expect((data.order as Record<string, unknown>).table_id).toBeNull();
  });

  // Test 6: No cafe_tables query when table_id is absent
  it('does not query cafe_tables when table_id is absent', async() => {
    const db = createMockDB();
    const queriedSql: string[] = [];
    const origPrepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      queriedSql.push(sql);
      return origPrepare(sql);
    }) as typeof db.prepare;

    const env = createMockEnv({ AURA_DB: db });
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody())
    });
    await createOrder(req, env);

    const cafeTableQueries = queriedSql.filter(s => s.includes('cafe_tables'));
    expect(cafeTableQueries.length).toBe(0);
  });

  // Test 7: Email provided → customer upsert fires
  it('inserts customer record when customer_email is provided', async() => {
    const db = makeOrderDB({ _tableNotFound: true });
    const env = createMockEnv({ AURA_DB: db });

    let customerSqlFound = false;
    const basePrepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const stmt = basePrepare(sql);
      const origBind = stmt.bind.bind(stmt);
      stmt.bind = (...args: unknown[]) => {
        if (sql.includes('INSERT INTO customers') && sql.includes('ON CONFLICT')) {
          customerSqlFound = true;
        }
        return origBind(...args);
      };
      return stmt;
    }) as typeof db.prepare;

    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ customer_email: 'nguyenvana@example.com' }))
    });
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const data: Record<string, unknown> = await res.json();
    expect((data.order as Record<string, unknown>).customer).toBeDefined();
    expect(customerSqlFound).toBe(true);
  });

  // Test 7b: No customer upsert when email is empty
  it('skips customer insert when customer_email is empty', async() => {
    const db = makeOrderDB({ _tableNotFound: true });
    const env = createMockEnv({ AURA_DB: db });

    let customerSqlFound = false;
    const basePrepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const stmt = basePrepare(sql);
      const origBind = stmt.bind.bind(stmt);
      stmt.bind = (...args: unknown[]) => {
        if (sql.includes('INSERT INTO customers') && sql.includes('ON CONFLICT')) {
          customerSqlFound = true;
        }
        return origBind(...args);
      };
      return stmt;
    }) as typeof db.prepare;

    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ customer_email: '' }))
    });
    await createOrder(req, env);
    expect(customerSqlFound).toBe(false);
  });

  // Test 8: DB error → 500
  it('returns 500 with error message on database error', async() => {
    const env = createMockEnv();
    const throwingDB = {
      prepare: () => {
        throw new Error('Simulated DB failure');
      }
    } as unknown as ReturnType<typeof createMockDB>;
    env.AURA_DB = throwingDB;

    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody())
    });
    const res = await createOrder(req, env);
    expect(res.status).toBe(500);
    const data: Record<string, unknown> = await res.json();
    expect(data.success).toBe(false);
    expect((data.error as string).includes('Simulated DB failure')).toBe(true);
  });

  // Test 9: Items preserve fields (qty, price, name)
  it('preserves order item fields through order creation', async() => {
    const items = [
      { name: 'Cà phê sữa đá', quantity: 2, price: 25000 },
      { name: 'Bánh mì thịt', quantity: 1, price: 15000 }
    ];
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ items, total: 65000 }))
    });
    const env = createMockEnv();
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);

    const data: Record<string, unknown> = await res.json();
    const order = data.order as Record<string, unknown>;
    const returnedItems = order.items as Array<Record<string, unknown>>;
    expect(returnedItems.length).toBe(2);

    expect(returnedItems[0]).toHaveProperty('name');
    expect(returnedItems[0]).toHaveProperty('price');
  });

  // Test 10: payos payment method accepted
  it('accepts payos payment method and includes it in response', async() => {
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ payment_method: 'payos' }))
    });
    const env = createMockEnv();
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const data: Record<string, unknown> = await res.json();
    const order = data.order as Record<string, unknown>;
    expect(order.payment_method).toBe('payos');
    expect(order.payment_status).toBe('unpaid');
  });

  // Test 11: Invalid payment method → 400
  it('returns 400 for invalid payment_method', async() => {
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ payment_method: 'visa' } as unknown as Partial<OrderBase>))
    });
    const env = createMockEnv();
    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
  });

  // Test 12: Total with discount/shipping
  it('includes shipping_fee and discount in response', async() => {
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ total: 70000, shipping_fee: 5000, discount: 2000 }))
    });
    const env = createMockEnv();
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const data: Record<string, unknown> = await res.json();
    const order = data.order as Record<string, unknown>;
    expect(order.shipping_fee).toBe(5000);
    expect(order.discount).toBe(2000);
  });
});
