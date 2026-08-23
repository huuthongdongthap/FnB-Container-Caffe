/**
 * POS Customer Lookup Route — unit tests.
 * Tests GET /api/pos/customer?phone= with scripted D1 mock.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { posCustomerRouter } from '../../routes/pos-customer';
import { requireStaff } from '../../middleware/staff-auth';
import { generateJWT } from '../../lib/jwt';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedRow { [key: string]: unknown }

function makeScriptedDB(rowsBySql: Array<{ match: (sql: string) => boolean; rows: ScriptedRow[]; firstRow?: ScriptedRow | null }>): D1Database {
  const callLog: string[] = [];
  const boundLog: { sql: string; args: unknown[] }[] = [];
  let idx = 0;
  const db = {
    _log: callLog,
    _bound: boundLog,
    prepare: (sql: string) => {
      callLog.push(sql);
      let handler = rowsBySql[idx];
      if (handler && !handler.match(sql)) handler = rowsBySql.find(h => h.match(sql));
      if (handler) idx = rowsBySql.indexOf(handler) + 1;
      const rows = handler?.rows ?? [];
      const firstRow = handler?.firstRow !== undefined ? handler.firstRow : (rows[0] ?? null);
      const stmt = {
        bind: (...args: unknown[]) => { boundLog.push({ sql, args }); return stmt; },
        run: async () => ({ success: true, changes: 1, lastRowId: 1, meta: {} }),
        first: async () => firstRow,
        all: async () => ({ results: rows, success: true, meta: {} }),
        raw: async () => [],
      };
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  } as unknown as D1Database;
  return db;
}

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';
const TEST_KV = new Map<string, string>();

function makeEnv(db: D1Database) {
  TEST_KV.clear();
  return {
    AURA_DB: db,
    AUTH_KV: {
      get: async (k: string) => (TEST_KV.has(k) ? TEST_KV.get(k) : null),
      put: async (k: string, v: string) => { TEST_KV.set(k, v); },
      delete: async (k: string) => { TEST_KV.delete(k); },
    } as any,
    JWT_SECRET: TEST_JWT_SECRET,
  } as any;
}

const testApp = new Hono<{ Bindings: any }>();
testApp.use('/api/pos/customer*', requireStaff(['owner', 'manager', 'staff', 'waiter']));
testApp.route('/api/pos/customer', posCustomerRouter);

async function fetchHandler(db: D1Database, method: string, path: string, body?: unknown, role: string = 'staff') {
  const token = await generateJWT({ id: 'u1', email: 'a@b.c', name: 'A', role }, TEST_JWT_SECRET);
  const req = new Request(`https://test.aura${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined && body !== null ? { body: JSON.stringify(body) } : {}),
  });
  const res = await testApp.fetch(req, makeEnv(db), { waitUntil: () => {} } as any);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

describe('pos-customer routes', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeScriptedDB([]);
  });

  it('returns 400 when phone parameter is missing', async () => {
    const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer');
    expect(status).toBe(400);
    expect(json.error || json.message).toContain('Thiếu');
  });

  it('returns 400 when phone format is invalid', async () => {
    const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=123');
    expect(status).toBe(400);
    expect(json.error || json.message).toContain('không hợp lệ');
  });

  it('returns 401 when no auth token provided', async () => {
    const req = new Request('https://test.aura/api/pos/customer?phone=0912345678', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await testApp.fetch(req, makeEnv(db), { waitUntil: () => {} } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when customer role tries to access', async () => {
    const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=0912345678', null, 'customer');
    expect(status).toBe(403);
    expect(json.error).toContain('Không có quyền');
  });

  it('returns found=false when customer not found', async () => {
    db = makeScriptedDB([
      {
        match: (sql) => sql.includes('FROM customers'),
        rows: [],
        firstRow: null,
      },
    ]);
    const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=0912345678');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.found).toBe(false);
    expect(json.message).toContain('Không tìm thấy');
  });

  it('returns customer data when found', async () => {
    const mockCustomer = {
      id: 'cust_123',
      name: 'Nguyễn Văn An',
      phone: '0912345678',
      email: 'an@example.com',
      loyalty_tier: 'gold',
      loyalty_points: 1500,
      lifetime_points: 5000,
      created_at: '2024-01-15T10:00:00Z',
      cashback_balance: 250000,
      total_earned: 500000,
      total_spent: 2000000,
      visit_count: 12,
    };

    db = makeScriptedDB([
      {
        match: (sql) => sql.includes('FROM customers'),
        rows: [mockCustomer],
        firstRow: mockCustomer,
      },
    ]);

    const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=0912345678');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.found).toBe(true);
    expect(json.customer).toBeDefined();
    expect(json.customer.id).toBe('cust_123');
    expect(json.customer.name).toBe('Nguyễn Văn An');
    expect(json.customer.phone).toBe('0912345678');
    expect(json.customer.loyalty_tier).toBe('gold');
    expect(json.customer.loyalty_tier_label).toBe('Vàng');
    expect(json.customer.loyalty_points).toBe(1500);
    expect(json.customer.cashback_balance).toBe(250000);
    expect(json.customer.visit_count).toBe(12);
  });

  it('normalizes phone with +84 prefix', async () => {
    const mockCustomer = {
      id: 'cust_123',
      name: 'Test User',
      phone: '0912345678',
      email: 'test@example.com',
      loyalty_tier: 'silver',
      loyalty_points: 500,
      lifetime_points: 1000,
      created_at: '2024-01-15T10:00:00Z',
      cashback_balance: 0,
      total_earned: 0,
      total_spent: 0,
      visit_count: 1,
    };

    db = makeScriptedDB([
      {
        match: (sql) => sql.includes('FROM customers'),
        rows: [mockCustomer],
        firstRow: mockCustomer,
      },
    ]);

    const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=%2B84912345678');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.found).toBe(true);
    expect(json.customer.phone).toBe('0912345678');
  });

  it('normalizes phone with spaces and dashes', async () => {
    const mockCustomer = {
      id: 'cust_123',
      name: 'Test User',
      phone: '0912345678',
      email: 'test@example.com',
      loyalty_tier: 'bronze',
      loyalty_points: 100,
      lifetime_points: 200,
      created_at: '2024-01-15T10:00:00Z',
      cashback_balance: 0,
      total_earned: 0,
      total_spent: 0,
      visit_count: 1,
    };

    db = makeScriptedDB([
      {
        match: (sql) => sql.includes('FROM customers'),
        rows: [mockCustomer],
        firstRow: mockCustomer,
      },
    ]);

    const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=0912-345-678');
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.found).toBe(true);
    expect(json.customer.phone).toBe('0912345678');
  });

  it('accepts all valid staff roles', async () => {
    const mockCustomer = {
      id: 'cust_123',
      name: 'Test User',
      phone: '0912345678',
      email: 'test@example.com',
      loyalty_tier: 'bronze',
      loyalty_points: 100,
      lifetime_points: 200,
      created_at: '2024-01-15T10:00:00Z',
      cashback_balance: 0,
      total_earned: 0,
      total_spent: 0,
      visit_count: 1,
    };

    for (const role of ['owner', 'manager', 'staff', 'waiter']) {
      db = makeScriptedDB([
        {
          match: (sql) => sql.includes('FROM customers'),
          rows: [mockCustomer],
          firstRow: mockCustomer,
        },
      ]);
      const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=0912345678', null, role);
      expect(status).toBe(200);
      expect(json.success).toBe(true);
    }
  });

  it('maps tier labels correctly', async () => {
    const tiers = [
      { tier: 'bronze', label: 'Đồng' },
      { tier: 'silver', label: 'Bạc' },
      { tier: 'gold', label: 'Vàng' },
      { tier: 'platinum', label: 'Bạch kim' },
    ];

    for (const { tier, label } of tiers) {
      const mockCustomer = {
        id: 'cust_123',
        name: 'Test User',
        phone: '0912345678',
        email: 'test@example.com',
        loyalty_tier: tier,
        loyalty_points: 100,
        lifetime_points: 200,
        created_at: '2024-01-15T10:00:00Z',
        cashback_balance: 0,
        total_earned: 0,
        total_spent: 0,
        visit_count: 1,
      };

      db = makeScriptedDB([
        {
          match: (sql) => sql.includes('FROM customers'),
          rows: [mockCustomer],
          firstRow: mockCustomer,
        },
      ]);

      const { status, json } = await fetchHandler(db, 'GET', '/api/pos/customer?phone=0912345678');
      expect(status).toBe(200);
      expect(json.customer.loyalty_tier_label).toBe(label);
    }
  });
});