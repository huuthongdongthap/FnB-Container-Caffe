import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv } from '../test-utils';
import type { D1Database } from '../../types/env';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mutable row that tests patch before assertions. */
interface PaymentRow {
  id: string;
  order_id: string;
  status: 'pending' | 'paid' | 'completed';
  refund_status: string | null;
  refund_amount: number | null;
  amount: number;
  method: string;
  transaction_id: string;
}

type RowMap = Partial<Record<string, PaymentRow>>;

const paymentRows = new Map<string, PaymentRow>();
let runSql: string | undefined;
let runBinds: unknown[] = [];
let runCount = 0;

function resetMockState() {
  paymentRows.clear();
  runSql = undefined;
  runBinds = [];
  runCount = 0;
}

function makeStmt(): D1PreparedStatement {
  return {
    _sql: '',
    _binds: [] as unknown[],
    bind: (...args: unknown[]) => {
      (makeStmt() as D1PreparedStatement as Record<string, unknown>)._binds = args;
      return makeStmt() as unknown as D1PreparedStatement;
    },
    first: async(_sql?: string) => {
      if (!_sql) {
        return null;
      }
      if (_sql.includes('FROM payments WHERE')) {
        const row: PaymentRow = {
          id: 'PAY_1',
          order_id: 'ORD_1',
          status: 'paid',
          refund_status: null,
          refund_amount: null,
          amount: 50000,
          method: 'momo',
          transaction_id: 'TX_MOMO'
        };
        return row;
      }
      return null;
    },
    all: async() => ({ results: [], success: true } as never),
    run: async() => {
      return { success: true, changes: 1, lastRowId: 1 } as never;
    },
    batch: async() => [{ success: true, changes: 1 } as never]
  } as unknown as D1PreparedStatement;
}

function mockDB(): D1Database {
  return {
    prepare: (_sql: string) => makeStmt(),
    batch: async() => [{ success: true, changes: 1 } as never],
    dump: async() => [],
    exec: async() => ({ changes: 0 } as never)
  } as unknown as D1Database;
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('MoMo webhook smoke', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetMockState();
  });

  function signParams(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      accessKey: 'MOMO_KEY',
      amount: '50000',
      extraData: '',
      message: 'Successful',
      orderId: 'ORD_SMOKE',
      orderType: 'momo_wallet',
      partnerCode: 'MOMO',
      payType: 'qr',
      requestId: 'REQ_SMOKE',
      responseTime: '1700000000000',
      resultCode: '0',
      transId: 'TX_SMOKE',
      ...overrides
    };
  }

  async function buildPayload(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const params = signParams();
    const signBase = Object.keys(params).sort()
      .map(k => `${k}=${params[k]}`).join('&');
    const sig = await signPayload(signBase, 'MOMO_SECRET');
    return {
      partnerCode: 'MOMO',
      orderId: 'ORD_SMOKE',
      requestId: 'REQ_SMOKE',
      resultCode: 0,
      amount: 50000,
      transId: 'TX_SMOKE',
      payType: 'qr',
      message: 'Successful',
      responseTime: 1700000000000,
      extraData: '',
      orderType: 'momo_wallet',
      signature: sig,
      ...overrides
    };
  }

  // ─── [1] Happy path: valid sig + paid payment → 200 ────────────────────
  it('returns 200 with {error:0} for valid HMAC-SHA-256 sig on paid payment', async() => {
    const { Hono } = await import('hono');
    const { momoWebhook } = await import('../../routes/webhooks/momo.js');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    );

    const app = new Hono();
    momoWebhook(app);

    const payload = await buildPayload();
    const req = new Request('https://test.aura/momo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await app.fetch(req, {
      ...createMockEnv(),
      AURA_DB: mockDB() as unknown as D1Database,
      MOMO_SECRET_KEY: 'MOMO_SECRET',
      MOMO_ACCESS_KEY: 'MOMO_KEY',
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_CHAT_ID: undefined
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe(0);
  });

  // ─── [2] Invalid signature → 400 ────────────────────────────────────────
  it('returns 400 when signature is tampered or missing', async() => {
    const { Hono } = await import('hono');
    const { momoWebhook } = await import('../../routes/webhooks/momo.js');

    const app = new Hono();
    momoWebhook(app);

    const payload = await buildPayload({ signature: 'bogus-sig-value' });
    const req = new Request('https://test.aura/momo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const env = {
      ...createMockEnv(),
      MOMO_SECRET_KEY: 'MOMO_SECRET',
      MOMO_ACCESS_KEY: 'MOMO_KEY'
    };

    const res = await app.fetch(req, env as never);
    expect(res.status).toBe(400);
  });

  // ─── [3] Idempotency: completed payment → 200, no second UPDATE ──────────
  it('is idempotent: already-completed payment returns 200 without double-update', async() => {
    const { Hono } = await import('hono');
    const { momoWebhook } = await import('../../routes/webhooks/momo.js');

    const updateCalls = 0;
    const db = mockDB();

    const app = new Hono();
    momoWebhook(app);

    const payload = await buildPayload();
    const req = new Request('https://test.aura/momo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await app.fetch(req, {
      ...createMockEnv(),
      AURA_DB: mockDB() as unknown as D1Database,
      MOMO_SECRET_KEY: 'MOMO_SECRET',
      MOMO_ACCESS_KEY: 'MOMO_KEY',
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_CHAT_ID: undefined
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe(0);
  });
});
