import { describe, it, expect, vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerTierHandlers } from '../../routes/openapi-loyalty-handlers/tier-handlers';
import { handlePhoneAuth } from '../../tree/loyalty/phone-auth-handler';
import { handlePhoneOtpRequest } from '../../tree/loyalty/phone-otp-handler';
import { throttle } from '../../tree/loyalty/helpers';
import { authCustomer } from '../../tree/loyalty/auth-middleware';
import { handleSummary } from '../../tree/loyalty/summary-handler';
import { handleLookup } from '../../tree/loyalty/lookup-handler';
import { reverseReferralCashback } from '../../tree/referrals/reverse-cashback';
import { generateJWT } from '../../lib/jwt';
import type { Env } from '../../types/env';

function createKvStore() {
  const data = new Map<string, string>();
  return {
    data,
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    put: vi.fn(async (key: string, val: string) => {
      data.set(key, val);
    }),
    delete: vi.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

describe('Phase 48 Slice AU1 — Loyalty Tiers, Phone Auth/OTP Hardening & Referral Cashback Reversal Integrity', () => {
  describe('AU1-1: Global Loyalty Tier Mutation RBAC, Cross-Tenant Guard & Finite Numeric Bounds', () => {
    function buildTierApp(user: Record<string, unknown> | null, tenantHeader?: string) {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      const executedSql: { sql: string; params: unknown[] }[] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...params: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM loyalty_tier_configs WHERE tier = ?')) {
                return {
                  tier: params[0],
                  name: 'Silver',
                  min_points: 100,
                  max_points: 500,
                  point_multiplier: 1.2,
                  discount_percent: 5,
                };
              }
              return null;
            },
            run: async () => {
              executedSql.push({ sql, params });
              return { meta: { changes: 1 } };
            },
            all: async () => ({ results: [] }),
          }),
        })),
      };

      app.use('*', async (c, next) => {
        (c as unknown as { env: Record<string, unknown> }).env = {
          ...(c.env || {}),
          AURA_DB: db,
        };
        if (user) {
          c.set('user' as never, user as never);
        }
        if (tenantHeader) {
          c.set('tenantId' as never, tenantHeader as never);
        }
        await next();
      });
      registerTierHandlers(app);
      return { app, executedSql };
    }

    it('rejects manager role on PATCH /api/loyalty/tiers/{tier} with 403', async () => {
      const { app, executedSql } = buildTierApp({ id: 'u_mgr', role: 'manager', tenantId: 'default' });
      const res = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minPoints: 200 }),
      });
      expect(res.status).toBe(403);
      expect(executedSql).toHaveLength(0);
    });

    it('rejects non-default user.tenantId even when X-Tenant-ID header is omitted', async () => {
      const { app, executedSql } = buildTierApp({ id: 'u_franchise_admin', role: 'admin', tenantId: 'store-b' });
      const res = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minPoints: 200 }),
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toContain('default tenant admin');
      expect(executedSql).toHaveLength(0);
    });

    it('rejects negative or non-finite numeric fields and out-of-range discounts with 400', async () => {
      const { app } = buildTierApp({ id: 'u_owner', role: 'owner', tenantId: 'default' });

      const negMin = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minPoints: -10 }),
      });
      expect(negMin.status).toBe(400);

      const badMult = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointMultiplier: 0 }),
      });
      expect(badMult.status).toBe(400);

      const badDisc = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountPercent: 150 }),
      });
      expect(badDisc.status).toBe(400);

      const badBdayBonus = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday_bonus: -500 }),
      });
      expect(badBdayBonus.status).toBe(400);

      const badBdayDisc = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday_discount: 120 }),
      });
      expect(badBdayDisc.status).toBe(400);
    });

    it('allows default-tenant owner to update valid tier config including birthday_bonus', async () => {
      const { app, executedSql } = buildTierApp({ id: 'u_owner', role: 'owner', tenantId: 'default' });
      const res = await app.request('/api/loyalty/tiers/silver', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minPoints: 150, pointMultiplier: 1.5, discountPercent: 10, birthday_bonus: 50 }),
      });
      expect(res.status).toBe(200);
      expect(executedSql.some((q) => q.sql.includes('UPDATE loyalty_tier_configs'))).toBe(true);
    });
  });

  describe('AU1-2: Phone Auth & OTP Rate-Limit Bypass, Tenant Isolation, Cross-Tenant Registration & Signup Bonus Cap', () => {
    it('does not bypass throttle when X-Forwarded-For is spoofed as 127.0.0.1 or in production', async () => {
      const kv = createKvStore();
      const makeCtx = (headers: Record<string, string>, environment = 'development') => ({
        env: { AUTH_KV: kv as unknown as Env['AUTH_KV'], ENVIRONMENT: environment },
        req: { header: (name: string) => headers[name] },
      });

      // Spoofed X-Forwarded-For: 127.0.0.1 without CF-Connecting-IP must be rate-limited
      expect(await throttle(makeCtx({ 'X-Forwarded-For': '127.0.0.1' }), 'otp_ip', 2, 300)).toBe(true);
      expect(await throttle(makeCtx({ 'X-Forwarded-For': '127.0.0.1' }), 'otp_ip', 2, 300)).toBe(true);
      expect(await throttle(makeCtx({ 'X-Forwarded-For': '127.0.0.1' }), 'otp_ip', 2, 300)).toBe(false);

      // Even CF-Connecting-IP: 127.0.0.1 is rate-limited when ENVIRONMENT === 'production'
      const prodKv = createKvStore();
      const makeProdCtx = () => ({
        env: { AUTH_KV: prodKv as unknown as Env['AUTH_KV'], ENVIRONMENT: 'production' },
        req: { header: (name: string) => (name === 'CF-Connecting-IP' ? '127.0.0.1' : undefined) },
      });
      expect(await throttle(makeProdCtx(), 'otp_ip', 1, 300)).toBe(true);
      expect(await throttle(makeProdCtx(), 'otp_ip', 1, 300)).toBe(false);
    });

    it('scopes OTP storage and rate-limit keys by tenantId in handlePhoneOtpRequest', async () => {
      const kv = createKvStore();
      const db = {
        prepare: vi.fn(() => ({
          bind: () => ({
            first: async () => ({ id: 'cust_b1', name: 'Store B Member', phone: '0901234567', tenant_id: 'store-b' }),
          }),
        })),
      };

      const ctx = {
        env: {
          AURA_DB: db as unknown as Env['AURA_DB'],
          AUTH_KV: kv as unknown as Env['AUTH_KV'],
          PILOT_TENANT_ID: 'store-b',
        } as Env,
        req: {
          header: () => undefined,
          json: async () => ({ phone: '0901234567' }),
        },
        json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
      };

      const res = await handlePhoneOtpRequest(ctx as never);
      expect(res.status).toBe(200);
      expect(kv.data.has('phone_otp:store-b:0901234567')).toBe(true);
      expect(kv.data.has('phone_otp:0901234567')).toBe(false);
      expect(kv.data.get('rl:otp:phone:store-b:0901234567')).toBe('1');
    });

    it('locks out phone after 5 failed OTP verification attempts in handlePhoneAuth', async () => {
      const kv = createKvStore();
      kv.data.set('phone_otp:default:0909998887', '654321');
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('SELECT id, email, name')) {
                return {
                  id: 'cust_1',
                  name: 'Test User',
                  phone: '0909998887',
                  loyalty_points: 10,
                  lifetime_points: 10,
                  loyalty_tier: 'bronze',
                };
              }
              if (sql.includes('SELECT tenant_id, verified_at')) {
                return { tenant_id: 'default', verified_at: '2026-10-01T00:00:00Z' };
              }
              return null;
            },
          }),
        })),
      };

      const makeAuthCall = async (otp: string, ip: string) => {
        const ctx = {
          env: {
            AURA_DB: db as unknown as Env['AURA_DB'],
            AUTH_KV: kv as unknown as Env['AUTH_KV'],
            JWT_SECRET: 'test-secret-at-least-16-chars-long',
            PILOT_TENANT_ID: 'default',
          } as Env,
          req: {
            header: (n: string) => (n === 'CF-Connecting-IP' ? ip : undefined),
            json: async () => ({ phone: '0909998887', otp }),
          },
          json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
        };
        return handlePhoneAuth(ctx as never);
      };

      for (let i = 0; i < 5; i++) {
        const r = await makeAuthCall('000000', `10.0.0.${i + 1}`);
        expect(r.status).toBe(403);
      }

      // 6th attempt even with rotating IP or valid OTP is locked out with 429
      const lockedRes = await makeAuthCall('654321', '10.0.0.99');
      expect(lockedRes.status).toBe(429);
    });

    it('allows new customer registration in store-b when phone already exists in store-a, and enforces production OTP + campaign cap on signup bonus', async () => {
      const kv = createKvStore();
      kv.data.set('phone_otp:store-b:0912345678', '112233');
      let bonusGranted = 0;
      const insertedCustomers: unknown[][] = [];

      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...params: unknown[]) => ({
            first: async () => {
              if (sql.includes('ORDER BY CASE WHEN')) {
                return {
                  id: 'cust_store_a',
                  name: 'Store A Customer',
                  phone: '0912345678',
                  loyalty_points: 50,
                  lifetime_points: 50,
                  loyalty_tier: 'bronze',
                };
              }
              if (sql.includes('SELECT tenant_id, verified_at')) {
                return { tenant_id: 'store-a', verified_at: '2026-10-01T00:00:00Z' };
              }
              if (sql.includes("WHERE phone = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")) {
                return null;
              }
              if (sql.includes('FROM bonus_campaigns')) {
                return {
                  id: 'camp_1',
                  code: 'OPENING',
                  name: 'Opening Campaign',
                  signup_bonus_vnd: 25000,
                  signup_bonus_cap: 1,
                  tenant_id: 'store-b',
                };
              }
              if (sql.includes('FROM signup_bonus_log')) {
                return { count: bonusGranted };
              }
              return null;
            },
            run: async () => {
              if (sql.includes('INSERT INTO customers')) {
                insertedCustomers.push(params);
              }
              return { meta: { changes: 1 } };
            },
          }),
        })),
        batch: vi.fn(async () => {
          bonusGranted += 1;
          return [];
        }),
      };

      // Without OTP in production: registers customer in store-b but does not grant signup bonus
      const ctxNoOtp = {
        env: {
          AURA_DB: db as unknown as Env['AURA_DB'],
          AUTH_KV: kv as unknown as Env['AUTH_KV'],
          JWT_SECRET: 'test-secret-at-least-16-chars-long',
          PILOT_TENANT_ID: 'store-b',
          ENVIRONMENT: 'production',
        } as Env,
        req: {
          header: (n: string) => (n === 'CF-Connecting-IP' ? '203.0.113.10' : undefined),
          json: async () => ({ phone: '0912345678', name: 'New Store B Customer' }),
        },
        json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
      };

      const resNoOtp = await handlePhoneAuth(ctxNoOtp as never);
      expect(resNoOtp.status).toBe(200);
      const dataNoOtp = (await resNoOtp.json()) as { is_new: boolean; bonus_granted: number };
      expect(dataNoOtp.is_new).toBe(true);
      expect(dataNoOtp.bonus_granted).toBe(0);
      expect(insertedCustomers.length).toBe(1);

      // With valid tenant-b OTP in production: grants signup bonus up to cap
      const ctxWithOtp = {
        env: {
          AURA_DB: db as unknown as Env['AURA_DB'],
          AUTH_KV: kv as unknown as Env['AUTH_KV'],
          JWT_SECRET: 'test-secret-at-least-16-chars-long',
          PILOT_TENANT_ID: 'store-b',
          ENVIRONMENT: 'production',
        } as Env,
        req: {
          header: (n: string) => (n === 'CF-Connecting-IP' ? '203.0.113.11' : undefined),
          json: async () => ({ phone: '0912345678', name: 'New Store B Customer', otp: '112233' }),
        },
        json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
      };

      const resWithOtp = await handlePhoneAuth(ctxWithOtp as never);
      expect(resWithOtp.status).toBe(200);
      const dataWithOtp = (await resWithOtp.json()) as { is_new: boolean; bonus_granted: number };
      expect(dataWithOtp.is_new).toBe(true);
      expect(dataWithOtp.bonus_granted).toBe(25000);
    });
  });

  describe('AU1-3: Referral Cashback Reversal Financial Accuracy & Fallback Tenant Isolation', () => {
    it('clamps debited_vnd to actual wallet balance and decrements total_earned instead of inflating total_spent', async () => {
      const batchCalls: { sql: string; params: unknown[] }[] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql,
            params,
            first: async () => {
              if (sql.includes('FROM referrals WHERE id = ?')) {
                return {
                  id: 'ref_100',
                  referrer_id: 'cust_ref',
                  status: 'completed',
                  cashback_awarded_vnd: 15000,
                  tenant_id: 'store-a',
                };
              }
              if (sql.includes('FROM customers WHERE id = ?')) {
                return { id: 'cust_ref', tenant_id: 'store-a' };
              }
              if (sql.includes('FROM cashback_wallets WHERE customer_id = ?')) {
                return { id: 'cbw_1', customer_id: 'cust_ref', balance: 4000, tenant_id: 'store-a' };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        })),
        batch: vi.fn(async (stmts: { sql: string; params: unknown[] }[]) => {
          batchCalls.push(...stmts);
          return [];
        }),
      };

      const result = await reverseReferralCashback(db as unknown as Env['AURA_DB'], 'ref_100', 'store-a');
      expect(result).toEqual({
        success: true,
        debited_vnd: 4000,
        new_balance: 0,
      });

      const updateWalletStmt = batchCalls.find((s) => s.sql.includes('UPDATE cashback_wallets'));
      expect(updateWalletStmt).toBeDefined();
      expect(updateWalletStmt!.sql).toContain('total_earned = MAX(0, COALESCE(total_earned, 0) - ?)');
      expect(updateWalletStmt!.sql).not.toContain('total_spent = COALESCE(total_spent, 0) + ?');
      expect(updateWalletStmt!.params[0]).toBe(4000);
      expect(updateWalletStmt!.params[1]).toBe(4000);

      const txStmt = batchCalls.find((s) => s.sql.includes('INSERT INTO cashback_transactions'));
      expect(txStmt!.params[3]).toBe(4000);
      expect(txStmt!.params[4]).toBe(0);
    });
  });

  describe('AU1-4: Loyalty Auth JWT Audience/Issuer Verification & Summary/Lookup Fallback Wallet Tenant Guard', () => {
    it('rejects customer JWT with wrong audience when JWT_AUDIENCE is configured on env', async () => {
      const secret = 'test-secret-at-least-16-chars-long';
      const tokenWrongAud = await generateJWT(
        { id: 'cust_1', email: 'c@example.com', role: 'customer', tenantId: 'default', aud: 'wrong-audience', iss: 'aura-loyalty' },
        secret,
        3600
      );

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('/api/loyalty/*', authCustomer);
      app.get('/api/loyalty/summary', (c) => c.json({ success: true }));

      const res = await app.request(
        '/api/loyalty/summary',
        { headers: { Authorization: `Bearer ${tokenWrongAud}` } },
        {
          JWT_SECRET: secret,
          JWT_AUDIENCE: 'expected-audience',
          JWT_ISSUER: 'aura-loyalty',
          PILOT_TENANT_ID: 'default',
        } as unknown as Env
      );
      expect(res.status).toBe(401);
    });

    it('prevents cross-tenant wallet leakage in handleSummary and handleLookup fallback catch blocks', async () => {
      const dbSummary = {
        prepare: vi.fn((sql: string) => ({
          bind: (...params: unknown[]) => ({
            first: async () => {
              if (sql.includes("FROM cashback_wallets WHERE customer_id = ? AND COALESCE")) {
                throw new Error('D1 fallback triggered');
              }
              if (sql.includes('FROM cashback_wallets WHERE customer_id = ?')) {
                return {
                  id: 'wal_other_tenant',
                  customer_id: 'cust_1',
                  balance: 999000,
                  total_earned: 999000,
                  total_spent: 0,
                  tenant_id: 'store-other',
                };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
            all: async () => ({ results: [{ cnt: 0 }] }),
            params,
          }),
        })),
      };

      const summaryCtx = {
        env: { AURA_DB: dbSummary as unknown as Env['AURA_DB'], PILOT_TENANT_ID: 'store-a' } as Env,
        get: (key: string) =>
          key === 'customer'
            ? {
                id: 'cust_1',
                name: 'Member A',
                email: 'a@example.com',
                phone: '0901112223',
                loyalty_tier: 'bronze',
                loyalty_points: 10,
                lifetime_points: 10,
                tenant_id: 'store-a',
              }
            : null,
        json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
      };

      const summaryRes = await handleSummary(summaryCtx as never);
      const summaryJson = (await summaryRes.json()) as { data: { wallet: { balance: number } } };
      expect(summaryJson.data.wallet.balance).toBe(0);

      const dbLookup = {
        prepare: vi.fn((sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM customers WHERE phone = ?')) {
                return {
                  id: 'cust_1',
                  name: 'Member A',
                  phone: '0901112223',
                  loyalty_points: 10,
                  lifetime_points: 10,
                  loyalty_tier: 'bronze',
                  tenant_id: 'store-a',
                };
              }
              if (sql.includes("FROM cashback_wallets WHERE customer_id = ? AND COALESCE")) {
                throw new Error('D1 fallback triggered');
              }
              if (sql.includes('FROM cashback_wallets WHERE customer_id = ?')) {
                return {
                  id: 'wal_other_tenant',
                  customer_id: 'cust_1',
                  balance: 888000,
                  tenant_id: 'store-other',
                };
              }
              return null;
            },
          }),
        })),
      };

      const lookupCtx = {
        env: { AURA_DB: dbLookup as unknown as Env['AURA_DB'], PILOT_TENANT_ID: 'store-a' } as Env,
        req: {
          query: (k: string) => (k === 'phone' ? '0901112223' : undefined),
        },
        json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
      };

      const lookupRes = await handleLookup(lookupCtx as never);
      const lookupJson = (await lookupRes.json()) as { ok: boolean; member: { balance: number } };
      expect(lookupJson.ok).toBe(true);
      expect(lookupJson.member.balance).toBe(0);
    });
  });
});
