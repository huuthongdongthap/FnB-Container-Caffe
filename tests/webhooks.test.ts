/**
 * Webhook Routes Tests — POST /api/webhooks/payos
 *
 * Tests for PayOS IPN webhook handler with mocked D1, crypto, and fetch.
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
    sign: vi.fn(async () => new Uint8Array(32).fill(97)),
  },
};

// ── Track D1 call order to debug ──────────────────────────────────
let d1Calls: string[] = [];

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tableData: Record<string, any[]> = {};
  ['payments', 'orders'].forEach(t => { tableData[t] = [...(seedData[t] || [])]; });

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      d1Calls.push('PREP: ' + q.substring(0, 100));
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) {
          this._bindValues.push(...vals);
          d1Calls.push('  BIND: ' + vals.join(','));
          return this;
        }),
        first: vi.fn(async function () {
          d1Calls.push('  FIRST');
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          return rows[0] || null;
        }),
        run: vi.fn(async () => {
          d1Calls.push('  RUN');
          return { success: true };
        }),
      };
      return stmt;
    }),
  };
  return db;
}

let webhookRouter: any;
let env: any;

beforeEach(() => {
  vi.clearAllMocks();
  d1Calls = [];
});

async function mountRouter() {
  const mod = await import('../worker/src/routes/webhooks');
  webhookRouter = mod.webhookRouter;
}

function validSignature(): string {
  return '61'.repeat(32);
}

describe('POST /payos', () => {
  test('acknowledges empty payload (health probe)', async () => {
    env = {
      AURA_DB: createMockD1(),
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await webhookRouter.request('/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env, { waitUntil: vi.fn() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe(0);
    expect(body.message).toMatch(/alive/i);
  });

  test('returns 500 when PAYOS_CHECKSUM_KEY not configured', async () => {
    env = { AURA_DB: createMockD1() };
    await mountRouter();

    const res = await webhookRouter.request('/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: 'abc',
        data: { orderCode: 123, amount: 50000, description: 'test' },
      }),
    }, env, { waitUntil: vi.fn() });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe(1);
  });

  test('processes webhook for known payment with valid signature', async () => {
    env = {
      AURA_DB: createMockD1({
        payments: [
          {
            id: 'pay_1',
            order_id: 'ord-1',
            status: 'pending',
            amount: 50000,
            transaction_id: '12345',
          },
        ],
        orders: [
          { id: 'ord-1', payment_status: 'pending', customer_name: 'Test' },
        ],
      }),
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
      AUTH_KV: {
        get: vi.fn(async () => null),
        put: vi.fn(async () => {}),
      },
    };
    await mountRouter();

    try {
      const res = await webhookRouter.request('/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: validSignature(),
          success: true,
          data: { orderCode: 12345, amount: 50000, description: 'Test order', code: '00' },
        }),
      }, env, { waitUntil: vi.fn() });
      if (res.status !== 200) {
        const errBody = await res.clone().json();
        process.stdout.write('DEBUG D1 calls:\n' + d1Calls.join('\n') + '\n');
        process.stdout.write('DEBUG 500 body: ' + JSON.stringify(errBody) + '\n');
      }
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(0);
    } catch (e: unknown) {
      process.stdout.write('CAUGHT EXCEPTION: ' + String(e) + '\n');
      if (e instanceof Error) {
        process.stdout.write('STACK: ' + (e.stack || '') + '\n');
      }
      throw e;
    }
  });

  test('returns 401 when signature is invalid', async () => {
    env = {
      AURA_DB: createMockD1(),
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await webhookRouter.request('/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: 'invalid_signature_here',
        success: true,
        data: { orderCode: 999, amount: 50000, description: 'Test' },
      }),
    }, env, { waitUntil: vi.fn() });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe(1);
    expect(body.message).toMatch(/invalid signature/i);
  });

  test('acknowledges unknown orderCode gracefully', async () => {
    env = {
      AURA_DB: createMockD1({ payments: [] }),
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await webhookRouter.request('/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: validSignature(),
        success: true,
        data: { orderCode: 99999, amount: 50000, description: 'Test' },
      }),
    }, env, { waitUntil: vi.fn() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe(0);
    expect(body.message).toMatch(/unknown/i);
  });

  test('handles already completed payment without error', async () => {
    env = {
      AURA_DB: createMockD1({
        payments: [
          {
            id: 'pay_2',
            order_id: 'ord-2',
            status: 'completed',
            amount: 30000,
            transaction_id: '67890',
          },
        ],
        orders: [
          { id: 'ord-2', payment_status: 'paid', customer_name: 'Test' },
        ],
      }),
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
      AUTH_KV: {
        get: vi.fn(),
        put: vi.fn(),
      },
    };
    await mountRouter();

    const res = await webhookRouter.request('/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: validSignature(),
        success: true,
        data: { orderCode: 67890, amount: 30000, description: 'Test', code: '00' },
      }),
    }, env, { waitUntil: vi.fn() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/already processed/i);
  });
});
