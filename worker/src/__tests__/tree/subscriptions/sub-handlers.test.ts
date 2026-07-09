import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── helpers – import order is intentional so vi.mock refs are hoisted above ── */
import * as jwtModule from '../../../lib/jwt';
import * as validatorsModule from '../../../lib/validators';
import {
  listSubscriptions,
  getStatsHandler,
  getMRRTrend,
  getSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  deleteSubscription
} from '../../../tree/subscriptions/sub-handlers';
import type { Env } from '../../../types/env';

/* ── static module mocks (must appear before handler imports) ─────────────── */
vi.mock('../../../lib/validators', () => ({
  createSubscriptionSchema: { safeParse: (input: unknown) => ({ success: true, data: input } as const) },
  cancelSubscriptionSchema: { safeParse: (input: unknown) => ({ success: true, data: input } as const) },
  updateSubscriptionSchema: { safeParse: (input: unknown) => ({ success: true, data: input } as const) }
}));

/* ── DB / query builder helpers ───────────────────────────────────────────── */
function makeChain(
  firstResult: unknown = null,
  allResults: unknown[] = [],
  runResult: { success: boolean; changes: number } = { success: true, changes: 0 }
) {
  const chain: Record<string, unknown> = {};
  chain.bind = vi.fn(() => {
    return chain;
  });
  chain.first = vi.fn(async() => firstResult);
  chain.all = vi.fn(async() => ({ results: allResults }));
  chain.run = vi.fn(async() => runResult);
  return chain as never;
}

function makeDB(chains: Record<string, unknown>[] = [makeChain()]): Env['AURA_DB'] {
  const queue = [...chains];
  return { prepare: vi.fn((_sql: string) => queue.shift() ?? makeChain()) } as unknown as Env['AURA_DB'];
}

const MOCK_KV = {} as never;

function makeEnv(db: Env['AURA_DB'], extra: Record<string, unknown> = {}): Env {
  return { JWT_SECRET: 'test-jwt-secret-16chars', AURA_DB: db, AUTH_KV: MOCK_KV, ...extra } as Env;
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
    json: jsonFn };
}

/* ── per-test override for JWT spy ────────────────────────────────────────── */
function mockJWT(payload: Record<string, unknown> = { role: 'owner', customerId: 'cust_1' }) {
  vi.spyOn(jwtModule, 'verifyJWT').mockResolvedValue(payload as never);
}

describe('sub-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listSubscriptions ──────────────────────────────────────────────────────

  describe('listSubscriptions', () => {
    it('returns subscriptions with plan join on happy path', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      const subs = [
        { id: 'sub_1', plan_id: 'plan_1', customer_name: 'Nguyen', status: 'active', features: '["wifi"]', created_at: '2026-01-01' }
      ];
      mockJWT({ role: 'customer', customerId: 'cust_1' });
      const db = makeDB([makeChain([], subs)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { query: () => undefined, header: () => undefined }, jsonSpy);

      await listSubscriptions(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: true, data: expect.arrayContaining([
        expect.objectContaining({ id: 'sub_1', plan_features: ['wifi'] })
      ]) });
    });

    it('filters by status when status query param present', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const db = makeDB([makeChain([], [])]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { query: () => 'active' }, jsonSpy);

      await listSubscriptions(ctx as never);

      const sql = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls[0]?.[0];
      expect(sql).toContain('status = ?');
    });

    it('filters by zone when zone query param present', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const db = makeDB([makeChain([], [])]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { query: () => 'Sky Deck' }, jsonSpy);

      await listSubscriptions(ctx as never);

      const sql = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls[0]?.[0];
      expect(sql).toContain('zone = ?');
    });

    it('resolves vendorId from JWT when Bearer token present (vendor role)', async() => {
      mockJWT({ role: 'vendor', customerId: 'cust_vendor' });
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      const db = makeDB([makeChain([], [])]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { query: () => undefined, header: () => 'Bearer tok' }, jsonSpy);

      await listSubscriptions(ctx as never);

      const sql = (db.prepare as unknown as { mock: { calls: [unknown, string][] } }).mock.calls[0]?.[0];
      expect(sql).toContain('customer_id = ?');
    });
  });

  // ── getStatsHandler ────────────────────────────────────────────────────────

  describe('getStatsHandler', () => {
    it('returns aggregated stats on happy path', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const db = makeDB([
        makeChain({ mrr: 1500000, count: 3 }),
        makeChain([], []),
        makeChain([], []),
        makeChain({ count: 1 }),
        makeChain({ count: 0 }),
        makeChain({ avg: 500000 }),
        makeChain({ under_1m: 1, from_1m_to_3m: 1, from_3m_to_5m: 0, above_5m: 0 }),
        makeChain({ count: 2 }),
        makeChain({ count: 10 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {}, jsonSpy);

      await getStatsHandler(ctx as never);

      const resp = jsonSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(resp.success).toBe(true);
      expect((resp.data as Record<string, unknown>).mrr_vnd).toBe(1500000);
      expect((resp.data as Record<string, unknown>).arr_vnd).toBe(18000000);
    });

    it('handles null active result (no active subscriptions)', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const db = makeDB([
        makeChain(null),
        makeChain([], []),
        makeChain([], []),
        makeChain({ count: 0 }),
        makeChain({ count: 0 }),
        makeChain(null),
        makeChain({ under_1m: 0, from_1m_to_3m: 0, from_3m_to_5m: 0, above_5m: 0 }),
        makeChain({ count: 0 }),
        makeChain({ count: 0 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {}, jsonSpy);

      await getStatsHandler(ctx as never);

      const resp = jsonSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(resp.success).toBe(true);
      expect((resp.data as Record<string, unknown>).mrr_vnd).toBe(0);
    });
  });

  // ── getMRRTrend ────────────────────────────────────────────────────────────

  describe('getMRRTrend', () => {
    it('returns snapshots from DB when available', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const snapshots = [
        { snapshot_date: '2026-07-01', mrr_vnd: 1000000, active_subscriptions: 2 },
        { snapshot_date: '2026-07-02', mrr_vnd: 1200000, active_subscriptions: 3 }
      ];
      const db = makeDB([makeChain([], snapshots)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { query: () => '2' }, jsonSpy);

      await getMRRTrend(ctx as never);

      const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean; data: { source: string; snapshots: unknown[] } };
      expect(resp.success).toBe(true);
      expect(resp.data.source).toBe('snapshots');
      expect(resp.data.snapshots).toHaveLength(2);
    });

    it('falls back to live data when no snapshots exist', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const db = makeDB([
        makeChain([], []),
        makeChain({ mrr: 500000, count: 1 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { query: () => '30' }, jsonSpy);

      await getMRRTrend(ctx as never);

      const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean; data: { source: string } };
      expect(resp.success).toBe(true);
      expect(resp.data.source).toBe('live');
    });
  });

  // ── getSubscription ────────────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('returns subscription with plan and recent invoices', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const sub = { id: 'sub_1', plan_id: 'plan_1', plan_name: 'Basic', plan_features: '["wifi"]', status: 'active' };
      const invoices = [{ id: 'inv_1', status: 'paid' }];
      const db = makeDB([
        makeChain(sub),
        makeChain([], invoices)
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { param: () => 'sub_1' }, jsonSpy);

      await getSubscription(ctx as never);

      const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean; data: Record<string, unknown> };
      expect(resp.success).toBe(true);
      expect(resp.data.id).toBe('sub_1');
      expect(resp.data.plan_features).toEqual(['wifi']);
      expect(resp.data.recent_invoices).toHaveLength(1);
    });

    it('returns 404 when subscription not found', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const db = makeDB([makeChain(null)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, { param: () => 'nonexistent' }, jsonSpy);

      await getSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Subscription not found' }, 404);
    });
  });

  // ── createSubscription ─────────────────────────────────────────────────────

  describe('createSubscription', () => {
    it('creates subscription and returns 201 with data', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const plan = { id: 'plan_1', name: 'Basic', monthly_price_vnd: 500000, deposit_vnd: 0, is_active: 1 };
      const newSub = { id: 'sub_new', plan_id: 'plan_1', status: 'active', plan_name: 'Basic', current_period_end: '2026-02-15' };

      // 9 total queries; queue indices 0..8
      const db = makeDB([
 makeChain(plan) as never, // 0: SELECT plan
 makeChain(undefined, undefined, { success: true, changes: 1 }) as never, // 1: INSERT sub
 makeChain(null) as never, // 2: idempotency SELECT (no existing invoice)
 makeChain(undefined, undefined, { success: true, changes: 1 }) as never, // 3: INSERT invoice
 makeChain(null) as never, // 4: mrr SELECT active subs
 makeChain(null) as never, // 5: mrr SELECT churned subs
 makeChain(null) as never, // 6: mrr SELECT new subs
 makeChain(undefined, undefined, { success: true, changes: 1 }) as never, // 7: mrr INSERT
 makeChain(newSub) as never // 8: final SELECT → newSub
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        json: async() => ({
          plan_id: 'plan_1',
          customer_name: 'Nguyen',
          billing_cycle: 'monthly',
          amount_vnd: 500000
        })
      }, jsonSpy);

      await createSubscription(ctx as never);

      expect(jsonSpy.mock.calls[0]?.[1]).toBe(201);
      const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean; data: { id: string } | null };
      expect(resp.success).toBe(true);
      expect(resp.data).not.toBeNull();
      expect((resp.data as { id: string }).id).toBe('sub_new');

    });
    it('returns 400 when plan not found or inactive', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT();
      const db = makeDB([makeChain(null)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        json: async() => ({ plan_id: 'plan_missing', customer_name: 'Test' })
      }, jsonSpy);

      await createSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Plan not found or inactive' }, 400);
    });
  });

  // ── updateSubscription ─────────────────────────────────────────────────────

  describe('updateSubscription', () => {
    it('updates subscription fields and returns updated data', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const existing = { id: 'sub_1', plan_id: 'plan_1', customer_name: 'Old', status: 'active' };
      const updated = { ...existing, customer_name: 'New' };

      const db = makeDB([
        makeChain(existing), // SELECT id
        makeChain(undefined, undefined, { success: true, changes: 1 }), // UPDATE run
        makeChain(updated) // final SELECT
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token',
        json: async() => ({ customer_name: 'New', customer_phone: '0909123456' })
      }, jsonSpy);

      await updateSubscription(ctx as never);

      const resp = jsonSpy.mock.calls[0]?.[0] as { success: boolean; data: Record<string, unknown> };
      expect(resp.success).toBe(true);
      expect(resp.data.customer_name).toBe('New');
    });

    it('returns 404 when subscription not found', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const db = makeDB([makeChain(null)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'nonexistent',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await updateSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Subscription not found' }, 404);
    });
  });

  // ── cancelSubscription ─────────────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('cancels subscription and sets status to cancelled', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const sub = { id: 'sub_1', status: 'active' };
      const db = makeDB([
        makeChain(sub),
        makeChain(undefined, undefined, { success: true, changes: 1 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token',
        json: async() => ({ reason: 'moved out' })
      }, jsonSpy);

      await cancelSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: true, message: 'Subscription cancelled' });
    });

    it('returns 400 when already cancelled', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const sub = { id: 'sub_1', status: 'cancelled' };
      const db = makeDB([makeChain(sub)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await cancelSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Already cancelled' }, 400);
    });
  });

  // ── pauseSubscription ──────────────────────────────────────────────────────

  describe('pauseSubscription', () => {
    it('pauses an active subscription', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const sub = { id: 'sub_1', status: 'active' };
      const db = makeDB([
        makeChain(sub),
        makeChain(undefined, undefined, { success: true, changes: 1 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await pauseSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: true, message: 'Subscription paused' });
    });

    it('returns 404 when subscription not found', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const db = makeDB([makeChain(null)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'nonexistent',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await pauseSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Subscription not found' }, 404);
    });
  });

  // ── resumeSubscription ─────────────────────────────────────────────────────

  describe('resumeSubscription', () => {
    it('resumes a paused subscription with extended period', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const pausedSub: Record<string, unknown> = {
        id: 'sub_1',
        status: 'paused',
        paused_at: '2026-07-01T00:00:00.000Z',
        current_period_end: '2026-08-01',
        created_at: '2026-01-01'
      };
      const db = makeDB([
        makeChain(pausedSub),
        makeChain(undefined, undefined, { success: true, changes: 1 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await resumeSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Subscription resumed', new_period_end: expect.any(String) })
      );
    });

    it('returns 400 when subscription is not paused', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const sub = { id: 'sub_1', status: 'active', paused_at: null, updated_at: '2026-07-01', created_at: '2026-01-01' };
      const db = makeDB([makeChain(sub)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await resumeSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Subscription is not paused' }, 400);
    });
  });

  // ── deleteSubscription ─────────────────────────────────────────────────────

  describe('deleteSubscription', () => {
    it('deletes a cancelled subscription', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const sub = { status: 'cancelled' };
      const db = makeDB([
        makeChain(sub),
        makeChain(undefined, undefined, { success: true, changes: 1 }),
        makeChain(undefined, undefined, { success: true, changes: 1 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await deleteSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: true, message: 'Subscription deleted' });
    });

    it('returns 400 when trying to delete active subscription', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const sub = { status: 'active' };
      const db = makeDB([
        makeChain(sub),
        makeChain(undefined, undefined, { success: true, changes: 0 }),
        makeChain(undefined, undefined, { success: true, changes: 0 })
      ]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'sub_1',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await deleteSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith(
        { success: false, error: 'Cannot delete active subscription — use cancel endpoint' },
        400
      );
    });

    it('returns 404 when subscription not found', async() => {
      const jsonSpy = vi.fn((data: unknown, status = 200) => ({ status, body: data }));
      mockJWT({ role: 'owner', customerId: 'cust_1' });
      const db = makeDB([makeChain(null)]);
      const env = makeEnv(db);
      const ctx = buildCtx(env, {
        param: () => 'nonexistent',
        header: () => 'Bearer owner-token'
      }, jsonSpy);

      await deleteSubscription(ctx as never);

      expect(jsonSpy).toHaveBeenCalledWith({ success: false, error: 'Subscription not found' }, 404);
    });
  });
});
