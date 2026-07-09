import { describe, it, expect, vi, beforeEach } from 'vitest';

// plan-handlers.ts imports requireAdmin from middleware.ts which calls verifyJWT.
// Mock the whole middleware module to stub requireAdmin so it passes through.
vi.mock('../../../tree/subscriptions/middleware', () => ({
  verifyJWT: vi.fn(async() => null as never),
  requireAdmin: vi.fn(async() => null as never),
  requireVendor: vi.fn(async() => null as never)
}));

// plan-handlers.ts imports createPlanSchema, updatePlanSchema from validators.
vi.mock('../../../lib/validators', () => ({
  createPlanSchema: {
    safeParse: vi.fn((raw: unknown) => {
      const body = raw as Record<string, unknown> | undefined;
      if (!body || !body.name || typeof body.name !== 'string') {
        return { success: false, error: { issues: [{ message: 'name is required' }] } } as never;
      }
      return { success: true, data: raw } as never;
    })
  },
  updatePlanSchema: {
    safeParse: vi.fn(() => ({ success: true, data: {} } as never))
  }
}));

import { listPlans, getPlan, createPlan } from '../../../tree/subscriptions/plan-handlers';
import type { Env } from '../../../types/env';
import type { PlanRecord } from '../../../tree/subscriptions/types';

const JWT_SECRET = 'test-jwt-secret-that-is-over-16-chars-long';
const MOCK_KV = {} as never;

// ── Chain / DB helpers ───────────────────────────────────────────────────────

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

function makeDB(chains: Record<string, unknown>[] = [makeChain()], extra: Record<string, unknown> = {}) {
  let chainIndex = 0;
  return {
    prepare: vi.fn((_sql: string) => {
      const c = chains[chainIndex] ?? makeChain();
      chainIndex++;
      return c;
    }),
    ...extra
  } as unknown as Env['AURA_DB'];
}

// ── Context builder ──────────────────────────────────────────────────────────

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

// ── listPlans ───────────────────────────────────────────────────────────────

describe('listPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns plans with parsed features on happy path', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const rows: PlanRecord[] = [{
      id: 'plan_1', name: 'Basic', slug: 'basic', description: '20ft',
      container_size: '20ft', monthly_price_vnd: 500000, deposit_vnd: 0,
      features: '["wifi","pool"]', max_occupants: 2, is_popular: 1,
      is_active: 1, sort_order: 1, created_at: '2026-01-01', updated_at: '2026-01-01'
    }];
    const db = makeDB([makeChain(rows)]);
    const env: Env = { JWT_SECRET, AURA_DB: db, AUTH_KV: MOCK_KV };
    const ctx = buildCtx(env, { query: () => undefined }, jsonSpy);

    await listPlans(ctx as never);

    const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean; data: PlanRecord[] };
    expect(resp.success).toBe(true);
    expect(resp.data[0]).toEqual(expect.objectContaining({
      id: 'plan_1', name: 'Basic', features: ['wifi', 'pool']
    }));
  });

  it('returns empty data when no plans exist', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const db = makeDB([makeChain([])]);
    const env: Env = { JWT_SECRET, AURA_DB: db, AUTH_KV: MOCK_KV };
    const ctx = buildCtx(env, {}, jsonSpy);

    await listPlans(ctx as never);

    expect(jsonSpy.mock.calls[0]?.[0]).toEqual({ success: true, data: [] });
  });
});

// ── getPlan ─────────────────────────────────────────────────────────────────

describe('getPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when plan not found', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const db = makeDB([makeChain([])]);
    const env: Env = { JWT_SECRET, AURA_DB: db, AUTH_KV: MOCK_KV };
    const ctx = buildCtx(env, { param: () => 'nonexistent' }, jsonSpy);

    await getPlan(ctx as never);

    const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean; error?: string };
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('Plan not found');
  });

  it('returns plan with parsed features on happy path', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const row: PlanRecord = {
      id: 'plan_1', name: 'Basic', slug: 'basic', description: '20ft',
      container_size: '20ft', monthly_price_vnd: 500000, deposit_vnd: 0,
      features: '["wifi","pool"]', max_occupants: 2, is_popular: 1,
      is_active: 1, sort_order: 1, created_at: '2026-01-01', updated_at: '2026-01-01'
    };
    const db = makeDB([makeChain([row], row, { success: true, changes: 0 })]);
    const env: Env = { JWT_SECRET, AURA_DB: db, AUTH_KV: MOCK_KV };
    const ctx = buildCtx(env, { param: () => 'plan_1' }, jsonSpy);

    await getPlan(ctx as never);

    const resp = jsonSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(resp.success).toBe(true);
    const data = resp.data as PlanRecord;
    expect(data).toEqual(expect.objectContaining({
      id: 'plan_1', name: 'Basic', features: ['wifi', 'pool']
    }));
  });
});

// ── createPlan ──────────────────────────────────────────────────────────────

describe('createPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts plan and returns 201 with created object', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));

    const newPlan: PlanRecord = {
      id: 'plan_new', name: 'Basic', slug: 'basic', description: '',
      container_size: '20ft', monthly_price_vnd: 500000, deposit_vnd: 0,
      features: '[]', max_occupants: 2, is_popular: 0,
      is_active: 1, sort_order: 0, created_at: '2026-07-01', updated_at: '2026-07-01'
    };

    // 1st prepare (INSERT) -> run() succeeds, 2nd prepare (SELECT) -> first() returns new plan
    const db = makeDB(
      [makeChain([], null, { success: true, changes: 1 }),
        makeChain([], newPlan, { success: true, changes: 0 })]
    );

    const env: Env = { JWT_SECRET, AURA_DB: db, AUTH_KV: MOCK_KV };
    const ctx = buildCtx(env, {
      header: () => 'Bearer owner-token',
      json: async() => ({
        name: 'Basic', slug: 'basic', monthly_price_vnd: 500000,
        features: [], container_size: '20ft', deposit_vnd: 0,
        max_occupants: 2, is_popular: true, is_active: true, sort_order: 0
      })
    }, jsonSpy);

    await createPlan(ctx as never);

    expect(jsonSpy.mock.calls[0]?.[1]).toBe(201);
    const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean };
    expect(resp.success).toBe(true);
  });

  it('returns 400 for body missing name (validation failure)', async() => {
    const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
    const db = makeDB([makeChain([], null, { success: true, changes: 0 })]);
    const env: Env = { JWT_SECRET, AURA_DB: db, AUTH_KV: MOCK_KV };
    const ctx = buildCtx(env, {
      header: () => 'Bearer owner-token',
      json: async() => ({ slug: 'missing-name' })
    }, jsonSpy);

    await createPlan(ctx as never);

    expect(jsonSpy.mock.calls[0]?.[1]).toBe(400);
  });
});
