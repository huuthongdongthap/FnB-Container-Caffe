// @vitest-environment node
/**
 * Webhook Routes Tests — POST /api/webhooks/payos
 *
 * Tests for PayOS IPN webhook handler with mocked D1, crypto, and fetch.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';
import { createHmac } from 'node:crypto';
import { paymentSqliteDB } from '../worker/src/__tests__/helpers/payment-sqlite-db';

// ── Polyfills ─────────────────────────────────────────────────────
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

// ── Track D1 call order to debug ──────────────────────────────────
let d1Calls: string[] = [];

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const fixture = paymentSqliteDB();
  for (const table of ['orders', 'payments'] as const) {
    for (const row of seedData[table] || []) fixture.seed(table, table === 'orders' ? { total: seedData.payments?.find((payment) => payment.order_id === row.id)?.amount, ...row } : row);
  }
  const prepare = fixture.db.prepare;
  fixture.db.prepare = ((sql: string) => { d1Calls.push('PREP: ' + sql); return prepare(sql); }) as any;
  return fixture.db;
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

function validSignature(data: Record<string, unknown>): string {
  const canonical = Object.keys(data).sort().map(key => `${key}=${data[key]}`).join('&');
  return createHmac('sha256', 'test-checksum-key').update(canonical).digest('hex');
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
            method: 'payos',
            transaction_id: '12345',
          },
        ],
        orders: [
          { id: 'ord-1', payment_status: 'unpaid', payment_method: 'payos', customer_name: 'Test' },
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
          signature: validSignature({ orderCode: 12345, amount: 50000, description: 'Test order', code: '00' }),
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
        signature: validSignature({ orderCode: 99999, amount: 50000, description: 'Test' }),
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
            method: 'payos',
            transaction_id: '67890',
          },
        ],
        orders: [
          { id: 'ord-2', payment_status: 'paid', payment_method: 'payos', customer_name: 'Test' },
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
        signature: validSignature({ orderCode: 67890, amount: 30000, description: 'Test', code: '00' }),
        success: true,
        data: { orderCode: 67890, amount: 30000, description: 'Test', code: '00' },
      }),
    }, env, { waitUntil: vi.fn() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/already processed/i);
  });

  test('does not settle an order when the transaction result code is not successful', async () => {
    env = {
      AURA_DB: createMockD1({
        payments: [{
          id: 'pay_failed', order_id: 'ord-failed', status: 'pending', amount: 30000,
          method: 'payos', transaction_id: '99887',
        }],
        orders: [{ id: 'ord-failed', payment_status: 'unpaid', payment_method: 'payos' }],
      }),
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    };
    await mountRouter();

    const res = await webhookRouter.request('/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: validSignature({ orderCode: 99887, amount: 30000, description: 'Failed transfer', code: '01' }),
        success: true,
        data: { orderCode: 99887, amount: 30000, description: 'Failed transfer', code: '01' },
      }),
    }, env, { waitUntil: vi.fn() });

    expect(res.status).toBe(200);
    expect(d1Calls.some(call => call.includes('UPDATE orders'))).toBe(false);
  });
});
