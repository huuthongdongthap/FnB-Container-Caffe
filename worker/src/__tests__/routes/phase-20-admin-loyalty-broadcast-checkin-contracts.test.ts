import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { segmentSQL } from '../../routes/broadcast-handlers/types';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { checkinRouter } from '../../routes/checkin';
import { listSubscriptions, getStatsHandler } from '../../tree/subscriptions/sub-handlers';
import { listPlans } from '../../tree/subscriptions/plan-handlers';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';

vi.mock('../../middleware/auth', () => ({
  requireAuth: () => (_c: any, next: any) => next(),
}));

describe('Phase 20: Admin Loyalty, Broadcast, Checkin & Subscriptions Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Broadcast Segment SQL Contract Aligns with D1 Schema', () => {
    it('uses loyalty_tier for tier-based segments', () => {
      const bronze = segmentSQL('loyalty_bronze');
      expect(bronze.sql).toContain("loyalty_tier = 'bronze'");
      expect(bronze.sql).not.toContain("WHERE tier = 'bronze'");

      const gold = segmentSQL('loyalty_gold');
      expect(gold.sql).toContain("loyalty_tier = 'gold'");

      const platinum = segmentSQL('loyalty_platinum');
      expect(platinum.sql).toContain("loyalty_tier = 'platinum'");
    });

    it('uses date_of_birth for birthday_this_month segment', () => {
      const bday = segmentSQL('birthday_this_month');
      expect(bday.sql).toContain('date_of_birth IS NOT NULL');
      expect(bday.sql).toContain('substr(date_of_birth, 6, 2) = ?');
      expect(bday.params).toBeDefined();
      expect(bday.params?.length).toBe(1);
    });
  });

  describe('2. Admin Loyalty API Contracts (cashback_wallets & loyalty_tier)', () => {
    it('GET /widgets queries cashback_wallets and orders correctly', async () => {
      const app = new Hono();
      app.route('/api/admin-loyalty', adminLoyaltyRouter);

      const db = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(async () => {
              if (sql.includes('loyalty_tier as tier, COUNT(*) as count FROM customers')) return { tier: 'gold', count: 45 };
              if (sql.includes('COUNT(*) as count FROM customers')) return { count: 120 };
              if (sql.includes('SELECT COALESCE(SUM(balance), 0) as total FROM cashback_wallets')) return { total: 500000 };
              if (sql.includes('SELECT COALESCE(SUM(total), 0) as total FROM orders')) return { total: 15000000 };
              return null;
            }),
            all: vi.fn().mockResolvedValue({ results: [] }),
          };
        }),
      };

      const req = new Request('https://test.aura/api/admin-loyalty/widgets');
      const env = { ...createMockEnv(), AURA_DB: db };
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data).toBeInstanceOf(Array);
      const totalMembers = json.data.find((w: any) => w.title === 'Total Members');
      expect(totalMembers.value).toBe(120);
      const cashbackPool = json.data.find((w: any) => w.title === 'Cashback Pool');
      expect(cashbackPool.value).toBe(500000);
      const totalSpend = json.data.find((w: any) => w.title === 'Total Spend');
      expect(totalSpend.value).toBe(15000000);
      const topTier = json.data.find((w: any) => w.title === 'Top Tier');
      expect(topTier.value).toBe('gold');
    });

    it('GET /top-customers queries customers joined with cashback_wallets', async () => {
      const app = new Hono();
      app.route('/api/admin-loyalty', adminLoyaltyRouter);

      const db = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockImplementation(async () => {
              if (sql.includes('cashback_wallets cw ON cw.customer_id = c.id')) {
                return {
                  results: [
                    {
                      id: 'cust-1',
                      name: 'Tran B',
                      phone: '0901234567',
                      tier: 'gold',
                      total_spent: 8500000,
                      visit_count: 14,
                    },
                  ],
                };
              }
              return { results: [] };
            }),
          };
        }),
      };

      const req = new Request('https://test.aura/api/admin-loyalty/top-customers?limit=10');
      const env = { ...createMockEnv(), AURA_DB: db };
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].tier).toBe('gold');
      expect(json.data[0].total_spent).toBe(8500000);
      expect(json.data[0].visit_count).toBe(14);
      const topCustomerSql = db.prepare.mock.calls.map((c: any[]) => String(c[0])).find((s: string) => s.includes('cashback_wallets cw ON cw.customer_id = c.id'));
      expect(topCustomerSql).toContain('o.customer_id = c.id');
      expect(topCustomerSql).toContain("o.status != 'cancelled'");
    });

    it('GET /export produces CSV with cashback_wallets balance and date_of_birth', async () => {
      const app = new Hono();
      app.route('/api/admin-loyalty', adminLoyaltyRouter);

      const db = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'cust-1',
                  name: 'Le C',
                  phone: '0912345678',
                  email: 'lec@aura.test',
                  birthday: '1995-05-15',
                  tier: 'silver',
                  cashback_balance: 75000,
                  total_spent: 1200000,
                  visit_count: 5,
                  created_at: '2026-01-01T00:00:00Z',
                },
              ],
            }),
          };
        }),
      };

      const req = new Request('https://test.aura/api/admin-loyalty/export');
      const env = { ...createMockEnv(), AURA_DB: db };
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');

      const csv = await res.text();
      expect(csv).toContain('ID,Name,Phone,Email,Birthday,Tier,Cashback,Total Spent,Visits,Created');
      expect(csv).toContain('cust-1,"Le C",0912345678,lec@aura.test,1995-05-15,silver,75000,1200000,5');
    });
  });

  describe('3. Checkin Approval ↔ cashback_wallets Contract', () => {
    it('PATCH /api/checkin/:id/approve creates/updates cashback_wallets', async () => {
      const app = new Hono();
      app.route('/api/checkin', checkinRouter);

      let walletCreated = false;
      let walletUpdated = false;

      const db = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          const stmt: any = {
            bind: vi.fn().mockImplementation((...args: any[]) => {
              stmt._args = args;
              return stmt;
            }),
            first: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM checkins WHERE id = ?')) {
                return {
                  id: 'ci_123',
                  customer_id: 'cust_999',
                  customer_name: 'Pham D',
                  reward_amount: 5000,
                  status: 'pending',
                };
              }
              if (sql.includes('FROM cashback_wallets WHERE customer_id = ?')) {
                // simulate wallet exists
                return { id: 'wal_existing', balance: 10000 };
              }
              return null;
            }),
            run: vi.fn().mockImplementation(async () => {
              if (sql.includes('UPDATE checkins SET status = ?')) {
                return { success: true };
              }
              if (sql.includes('UPDATE cashback_wallets SET balance = balance + ?')) {
                walletUpdated = true;
                return { success: true };
              }
              if (sql.includes('INSERT INTO cashback_wallets')) {
                walletCreated = true;
                return { success: true };
              }
              return { success: true };
            }),
          };
          return stmt;
        }),
      };

      const req = new Request('https://test.aura/api/checkin/ci_123/approve', {
        method: 'PATCH',
      });
      const env = { ...createMockEnv(), AURA_DB: db };
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
      expect(walletUpdated).toBe(true);
      expect(walletCreated).toBe(false);
    });
  });

  describe('4. Subscriptions D1 Fallback & Resilience', () => {
    it('listSubscriptions returns empty array without throwing when D1 table is not created', async () => {
      const failingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('no such table: subscriptions');
        }),
      };

      const ctx: any = {
        req: {
          header: vi.fn().mockReturnValue(null),
          query: vi.fn().mockReturnValue(null),
        },
        env: { AURA_DB: failingDb, JWT_SECRET: TEST_JWT_SECRET },
        json: vi.fn().mockImplementation((payload) => payload),
      };

      const res = await listSubscriptions(ctx);
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);
    });

    it('getStatsHandler returns zeroed metrics when D1 table is not created', async () => {
      const failingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('no such table: subscriptions');
        }),
      };

      const ctx: any = {
        env: { AURA_DB: failingDb },
        json: vi.fn().mockImplementation((payload) => payload),
      };

      const res = await getStatsHandler(ctx);
      expect(res.success).toBe(true);
      expect(res.data.mrr_vnd).toBe(0);
      expect(res.data.active_subscriptions).toBe(0);
      expect(res.data.by_zone).toEqual([]);
    });

    it('listPlans returns empty array without throwing when D1 table is not created', async () => {
      const failingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('no such table: subscription_plans');
        }),
      };

      const ctx: any = {
        req: { query: vi.fn().mockReturnValue(null) },
        env: { AURA_DB: failingDb },
        json: vi.fn().mockImplementation((payload) => payload),
      };

      const res = await listPlans(ctx);
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);
    });
  });
});
