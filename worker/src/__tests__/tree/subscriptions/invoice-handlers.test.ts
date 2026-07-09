import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../tree/subscriptions/middleware', () => ({
  verifyJWT: vi.fn(async() => null as never),
  requireAdmin: vi.fn(async() => null as never),
  requireVendor: vi.fn(async() => null as never)
}));

vi.mock('../../../lib/validators', () => ({
  payInvoiceSchema: {
    safeParse: vi.fn((raw: unknown) => ({
      success: true,
      data: (raw as Record<string, unknown> | undefined) ?? {}
    } as never))
  }
}));

import { listInvoices, payInvoice, generateInvoices } from '../../../tree/subscriptions/invoice-handlers';
import type { Env } from '../../../types/env';

const JWT_SECRET = 'test-jwt-secret-that-is-over-16-chars-long';

function makeChain(
  allResult: unknown[] = [],
  firstResult: unknown = null,
  runResult: { success: boolean; changes: number } = { success: true, changes: 0 }
) {
  const chain: Record<string, unknown> = {};
  chain.bind = vi.fn(() => {
    return chain;
  });
  chain.all = vi.fn(async() => ({ results: allResult }));
  chain.first = vi.fn(async() => firstResult);
  chain.run = vi.fn(async() => runResult);
  return chain as never;
}

function makeDB(chains: Record<string, unknown>[] = [makeChain()]) {
  const queue = [...chains];
  return {
    prepare: vi.fn((_sql: string) => queue.shift() ?? makeChain())
  };
}

function makeEnv(dbStub: Record<string, unknown>, extra?: Partial<Env>): Env {
  return {
    ...extra,
    JWT_SECRET,
    AURA_DB: dbStub as unknown as Env['AURA_DB']
  } as Env;
}

function buildCtx(
  env: Env,
  req: Record<string, unknown> = {},
  jsonFn: ReturnType<typeof vi.fn> = vi.fn((data: unknown, status = 200) => ({ status, body: data }))
): Record<string, unknown> {
  return {
    env,
    req: {
      query: vi.fn(() => undefined),
      param: vi.fn(() => undefined),
      json: vi.fn(async() => ({})),
      header: vi.fn(() => undefined),
      ...req
    },
    json: jsonFn
  };
}

describe('listInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invoices from DB on happy path', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const rows = [{ id: 'inv_1', status: 'pending', customer_name: 'Nguyen', plan_name: 'Basic' }];
    const db = makeDB([makeChain(rows, rows[0], { success: true, changes: 0 })]);
    const env = makeEnv(db);
    const ctx = buildCtx(env, { query: () => undefined, param: () => undefined }, jsonSpy);
    await listInvoices(ctx as never);
    expect(jsonSpy).toHaveBeenCalledWith({ success: true, data: rows });
  });

  it('returns empty array when no invoices', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const db = makeDB([makeChain([], null, { success: true, changes: 0 })]);
    const env = makeEnv(db);
    const ctx = buildCtx(env, {}, jsonSpy);
    await listInvoices(ctx as never);
    expect(jsonSpy).toHaveBeenCalledWith({ success: true, data: [] });
  });
});

describe('payInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when invoice not found', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const db = makeDB([makeChain([], null, { success: true, changes: 0 })]);
    const env = makeEnv(db);
    const ctx = buildCtx(
      env,
      { param: () => 'inv_1', header: () => 'Bearer owner-token', json: async() => ({ payment_method: 'bank_transfer' }) },
      jsonSpy
    );
    await payInvoice(ctx as never);
    expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Invoice not found' }, 404);
  });

  it('marks invoice as paid on happy path', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const invoice = {
      id: 'inv_1', status: 'pending', subscription_id: 'sub_1',
      amount_vnd: 500000, customer_name: 'Nguyen', plan_name: 'Basic',
      period_start: '2026-01-01', period_end: '2026-02-01'
    };
    const selChain = makeChain([invoice], invoice, { success: true, changes: 1 });
    const updInvChain = makeChain([], null, { success: true, changes: 1 });
    const updSubChain = makeChain([], null, { success: true, changes: 1 });
    const db = makeDB([selChain, updInvChain, updSubChain]);
    const env = makeEnv(db);
    const ctx = buildCtx(
      env,
      { param: () => 'inv_1', header: () => 'Bearer owner-token', json: async() => ({ payment_method: 'bank_transfer', payment_ref: 'ref_1' }) },
      jsonSpy
    );
    await payInvoice(ctx as never);
    expect(jsonSpy).toHaveBeenCalledWith({ success: true, message: 'Invoice marked as paid', data: { id: 'inv_1', status: 'paid' } });
  });
});

describe('generateInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates invoices for due subscriptions', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const subs = [{ id: 'sub_1', billing_cycle: 'monthly', amount_vnd: 500000, container_number: null }];
    const selChain = makeChain(subs, subs[0], { success: true, changes: 0 });
    const insChain = makeChain([], null, { success: true, changes: 1 });
    const db = makeDB([selChain, insChain]);
    const env = makeEnv(db);
    const ctx = buildCtx(env, { header: () => 'Bearer owner-token', param: () => undefined }, jsonSpy);
    await generateInvoices(ctx as never);
    expect(jsonSpy).toHaveBeenCalledWith({ success: true, message: expect.stringContaining('Generated'), generated_count: 1 });
  });

  it('returns generated_count 0 when no due subscriptions', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const db = makeDB([makeChain([], null, { success: true, changes: 0 })]);
    const env = makeEnv(db);
    const ctx = buildCtx(env, { header: () => 'Bearer owner-token' }, jsonSpy);
    await generateInvoices(ctx as never);
    const call = jsonSpy.mock.calls[0];
    expect((call?.[0] as { success: boolean; generated_count?: number }).generated_count).toBe(0);
  });
});
