/**
 * M4 Online — Online Order (POST /api/crm/orders).
 * Tests customer self-service order placement + staff/owner on-behalf mode.
 *
 * Pattern: crmRouter.fetch(req, env, executionContext).
 */
import { describe, it, expect } from 'vitest';

const JWT_SECRET = 'test_secret_at_least_16_chars';

interface MockRow {
  id: string;
  [key: string]: any;
}

function createMockEnv(seed: Record<string, MockRow[]> = {}) {
  const db = createMockD1(seed);
  return {
    AURA_DB: db,
    JWT_SECRET,
    AUTH_KV: { get: async () => null },
  } as any;
}

function createMockD1(seed: Record<string, MockRow[]> = {}) {
  const tables: Record<string, MockRow[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = [...v];

  return {
    prepare: (sql: string) => {
      const sqlLower = sql.toLowerCase();
      let table = 'unknown';
      if (sqlLower.includes('from menu_items') || sqlLower.includes('into menu_items')) table = 'menu_items';
      else if (sqlLower.includes('from orders') || sqlLower.includes('into orders')) table = 'orders';
      else if (sqlLower.includes('from customers') || sqlLower.includes('into customers')) table = 'customers';

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
            // For filtered queries (WHERE id = ?), match by first bound arg.
            if (args.length > 0 && typeof args[0] === 'string') {
              const found = rows.find((r: MockRow) => r.id === args[0]);
              if (found) return found as T;
              // If query has WHERE id = ? but no match, return null (only when SELECT has id filter).
              if (sqlLower.includes('where') && sqlLower.includes('id = ?')) {
                return null;
              }
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
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${sigStr}`;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const MENU_SEED = {
  menu_items: [
    { id: 'mi_1', name: 'Espresso', price: 45000, available: 1 },
    { id: 'mi_2', name: 'Latte', price: 55000, available: 1 },
    { id: 'mi_3', name: 'Sold Out', price: 30000, available: 0 },
  ],
};

describe('M4 — Online Order', () => {
  it('customer places a valid pickup order', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'pickup',
        customerPhone: '+84901234567',
        items: [
          { menuItemId: 'mi_1', quantity: 2 },
          { menuItemId: 'mi_2', quantity: 1 },
        ],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orderId).toMatch(/^ord_[0-9a-f]+$/);
    expect(body.data.status).toBe('pending');
    expect(body.data.channel).toBe('pickup');
    expect(body.data.totalCents).toBe(45000 * 2 + 55000);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0]).toMatchObject({
      menuItemId: 'mi_1',
      name: 'Espresso',
      quantity: 2,
      unitPriceCents: 45000,
      subtotalCents: 90000,
    });
  });

  it('staff places order on behalf of a customer', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'staff_1', email: 's@b.com', name: 'Sam', role: 'staff' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'delivery',
        customerId: 'cust_99',
        customerPhone: '+84909999999',
        items: [{ menuItemId: 'mi_2', quantity: 1 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.totalCents).toBe(55000);
    expect(body.data.channel).toBe('delivery');
  });

  it('rejects order with unavailable item', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'pickup',
        customerPhone: '+84901234567',
        items: [{ menuItemId: 'mi_3', quantity: 1 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('unavailable');
  });

  it('rejects order with unknown item', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'pickup',
        customerPhone: '+84901234567',
        items: [{ menuItemId: 'mi_missing', quantity: 1 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('rejects empty items array', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ channel: 'pickup', customerPhone: '+84901234567', items: [] }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/items/i);
  });

  it('rejects invalid channel', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'dine_in',
        customerPhone: '+84901234567',
        items: [{ menuItemId: 'mi_1', quantity: 1 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/channel/i);
  });

  it('rejects missing customerPhone', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'pickup',
        items: [{ menuItemId: 'mi_1', quantity: 1 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/customerPhone/i);
  });

  it('rejects invalid quantity', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'pickup',
        customerPhone: '+84901234567',
        items: [{ menuItemId: 'mi_1', quantity: 0 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/quantity/i);
  });

  it('401 when no auth token', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'pickup',
        customerPhone: '+84901234567',
        items: [{ menuItemId: 'mi_1', quantity: 1 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(401);
  });

  it('403 when role not allowed (e.g. waiter)', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'w_1', email: 'w@b.com', name: 'Wai', role: 'waiter' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'pickup',
        customerPhone: '+84901234567',
        items: [{ menuItemId: 'mi_1', quantity: 1 }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(403);
  });

  it('preserves per-item note', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(MENU_SEED);
    const token = await signToken({ id: 'cust_1', email: 'a@b.com', name: 'Alice', role: 'customer' });

    const req = new Request('http://localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({
        channel: 'pickup',
        customerPhone: '+84901234567',
        items: [{ menuItemId: 'mi_1', quantity: 1, note: 'extra hot' }],
      }),
    });

    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.items[0].note).toBe('extra hot');
  });
});
