/**
 * M4 Online — Pickup / Delivery fulfillment view.
 * Tests GET /fulfillment/locations + GET /orders/:id/fulfillment.
 */
import { describe, it, expect } from 'vitest';

const JWT_SECRET = 'test_secret_at_least_16_chars';

interface MockRow {
  id: string;
  [key: string]: any;
}

function createMockEnv(seed: Record<string, MockRow[]> = {}, kvData: Record<string, string> = {}) {
  const db = createMockD1(seed);
  const kv = {
    get: async (k: string) => kvData[k] ?? null,
  };
  return {
    AURA_DB: db,
    JWT_SECRET,
    AUTH_KV: kv,
  } as any;
}

function createMockD1(seed: Record<string, MockRow[]> = {}) {
  const tables: Record<string, MockRow[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = [...v];

  return {
    prepare: (sql: string) => {
      const sqlLower = sql.toLowerCase();
      let table = 'unknown';
      if (sqlLower.includes('from orders') || sqlLower.includes('into orders')) table = 'orders';
      else if (sqlLower.includes('from menu_items') || sqlLower.includes('into menu_items')) table = 'menu_items';

      const isInsert = sqlLower.startsWith('insert');

      return {
        bind: (...args: any[]) => ({
          first: async <T = any>(): Promise<T | null> => {
            if (isInsert) {
              const row = { id: args[0] ?? 'gen_id' };
              tables[table] = tables[table] || [];
              tables[table].push(row);
              return row as T;
            }
            const rows = tables[table] || [];
            // Match by bound id for `WHERE id = ?` queries.
            if (sqlLower.includes('where') && sqlLower.includes('id = ?') && typeof args[0] === 'string') {
              const found = rows.find((r: MockRow) => r.id === args[0]);
              return (found ?? null) as T;
            }
            // Aggregate queries (COUNT) — return a synthetic row.
            if (sqlLower.includes('count(')) {
              // For queue depth: count PENDING orders with created_at < args[1].
              if (args[0] === 'pending' && args[1] && typeof args[1] === 'string') {
                const cutoff = args[1];
                const count = rows.filter(
                  (r: MockRow) => r.status === 'pending' && r.created_at < cutoff,
                ).length;
                return { c: count } as T;
              }
              return { c: rows.length } as T;
            }
            return (rows[0] ?? null) as T;
          },
          all: async <T = any>(): Promise<{ results: T[] }> => {
            if (isInsert) {
              const row = { id: args[0] ?? 'gen_id' };
              tables[table] = tables[table] || [];
              tables[table].push(row);
              return { results: [row] as T[] };
            }
            return { results: (tables[table] || []) as T[] };
          },
          run: async () => ({ success: true }),
        }),
      };
    },
  } as any;
}

async function signToken(payload: Record<string, any>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { iat: now, exp: now + 3600, ...payload };
  const enc = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${enc(header)}.${enc(fullPayload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sigStr}`;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const ORDERS_SEED = {
  orders: [
    {
      id: 'ord_1',
      status: 'pending',
      order_type: 'pickup',
      customer_id: 'cust_1',
      created_at: new Date(Date.now() - 60_000).toISOString(),
    },
    {
      id: 'ord_2',
      status: 'pending',
      order_type: 'pickup',
      customer_id: 'cust_2',
      created_at: new Date(Date.now() - 120_000).toISOString(),
    },
    {
      id: 'ord_3',
      status: 'served',
      order_type: 'pickup',
      customer_id: 'cust_1',
      created_at: new Date(Date.now() - 300_000).toISOString(),
    },
  ],
};

describe('M4 — Pickup / Delivery fulfillment', () => {
  describe('GET /fulfillment/locations (public)', () => {
    it('returns default pickup point when KV is empty', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv({});

      const req = new Request('http://localhost/fulfillment/locations');
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('main_counter');
    });

    it('returns pickup point from KV config', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv({}, {
        'fulfillment:pickup_point': JSON.stringify({
          id: 'branch_a',
          name: 'AURA — Lê Lợi',
          address: '50 Lê Lợi, Q.1',
          hint: 'Tầng trệt',
        }),
      });

      const req = new Request('http://localhost/fulfillment/locations');
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data[0].id).toBe('branch_a');
      expect(body.data[0].name).toContain('Lê Lợi');
      expect(body.data[0].hint).toBe('Tầng trệt');
    });

    it('no auth required', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv({});

      const req = new Request('http://localhost/fulfillment/locations');
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /orders/:id/fulfillment', () => {
    it('returns ETA + pickup point for pending pickup order', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv(ORDERS_SEED);
      const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

      const req = new Request('http://localhost/orders/ord_1/fulfillment', {
        headers: authHeader(token),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.orderId).toBe('ord_1');
      expect(body.data.channel).toBe('pickup');
      expect(body.data.status).toBe('pending');
      expect(body.data.etaMinutes).toBeGreaterThan(0);
      expect(body.data.etaAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // ord_2 was created earlier, so ord_1 has 1 order ahead.
      expect(body.data.queueDepth).toBe(1);
      expect(body.data.pickupPoint).not.toBeNull();
      expect(body.data.pickupPoint.id).toBe('main_counter');
    });

    it('returns null ETA + no pickup point for terminal order', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv(ORDERS_SEED);
      const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

      const req = new Request('http://localhost/orders/ord_3/fulfillment', {
        headers: authHeader(token),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('served');
      expect(body.data.etaAt).toBeNull();
      expect(body.data.etaMinutes).toBe(0);
      expect(body.data.queueDepth).toBe(0);
      // Terminal pickup order — pickup point omitted (order is done).
      expect(body.data.pickupPoint).toBeNull();
    });

    it('404 for unknown order', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv(ORDERS_SEED);
      const token = await signToken({ id: 'staff_1', email: 's@b.com', name: 'Sam', role: 'staff' });

      const req = new Request('http://localhost/orders/ord_missing/fulfillment', {
        headers: authHeader(token),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('customer cannot read another customer order', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv(ORDERS_SEED);
      const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

      // ord_2 belongs to cust_2
      const req = new Request('http://localhost/orders/ord_2/fulfillment', {
        headers: authHeader(token),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(403);
    });

    it('staff can read any order fulfillment', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv(ORDERS_SEED);
      const token = await signToken({ id: 'staff_1', email: 's@b.com', name: 'Sam', role: 'staff' });

      const req = new Request('http://localhost/orders/ord_1/fulfillment', {
        headers: authHeader(token),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.orderId).toBe('ord_1');
    });

    it('delivery channel — channel reported, no pickup point attached', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {
        orders: [{
          id: 'ord_d',
          status: 'pending',
          channel: 'delivery',
          customer_id: 'cust_1',
          created_at: new Date().toISOString(),
        }],
      };
      const env = createMockEnv(seed);
      const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

      const req = new Request('http://localhost/orders/ord_d/fulfillment', {
        headers: authHeader(token),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.channel).toBe('delivery');
      expect(body.data.pickupPoint).toBeNull();
    });

    it('401 when no auth', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv(ORDERS_SEED);

      const req = new Request('http://localhost/orders/ord_1/fulfillment');
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(401);
    });

    it('falls back to default pickup point when KV value is malformed JSON', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const env = createMockEnv(ORDERS_SEED, {
        'fulfillment:pickup_point': '{not valid json',
      });
      const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

      const req = new Request('http://localhost/orders/ord_1/fulfillment', {
        headers: authHeader(token),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.pickupPoint.id).toBe('main_counter');
    });
  });
});
