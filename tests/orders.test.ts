/**
 * Orders Route Tests — plain handlers (createOrder, getOrder, updateOrder, getAdminOrders, getStats)
 * Tests plain Request/Response handlers directly.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fetch for Telegram notifications
globalThis.fetch = vi.fn();

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    orders: [...(seedData.orders || [])],
    payments: [...(seedData.payments || [])],
    customers: [...(seedData.customers || [])],
    referrals: [...(seedData.referrals || [])],
    cashback_transactions: [...(seedData.cashback_transactions || [])],
    cashback_wallets: [...(seedData.cashback_wallets || [])],
    loyalty_point_logs: [...(seedData.loyalty_point_logs || [])],
    loyalty_audit_log: [...(seedData.loyalty_audit_log || [])],
  };

  function getTable(sql: string): string {
    const from = sql.match(/\bFROM\s+(\w+)/i);
    if (from) return from[1];
    const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
    if (insert) return insert[1];
    const update = sql.match(/UPDATE\s+(\w+)/i);
    if (update) return update[1];
    return '';
  }

  function extractWhereCols(sql: string): string[] {
    const wherePart = sql.match(/WHERE\s+(.+?)(?:ORDER\s+BY|GROUP\s+BY|LIMIT|$)/i);
    if (!wherePart) return [];
    const conds = wherePart[1].split(/\s+AND\s+/i);
    return conds.map(c => {
      const m = c.match(/(\w+)\s*(?:=|>=|<=|!=|>|<)\s*\?/);
      return m ? m[1] : '';
    }).filter(Boolean);
  }

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => { bindValues.push(...vals); return stmt; }),
        first: vi.fn(async () => {
          const t = getTable(sql);
          const rows = tables[t] || [];
          const whereCols = extractWhereCols(sql);
          if (whereCols.length > 0 && bindValues.length > 0) {
            for (const row of rows) {
              let match = true;
              for (let i = 0; i < Math.min(whereCols.length, bindValues.length); i++) {
                if (String((row as Record<string, unknown>)[whereCols[i]]) !== String(bindValues[i])) { match = false; break; }
              }
              if (match) return row;
            }
            return null;
          }
          return rows[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          const rows = tables[t] || [];
          const whereCols = extractWhereCols(sql);
          if (whereCols.length > 0 && bindValues.length > 0) {
            const filtered = rows.filter(r => {
              for (let i = 0; i < Math.min(whereCols.length, bindValues.length); i++) {
                if (String((r as Record<string, unknown>)[whereCols[i]]) !== String(bindValues[i])) return false;
              }
              return true;
            });
            return { results: filtered };
          }
          return { results: [...rows] };
        }),
        run: vi.fn(async () => {
          const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insert) {
            const t = insert[1];
            if (!tables[t]) tables[t] = [];
          }
          return { success: true, meta: { changes: 1 } };
        }),
      };
      return stmt;
    }),
    batch: vi.fn(async () => [{ success: true }]),
  };
}

let createOrder: any, getOrder: any, updateOrder: any, getAdminOrders: any, getStats: any;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../worker/src/routes/orders.ts');
  createOrder = mod.createOrder;
  getOrder = mod.getOrder;
  updateOrder = mod.updateOrder;
  getAdminOrders = mod.getAdminOrders;
  getStats = mod.getStats;
});

describe('createOrder', () => {
  test('creates order and returns 201', async () => {
    const env = {
      AURA_DB: createMockD1({ customers: [] }),
      AUTH_KV: null,
    };
    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Coffee', qty: 2, price: 25000 }],
        total: 50000,
        customer_name: 'Alice',
        customer_phone: '09123456789',
        payment_method: 'cod',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.order.customer_name).toBe('Alice');
  });

  test('returns 400 on missing total', async () => {
    const env = { AURA_DB: createMockD1() };
    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Coffee', qty: 2, price: 25000 }],
        customer_name: 'Alice',
        customer_phone: '09123456789',
        payment_method: 'cod',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on invalid payment method', async () => {
    const env = { AURA_DB: createMockD1() };
    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Coffee', qty: 2, price: 25000 }],
        total: 50000,
        customer_name: 'Alice',
        customer_phone: '09123456789',
        payment_method: 'invalid_method',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on invalid JSON body', async () => {
    const env = { AURA_DB: createMockD1() };
    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(500);
  });
});

describe('getOrder', () => {
  test('returns 200 with order data', async () => {
    const env = {
      AURA_DB: createMockD1({
        orders: [{ id: 'ORD_1', status: 'pending', total: '50000', payment_status: 'unpaid', customer_name: 'Alice', customer_phone: '09123456789', items: '[{"name":"Coffee","qty":2}]', created_at: '2026-01-01' }],
        payments: [{ id: 'PAY_1', order_id: 'ORD_1', method: 'cod', amount: 50000, status: 'pending' }],
      }),
    };
    const req = new Request('http://localhost/api/orders/ORD_1');

    const res = await getOrder(req, env, 'ORD_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.order.customer_name).toBe('Alice');
  });

  test('returns 404 when order not found', async () => {
    const env = { AURA_DB: createMockD1({ orders: [] }) };
    const req = new Request('http://localhost/api/orders/NONEXISTENT');

    const res = await getOrder(req, env, 'NONEXISTENT');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

describe('updateOrder', () => {
  test('updates order status successfully', async () => {
    const env = {
      AURA_DB: createMockD1({
        orders: [{ id: 'ORD_1', status: 'pending', customer_email: null, customer_phone: null }],
      }),
    };
    const req = new Request('http://localhost/api/orders/ORD_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    const res = await updateOrder(req, env, 'ORD_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 400 on invalid status transition', async () => {
    const env = {
      AURA_DB: createMockD1({
        orders: [{ id: 'ORD_1', status: 'cancelled' }],
      }),
    };
    const req = new Request('http://localhost/api/orders/ORD_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    const res = await updateOrder(req, env, 'ORD_1');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid transition/i);
  });

  test('returns 404 when order not found', async () => {
    const env = { AURA_DB: createMockD1({ orders: [] }) };
    const req = new Request('http://localhost/api/orders/NONEXISTENT', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    const res = await updateOrder(req, env, 'NONEXISTENT');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

describe('getAdminOrders', () => {
  test('returns 200 with orders and pagination', async () => {
    const env = {
      AURA_DB: createMockD1({
        orders: [
          { id: 'ORD_1', status: 'pending', total: '50000', payment_status: 'unpaid', customer_name: 'Alice', customer_phone: '09123456789', items: '[]', created_at: '2026-01-01' },
        ],
      }),
    };
    const req = new Request('http://localhost/api/admin/orders');

    const res = await getAdminOrders(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.pagination).toBeDefined();
  });
});

describe('getStats', () => {
  test('returns 200 with stats', async () => {
    const env = {
      AURA_DB: createMockD1({ orders: [] }),
    };
    const req = new Request('http://localhost/api/orders/stats');

    const res = await getStats(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.stats).toBeDefined();
    expect(body.stats.orders_today).toBe(0);
  });
});
