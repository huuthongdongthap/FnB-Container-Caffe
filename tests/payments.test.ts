/**
 * Payment Routes Tests — POST /api/payment/create-link
 *
 * Tests for paymentRouter with PayOS integration, mocked D1, fetch, and crypto.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

// ── Polyfills ─────────────────────────────────────────────────────
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

// ── Mock Web Crypto API ───────────────────────────────────────────
delete (globalThis as any).crypto;
(globalThis as any).crypto = {
  subtle: {
    importKey: vi.fn(async () => ({ type: 'secret', algorithm: { name: 'HMAC', hash: 'SHA-256' } })),
    sign: vi.fn(async () => new Uint8Array(32).fill(97)), // 0x61 = 'a'
  },
};

// ── Mock requireAuth ──────────────────────────────────────────────
vi.mock('../worker/src/middleware/auth', () => ({
  requireAuth: () => {
    return async (c: any, next: any) => {
      c.set('user', { id: 'cust-1', email: 'customer@test.com', name: 'Test Customer', role: 'customer' });
      await next();
    };
  },
}));

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tableData: Record<string, any[]> = {};
  ['orders', 'payments'].forEach(t => { tableData[t] = [...(seedData[t] || [])]; });

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  function parseWhere(sql: string) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const table = fromMatch ? fromMatch[1] : null;
    const condMatch = sql.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/g);
    if (!condMatch || !table) return null;
    const conditions: Array<{ col: string; op: string; bindIdx?: number; literal?: string | number }> = [];
    let bindIdx = 0;
    for (const c of condMatch) {
      const m = c.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/)!;
      const col = m[1]; const op = m[2]; const vt = m[3];
      if (col === '1' && op === '=' && vt === '1') continue;
      if (vt === '?') { conditions.push({ col, op, bindIdx }); bindIdx++; }
      else if (vt.startsWith("'") || vt.startsWith('"')) { conditions.push({ col, op, literal: vt.slice(1, -1) }); }
      else { conditions.push({ col, op, literal: Number(vt) }); }
    }
    if (conditions.length === 0) return null;
    return { table, conditions };
  }

  function matchRow(row: any, conditions: any[], bindValues: any[]) {
    for (const cond of conditions) {
      const val = cond.literal !== undefined ? cond.literal : bindValues[cond.bindIdx];
      const rowVal = row[cond.col];
      if (rowVal == null && val != null) return false;
      switch (cond.op) {
        case '=':  if (String(rowVal) !== String(val)) return false; break;
        case '>':  if (Number(rowVal) <= Number(val)) return false; break;
        case '<':  if (Number(rowVal) >= Number(val)) return false; break;
        default:   if (String(rowVal) !== String(val)) return false; break;
      }
    }
    return true;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function () {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          if (!parsed || !rows.length) return rows[0] || null;
          const matched = rows.filter(r => matchRow(r, parsed.conditions, this._bindValues));
          return matched[0] || null;
        }),
        run: vi.fn(async function () {
          const insertMatch = q.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insertMatch && tableData[insertMatch[1]]) {
            const row: any = {};
            const cols = q.match(/\(([^)]+)\)/);
            if (cols) {
              const names = cols[1].split(',').map((c: string) => c.trim());
              names.forEach((n: string, i: number) => { row[n] = stmt._bindValues[i]; });
            }
            tableData[insertMatch[1]].push(row);
          }
          return { success: true } as any;
        }),
        all: vi.fn(async function () {
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          return { results: [...rows] };
        }),
        batch: vi.fn(async (stmts: any[]) => stmts.map(() => ({ success: true }))),
      };
      return stmt;
    }),
  };
  return db;
}

let mockFetch: ReturnType<typeof vi.fn>;
let paymentRouter: any;
let env: any;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch;
});

async function mountRouter() {
  const mod = await import('../worker/src/routes/payments');
  paymentRouter = mod.paymentRouter;
}

const seedOrder = {
  id: 'ord-1',
  total: 50000,
  payment_status: 'pending',
  customer_id: 'cust-1',
};

describe('POST /create-link', () => {
  test('creates PayOS payment link successfully', async () => {
    // Mock PayOS API response
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({
        code: '00',
        data: { checkoutUrl: 'https://pay.payos.vn/test', paymentLinkId: 'pl_test' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    env = {
      AURA_DB: createMockD1({ orders: [seedOrder], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
      FE_BASE_URL: 'https://auraspace.cafe',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1', description: 'Test order' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://pay.payos.vn/test');
  });

  test('returns 400 on missing order_id', async () => {
    env = {
      AURA_DB: createMockD1({ orders: [], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 when order not found', async () => {
    env = {
      AURA_DB: createMockD1({ orders: [], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'nonexistent' }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  test('returns 409 when order already paid', async () => {
    const paidOrder = { ...seedOrder, payment_status: 'paid' };
    env = {
      AURA_DB: createMockD1({ orders: [paidOrder], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1' }),
    }, env);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/already paid/i);
  });

  test('returns 500 when PayOS env vars not configured', async () => {
    env = {
      AURA_DB: createMockD1({ orders: [seedOrder], payments: [] }),
      // No PayOS env vars
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1' }),
    }, env);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not configured/i);
  });

  test('returns 502 when PayOS API returns error', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: '01', desc: 'Invalid params' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    env = {
      AURA_DB: createMockD1({ orders: [seedOrder], payments: [] }),
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await paymentRouter.request('/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'ord-1' }),
    }, env);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
