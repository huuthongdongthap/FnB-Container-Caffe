import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSpendCashback } from '../../../tree/loyalty/spend-cashback-handler';

const makeCtx = (overrides: {
  customer?: Record<string, unknown>
  order?: Record<string, number> | null
  wallet?: Record<string, number> | null
  spendTx?: { id: string } | null
  updateRes?: { changes: number }
} = {}): unknown => {
  const {
    customer = { id: 'cust_1' },
    order = { total_amount: 100000 },
    wallet = { balance: 50000 },
    spendTx = null,
    updateRes = { changes: 1 }
  } = overrides;
  let i = 0;
  const rows: Array<Record<string, unknown> | null> = [spendTx, order, wallet, { balance: 10000 }];
  return {
    get: () => customer,
    env: { AURA_DB: { prepare: () => ({ bind: () => ({ first: async() => rows[i++] ?? null, run: async() => updateRes }) }) } },
    req: { json: async() => ({ order_id: 'ord_1', amount: 10000 }), header: () => undefined },
    json: (d: unknown, s = 200) => ({ status: s, body: d })
  };
};

describe('handleSpendCashback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for schema-less body', async() => {
    // Mock req.json to return bad body
    const ctx = { ...makeCtx() as Record<string, unknown>, req: { json: async() => ({}), header: () => undefined } };
    const res = await handleSpendCashback(ctx as Parameters<typeof handleSpendCashback>[0]);
    expect((res as Response).status).toBe(400);
  });

  it('spends successfully on happy path', async() => {
    const res = await handleSpendCashback(makeCtx() as Parameters<typeof handleSpendCashback>[0]);
    expect((res as Response).status).toBe(200);
    expect((res as unknown as { body: Record<string, unknown> }).body.success).toBe(true);
  });

  it('blocks when no wallet exists', async() => {
    const res = await handleSpendCashback(makeCtx({ wallet: null }) as Parameters<typeof handleSpendCashback>[0]);
    expect((res as Response).status).toBe(400);
  });

  it('blocks insufficient balance', async() => {
    const res = await handleSpendCashback(makeCtx({ wallet: { balance: 500 }, updateRes: { changes: 0 } }) as Parameters<typeof handleSpendCashback>[0]);
    expect((res as Response).status).toBe(400);
  });
});
