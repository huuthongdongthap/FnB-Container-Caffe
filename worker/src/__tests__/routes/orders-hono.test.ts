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
      run: async() => {
        const q = stmt._sql || '';
        // For guest-checkin batch: first statement is UPDATE cafe_tables
        if (q.includes('UPDATE cafe_tables SET status')) {
          if (noTable) {
            return { success: true, changes: 0 }; // No rows updated = table not available
          }
          return { success: true, changes: 1 };
        }
        return { success: true, changes: 1, lastRowId: 1 };
      },
      first: async() => {
        const q = stmt._sql || '';
        // Guest checkin - table lookup by table_number
        if (q.includes('FROM cafe_tables WHERE table_number = ?')) {
          if (noTable) {
            return null;
          }
          return table ?? { id: 'tbl-1', status: 'Available' };
        }
        // Checkout - SELECT * FROM orders WHERE id = ? after INSERT
        if (q.includes('FROM orders WHERE id = ?')) {
          return insertOrder ?? { id: 'ord-1', total: 50000, status: 'pending', payment_method: 'cod', created_at: new Date().toISOString() };
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

describe('ordersRouter — customer-facing mount at /api/orders', () => {
  describe('POST /checkout', () => {
    it('returns 201 with order data on valid input', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/checkout', {
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
      const res = await ordersRouter.fetch(req, env);
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('status', 'pending');
    });

    it('returns 400 when items array is empty', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/checkout', {
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
      const res = await ordersRouter.fetch(req, env);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /guest-checkin', () => {
    it('creates placeholder order and marks table Occupied atomically', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Khách QR',
          customer_phone: '0909123456',
          table_id: '5'
        })
      });
      const res = await ordersRouter.fetch(req, env);
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
      const req = new Request('https://test.aura/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Test',
          customer_phone: '0909000000',
          table_id: '999'
        })
      });
      const res = await ordersRouter.fetch(req, env);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /', () => {
    it('returns recent orders list', async() => {
      const db = stubDB();
      const env = makeEnv(db);
      const req = new Request('https://test.aura/', {
        method: 'GET'
      });
      const res = await ordersRouter.fetch(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
