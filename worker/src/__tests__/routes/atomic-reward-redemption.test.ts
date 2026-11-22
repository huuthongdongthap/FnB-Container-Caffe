// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { afterEach, describe, expect, it } from 'vitest';
import { registerRewardHandlers } from '../../routes/openapi-loyalty-handlers/reward-handlers';
import { loyaltyRouter } from '../../routes/loyalty';
import { generateJWT } from '../../lib/jwt';
import { reverseRefundTranche } from '../../../../packages/domain/crm/commands/refund-tranche';
import { loadPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';

const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  sqlite.exec(readFileSync(new URL('../../../../db/schema.sql', import.meta.url), 'utf8'));
  sqlite.exec(`INSERT INTO customers(id,tenant_id,loyalty_points,lifetime_points) VALUES ('customer','cafe-a',100,100);
    INSERT INTO loyalty_accounts(id,customer_id,tenant_id,current_points,lifetime_points) VALUES ('account','customer','cafe-a',100,100);
    INSERT INTO loyalty_rewards(id,name,tenant_id,points_cost,max_redemptions) VALUES ('reward','Drink','cafe-a',100,1);
    INSERT INTO rewards(id,title,discount_type,discount_value,point_cost,tenant_id) VALUES ('reward','Drink','fixed',10000,100,'cafe-a');
    INSERT INTO orders(id,customer_id,tenant_id,total,status,payment_status,points_earned,cashback_earned,items,customer_name,customer_phone,payment_method)
      VALUES ('order','customer','cafe-a',10000,'completed','paid',100,0,'[]','Customer','0901234567','payos');
    INSERT INTO refund_loyalty_work(tenant_id,reversal_key,order_id,customer_id,amount)
      VALUES ('cafe-a','transfer','order','customer',10000);`);
  const runners = new WeakMap<object, () => unknown>();
  let beforeBatch: (() => Promise<void>) | undefined;
  let afterBatch: (() => Promise<void>) | undefined;
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const run = () => {
      const stmt = sqlite.prepare(sql);
      if (stmt.columns().length) return { success: true, results: stmt.all(...args as never[]), meta: { changes: 0 } };
      const result = stmt.run(...args as never[]);
      return { success: true, results: [], meta: { changes: Number(result.changes) } };
    };
    const statement = {
      bind(...values: unknown[]) { args = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...args as never[]) ?? null; },
      async all() { return { success: true, results: sqlite.prepare(sql).all(...args as never[]) }; },
      async run() { return run(); },
    };
    runners.set(statement, run);
    return statement as unknown as D1PreparedStatement;
  };
  const db = { prepare, async batch(statements: D1PreparedStatement[]) {
    const hook = beforeBatch; beforeBatch = undefined;
    await hook?.();
    sqlite.exec('BEGIN');
    let results: unknown[];
    try { results = statements.map(s => runners.get(s)!()); sqlite.exec('COMMIT'); }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    const after = afterBatch; afterBatch = undefined;
    await after?.();
    return results;
  } } as unknown as D1Database;
  const app = new OpenAPIHono<any>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'customer', customerId: 'customer', tenantId: 'cafe-a', role: 'customer' });
    c.set('tenantId', 'cafe-a'); await next();
  });
  registerRewardHandlers(app);
  const redeem = (key = 'request') => app.request('/api/loyalty/rewards/redeem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rewardId: 'reward', idempotencyKey: key }),
  }, { AURA_DB: db });
  const customerApp = new OpenAPIHono<any>();
  customerApp.route('/api/loyalty', loyaltyRouter);
  const customerRequest = async (path: string, method = 'GET') => {
    const secret = 'local-customer-redemption-test-secret';
    const token = await generateJWT({ id: 'customer', role: 'customer', tenantId: 'cafe-a' }, secret);
    return customerApp.request(`/api/loyalty/${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(method === 'POST' ? { body: JSON.stringify({ reward_id: 'reward' }) } : {}),
    }, { AURA_DB: db, JWT_SECRET: secret, PILOT_TENANT_ID: 'cafe-a' });
  };
  const customerRedeem = () => customerRequest('redeem', 'POST');
  const refund = async () => reverseRefundTranche(db, await loadPolicy(db, undefined, new Date(), 'cafe-a'), {
    orderId: 'order', customerId: 'customer', refundAmountVnd: 10000, tenantId: 'cafe-a', reversalKey: 'transfer',
  });
  const row = (sql: string) => sqlite.prepare(sql).get() as Record<string, unknown>;
  const untouched = () => {
    expect(row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
    expect(row('SELECT current_points FROM loyalty_accounts').current_points).toBe(100);
    expect(row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(0);
    for (const table of ['loyalty_transactions', 'loyalty_point_logs', 'loyalty_redemptions', 'user_rewards']) {
      expect(row(`SELECT COUNT(*) n FROM ${table}`).n).toBe(0);
    }
  };
  return { sqlite, db, redeem, customerRedeem, customerRequest, refund, row, untouched,
    beforeBatch(hook: () => Promise<void>) { beforeBatch = hook; },
    afterBatch(hook: () => Promise<void>) { afterBatch = hook; } };
}

describe('atomic reward redemption and refund serialization on real SQLite', () => {
  it('enforces stock-as-cap when both quota columns exist and max_redemptions is null', async () => {
    const f = fixture();
    f.sqlite.exec('UPDATE loyalty_rewards SET stock=1, max_redemptions=NULL; UPDATE customers SET loyalty_points=200; UPDATE loyalty_accounts SET current_points=200');
    f.beforeBatch(async () => { expect((await f.redeem('competing')).status).toBe(200); });
    expect((await f.redeem('original')).status).toBe(409);
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(1);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
  });
  it.each(['before request', 'after preflight'])('OpenAPI honors canonical stock exhausted by the customer route %s', async timing => {
    const f = fixture();
    f.sqlite.exec(`DELETE FROM rewards; UPDATE loyalty_rewards SET stock=1, max_redemptions=NULL;
      UPDATE customers SET loyalty_points=200; UPDATE loyalty_accounts SET current_points=200`);
    const exhaust = async () => { expect((await f.customerRedeem()).status).toBe(200); };
    if (timing === 'before request') await exhaust();
    else f.beforeBatch(exhaust);
    expect((await f.redeem()).status).toBe(409);
    expect(f.row('SELECT stock, current_redemptions FROM loyalty_rewards')).toMatchObject({ stock: 0, current_redemptions: 1 });
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(1);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(100);
  });
  it.each(['before request', 'after preflight'])('customer honors canonical stock exhausted by OpenAPI %s', async timing => {
    const f = fixture();
    f.sqlite.exec(`DELETE FROM rewards; UPDATE loyalty_rewards SET stock=1, max_redemptions=NULL;
      UPDATE customers SET loyalty_points=200; UPDATE loyalty_accounts SET current_points=200`);
    const exhaust = async () => { expect((await f.redeem()).status).toBe(200); };
    if (timing === 'before request') await exhaust();
    else f.beforeBatch(exhaust);
    expect((await f.customerRedeem()).status).toBe(409);
    expect(f.row('SELECT stock, current_redemptions FROM loyalty_rewards')).toMatchObject({ stock: 0, current_redemptions: 1 });
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(1);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(100);
  });
  it.each(['OpenAPI first', 'customer first'])('shares remaining stock without reducing the total twice: %s', async ordering => {
    const f = fixture();
    f.sqlite.exec(`DELETE FROM rewards; UPDATE loyalty_rewards SET stock=2, max_redemptions=NULL;
      UPDATE customers SET loyalty_points=300; UPDATE loyalty_accounts SET current_points=300`);
    const first = ordering === 'OpenAPI first' ? () => f.redeem('first') : f.customerRedeem;
    const second = ordering === 'OpenAPI first' ? f.customerRedeem : () => f.redeem('second');
    expect((await first()).status).toBe(200);
    expect(f.row('SELECT stock FROM loyalty_rewards').stock).toBe(1);
    expect((await second()).status).toBe(200);
    expect((await f.redeem('exhausted')).status).toBe(409);
    expect((await f.customerRedeem()).status).toBe(409);
    expect(f.row('SELECT stock, current_redemptions FROM loyalty_rewards')).toMatchObject({ stock: 0, current_redemptions: 2 });
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(2);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(100);
  });
  it('customer cannot bypass a lowered canonical cap through replenished legacy stock', async () => {
    const f = fixture();
    f.sqlite.exec(`UPDATE loyalty_rewards SET stock=2, max_redemptions=2;
      UPDATE rewards SET stock=2;
      UPDATE customers SET loyalty_points=300; UPDATE loyalty_accounts SET current_points=300`);
    expect((await f.redeem()).status).toBe(200);
    // Admin lowering the lifetime cap also refreshes the legacy stock mirror.
    f.sqlite.exec('UPDATE loyalty_rewards SET max_redemptions=1; UPDATE rewards SET stock=1');
    expect((await f.customerRedeem()).status).toBe(409);
    expect(f.row('SELECT stock FROM rewards').stock).toBe(1);
    expect(f.row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(1);
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(1);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(200);
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(200);
  });
  it('customer rolls back legacy reservation when a present canonical reservation is ignored', async () => {
    const f = fixture();
    f.sqlite.exec(`UPDATE rewards SET stock=1;
      CREATE TRIGGER ignore_canonical BEFORE UPDATE ON loyalty_rewards BEGIN SELECT RAISE(IGNORE); END;`);
    expect((await f.customerRedeem()).status).toBe(409);
    expect(f.row('SELECT stock FROM rewards').stock).toBe(1);
    f.untouched();
  });
  it.each([false, true])('customer lists legacy-only vouchers despite a foreign canonical row: mirror absent %s', async noMirror => {
    const f = fixture();
    f.sqlite.exec("UPDATE loyalty_rewards SET tenant_id='cafe-b', name='Foreign Secret'; UPDATE rewards SET stock=1");
    if (noMirror) f.sqlite.exec('DROP TABLE user_rewards');
    const response = await f.customerRedeem();
    expect(response.status).toBe(200);
    const issued = (await response.json() as any).data;
    expect(f.row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(0);
    expect(f.row('SELECT stock FROM rewards').stock).toBe(0);
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(1);
    const listed = await f.customerRequest('my-rewards');
    expect(listed.status).toBe(200);
    expect((await listed.json() as any).data).toEqual([
      expect.objectContaining({ code: issued.code, title: 'Drink' }),
    ]);
  });
  it('canonical vouchers use local metadata despite a foreign legacy reward with the same ID', async () => {
    const f = fixture();
    f.sqlite.exec("UPDATE rewards SET tenant_id='cafe-b',title='Foreign Secret'");
    expect((await f.redeem()).status).toBe(200);
    const listed = await f.customerRequest('my-rewards');
    expect(listed.status).toBe(200);
    expect((await listed.json() as any).data).toEqual([expect.objectContaining({ title: 'Drink', tenant_id: 'cafe-a' })]);
  });
  it('mounted customer endpoint preserves response and atomically issues a usable voucher', async () => {
    const f = fixture();
    const response = await f.customerRedeem();
    expect(response.status).toBe(200);
    expect((await response.json() as any).data).toMatchObject({ reward: 'Drink', points_spent: 100, points_remaining: 0 });
    expect(f.row('SELECT status FROM loyalty_redemptions').status).toBe('active');
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(0);
    expect(f.row('SELECT reason FROM loyalty_transactions').reason).toBe('redeem');
    expect(f.row('SELECT reason FROM loyalty_point_logs').reason).toBe('redeem');
  });
  it.each([false, true])('lists canonical-only vouchers alongside existing legacy vouchers: %s', async hasLegacyVoucher => {
    const f = fixture();
    f.sqlite.exec(`DELETE FROM rewards;
      INSERT INTO rewards(id,title,discount_type,discount_value,point_cost,tenant_id)
        VALUES ('legacy','Legacy Drink','fixed',10000,100,'cafe-a');`);
    if (hasLegacyVoucher) f.sqlite.exec(`
      INSERT INTO user_rewards(id,customer_id,reward_id,code,tenant_id,status)
        VALUES ('old-voucher','customer','legacy','OLD-CODE','cafe-a','active');`);
    const response = await f.customerRedeem();
    expect(response.status).toBe(200);
    const issued = (await response.json() as any).data;
    const listed = await f.customerRequest('my-rewards');
    expect(listed.status).toBe(200);
    const vouchers = (await listed.json() as any).data as Array<Record<string, unknown>>;
    expect(vouchers).toEqual(expect.arrayContaining([expect.objectContaining({ code: issued.code, title: 'Drink', status: 'active' })]));
    expect(vouchers).toHaveLength(hasLegacyVoucher ? 2 : 1);
    expect(f.row("SELECT COUNT(*) n FROM user_rewards WHERE reward_id='reward'").n).toBe(0);
  });
  it('lists mirrored vouchers once and excludes foreign tenant redemption records', async () => {
    const f = fixture();
    const response = await f.customerRedeem();
    expect(response.status).toBe(200);
    const issued = (await response.json() as any).data;
    f.sqlite.exec(`INSERT INTO loyalty_redemptions(id,customer_id,reward_id,code,points_spent,tenant_id,status)
      VALUES ('foreign','customer','reward','FOREIGN-CODE',100,'cafe-b','active');`);
    const listed = await f.customerRequest('my-rewards');
    expect(listed.status).toBe(200);
    expect((await listed.json() as any).data).toEqual([expect.objectContaining({ code: issued.code })]);
  });
  it('mounted customer endpoint cannot issue after a refund wins before commit', async () => {
    const f = fixture(); f.beforeBatch(async () => { expect((await f.refund()).ok).toBe(true); });
    expect((await f.customerRedeem()).status).toBe(409);
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(0);
  });
  it('mounted customer voucher is visible to a refund immediately after commit', async () => {
    const f = fixture(); f.afterBatch(async () => { expect((await f.refund()).ok).toBe(true); });
    expect((await f.customerRedeem()).status).toBe(200);
    expect(f.row('SELECT status FROM loyalty_redemptions').status).toBe('revoked');
    expect(f.row('SELECT status FROM user_rewards').status).toBe('revoked');
  });
  it('refund retries stale snapshot when mounted customer redemption wins first', async () => {
    const f = fixture(); f.beforeBatch(async () => { expect((await f.customerRedeem()).status).toBe(200); });
    expect((await f.refund()).ok).toBe(true);
    expect(f.row('SELECT status FROM loyalty_redemptions').status).toBe('revoked');
  });
  it('mounted customer voucher insertion failure rolls back debit, mirrors and stock', async () => {
    const f = fixture();
    f.sqlite.exec("UPDATE rewards SET stock=1; CREATE TRIGGER reject_customer_voucher BEFORE INSERT ON loyalty_redemptions BEGIN SELECT RAISE(ABORT,'voucher failure'); END;");
    expect((await f.customerRedeem()).status).toBe(503);
    f.untouched();
    expect(f.row('SELECT stock FROM rewards').stock).toBe(1);
  });
  it('commits debit, tenant-scoped vouchers, accounting and quota together', async () => {
    const f = fixture();
    const response = await f.redeem();
    expect(response.status).toBe(200);
    expect((await response.json() as any).data.newBalance).toBe(0);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(0);
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(0);
    expect(f.row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(1);
    for (const table of ['loyalty_transactions', 'loyalty_point_logs', 'loyalty_redemptions', 'user_rewards']) {
      expect(f.row(`SELECT COUNT(*) n FROM ${table} WHERE tenant_id = 'cafe-a'`).n).toBe(1);
    }
  });
  it('refund committing before redemption batch prevents stale-balance voucher issuance', async () => {
    const f = fixture();
    f.beforeBatch(async () => { expect((await f.refund()).ok).toBe(true); });
    expect((await f.redeem()).status).toBe(409);
    expect(f.row('SELECT status FROM refund_loyalty_work').status).toBe('completed');
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(0);
    expect(f.row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(0);
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(0);
  });
  it('refund immediately after debit batch sees and revokes both vouchers, never a late active mirror', async () => {
    const f = fixture();
    f.afterBatch(async () => { expect((await f.refund()).ok).toBe(true); });
    expect((await f.redeem()).status).toBe(200);
    expect(f.row('SELECT status FROM loyalty_redemptions').status).toBe('revoked');
    expect(f.row('SELECT status FROM user_rewards').status).toBe('revoked');
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(0);
  });
  it('refund snapshot preceding redemption retries customer CAS and revokes new vouchers', async () => {
    const f = fixture();
    f.beforeBatch(async () => { expect((await f.redeem()).status).toBe(200); });
    expect((await f.refund()).ok).toBe(true);
    expect(f.row('SELECT status FROM loyalty_redemptions').status).toBe('revoked');
    expect(f.row('SELECT status FROM user_rewards').status).toBe('revoked');
  });
  it.each(['loyalty_redemptions', 'user_rewards', 'loyalty_transactions', 'loyalty_point_logs'])('%s insertion failure rolls back every financial effect', async table => {
    const f = fixture();
    f.sqlite.exec(`CREATE TRIGGER fail_insert BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected storage failure'); END;`);
    expect((await f.redeem()).status).toBe(503);
    f.untouched();
  });
  it.each(['loyalty_redemptions', 'user_rewards', 'customers'])('%s zero-row mutation aborts the batch before returning success', async table => {
    const f = fixture();
    f.sqlite.exec(`CREATE TRIGGER ignore_write BEFORE ${table === 'customers' ? 'UPDATE' : 'INSERT'} ON ${table} BEGIN SELECT RAISE(IGNORE); END;`);
    expect((await f.redeem()).status).toBe(409);
    f.untouched();
  });
  it('missing authoritative issuance storage fails closed without reserving quota or deducting points', async () => {
    const f = fixture(); f.sqlite.exec('DROP TABLE loyalty_redemptions');
    expect((await f.redeem()).status).toBe(503);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
    expect(f.row('SELECT current_points FROM loyalty_accounts').current_points).toBe(100);
    expect(f.row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(0);
    expect(f.row('SELECT COUNT(*) n FROM loyalty_transactions').n).toBe(0);
  });
  it('funded account with zero customer mirror cannot evade an in-flight refund CAS', async () => {
    const f = fixture(); f.sqlite.exec('UPDATE customers SET loyalty_points = 0');
    f.beforeBatch(async () => { expect((await f.redeem()).status).toBe(409); });
    expect((await f.refund()).ok).toBe(true);
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(0);
    expect(f.row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(0);
  });
  it('preserves legacy rewards stock reservation and rolls it back on issuance failure', async () => {
    const f = fixture();
    f.sqlite.exec(`DELETE FROM loyalty_rewards; UPDATE rewards SET stock = 1, is_active = 1;
      CREATE TRIGGER fail_insert BEFORE INSERT ON loyalty_redemptions BEGIN SELECT RAISE(ABORT, 'storage failure'); END;`);
    expect((await f.redeem()).status).toBe(503);
    expect(f.row('SELECT stock FROM rewards').stock).toBe(1);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
    f.sqlite.exec('DROP TRIGGER fail_insert');
    expect((await f.redeem()).status).toBe(200);
    expect(f.row('SELECT stock FROM rewards').stock).toBe(0);
  });
  it('preserves redeemed_count/stock quota schema without a current_redemptions column', async () => {
    const f = fixture();
    f.sqlite.exec('ALTER TABLE loyalty_rewards DROP COLUMN current_redemptions; UPDATE loyalty_rewards SET stock = 1');
    expect((await f.redeem()).status).toBe(200);
    expect(f.row('SELECT redeemed_count FROM loyalty_rewards').redeemed_count).toBe(1);
  });
  it('guards stale quota snapshots and duplicate idempotency inside the transaction', async () => {
    const f = fixture();
    f.sqlite.exec('UPDATE customers SET loyalty_points = 200; UPDATE loyalty_accounts SET current_points = 200');
    f.beforeBatch(async () => { expect((await f.redeem()).status).toBe(200); });
    expect((await f.redeem()).status).toBe(409);
    expect(f.row('SELECT COUNT(*) n FROM loyalty_redemptions').n).toBe(1);
    expect(f.row('SELECT current_redemptions FROM loyalty_rewards').current_redemptions).toBe(1);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(100);
  });
  it('leaves foreign-tenant voucher and legacy reward mirrors untouched', async () => {
    const f = fixture();
    f.sqlite.exec(`UPDATE rewards SET tenant_id = 'cafe-b';
      INSERT INTO loyalty_redemptions(id,customer_id,reward_id,code,points_spent,tenant_id,status)
        VALUES ('foreign','customer','reward','foreign-code',100,'cafe-b','active');
      INSERT INTO user_rewards(id,customer_id,reward_id,code,tenant_id,status)
        VALUES ('foreign','customer','reward','foreign-code','cafe-b','active');`);
    expect((await f.redeem()).status).toBe(200);
    expect((await f.refund()).ok).toBe(true);
    expect(f.row("SELECT status FROM loyalty_redemptions WHERE id = 'foreign'").status).toBe('active');
    expect(f.row("SELECT status FROM user_rewards WHERE id = 'foreign'").status).toBe('active');
    expect(f.row("SELECT COUNT(*) n FROM user_rewards WHERE tenant_id = 'cafe-a'").n).toBe(0);
  });
  it('preserves customers-only account fallback and optional absent mirrors', async () => {
    const f = fixture(); f.sqlite.exec('DROP TABLE loyalty_accounts; DROP TABLE user_rewards; DROP TABLE loyalty_point_logs');
    expect((await f.redeem()).status).toBe(200);
    expect(f.row('SELECT loyalty_points FROM customers').loyalty_points).toBe(0);
    expect(f.row('SELECT status FROM loyalty_redemptions').status).toBe('active');
    const summaryRes = await f.customerRequest('summary');
    expect(summaryRes.status).toBe(200);
    expect(((await summaryRes.json()) as { data: { active_rewards: number } }).data.active_rewards).toBe(1);
  });

  it('counts canonical-only, dual-written, mixed, revoked, and tenant-scoped vouchers accurately in /api/loyalty/summary', async () => {
    const f = fixture();
    // Dual-written redemption (both loyalty_redemptions and user_rewards share code): counts as 1, not 2.
    expect((await f.customerRedeem()).status).toBe(200);
    expect(f.row("SELECT COUNT(*) n FROM loyalty_redemptions WHERE tenant_id = 'cafe-a'").n).toBe(1);
    expect(f.row("SELECT COUNT(*) n FROM user_rewards WHERE tenant_id = 'cafe-a'").n).toBe(1);
    const dualSummary = await f.customerRequest('summary');
    expect(dualSummary.status).toBe(200);
    expect(((await dualSummary.json()) as { data: { active_rewards: number } }).data.active_rewards).toBe(1);

    // Add canonical-only voucher, foreign-tenant voucher, and revoked voucher: only active same-tenant vouchers count (2).
    f.sqlite.exec(`INSERT INTO loyalty_rewards(id,name,tenant_id,points_cost,max_redemptions) VALUES ('canonical-only','Canonical Drink','cafe-a',50,5);
      INSERT INTO loyalty_redemptions(id,customer_id,reward_id,code,points_spent,tenant_id,status)
        VALUES ('lrd_canon','customer','canonical-only','CANON-CODE-1',50,'cafe-a','active'),
               ('lrd_foreign','customer','canonical-only','FOREIGN-CODE-1',50,'cafe-b','active'),
               ('lrd_revoked','customer','canonical-only','REVOKED-CODE-1',50,'cafe-a','revoked');
      INSERT INTO user_rewards(id,customer_id,reward_id,code,tenant_id,status)
        VALUES ('ur_foreign','customer','reward','FOREIGN-UR-1','cafe-b','active');`);
    const mixedSummary = await f.customerRequest('summary');
    expect(mixedSummary.status).toBe(200);
    expect(((await mixedSummary.json()) as { data: { active_rewards: number } }).data.active_rewards).toBe(2);

    // Refund revokes the redeemed voucher; summary drops accordingly.
    expect((await f.refund()).ok).toBe(true);
    const afterRefundSummary = await f.customerRequest('summary');
    expect(afterRefundSummary.status).toBe(200);
    expect(((await afterRefundSummary.json()) as { data: { active_rewards: number } }).data.active_rewards).toBe(1);
  });

  it('counts canonical-only customer redemption in /api/loyalty/summary even when user_rewards exists and has zero rows', async () => {
    const f = fixture();
    f.sqlite.exec('DELETE FROM rewards');
    expect((await f.customerRedeem()).status).toBe(200);
    expect(f.row("SELECT COUNT(*) n FROM user_rewards WHERE tenant_id = 'cafe-a'").n).toBe(0);
    expect(f.row("SELECT COUNT(*) n FROM loyalty_redemptions WHERE tenant_id = 'cafe-a'").n).toBe(1);
    const summaryRes = await f.customerRequest('summary');
    expect(summaryRes.status).toBe(200);
    expect(((await summaryRes.json()) as { data: { active_rewards: number } }).data.active_rewards).toBe(1);
  });

  it('counts voucher_code-only loyalty_redemptions rows accurately in /api/loyalty/summary', async () => {
    const f = fixture();
    f.sqlite.exec(`DROP TABLE loyalty_redemptions;
      CREATE TABLE loyalty_redemptions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        reward_id TEXT NOT NULL,
        voucher_code TEXT,
        points_spent INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'active',
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO loyalty_redemptions(id,customer_id,reward_id,voucher_code,points_spent,status,tenant_id)
        VALUES ('lr_vc_1','customer','reward','VC-ONLY-1',50,'active','cafe-a'),
               ('lr_vc_foreign','customer','reward','VC-FOREIGN',50,'active','cafe-b');`);
    const summaryRes = await f.customerRequest('summary');
    expect(summaryRes.status).toBe(200);
    expect(((await summaryRes.json()) as { data: { active_rewards: number } }).data.active_rewards).toBe(1);
  });

  it('preserves user_rewards tenant scope when default-tenant loyalty_redemptions lacks tenant_id', async () => {
    const f = fixture();
    f.sqlite.exec(`UPDATE customers SET tenant_id = 'default' WHERE id = 'customer';
      DROP TABLE loyalty_redemptions;
      CREATE TABLE loyalty_redemptions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        reward_id TEXT NOT NULL,
        code TEXT,
        points_spent INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO user_rewards(id,customer_id,reward_id,code,tenant_id,status) VALUES
        ('ur_def','customer','reward','DEF-UR-1','default','active'),
        ('ur_other','customer','reward','OTHER-UR-1','cafe-b','active');
      INSERT INTO loyalty_redemptions(id,customer_id,reward_id,code,points_spent,status) VALUES
        ('lr_def_only','customer','reward','DEF-LR-1',50,'active'),
        ('lr_dup','customer','reward','DEF-UR-1',50,'active');`);
    const secret = 'local-customer-redemption-test-secret';
    const token = await generateJWT({ id: 'customer', role: 'customer', tenantId: 'default' }, secret);
    const summaryRes = await loyaltyRouter.request('http://localhost/summary', { headers: { Authorization: `Bearer ${token}` } }, { AURA_DB: f.db, JWT_SECRET: secret } as never);
    expect(summaryRes.status).toBe(200);
    // Counts DEF-UR-1 (deduped across both tables) + DEF-LR-1 = 2; excludes cafe-b OTHER-UR-1.
    expect(((await summaryRes.json()) as { data: { active_rewards: number } }).data.active_rewards).toBe(2);
  });

  it('fails closed instead of downgrading tenant scope when active voucher lookup hits a transient database error', async () => {
    const f = fixture();
    const faultyDb: D1Database = {
      ...f.db,
      prepare(sql: string) {
        if (/FROM user_rewards/i.test(sql) && /UNION/i.test(sql)) {
          return {
            bind() {
              return {
                async all() { throw new Error('D1_ERROR: database is locked'); },
                async first() { throw new Error('D1_ERROR: database is locked'); },
                async run() { throw new Error('D1_ERROR: database is locked'); },
              };
            },
          } as unknown as D1PreparedStatement;
        }
        return f.db.prepare(sql);
      },
    } as unknown as D1Database;
    const secret = 'local-customer-redemption-test-secret';
    const token = await generateJWT({ id: 'customer', role: 'customer', tenantId: 'cafe-a' }, secret);
    const summaryRes = await loyaltyRouter.request('http://localhost/summary', { headers: { Authorization: `Bearer ${token}` } }, { AURA_DB: faultyDb, JWT_SECRET: secret } as never);
    expect(summaryRes.status).toBe(500);
  });
});
