/**
 * M4 Online — Customer Self-Service Account endpoints.
 * Tests GET /account/me and PATCH /account/consent.
 *
 * Pattern: crmRouter.fetch(req, env, executionContext) — Hono's
 * canonical test surface for Workers-bound apps.
 */
import { describe, it, expect } from 'vitest';

const JWT_SECRET = 'test_secret_at_least_16_chars';

// ─────────────────────────────────────────────────────────────────────
// Mock D1 — returns seeded rows by table name.
// ─────────────────────────────────────────────────────────────────────

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
      if (sqlLower.includes('from customers') || sqlLower.includes('into customers')) table = 'customers';
      else if (sqlLower.includes('from orders') || sqlLower.includes('into orders')) table = 'orders';
      else if (sqlLower.includes('from consents') || sqlLower.includes('into consents')) table = 'consents';
      else if (sqlLower.includes('from loyalty_tiers')) table = 'loyalty_tiers';

      const isInsert = sqlLower.startsWith('insert');

      return {
        bind: (..._args: any[]) => ({
          first: async <T = any>(): Promise<T | null> => {
            if (isInsert) {
              const row = { id: _args[0] ?? 'gen_id' };
              tables[table] = tables[table] || [];
              tables[table].push(row);
              return row as T;
            }
            const rows = tables[table] || [];
            return (rows[0] ?? null) as T | null;
          },
          all: async <T = any>(): Promise<{ results: T[] }> => {
            if (isInsert) {
              const row = { id: _args[0] ?? 'gen_id' };
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

// ─────────────────────────────────────────────────────────────────────
// JWT helper — HS256 sign with Web Crypto.
// ─────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe('M4 — Customer Account', () => {
  describe('GET /account/me', () => {
    it('returns account view for authenticated customer', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {
        customers: [
          {
            id: 'cust_1',
            name: 'Alice',
            phone: '+84901',
            email: 'alice@example.com',
            loyalty_tier: 'gold',
            loyalty_points: 500,
            lifetime_points: 1500,
          },
        ],
        orders: [
          { id: 'ord_1', total_cents: 12000, status: 'completed', created_at: '2026-09-14T10:00:00Z' },
        ],
        consents: [{ purpose: 'marketing', granted: 1, updated_at: '2026-09-10T08:00:00Z' }],
        loyalty_tiers: [
          { tier_name: 'bronze', min_points: 0 },
          { tier_name: 'silver', min_points: 50 },
          { tier_name: 'gold', min_points: 200 },
          { tier_name: 'platinum', min_points: 500 },
        ],
      };
      const env = createMockEnv(seed);

      const token = await signToken({ id: 'cust_1', role: 'customer' });
      const req = new Request('http://localhost/account/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.customerId).toBe('cust_1');
      expect(body.data.tier).toBe('gold');
      expect(body.data.points).toBe(500);
      expect(body.data.recentOrders).toHaveLength(1);
      expect(body.data.consents).toHaveLength(1);
      expect(body.data.consents[0].purpose).toBe('marketing');
      // Customer has 1500 lifetime points; platinum threshold is 500 — already at max tier
      expect(body.data.nextTier).toBeNull();
    });

    it('returns empty account for unknown customer', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const token = await signToken({ id: 'unknown_cust', role: 'customer' });
      const req = new Request('http://localhost/account/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.customerId).toBe('unknown_cust');
      expect(body.data.tier).toBe('member');
      expect(body.data.points).toBe(0);
      expect(body.data.recentOrders).toHaveLength(0);
    });

    it('returns 401 without auth header', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const req = new Request('http://localhost/account/me');
      const res = await crmRouter.fetch(req, env, {} as any);
      expect(res.status).toBe(401);
    });

    it('returns 403 for disallowed role', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const token = await signToken({ id: 'cust_1', role: 'guest' });
      const req = new Request('http://localhost/account/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /account/consent', () => {
    it('records a consent grant for authenticated customer', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const token = await signToken({ id: 'cust_1', role: 'customer' });
      const req = new Request('http://localhost/account/consent', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purpose: 'marketing', granted: true, policyVersion: 'v1' }),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.purpose).toBe('marketing');
      expect(body.data.granted).toBe(1);
      expect(body.data.createdBy).toBe('cust_1');
    });

    it('records a consent revoke for staff acting on customer', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const token = await signToken({ id: 'staff_9', role: 'staff' });
      const req = new Request('http://localhost/account/consent', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purpose: 'analytics', granted: false, customerId: 'cust_1' }),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.granted).toBe(0);
    });

    it('returns 400 for invalid purpose', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const token = await signToken({ id: 'cust_1', role: 'customer' });
      const req = new Request('http://localhost/account/consent', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purpose: 'invalid_thing', granted: true }),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('returns 400 when purpose or granted is missing', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const token = await signToken({ id: 'cust_1', role: 'customer' });
      const req = new Request('http://localhost/account/consent', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purpose: 'marketing' }),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth header', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const seed = {};
      const env = createMockEnv(seed);

      const req = new Request('http://localhost/account/consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'marketing', granted: true }),
      });
      const res = await crmRouter.fetch(req, env, {} as any);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /consent-purposes', () => {
    it('returns the list of valid purposes (public)', async () => {
      const { crmRouter } = await import('../worker/src/routes/crm');
      const req = new Request('http://localhost/consent-purposes');
      const res = await crmRouter.fetch(req, {} as any, {} as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toContain('marketing');
      expect(body.data).toContain('order');
      expect(body.data).toContain('analytics');
      expect(body.data).toContain('referral');
      expect(body.data).toContain('loyalty');
    });
  });
});
