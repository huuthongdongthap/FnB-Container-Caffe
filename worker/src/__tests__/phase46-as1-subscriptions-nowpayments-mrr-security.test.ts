import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNowPaymentsInvoice } from '../tree/subscriptions/nowpayments';
import {
  nowPaymentsIPN,
  processNowPaymentsIpn,
} from '../../../packages/domain/payment/commands/nowpayments-ipn';
import {
  normalizeSubscriptionMonthlyVnd,
  updateMRRSnapshot,
} from '../tree/subscriptions/mrr-calculator';
import { createPlan, updatePlan } from '../tree/subscriptions/plan-handlers';
import { getInvoiceReceipt } from '../routes/subscription-receipt';
import { generateJWT } from '../lib/jwt';
import type { Context } from 'hono';
import type { Env } from '../types/env';

async function signHmacSha512(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Phase 46 Slice AS1 — Subscriptions, NowPayments IPN, MRR/ARR, Plan Catalog & Receipt Access', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('NowPayments invoice creation (VND amount & paymentRef)', () => {
    it('sends full amountVnd with price_currency vnd and prefixes invoice id with inv:', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'np_inv_999',
            payment_id: '',
            checkout_url: 'https://nowpayments.io/payment/?iid=np_inv_999',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const res = await createNowPaymentsInvoice(
        { NOWPAYMENTS_API_KEY: 'np_key_test', APP_URL: 'https://aura.test' },
        'inv_local_1',
        15_000_000,
        'Container 20ft'
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0];
      const sentPayload = JSON.parse(String(init?.body));
      expect(sentPayload.price_amount).toBe(15_000_000);
      expect(sentPayload.price_currency).toBe('vnd');
      expect(sentPayload.order_id).toBe('invoice_inv_local_1');
      expect(res).toEqual({
        paymentId: '',
        checkoutUrl: 'https://nowpayments.io/payment/?iid=np_inv_999',
        paymentRef: 'inv:np_inv_999',
      });
    });

    it('rejects non-positive or non-finite amountVnd', async () => {
      await expect(
        createNowPaymentsInvoice({ NOWPAYMENTS_API_KEY: 'np_key_test' }, 'inv_1', 0)
      ).rejects.toThrow(/positive finite/i);
      await expect(
        createNowPaymentsInvoice({ NOWPAYMENTS_API_KEY: 'np_key_test' }, 'inv_1', -5000)
      ).rejects.toThrow(/positive finite/i);
      await expect(
        createNowPaymentsInvoice({ NOWPAYMENTS_API_KEY: 'np_key_test' }, 'inv_1', Number.NaN)
      ).rejects.toThrow(/positive finite/i);
    });
  });

  describe('NowPayments IPN webhook verification & period extension', () => {
    it('verifies x-nowpayments-sig before JSON parsing and returns 400 on malformed JSON', async () => {
      const secret = 'ipn_test_secret_key';
      const malformed = '{invalid_json';
      const validSig = await signHmacSha512(malformed, secret);

      const unsignedRes = await nowPaymentsIPN(
        new Request('https://aura.test/api/webhooks/nowpayments', {
          method: 'POST',
          body: malformed,
        }),
        { NOWPAYMENTS_IPN_SECRET: secret, ENVIRONMENT: 'production' }
      );
      expect(unsignedRes.status).toBe(401);

      const signedMalformedRes = await nowPaymentsIPN(
        new Request('https://aura.test/api/webhooks/nowpayments', {
          method: 'POST',
          headers: { 'x-nowpayments-signature': validSig },
          body: malformed,
        }),
        { NOWPAYMENTS_IPN_SECRET: secret, ENVIRONMENT: 'production' }
      );
      expect(signedMalformedRes.status).toBe(400);
    });

    it('does not double-extend current_period_end for initial subscription invoice with future period end, and accepts inv: payment_ref', async () => {
      const futureStart = '2026-11-01';
      const futureEnd = '2099-12-01';
      let updatedSubArgs: unknown[] = [];

      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM subscription_invoices WHERE payment_ref = ?')) {
                return null;
              }
              if (sql.includes('FROM subscription_invoices WHERE id = ?')) {
                return {
                  id: 'inv_init_1',
                  subscription_id: 'sub_init_1',
                  status: 'pending',
                  amount_vnd: 15_000_000,
                  payment_ref: 'inv:np_hosted_123',
                  tenant_id: 'tenant_a',
                  period_start: futureStart,
                  period_end: futureEnd,
                };
              }
              if (sql.includes('FROM subscriptions WHERE id = ?')) {
                return {
                  id: 'sub_init_1',
                  status: 'active',
                  billing_cycle: 'monthly',
                  current_period_start: futureStart,
                  current_period_end: futureEnd,
                  tenant_id: 'tenant_a',
                };
              }
              if (sql.includes('COUNT(*) as count FROM subscription_invoices')) {
                return { count: 0 };
              }
              return null;
            },
            run: async () => {
              if (sql.startsWith('UPDATE subscriptions SET')) {
                updatedSubArgs = args;
              }
              return { meta: { changes: 1 } };
            },
          }),
        })),
      };

      const res = await processNowPaymentsIpn(db, {
        payment_id: 'pay_actual_999',
        order_id: 'invoice_inv_init_1',
        payment_status: 'finished',
        price_amount: 15_000_000,
        price_currency: 'vnd',
      });

      expect(res.ok).toBe(true);
      expect(updatedSubArgs[0]).toBe(futureStart);
      expect(updatedSubArgs[1]).toBe(futureEnd);
      expect(updatedSubArgs[2]).toBe(futureEnd);
    });

    it('extends current_period_end on renewal when a prior paid invoice exists', async () => {
      const currentStart = '2099-10-01';
      const currentEnd = '2099-11-01';
      let updatedSubArgs: unknown[] = [];

      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM subscription_invoices WHERE id = ?')) {
                return {
                  id: 'inv_renew_2',
                  subscription_id: 'sub_renew_1',
                  status: 'pending',
                  amount_vnd: 15_000_000,
                  payment_ref: 'inv:np_hosted_456',
                  tenant_id: 'default',
                  period_start: '2099-11-01',
                  period_end: '2099-12-01',
                };
              }
              if (sql.includes('FROM subscriptions WHERE id = ?')) {
                return {
                  id: 'sub_renew_1',
                  status: 'active',
                  billing_cycle: 'monthly',
                  current_period_start: currentStart,
                  current_period_end: currentEnd,
                  tenant_id: 'default',
                };
              }
              if (sql.includes('COUNT(*) as count FROM subscription_invoices')) {
                return { count: 1 };
              }
              return null;
            },
            run: async () => {
              if (sql.startsWith('UPDATE subscriptions SET')) {
                updatedSubArgs = args;
              }
              return { meta: { changes: 1 } };
            },
          }),
        })),
      };

      const res = await processNowPaymentsIpn(db, {
        payment_id: 'pay_renew_888',
        order_id: 'invoice_inv_renew_2',
        payment_status: 'finished',
        price_amount: 15_000_000,
        price_currency: 'vnd',
      });

      expect(res.ok).toBe(true);
      expect(updatedSubArgs[0]).toBe(currentEnd);
      expect(updatedSubArgs[1]).toBe('2099-12-01');
    });

    it('enforces payment_ref match and tenant scoping on refunded IPN', async () => {
      const executedQueries: string[] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM subscription_invoices WHERE id = ?')) {
                return {
                  id: 'inv_ref_1',
                  subscription_id: 'sub_ref_1',
                  status: 'paid',
                  amount_vnd: 10_000_000,
                  payment_ref: 'pay_bound_1',
                  tenant_id: 'tenant_franchise_1',
                };
              }
              return null;
            },
            run: async () => {
              executedQueries.push(sql);
              return { meta: { changes: 1 } };
            },
          }),
        })),
      };

      const mismatch = await processNowPaymentsIpn(db, {
        payment_id: 'pay_spoofed_other',
        order_id: 'invoice_inv_ref_1',
        payment_status: 'refunded',
      });
      expect(mismatch.ok).toBe(false);
      expect(mismatch.status).toBe(409);

      const matched = await processNowPaymentsIpn(db, {
        payment_id: 'pay_bound_1',
        order_id: 'invoice_inv_ref_1',
        payment_status: 'refunded',
      });
      expect(matched.ok).toBe(true);
      expect(
        executedQueries.some(
          (q) =>
            q.includes("UPDATE subscription_invoices SET status = 'refunded'") &&
            q.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        )
      ).toBe(true);
      expect(
        executedQueries.some(
          (q) =>
            q.includes("UPDATE subscriptions SET status = 'cancelled'") &&
            q.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        )
      ).toBe(true);
    });
  });

  describe('MRR/ARR billing-cycle normalization', () => {
    it('normalizes monthly, quarterly, and annual billing cycles accurately', () => {
      expect(normalizeSubscriptionMonthlyVnd(12_000_000, 'monthly')).toBe(12_000_000);
      expect(normalizeSubscriptionMonthlyVnd(30_000_000, 'quarterly')).toBe(10_000_000);
      expect(normalizeSubscriptionMonthlyVnd(120_000_000, 'annual')).toBe(10_000_000);
      expect(normalizeSubscriptionMonthlyVnd(120_000_000, 'yearly')).toBe(10_000_000);
      expect(normalizeSubscriptionMonthlyVnd(0, 'monthly')).toBe(0);
    });

    it('uses normalized_mrr when computing MRR and ARR in updateMRRSnapshot', async () => {
      let boundSnapshotArgs: unknown[] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => ({ count: 0 }),
            run: async () => {
              if (sql.includes('INSERT INTO mrr_snapshots')) {
                boundSnapshotArgs = args;
              }
              return {};
            },
          }),
          first: async () => {
            if (sql.includes('normalized_mrr')) {
              return { count: 2, mrr: 150_000_000, normalized_mrr: 20_000_000 };
            }
            return { count: 2, mrr: 150_000_000 };
          },
        })),
      };

      await updateMRRSnapshot(
        db as unknown as import('@cloudflare/workers-types').D1Database,
        'default'
      );

      expect(boundSnapshotArgs[2]).toBe(20_000_000);
      expect(boundSnapshotArgs[3]).toBe(240_000_000);
      expect(boundSnapshotArgs[4]).toBe(2);
      expect(boundSnapshotArgs[8]).toBe(10_000_000);
    });
  });

  describe('Plan catalog handlers (parsed.data & tenant-scoped catch guards)', () => {
    const jwtSecret = 'test_jwt_secret_minimum_32_characters_long_key';

    it('binds parsed.data defaults/aliases in createPlan and fails closed when non-default tenant insert fails', async () => {
      const adminToken = await generateJWT({ role: 'admin' }, jwtSecret);
      const boundInsertArgs: unknown[][] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            run: async () => {
              if (sql.includes('INSERT INTO subscription_plans')) {
                boundInsertArgs.push(args);
              }
              return {};
            },
            first: async () => ({
              id: 'plan_1',
              name: 'Pro Container',
              slug: 'pro-container',
              monthly_price_vnd: 18_000_000,
              features: '["wifi","ac"]',
            }),
          }),
        })),
      };

      const c = {
        env: { AURA_DB: db, JWT_SECRET: jwtSecret },
        get: (key: string) => {
          if (key === 'user') return { id: 'admin_1', role: 'admin', tenantId: 'default' };
          if (key === 'tenantId') return 'default';
          return undefined;
        },
        req: {
          header: (name: string) =>
            name.toLowerCase() === 'authorization' ? `Bearer ${adminToken}` : undefined,
          json: async () => ({
            name: 'Pro Container',
            price: 18_000_000,
            features: '["wifi","ac"]',
          }),
        },
        json: (payload: unknown, status = 200) =>
          new Response(JSON.stringify(payload), { status }),
      } as unknown as Context<{ Bindings: Env }>;

      const res = await createPlan(c);
      expect(res.status).toBe(201);
      expect(boundInsertArgs).toHaveLength(1);
      expect(boundInsertArgs[0][2]).toBe('pro-container');
      expect(boundInsertArgs[0][5]).toBe(18_000_000);
      expect(boundInsertArgs[0][7]).toBe('["wifi","ac"]');

      const failingTenantDb = {
        prepare: vi.fn(() => ({
          bind: () => ({
            run: async () => {
              throw new Error('D1 schema error');
            },
          }),
        })),
      };
      const cTenantFail = {
        env: { AURA_DB: failingTenantDb, JWT_SECRET: jwtSecret },
        get: (key: string) => {
          if (key === 'user') return { id: 'admin_1', role: 'admin', tenantId: 'tenant_franchise_2' };
          if (key === 'tenantId') return 'tenant_franchise_2';
          return undefined;
        },
        req: {
          header: (name: string) =>
            name.toLowerCase() === 'authorization' ? `Bearer ${adminToken}` : undefined,
          json: async () => ({
            name: 'Franchise Plan',
            monthly_price_vnd: 12_000_000,
          }),
        },
        json: (payload: unknown, status = 200) =>
          new Response(JSON.stringify(payload), { status }),
      } as unknown as Context<{ Bindings: Env }>;

      const failRes = await createPlan(cTenantFail);
      expect(failRes.status).toBe(500);
      expect(failingTenantDb.prepare).toHaveBeenCalledTimes(1);
    });

    it('does not fall back to unscoped UPDATE in updatePlan for non-default tenants', async () => {
      const adminToken = await generateJWT({ role: 'admin' }, jwtSecret);
      const executedSql: string[] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: () => ({
            first: async () => ({
              id: 'plan_tenant_1',
              name: 'Old Name',
              slug: 'old-name',
              monthly_price_vnd: 10_000_000,
              features: '[]',
              tenant_id: 'tenant_franchise_2',
            }),
            run: async () => {
              executedSql.push(sql);
              throw new Error('D1 update error');
            },
          }),
        })),
      };

      const c = {
        env: { AURA_DB: db, JWT_SECRET: jwtSecret },
        get: (key: string) => {
          if (key === 'user') return { id: 'admin_1', role: 'admin', tenantId: 'tenant_franchise_2' };
          if (key === 'tenantId') return 'tenant_franchise_2';
          return undefined;
        },
        req: {
          param: () => 'plan_tenant_1',
          header: (name: string) =>
            name.toLowerCase() === 'authorization' ? `Bearer ${adminToken}` : undefined,
          json: async () => ({ name: 'Updated Name', price: 14_000_000 }),
        },
        json: (payload: unknown, status = 200) =>
          new Response(JSON.stringify(payload), { status }),
      } as unknown as Context<{ Bindings: Env }>;

      const res = await updatePlan(c);
      expect(res.status).toBe(500);
      expect(executedSql).toHaveLength(1);
      expect(executedSql[0]).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
    });
  });

  describe('Subscription invoice receipt RBAC & fail-closed tenant verification', () => {
    const baseInvoice = {
      id: 'inv_rcpt_1',
      invoice_number: 'INV-2026-001',
      amount_vnd: 15_000_000,
      status: 'paid',
      customer_id: 'cust_owner_1',
      customer_name: 'Nguyen Van A',
      customer_email: 'owner@example.com',
      subscription_tenant_id: 'tenant_1',
      plan_name: 'Container 20ft',
    };

    function makeContext(
      user: Record<string, unknown> | undefined,
      tenantId: string,
      dbImpl: unknown
    ) {
      return {
        env: { AURA_DB: dbImpl },
        get: (k: string) => {
          if (k === 'user') return user;
          if (k === 'tenantId') return tenantId;
          return undefined;
        },
        req: {
          param: () => 'inv_rcpt_1',
          header: () => undefined,
        },
      } as unknown as Context<{ Bindings: Env }>;
    }

    it('rejects unauthenticated requests with 401 and unauthorized staff roles (waiter/staff) with 403', async () => {
      const db = {
        prepare: () => ({
          bind: () => ({ first: async () => baseInvoice }),
        }),
      };

      const unauthRes = await getInvoiceReceipt(makeContext(undefined, 'tenant_1', db));
      expect(unauthRes.status).toBe(401);

      const waiterRes = await getInvoiceReceipt(
        makeContext({ id: 'u_waiter', role: 'waiter' }, 'tenant_1', db)
      );
      expect(waiterRes.status).toBe(403);

      const genericStaffRes = await getInvoiceReceipt(
        makeContext({ id: 'u_staff', role: 'staff' }, 'tenant_1', db)
      );
      expect(genericStaffRes.status).toBe(403);
    });

    it('allows authorized staff roles and owning customer, and rejects non-owning customer with 403', async () => {
      const db = {
        prepare: () => ({
          bind: () => ({ first: async () => baseInvoice }),
        }),
      };

      const cashierRes = await getInvoiceReceipt(
        makeContext({ id: 'u_cashier', role: 'cashier' }, 'tenant_1', db)
      );
      expect(cashierRes.status).toBe(200);

      const ownerCustomerRes = await getInvoiceReceipt(
        makeContext({ sub: 'cust_owner_1', role: 'customer' }, 'tenant_1', db)
      );
      expect(ownerCustomerRes.status).toBe(200);

      const otherCustomerRes = await getInvoiceReceipt(
        makeContext({ id: 'cust_other_2', role: 'customer' }, 'tenant_1', db)
      );
      expect(otherCustomerRes.status).toBe(403);
    });

    it('fails closed with 404 for non-default tenant when tenant columns cannot be verified', async () => {
      let callCount = 0;
      const legacyDbWithoutTenantColumns = {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              callCount++;
              if (callCount === 1) {
                throw new Error('no such column: s.tenant_id');
              }
              return {
                id: 'inv_rcpt_1',
                invoice_number: 'INV-2026-001',
                amount_vnd: 15_000_000,
                status: 'paid',
                customer_id: 'cust_owner_1',
              };
            },
          }),
        }),
      };

      const res = await getInvoiceReceipt(
        makeContext({ id: 'u_admin', role: 'admin' }, 'tenant_2', legacyDbWithoutTenantColumns)
      );
      expect(res.status).toBe(404);
    });
  });
});
