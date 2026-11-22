// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyAccrual } from '../../../../packages/domain/crm/commands/accrual';
import { loadPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';
import { refundRaceFixture } from './refund-race-sqlite-fixture';

const accountingTables = ['cashback_transactions', 'loyalty_point_logs', 'loyalty_audit_log'] as const;

async function upgradingPolicy(db: Parameters<typeof loadPolicy>[0]) {
  const policy = await loadPolicy(db);
  policy.tiers = [policy.defaultTier, { ...policy.defaultTier, tierName: 'silver', minPoints: 50 }];
  return policy;
}

describe('accrual accounting tenant identity at insert time', () => {
  it.each(['*', 'hq', 'sadec'])('binds the order tenant in earn and tier accounting with caller scope %s', async tenantId => {
    const f = refundRaceFixture(); f.order('ORDER', 'sadec', 'member');
    f.sqlite.exec(`UPDATE orders SET status = 'completed', payment_status = 'paid';
      UPDATE customers SET tenant_id = 'sadec', loyalty_points = 49, lifetime_points = 49;
      DELETE FROM cashback_wallets;`);
    for (const table of accountingTables) {
      f.sqlite.exec(`CREATE TRIGGER require_${table}_tenant BEFORE INSERT ON ${table}
        WHEN NEW.tenant_id != 'sadec' OR NEW.tenant_id IS NULL
        BEGIN SELECT RAISE(ABORT, 'incorrect accounting tenant'); END;
        CREATE TRIGGER reject_${table}_tenant_patch BEFORE UPDATE OF tenant_id ON ${table}
        BEGIN SELECT RAISE(ABORT, 'accounting tenant must be correct at insert'); END;`);
    }
    const policy = await upgradingPolicy(f.db);
    const input = { orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId };
    expect(await applyAccrual(f.db, policy, input)).toMatchObject({ ok: true, points: 2, cashback: 600, tierUpgraded: true });
    expect(f.sqlite.prepare('SELECT tenant_id, balance FROM cashback_wallets').all()).toEqual([{ tenant_id: 'sadec', balance: 600 }]);
    for (const table of accountingTables) {
      const rows = f.sqlite.prepare(`SELECT tenant_id FROM ${table}`).all();
      expect(rows).toHaveLength(table === 'cashback_transactions' ? 1 : 2);
      expect(rows.every(row => row.tenant_id === 'sadec')).toBe(true);
    }
    expect(await applyAccrual(f.db, policy, input)).toMatchObject({ ok: false, reason: 'already_processed' });
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points FROM customers').get()).toMatchObject({ loyalty_points: 51, lifetime_points: 51 });
  });

  it('fails closed on a real accounting schema read error before crediting benefits', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member');
    f.sqlite.exec(`UPDATE orders SET payment_status = 'paid'; DROP TABLE loyalty_audit_log;
      CREATE VIEW loyalty_audit_log AS SELECT * FROM loyalty_audit_log;`);
    expect(await applyAccrual(f.db, await loadPolicy(f.db), { orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000 }))
      .toMatchObject({ ok: false, reason: 'd1_error', error: expect.stringContaining('failed to verify accounting schema') });
    expect(f.sqlite.prepare('SELECT loyalty_points FROM customers').get()?.loyalty_points).toBe(0);
    expect(f.sqlite.prepare('SELECT balance FROM cashback_wallets').get()?.balance).toBe(0);
    expect(f.sqlite.prepare('SELECT count(*) n FROM loyalty_point_logs').get()?.n).toBe(0);
    expect(f.sqlite.prepare('SELECT count(*) n FROM cashback_transactions').get()?.n).toBe(0);
  });

  it.each(['all', ...accountingTables])('supports genuine missing tenant columns in %s without dropping tenant identity elsewhere', async legacyTable => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member');
    f.sqlite.exec("UPDATE orders SET payment_status = 'paid'; UPDATE customers SET loyalty_points = 49, lifetime_points = 49");
    const withoutTenant = legacyTable === 'all' ? [...accountingTables, 'orders', 'customers', 'cashback_wallets', 'loyalty_accounts'] : [legacyTable];
    for (const table of withoutTenant) f.sqlite.exec(`ALTER TABLE ${table} DROP COLUMN tenant_id`);
    const policy = await upgradingPolicy(f.db);
    expect(await applyAccrual(f.db, policy, { orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000 }))
      .toMatchObject({ ok: true, points: 2, cashback: 600, tierUpgraded: true });
    for (const table of accountingTables) {
      const rows = f.sqlite.prepare(`SELECT * FROM ${table}`).all();
      expect(rows).toHaveLength(table === 'cashback_transactions' ? 1 : 2);
      if (!withoutTenant.includes(table)) expect(rows.every(row => row.tenant_id === 'default')).toBe(true);
    }
  });
});
