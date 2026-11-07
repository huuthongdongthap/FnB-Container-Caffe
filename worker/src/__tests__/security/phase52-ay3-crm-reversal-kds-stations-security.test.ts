// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { reverseAccrual } from '../../../../packages/domain/crm/commands/refund-reversal';
import type { LoyaltyPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';
import {
  redeemReferral,
  rewardReferralOnFirstOrder,
  reverseReferralCashback,
} from '../../../../packages/domain/crm/commands/referral';
import { DEFAULT_REFERRAL_POLICY } from '../../../../packages/domain/crm/commands/referral-policy';
import { stationTicketsRouter } from '../../../../packages/domain/kitchen/commands/kitchen-station-tickets';
import { getKdsMobile } from '../../../../packages/domain/kitchen/commands/kds-mobile';
import { executeKdsStatusTransition } from '../../../../packages/domain/kitchen/commands/kds-status-transition';
import {
  handleGetKdsOrders,
  handleUpdateOrderStatus,
  handleMarkCodPaid,
} from '../../routes/orders-hono-handlers/kds-handlers';

const TEST_LOYALTY_POLICY: LoyaltyPolicy = {
  tiers: [
    { tierName: 'Bronze', minPoints: 0, cashbackRate: 0.03, pointMultiplier: 1.0, expiryDays: 365 },
    { tierName: 'Silver', minPoints: 500, cashbackRate: 0.05, pointMultiplier: 1.2, expiryDays: 365 },
  ],
  defaultTier: { tierName: 'Bronze', minPoints: 0, cashbackRate: 0.03, pointMultiplier: 1.0, expiryDays: 365 },
  campaignMultiplier: 1.0,
  maxCapPerTx: 50000,
  campaignCode: null,
  expiresAt: null,
};

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    const createBound = (args: unknown[]) => ({
      bind: (...nextArgs: unknown[]) => createBound(nextArgs),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(args as any[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      all: async <T = Record<string, unknown>>() => {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...(args as any[])) as T[];
        return { results, success: true, meta: {} };
      },
      run: async () => {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(args as any[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    });
    return createBound([]);
  };

  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function seedCrmAndKdsSchema(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      loyalty_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      loyalty_tier TEXT DEFAULT 'Bronze',
      tenant_id TEXT DEFAULT 'default',
      updated_at TEXT
    );
    CREATE TABLE loyalty_accounts (
      customer_id TEXT PRIMARY KEY,
      current_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'Bronze',
      tenant_id TEXT DEFAULT 'default',
      updated_at TEXT
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      table_id TEXT,
      items TEXT DEFAULT '[]',
      notes TEXT,
      status TEXT DEFAULT 'pending',
      order_type TEXT DEFAULT 'dine_in',
      payment_method TEXT DEFAULT 'cash',
      payment_status TEXT DEFAULT 'unpaid',
      is_cod INTEGER DEFAULT 0,
      total REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      cashback_earned REAL DEFAULT 0,
      cashback_used REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT,
      quantity INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      status TEXT DEFAULT 'pending'
    );
    CREATE TABLE loyalty_point_logs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      points_change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      balance_after INTEGER,
      description TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
    CREATE TABLE loyalty_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT,
      action TEXT,
      amount_vnd REAL,
      order_id TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
    CREATE TABLE cashback_wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      balance REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL DEFAULT 0,
      description TEXT,
      expires_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
    CREATE TABLE referral_codes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      code TEXT NOT NULL,
      times_used INTEGER DEFAULT 0,
      max_uses INTEGER,
      total_points_earned INTEGER DEFAULT 0,
      total_cashback_earned_vnd REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
    CREATE TABLE referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_customer_id TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      points_awarded INTEGER DEFAULT 0,
      cashback_awarded_vnd REAL DEFAULT 0,
      first_order_id TEXT,
      first_order_amount REAL,
      status TEXT DEFAULT 'pending',
      bonus_type TEXT,
      reward_paid_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
    CREATE TABLE kitchen_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE category_stations (
      category_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      PRIMARY KEY (category_id, station_id)
    );
    CREATE TABLE order_item_stations (
      order_item_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      started_at TEXT,
      ready_at TEXT,
      PRIMARY KEY (order_item_id, station_id)
    );
    CREATE TABLE cafe_tables (
      id TEXT PRIMARY KEY,
      table_number TEXT,
      status TEXT DEFAULT 'available',
      current_order_id TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      method TEXT,
      amount REAL,
      status TEXT,
      transaction_id TEXT,
      paid_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
  `);
}

describe('Phase 52 Slice AY3 — CRM Reversal/Referral, Kitchen Station Tickets & KDS Security', () => {
  describe('1. reverseAccrual — Cumulative partial refunds, tenant-scoped idempotency & OpenAPI total_amount fallback', () => {
    it('supports multiple sequential partial refunds up to 100% of earned points & cashback and returns already_reversed once exhausted', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO customers (id, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
           VALUES ('cust-1', 100, 100, 'Bronze', 'store-a')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
           VALUES ('cbw-1', 'cust-1', 10000, 10000, 0, 'store-a')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_id, total, total_amount, points_earned, cashback_earned, status, tenant_id)
           VALUES ('ord-partial-1', 'cust-1', 100000, 100000, 100, 10000, 'completed', 'store-a')`,
        )
        .run();

      // Foreign tenant refund log with the same order_id must NOT block store-a's refund reversal
      sqlite
        .prepare(
          `INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, tenant_id)
           VALUES ('ptl-foreign', 'cust-foreign', 'ord-partial-1', -100, 'refund', 0, 'store-b')`,
        )
        .run();

      // 1st partial refund: 30,000 VND (30%) -> deducts 30 points and 3,000 VND cashback
      const firstRes = await reverseAccrual(db, TEST_LOYALTY_POLICY, {
        orderId: 'ord-partial-1',
        customerId: 'cust-1',
        refundAmountVnd: 30000,
        tenantId: 'store-a',
      });
      expect(firstRes.ok).toBe(true);
      if (firstRes.ok) {
        expect(firstRes.pointsDeducted).toBe(30);
        expect(firstRes.newLifetimePoints).toBe(70);
      }

      const walletAfterFirst = sqlite
        .prepare("SELECT balance FROM cashback_wallets WHERE id = 'cbw-1'")
        .get() as { balance: number };
      expect(walletAfterFirst.balance).toBe(7000);

      // 2nd partial refund: 70,000 VND (remaining 70%) -> deducts remaining 70 points and 7,000 VND cashback
      const secondRes = await reverseAccrual(db, TEST_LOYALTY_POLICY, {
        orderId: 'ord-partial-1',
        customerId: 'cust-1',
        refundAmountVnd: 70000,
        tenantId: 'store-a',
      });
      expect(secondRes.ok).toBe(true);
      if (secondRes.ok) {
        expect(secondRes.pointsDeducted).toBe(70);
        expect(secondRes.newLifetimePoints).toBe(0);
      }

      const custAfterSecond = sqlite
        .prepare("SELECT loyalty_points, lifetime_points FROM customers WHERE id = 'cust-1'")
        .get() as { loyalty_points: number; lifetime_points: number };
      expect(custAfterSecond.loyalty_points).toBe(0);
      expect(custAfterSecond.lifetime_points).toBe(0);

      const walletAfterSecond = sqlite
        .prepare("SELECT balance FROM cashback_wallets WHERE id = 'cbw-1'")
        .get() as { balance: number };
      expect(walletAfterSecond.balance).toBe(0);

      // 3rd call after 100% has been reversed -> returns already_reversed
      const thirdRes = await reverseAccrual(db, TEST_LOYALTY_POLICY, {
        orderId: 'ord-partial-1',
        customerId: 'cust-1',
        refundAmountVnd: 20000,
        tenantId: 'store-a',
      });
      expect(thirdRes.ok).toBe(false);
      if (!thirdRes.ok) {
        expect(thirdRes.reason).toBe('already_reversed');
      }
    });

    it('resolves order total via COALESCE(total, total_amount, 0) on OpenAPI orders where total is 0', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO customers (id, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
           VALUES ('cust-openapi', 100, 100, 'Bronze', 'store-a')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_id, total, total_amount, points_earned, cashback_earned, status, tenant_id)
           VALUES ('ord-openapi-1', 'cust-openapi', 0, 200000, 100, 0, 'completed', 'store-a')`,
        )
        .run();

      // 50,000 VND refund on 200,000 VND total_amount = 25% -> 25 points (not 100 points)
      const res = await reverseAccrual(db, TEST_LOYALTY_POLICY, {
        orderId: 'ord-openapi-1',
        customerId: 'cust-openapi',
        refundAmountVnd: 50000,
        tenantId: 'store-a',
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.pointsDeducted).toBe(25);
        expect(res.newLifetimePoints).toBe(75);
      }
    });
  });

  describe('2. redeemReferral, rewardReferralOnFirstOrder & reverseReferralCashback — Policy enforcement & tenant scoping', () => {
    it('rejects redeemReferral when policy.enabled is false and honors custom policy reward amounts when enabled', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare("INSERT INTO customers (id, name, tenant_id) VALUES ('ref-1', 'Referrer', 'store-a')")
        .run();
      sqlite
        .prepare("INSERT INTO customers (id, name, tenant_id) VALUES ('new-1', 'Referee', 'store-a')")
        .run();
      sqlite
        .prepare(
          "INSERT INTO referral_codes (id, customer_id, code, times_used, tenant_id) VALUES ('rc-1', 'ref-1', 'CAFE50', 0, 'store-a')",
        )
        .run();

      const disabledRes = await redeemReferral(db, 'CAFE50', 'new-1', 'store-a', {
        ...DEFAULT_REFERRAL_POLICY,
        enabled: false,
      });
      expect(disabledRes.success).toBe(false);
      expect(disabledRes.reason).toBe('referral_disabled');
      expect(disabledRes.error).toBe('Chương trình giới thiệu đang tạm ngưng');

      const enabledRes = await redeemReferral(db, 'CAFE50', 'new-1', 'store-a', {
        ...DEFAULT_REFERRAL_POLICY,
        enabled: true,
        bonusType: 'cashback',
        pointsReferrer: 120,
        cashbackReferrerVnd: 35000,
      });
      expect(enabledRes.success).toBe(true);

      const savedRef = sqlite
        .prepare("SELECT points_awarded, cashback_awarded_vnd, bonus_type, tenant_id FROM referrals WHERE referred_customer_id = 'new-1'")
        .get() as { points_awarded: number; cashback_awarded_vnd: number; bonus_type: string; tenant_id: string };
      expect(savedRef.points_awarded).toBe(120);
      expect(savedRef.cashback_awarded_vnd).toBe(35000);
      expect(savedRef.bonus_type).toBe('cashback');
      expect(savedRef.tenant_id).toBe('store-a');
    });

    it('scopes referral status updates and referee welcome cashback reversal by tenant_id and decrements total_earned', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare("INSERT INTO customers (id, name, tenant_id) VALUES ('referrer-a', 'Referrer A', 'store-a')")
        .run();
      sqlite
        .prepare("INSERT INTO customers (id, name, tenant_id) VALUES ('referee-a', 'Referee A', 'store-a')")
        .run();
      sqlite
        .prepare(
          "INSERT INTO referral_codes (id, customer_id, code, times_used, tenant_id) VALUES ('rc-a', 'referrer-a', 'REFA', 1, 'store-a')",
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, cashback_awarded_vnd, status, bonus_type, tenant_id)
           VALUES ('ref-row-a', 'referrer-a', 'referee-a', 'REFA', 20000, 'pending', 'cashback', 'store-a')`,
        )
        .run();

      // Seed foreign-tenant wallet for referee-a that must not be touched by store-a reversal
      sqlite
        .prepare(
          `INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
           VALUES ('cbw-referee-foreign', 'referee-a', 99000, 99000, 0, 'store-b')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, tenant_id)
           VALUES ('cbt-foreign-bonus', 'cbw-referee-foreign', 'referee-a', 'bonus', 99000, 99000, 'Referral welcome bonus (ref=ref-row-a): +99000 VND', 'store-b')`,
        )
        .run();

      const rewardRes = await rewardReferralOnFirstOrder(
        db,
        'referee-a',
        'ord-first-a',
        50000,
        {
          ...DEFAULT_REFERRAL_POLICY,
          bonusType: 'cashback',
          cashbackReferrerVnd: 20000,
          cashbackRefereeVnd: 10000,
          minOrderVnd: 20000,
        },
        'store-a',
      );
      expect(rewardRes.success).toBe(true);

      // Cross-tenant reversal attempt from store-b must fail
      const crossTenantRev = await reverseReferralCashback(db, 'ref-row-a', 'store-b');
      expect(crossTenantRev.success).toBe(false);

      // Legitimate store-a reversal reverses referrer and referee store-a wallets & decrements total_earned
      const revRes = await reverseReferralCashback(db, 'ref-row-a', 'store-a');
      expect(revRes.success).toBe(true);

      const referrerWallet = sqlite
        .prepare("SELECT balance, total_earned, total_spent FROM cashback_wallets WHERE customer_id = 'referrer-a' AND tenant_id = 'store-a'")
        .get() as { balance: number; total_earned: number; total_spent: number };
      expect(referrerWallet.balance).toBe(0);
      expect(referrerWallet.total_earned).toBe(0);
      expect(referrerWallet.total_spent).toBe(0);

      const refereeWalletA = sqlite
        .prepare("SELECT balance, total_earned, total_spent FROM cashback_wallets WHERE customer_id = 'referee-a' AND tenant_id = 'store-a'")
        .get() as { balance: number; total_earned: number; total_spent: number };
      expect(refereeWalletA.balance).toBe(0);
      expect(refereeWalletA.total_earned).toBe(0);
      expect(refereeWalletA.total_spent).toBe(0);

      const refereeRevTx = sqlite
        .prepare("SELECT tenant_id, amount FROM cashback_transactions WHERE id = 'cbt_ref_rev_ref-row-a_referee'")
        .get() as { tenant_id: string; amount: number } | undefined;
      expect(refereeRevTx?.tenant_id).toBe('store-a');
      expect(refereeRevTx?.amount).toBe(10000);

      // Foreign store-b wallet must remain untouched
      const foreignWallet = sqlite
        .prepare("SELECT balance, total_earned FROM cashback_wallets WHERE id = 'cbw-referee-foreign'")
        .get() as { balance: number; total_earned: number };
      expect(foreignWallet.balance).toBe(99000);
      expect(foreignWallet.total_earned).toBe(99000);
    });
  });

  describe('3. stationTicketsRouter — Auth guard on GET /:id/tickets, caller-tenant confinement & order item membership', () => {
    it('enforces requireKdsItemStaff on GET /:id/tickets, blocks cross-tenant overrides from non-HQ staff, and rejects nonexistent order itemIds with 404', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare("INSERT INTO kitchen_stations (id, name, slug, tenant_id) VALUES ('st-bar-a', 'Quầy Bar A', 'bar-a', 'store-a')")
        .run();
      sqlite
        .prepare("INSERT INTO kitchen_stations (id, name, slug, tenant_id) VALUES ('st-bar-b', 'Quầy Bar B', 'bar-b', 'store-b')")
        .run();
      sqlite
        .prepare("INSERT INTO category_stations (category_id, station_id) VALUES ('cat-coffee', 'st-bar-a')")
        .run();
      sqlite
        .prepare(
          `INSERT INTO orders (id, status, items, tenant_id)
           VALUES ('ord-st-1', 'confirmed', ?, 'store-a')`,
        )
        .run(JSON.stringify([{ id: 'itm-latte', name: 'Latte', category_id: 'cat-coffee', qty: 1 }]));

      // 1. Waiter role is rejected with 403 on GET /:id/tickets
      const waiterApp = new Hono<{ Bindings: Env }>();
      waiterApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'u-waiter', role: 'waiter', tenantId: 'store-a' });
        await next();
      });
      waiterApp.route('/', stationTicketsRouter);

      const waiterGetRes = await waiterApp.fetch(
        new Request('https://api.test/st-bar-a/tickets'),
        { AURA_DB: db } as any,
      );
      expect(waiterGetRes.status).toBe(403);

      // 2. Non-HQ owner on 'default' tenant cannot override ?tenant_id=store-b on GET /:id/tickets or POST /start
      const defaultOwnerApp = new Hono<{ Bindings: Env }>();
      defaultOwnerApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'u-def-owner', role: 'owner', tenantId: 'default' });
        await next();
      });
      defaultOwnerApp.route('/', stationTicketsRouter);

      const crossGetRes = await defaultOwnerApp.fetch(
        new Request('https://api.test/st-bar-b/tickets?tenant_id=store-b'),
        { AURA_DB: db } as any,
      );
      expect(crossGetRes.status).toBe(403);

      const crossStartRes = await defaultOwnerApp.fetch(
        new Request('https://api.test/tickets/ord-st-1/items/itm-latte/start?station_id=st-bar-a&tenant_id=store-a', {
          method: 'POST',
        }),
        { AURA_DB: db } as any,
      );
      expect(crossStartRes.status).toBe(403);

      // 3. Store-A barista can GET tickets, is blocked with 404 on nonexistent itemId, and succeeds on valid itemId
      const baristaApp = new Hono<{ Bindings: Env }>();
      baristaApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'u-barista', role: 'barista', tenantId: 'store-a' });
        c.set('tenantId' as any, 'store-a');
        await next();
      });
      baristaApp.route('/', stationTicketsRouter);

      const validGetRes = await baristaApp.fetch(
        new Request('https://api.test/st-bar-a/tickets'),
        { AURA_DB: db } as any,
      );
      expect(validGetRes.status).toBe(200);
      const validGetJson = (await validGetRes.json()) as { data: Array<{ id: string }> };
      expect(validGetJson.data).toHaveLength(1);
      expect(validGetJson.data[0].id).toBe('ord-st-1');

      const fakeStartRes = await baristaApp.fetch(
        new Request('https://api.test/tickets/ord-st-1/items/nonexistent-item-99/start?station_id=st-bar-a', {
          method: 'POST',
        }),
        { AURA_DB: db } as any,
      );
      expect(fakeStartRes.status).toBe(404);

      const fakeReadyRes = await baristaApp.fetch(
        new Request('https://api.test/tickets/ord-st-1/items/nonexistent-item-99/ready?station_id=st-bar-a', {
          method: 'POST',
        }),
        { AURA_DB: db } as any,
      );
      expect(fakeReadyRes.status).toBe(404);

      const stationRowsAfterFake = sqlite
        .prepare('SELECT COUNT(*) as cnt FROM order_item_stations')
        .get() as { cnt: number };
      expect(stationRowsAfterFake.cnt).toBe(0);

      // Valid item start & ready succeed
      const realStartRes = await baristaApp.fetch(
        new Request('https://api.test/tickets/ord-st-1/items/itm-latte/start?station_id=st-bar-a', {
          method: 'POST',
        }),
        { AURA_DB: db } as any,
      );
      expect(realStartRes.status).toBe(200);

      const realReadyRes = await baristaApp.fetch(
        new Request('https://api.test/tickets/ord-st-1/items/itm-latte/ready?station_id=st-bar-a', {
          method: 'POST',
        }),
        { AURA_DB: db } as any,
      );
      expect(realReadyRes.status).toBe(200);
      const realReadyJson = (await realReadyRes.json()) as { all_items_ready: boolean; order_status: string };
      expect(realReadyJson.all_items_ready).toBe(true);
      expect(realReadyJson.order_status).toBe('ready');
    });
  });

  describe('4. kds-mobile, kds-status-transition & kds-handlers — Default-tenant owner confinement & cashback cancellation ledger', () => {
    it('blocks default-tenant owner from reading cross-tenant mobile KDS orders while allowing HQ (*) owner', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare("INSERT INTO orders (id, status, items, tenant_id) VALUES ('ord-b-1', 'pending', '[]', 'store-b')")
        .run();

      const defaultOwnerApp = new Hono<{ Bindings: Env }>();
      defaultOwnerApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'owner-def', role: 'owner', tenantId: 'default' });
        await next();
      });
      defaultOwnerApp.get('/mobile/kds/orders', (c) => getKdsMobile(c));

      const deniedRes = await defaultOwnerApp.fetch(
        new Request('https://api.test/mobile/kds/orders?tenant_id=store-b'),
        { AURA_DB: db } as any,
      );
      expect(deniedRes.status).toBe(403);

      const hqOwnerApp = new Hono<{ Bindings: Env }>();
      hqOwnerApp.use('*', async (c, next) => {
        c.set('user' as any, { id: 'owner-hq', role: 'owner', tenantId: '*' });
        await next();
      });
      hqOwnerApp.get('/mobile/kds/orders', (c) => getKdsMobile(c));

      const allowedRes = await hqOwnerApp.fetch(
        new Request('https://api.test/mobile/kds/orders?tenant_id=store-b'),
        { AURA_DB: db } as any,
      );
      expect(allowedRes.status).toBe(200);
      const allowedJson = (await allowedRes.json()) as { orders: Array<{ id: string }> };
      expect(allowedJson.orders).toHaveLength(1);
      expect(allowedJson.orders[0].id).toBe('ord-b-1');
    });

    it('records balance_after on cashback_transactions and decrements total_spent on cashback_wallets when cancelling an order', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
           VALUES ('cbw-cancel-1', 'cust-cancel-1', 15000, 35000, 20000, 'store-a')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_id, status, payment_status, total, cashback_used, tenant_id)
           VALUES ('ord-cancel-cb', 'cust-cancel-1', 'pending', 'unpaid', 80000, 20000, 'store-a')`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, tenant_id)
           VALUES ('cbt-spend-1', 'cbw-cancel-1', 'cust-cancel-1', 'ord-cancel-cb', 'spend', 20000, 15000, 'store-a')`,
        )
        .run();

      const res = await executeKdsStatusTransition(db, 'ord-cancel-cb', 'cancelled', 'manager', {
        tenantId: 'store-a',
      });
      expect(res.success).toBe(true);

      const walletAfter = sqlite
        .prepare("SELECT balance, total_spent FROM cashback_wallets WHERE id = 'cbw-cancel-1'")
        .get() as { balance: number; total_spent: number };
      expect(walletAfter.balance).toBe(35000);
      expect(walletAfter.total_spent).toBe(0);

      const refundTx = sqlite
        .prepare("SELECT amount, balance_after, tenant_id FROM cashback_transactions WHERE id = 'cb_ref_ord-cancel-cb'")
        .get() as { amount: number; balance_after: number; tenant_id: string };
      expect(refundTx.amount).toBe(20000);
      expect(refundTx.balance_after).toBe(35000);
      expect(refundTx.tenant_id).toBe('store-a');
    });

    it('enforces caller-tenant confinement across handleGetKdsOrders, handleUpdateOrderStatus, and handleMarkCodPaid', async () => {
      const sqlite = new DatabaseSync(':memory:');
      seedCrmAndKdsSchema(sqlite);
      const db = createSqliteD1(sqlite);

      sqlite
        .prepare(
          `INSERT INTO orders (id, status, payment_method, payment_status, is_cod, total, items, tenant_id)
           VALUES ('ord-kds-b', 'confirmed', 'cod', 'unpaid', 1, 55000, '[]', 'store-b')`,
        )
        .run();

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as any, { id: 'staff-a', role: 'manager', tenantId: 'store-a' });
        await next();
      });
      app.get('/kds', handleGetKdsOrders);
      app.patch('/:id/status', (c) => handleUpdateOrderStatus(c));
      app.patch('/:id/mark-cod-paid', handleMarkCodPaid);

      const getCrossRes = await app.fetch(
        new Request('https://api.test/kds?tenant_id=store-b'),
        { AURA_DB: db } as any,
      );
      expect(getCrossRes.status).toBe(403);

      const statusCrossRes = await app.fetch(
        new Request('https://api.test/ord-kds-b/status?tenant_id=store-b', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'preparing' }),
        }),
        { AURA_DB: db } as any,
      );
      expect(statusCrossRes.status).toBe(403);

      const codCrossRes = await app.fetch(
        new Request('https://api.test/ord-kds-b/mark-cod-paid?tenant_id=store-b', {
          method: 'PATCH',
        }),
        { AURA_DB: db } as any,
      );
      expect(codCrossRes.status).toBe(403);

      const orderStillUnchanged = sqlite
        .prepare("SELECT status, payment_status FROM orders WHERE id = 'ord-kds-b'")
        .get() as { status: string; payment_status: string };
      expect(orderStillUnchanged.status).toBe('confirmed');
      expect(orderStillUnchanged.payment_status).toBe('unpaid');
    });
  });
});
