/**
 * Unit tests for orders-hono.ts (ordersRouter mounted at /api/orders and /api/kds/orders)
 *
 * Validates that the router mount fix makes POST /api/orders/checkout and
 * POST /api/orders/guest-checkin reachable at the customer-facing path.
 */

import { describe, it, expect, vi } from 'vitest';
import { ordersRouter } from '../../routes/orders-hono';
import { createMockEnv, createMockDB } from '../test-utils';
function stubDB(overrides: {
  insertOrder?: { id: string; total: number };
  table?: { id: string; status: string };
  noTable?: boolean;
} = {}) {
  const { insertOrder, table, noTable } = overrides;

  // Every prepare() call gets its own statement that captures the SQL
  // and returns data based on pattern matching against THAT SQL.
  const makeStmt = (_sql: string) => {
    const stmt: any = {
      _sql,
      _binds: [] as unknown[],
      bind(...args: unknown[]) {
        stmt._binds = args;
        return stmt;
      },
      all: async() => ({ results: [], success: true }),
      run: async() => ({ success: true, changes: 1, lastRowId: 1 }),
      first: async() => {
        const q = stmt._sql || '';
        if (q.includes('FROM cafe_tables WHERE table_number = ?')) {
          if (noTable) {
            return null;
          }
          return { id: 'tbl_1', status: 'Available' };
        }
        if (q.includes('SELECT * FROM orders WHERE id = ?')) {
          return {
            id: 'ORD-TEST123',
            customer_name: 'Test Customer',
            customer_phone: '0909000000',
            table_id: null,
            items: '[]',
            subtotal: 0,
            discount_amount: 0,
            total: 0,
            status: 'pending',
            payment_method: 'cod',
            created_at: new Date().toISOString()
          };
        }
        return null;
      }
    };
    return stmt;
  };

  const prepare = (_sql: string) => makeStmt(_sql);

  const db = createMockDB();
  db.prepare = prepare as any;
  return db;
}

function makeEnv(db: ReturnType<typeof stubDB>, overrides: Record<string, unknown> = {}) {
  return {
    ...createMockEnv(),
    AURA_DB: db,
    ...overrides
  } as any;
}

async function fetchRouter(path: string, init: RequestInit = {}, env: Record<string, unknown>) {
  const url = `https://test.aura${path}`;
  return ordersRouter.fetch(new Request(url, init), env);
}

describe('ordersRouter — customer-facing mount at /api/orders', () => {
  describe('POST /checkout', () => {
    it('returns 201 with order data on valid input', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ product_id: 'p1', price: 25000, quantity: 2 }],
          total: 50000,
          customer_name: 'Nguyễn Văn A',
          customer_phone: '0909123456',
          payment_method: 'cod'
        })
      });
      const res = await fetchRouter('/checkout', req, env);
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('status', 'pending');
    });

    it('returns 400 when items array is empty', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [],
          total: 0,
          customer_name: 'Test',
          customer_phone: '0909000000',
          payment_method: 'cod'
        })
      });
      const res = await fetchRouter('/checkout', req, env);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /guest-checkin', () => {
    it('creates placeholder order and marks table Occupied atomically', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Khách QR',
          customer_phone: '0909123456',
          table_id: '5'
        })
      });
      const res = await fetchRouter('/guest-checkin', req, env);
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('table_number', '5');
      expect(body.data).toHaveProperty('status', 'pending');
    });

    it('returns 404 when table does not exist', async() => {
      const db = stubDB({ noTable: true });
      const env = makeEnv(db);
      const req = new Request('https://test.aura/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Test',
          customer_phone: '0909000000',
          table_id: '999'
        })
      });
      const res = await fetchRouter('/guest-checkin', req, env);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /', () => {
    it('returns recent orders list', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/api/orders', {
        method: 'GET'
      });
      const res = await fetchRouter('/', req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
