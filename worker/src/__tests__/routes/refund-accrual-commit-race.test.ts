// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { applyAccrual } from '../../../../packages/domain/crm/commands/accrual';
import { reverseAccrual } from '../../../../packages/domain/crm/commands/refund-reversal';
import { loadPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';
import { refundRaceFixture } from './refund-race-sqlite-fixture';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function webhook() {
  const data = { orderCode: 123456, amount: 20000, code: '00', description: 'Local regression' };
  const text = Object.keys(data).sort().map(key => `${key}=${data[key as keyof typeof data]}`).join('&');
  const signature = createHmac('sha256', 'local-payos-checksum').update(text).digest('hex');
  return { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '00', desc: 'success', success: true, data, signature }) };
}

describe('PayOS accrual commit-time refund coordination', () => {
  it('does not mint benefits after a full refund completes zero-earned work during a paused signed PayOS callback', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member'); f.payment('ORDER');
    const reached = deferred(), release = deferred();
    let paused = false;
    f.onBatch(async sql => {
      if (!paused && sql.some(query => query.includes('INSERT INTO cashback_transactions'))) {
        paused = true; reached.resolve(); await release.promise;
      }
    });
    const callback = f.app.request('/payos', webhook(), f.env);
    await reached.promise;
    expect(f.sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
    const refund = await f.refund({ paymentId: 'pay_ORDER', amount: 20000, manual_transfer_ref: 'BANK-RACE' });
    expect(refund.status).toBe(200);
    expect(f.sqlite.prepare('SELECT status, points_reversed, cashback_reversed FROM refund_loyalty_work').get())
      .toMatchObject({ status: 'completed', points_reversed: 0, cashback_reversed: 0 });
    release.resolve(); expect((await callback).status).toBe(200);
    expect(paused).toBe(true);
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points FROM customers').get()).toMatchObject({ loyalty_points: 0, lifetime_points: 0 });
    expect(f.sqlite.prepare('SELECT balance, total_earned FROM cashback_wallets').get()).toMatchObject({ balance: 0, total_earned: 0 });
    expect(f.sqlite.prepare('SELECT points_earned, cashback_earned FROM orders').get()).toMatchObject({ points_earned: 0, cashback_earned: 0 });
    expect(f.sqlite.prepare("SELECT count(*) n FROM cashback_transactions WHERE type = 'earn'").get()?.n).toBe(0);
    expect(f.sqlite.prepare("SELECT count(*) n FROM loyalty_point_logs WHERE reason = 'purchase'").get()?.n).toBe(0);
  });

  it('commits exact net remaining entitlement after a partial refund during a paused signed PayOS callback with zero overcredit window and exact subsequent reversal', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member'); f.payment('ORDER');
    const reached = deferred(), release = deferred();
    let paused = false;
    let creditAttempts = 0;
    f.onBatch(async sql => {
      if (sql.some(query => query.includes('INSERT INTO cashback_transactions'))) {
        creditAttempts++;
        if (!paused) {
          paused = true; reached.resolve(); await release.promise;
        }
      }
    });
    const callback = f.app.request('/payos', webhook(), f.env);
    await reached.promise;
    expect(f.sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('paid');
    const partial = await f.refund({ paymentId: 'pay_ORDER', amount: 10000, manual_transfer_ref: 'BANK-PARTIAL-1' });
    expect(partial.status).toBe(200);
    expect(f.sqlite.prepare('SELECT status, points_reversed, cashback_reversed FROM refund_loyalty_work').get())
      .toMatchObject({ status: 'completed', points_reversed: 0, cashback_reversed: 0 });

    release.resolve(); expect((await callback).status).toBe(200);
    expect(creditAttempts).toBe(2);
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points FROM customers').get()).toMatchObject({ loyalty_points: 1, lifetime_points: 1 });
    expect(f.sqlite.prepare('SELECT balance, total_earned FROM cashback_wallets').get()).toMatchObject({ balance: 300, total_earned: 300 });
    expect(f.sqlite.prepare('SELECT points_earned, cashback_earned FROM orders').get()).toMatchObject({ points_earned: 1, cashback_earned: 300 });
    expect(f.sqlite.prepare("SELECT status, points_reversed, cashback_reversed FROM refund_loyalty_work WHERE reversal_key = 'BANK-PARTIAL-1'").get())
      .toMatchObject({ status: 'completed', points_reversed: 1, cashback_reversed: 300 });
    expect(f.sqlite.prepare("SELECT amount, balance_after FROM cashback_transactions WHERE type = 'earn'").get())
      .toMatchObject({ amount: 300, balance_after: 300 });
    expect(f.sqlite.prepare("SELECT points_change, balance_after FROM loyalty_point_logs WHERE reason = 'purchase'").get())
      .toMatchObject({ points_change: 1, balance_after: 1 });

    // Second partial refund completing the full 20,000 VND order must reverse the exact remaining 1 pt / 300 VND.
    const remainder = await f.refund({ paymentId: 'pay_ORDER', amount: 10000, manual_transfer_ref: 'BANK-PARTIAL-2' });
    expect(remainder.status).toBe(200);
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points FROM customers').get()).toMatchObject({ loyalty_points: 0, lifetime_points: 0 });
    expect(f.sqlite.prepare('SELECT balance, total_earned FROM cashback_wallets').get()).toMatchObject({ balance: 0, total_earned: 0 });
    expect(f.sqlite.prepare('SELECT points_earned, cashback_earned FROM orders').get()).toMatchObject({ points_earned: 0, cashback_earned: 0 });
    expect(f.sqlite.prepare("SELECT status, points_reversed, cashback_reversed FROM refund_loyalty_work WHERE reversal_key = 'BANK-PARTIAL-2'").get())
      .toMatchObject({ status: 'completed', points_reversed: 1, cashback_reversed: 300 });
    expect(f.sqlite.prepare('SELECT SUM(points_change) s FROM loyalty_point_logs').get()?.s).toBe(0);
    expect(f.sqlite.prepare("SELECT SUM(CASE WHEN type = 'earn' THEN amount ELSE -amount END) s FROM cashback_transactions").get()?.s).toBe(0);
  });

  it('matches cumulative tranche rounding across multiple prior partial refunds (completed and pending), avoids spurious tier upgrade, and settles cleanly with later refunds', async () => {
    const f = refundRaceFixture();
    f.sqlite.exec(`INSERT INTO orders (id, tenant_id, customer_id, total, status, payment_status)
      VALUES ('ORD30K', 'default', 'member', 30000, 'completed', 'paid');
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id)
      VALUES ('pay_ORD30K', 'ORD30K', 'payos', 30000, 'completed', '300001');
      INSERT INTO loyalty_accounts (customer_id, tenant_id, tier) VALUES ('member', 'default', 'bronze');`);
    // First 10k partial refund completes normally before accrual; second 10k partial refund leaves work pending.
    expect((await f.refund({ paymentId: 'pay_ORD30K', amount: 10000, manual_transfer_ref: 'TRANCHE-1' })).status).toBe(200);
    f.sqlite.exec(`CREATE TRIGGER fail_tranche2 BEFORE INSERT ON loyalty_point_logs WHEN NEW.reason = 'refund' BEGIN SELECT RAISE(ABORT, 'transient'); END;`);
    expect((await f.refund({ paymentId: 'pay_ORD30K', amount: 10000, manual_transfer_ref: 'TRANCHE-2' })).status).toBe(200);
    f.sqlite.exec('DROP TRIGGER fail_tranche2');
    expect(f.sqlite.prepare("SELECT status FROM refund_loyalty_work WHERE reversal_key = 'TRANCHE-2'").get()?.status).toBe('pending');

    const policy = await loadPolicy(f.db);
    // Silver at 2 points: gross 3 points would upgrade, net 1 point must keep bronze.
    policy.tiers = [policy.defaultTier, { ...policy.defaultTier, tierName: 'silver', minPoints: 2 }];
    const accrual = await applyAccrual(f.db, policy, { orderId: 'ORD30K', customerId: 'member', orderTotalVnd: 30000, tenantId: 'default' });
    expect(accrual).toMatchObject({ ok: true, points: 1, cashback: 300, tier: 'bronze', tierUpgraded: false });
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers').get())
      .toEqual({ loyalty_points: 1, lifetime_points: 1, loyalty_tier: 'bronze' });
    expect(f.sqlite.prepare('SELECT current_points, lifetime_points, tier FROM loyalty_accounts').get())
      .toEqual({ current_points: 1, lifetime_points: 1, tier: 'bronze' });
    expect(f.sqlite.prepare('SELECT balance, total_earned FROM cashback_wallets').get()).toEqual({ balance: 300, total_earned: 300 });
    expect(f.sqlite.prepare("SELECT points_earned, cashback_earned FROM orders WHERE id = 'ORD30K'").get())
      .toEqual({ points_earned: 1, cashback_earned: 300 });
    expect(f.sqlite.prepare("SELECT reversal_key, status, points_reversed, cashback_reversed FROM refund_loyalty_work ORDER BY reversal_key").all())
      .toEqual([
        { reversal_key: 'TRANCHE-1', status: 'completed', points_reversed: 1, cashback_reversed: 300 },
        { reversal_key: 'TRANCHE-2', status: 'completed', points_reversed: 1, cashback_reversed: 300 },
      ]);
    // Retrying TRANCHE-2 after accrual completed it must return 409 without double-reversing.
    expect((await f.refund({ paymentId: 'pay_ORD30K', amount: 10000, manual_transfer_ref: 'TRANCHE-2' })).status).toBe(409);
    // Final 10k tranche reverses remaining 1 pt / 300 VND cleanly to zero.
    expect((await f.refund({ paymentId: 'pay_ORD30K', amount: 10000, manual_transfer_ref: 'TRANCHE-3' })).status).toBe(200);
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers').get())
      .toEqual({ loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'bronze' });
    expect(f.sqlite.prepare('SELECT balance, total_earned FROM cashback_wallets').get()).toEqual({ balance: 0, total_earned: 0 });
    expect(f.sqlite.prepare("SELECT points_earned, cashback_earned FROM orders WHERE id = 'ORD30K'").get())
      .toEqual({ points_earned: 0, cashback_earned: 0 });
  });

  it('rejects late accrual with zero earn ledgers when multiple prior partial refunds already cover full order total', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member'); f.payment('ORDER', 'completed');
    f.sqlite.exec("UPDATE orders SET payment_status = 'paid'");
    expect((await f.refund({ paymentId: 'pay_ORDER', amount: 10000, manual_transfer_ref: 'PART-A' })).status).toBe(200);
    expect((await f.refund({ paymentId: 'pay_ORDER', amount: 10000, manual_transfer_ref: 'PART-B' })).status).toBe(200);
    const result = await applyAccrual(f.db, await loadPolicy(f.db), {
      orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId: 'default',
    });
    expect(result).toEqual({ ok: false, reason: 'order_not_eligible' });
    expect(f.sqlite.prepare("SELECT count(*) n FROM cashback_transactions WHERE type = 'earn'").get()?.n).toBe(0);
    expect(f.sqlite.prepare("SELECT count(*) n FROM loyalty_point_logs WHERE reason = 'purchase'").get()?.n).toBe(0);
  });

  it.each(['missing metadata column', 'ignored order write', 'ignored account mirror'])('rolls back all accrual effects on %s', async fault => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member');
    f.sqlite.exec(`UPDATE orders SET payment_status = 'paid';
      INSERT INTO loyalty_accounts (customer_id, tier) VALUES ('member', 'bronze');`);
    if (fault === 'missing metadata column') f.sqlite.exec('ALTER TABLE orders DROP COLUMN cashback_earned');
    else if (fault === 'ignored order write') f.sqlite.exec(`CREATE TRIGGER ignore_credit BEFORE UPDATE OF points_earned ON orders BEGIN SELECT RAISE(IGNORE); END;`);
    else f.sqlite.exec(`CREATE TRIGGER ignore_account BEFORE UPDATE ON loyalty_accounts BEGIN SELECT RAISE(IGNORE); END;`);
    let creditBatches = 0;
    f.onBatch(async sql => {
      if (sql.some(query => query.includes('INSERT INTO cashback_transactions'))) creditBatches++;
    });
    const result = await applyAccrual(f.db, await loadPolicy(f.db), { orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId: 'default' });
    expect(result).toMatchObject({ ok: false, reason: 'd1_error' });
    expect(creditBatches).toBe(1);
    expect(f.sqlite.prepare('SELECT loyalty_points FROM customers').get()?.loyalty_points).toBe(0);
    expect(f.sqlite.prepare('SELECT balance FROM cashback_wallets').get()?.balance).toBe(0);
    expect(f.sqlite.prepare('SELECT current_points FROM loyalty_accounts').get()?.current_points).toBe(0);
    expect(f.sqlite.prepare('SELECT points_earned FROM orders').get()?.points_earned).toBe(0);
    for (const ledger of ['cashback_transactions', 'loyalty_point_logs', 'loyalty_audit_log']) {
      expect(f.sqlite.prepare(`SELECT count(*) n FROM ${ledger}`).get()?.n).toBe(0);
    }
  });

  it('refund immediately after accrual commit sees the tier and account credit with no late re-credit', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member'); f.payment('ORDER', 'completed');
    f.sqlite.exec(`UPDATE orders SET payment_status = 'paid';
      INSERT INTO loyalty_accounts (customer_id, tier) VALUES ('member', 'bronze');`);
    const policy = await loadPolicy(f.db);
    policy.tiers = [policy.defaultTier, { ...policy.defaultTier, tierName: 'silver', minPoints: 2 }];
    let observedCredit;
    let refundStatus;
    f.afterCredit(async () => {
      observedCredit = f.sqlite.prepare('SELECT current_points, lifetime_points, tier FROM loyalty_accounts').get();
      const response = await f.refund({ paymentId: 'pay_ORDER', amount: 20000, manual_transfer_ref: 'BANK-AFTER-CREDIT' });
      refundStatus = response.status;
    });
    expect(await applyAccrual(f.db, policy, { orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000 }))
      .toMatchObject({ ok: true, tierUpgraded: true });
    expect(refundStatus).toBe(200);
    expect(observedCredit).toEqual({ current_points: 2, lifetime_points: 2, tier: 'silver' });
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers').get())
      .toEqual({ loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'bronze' });
    expect(f.sqlite.prepare('SELECT current_points, lifetime_points, tier FROM loyalty_accounts').get())
      .toEqual({ current_points: 0, lifetime_points: 0, tier: 'bronze' });
    expect(f.sqlite.prepare('SELECT status, points_reversed, cashback_reversed FROM refund_loyalty_work').get())
      .toEqual({ status: 'completed', points_reversed: 2, cashback_reversed: 600 });
  });

  it('retains valid minimal-schema accrual when status and refund-work tables genuinely do not exist', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member');
    f.sqlite.exec('ALTER TABLE orders DROP COLUMN status; ALTER TABLE orders DROP COLUMN payment_status; DROP TABLE refund_loyalty_work');
    expect(await applyAccrual(f.db, await loadPolicy(f.db), { orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId: 'default' }))
      .toMatchObject({ ok: true, points: 2, cashback: 600 });
    expect(f.sqlite.prepare('SELECT loyalty_points FROM customers').get()?.loyalty_points).toBe(2);
  });

  it('orders same-day mixed SQLite space and ISO-T refund_loyalty_work timestamps chronologically during accrual attribution', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member');
    f.sqlite.exec(`UPDATE orders SET status = 'completed', payment_status = 'paid';
      INSERT INTO refund_loyalty_work (tenant_id, reversal_key, payment_id, order_id, amount, status, points_reversed, cashback_reversed, created_at, completed_at)
      VALUES ('default', 'EARLY-ISO', 'pay_ORDER', 'ORDER', 5000, 'completed', 0, 0, '2026-11-22 10:00:00', '2026-11-22T10:00:00.100Z'),
             ('default', 'LATER-SQLITE', 'pay_ORDER', 'ORDER', 5000, 'pending', 0, 0, '2026-11-22 14:00:00', NULL);`);
    const result = await applyAccrual(f.db, await loadPolicy(f.db), {
      orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId: 'default',
    });
    expect(result).toMatchObject({ ok: true, points: 1, cashback: 300 });
    // Cumulative rounding on 2 gross points: earlier 5k tranche (25%) takes 1 pt, later 5k tranche (50% cumulative) takes 0 pts.
    expect(f.sqlite.prepare("SELECT reversal_key, points_reversed, cashback_reversed FROM refund_loyalty_work ORDER BY reversal_key").all())
      .toEqual([
        { reversal_key: 'EARLY-ISO', points_reversed: 1, cashback_reversed: 150 },
        { reversal_key: 'LATER-SQLITE', points_reversed: 0, cashback_reversed: 150 },
      ]);
  });

  it('tolerates a benign zero-earned pending-to-completed transition on refund_loyalty_work during accrual commit', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member');
    f.sqlite.exec(`UPDATE orders SET status = 'completed', payment_status = 'paid';
      INSERT INTO refund_loyalty_work (tenant_id, reversal_key, payment_id, order_id, amount, status, points_reversed, cashback_reversed)
      VALUES ('default', 'PENDING-ZERO', 'pay_ORDER', 'ORDER', 10000, 'pending', 0, 0);`);
    let batchAttempts = 0;
    f.onBatch(async sql => {
      if (sql.some(query => query.includes('INSERT INTO cashback_transactions'))) {
        batchAttempts++;
        if (batchAttempts === 1) {
          f.sqlite.exec("UPDATE refund_loyalty_work SET status = 'completed', completed_at = '2026-11-22T10:00:00.500Z' WHERE reversal_key = 'PENDING-ZERO'");
        }
      }
    });
    const result = await applyAccrual(f.db, await loadPolicy(f.db), {
      orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId: 'default',
    });
    expect(result).toMatchObject({ ok: true, points: 1, cashback: 300 });
    expect(batchAttempts).toBe(1);
    expect(f.sqlite.prepare("SELECT status, points_reversed, cashback_reversed FROM refund_loyalty_work WHERE reversal_key = 'PENDING-ZERO'").get())
      .toEqual({ status: 'completed', points_reversed: 1, cashback_reversed: 300 });
  });

  it('legacy reverseAccrual ignores zero-earned pre-accrual audit rows and reverses remaining net benefits accurately', async () => {
    const f = refundRaceFixture();
    f.sqlite.exec(`INSERT INTO orders (id, tenant_id, customer_id, total, status, payment_status)
      VALUES ('ORD100K', 'default', 'member', 100000, 'completed', 'paid');
      INSERT INTO payments (id, order_id, method, amount, status, transaction_id)
      VALUES ('pay_ORD100K', 'ORD100K', 'payos', 100000, 'completed', '900001');`);
    // 50% partial refund before accrual writes a zero-earned points_refund audit row.
    expect((await f.refund({ paymentId: 'pay_ORD100K', amount: 50000, manual_transfer_ref: 'PRE-50K' })).status).toBe(200);
    const policy = await loadPolicy(f.db);
    // Late accrual nets the prior 50% refund: gross 10 pts / 3000 VND -> net 5 pts / 1500 VND.
    expect(await applyAccrual(f.db, policy, {
      orderId: 'ORD100K', customerId: 'member', orderTotalVnd: 100000, tenantId: 'default',
    })).toMatchObject({ ok: true, points: 5, cashback: 1500 });

    // Two 25% legacy reverseAccrual calls must reverse the remaining 5 pts / 1500 VND cleanly to zero.
    const rev1 = await reverseAccrual(f.db, policy, {
      orderId: 'ORD100K', customerId: 'member', refundAmountVnd: 25000, tenantId: 'default',
    });
    expect(rev1).toMatchObject({ ok: true, pointsDeducted: 3 });
    const rev2 = await reverseAccrual(f.db, policy, {
      orderId: 'ORD100K', customerId: 'member', refundAmountVnd: 25000, tenantId: 'default',
    });
    expect(rev2).toMatchObject({ ok: true, pointsDeducted: 2 });
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points FROM customers').get()).toEqual({ loyalty_points: 0, lifetime_points: 0 });
    expect(f.sqlite.prepare('SELECT balance, total_earned FROM cashback_wallets').get()).toEqual({ balance: 0, total_earned: 0 });
    const rev3 = await reverseAccrual(f.db, policy, {
      orderId: 'ORD100K', customerId: 'member', refundAmountVnd: 10000, tenantId: 'default',
    });
    expect(rev3).toEqual({ ok: false, reason: 'already_reversed' });
  });

  it('supports default-tenant accrual on legacy schema lacking tenant_id and fails closed for non-default tenants lacking ledger tenant_id', async () => {
    const legacy = refundRaceFixture(); legacy.order('ORDER', 'default', 'member');
    legacy.sqlite.exec("UPDATE orders SET payment_status = 'paid'");
    for (const table of ['orders', 'customers', 'cashback_wallets', 'cashback_transactions', 'loyalty_point_logs', 'loyalty_audit_log', 'loyalty_accounts']) {
      legacy.sqlite.exec(`ALTER TABLE ${table} DROP COLUMN tenant_id`);
    }
    expect(await applyAccrual(legacy.db, await loadPolicy(legacy.db), {
      orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId: 'default',
    })).toMatchObject({ ok: true, points: 2, cashback: 600 });

    const nonDefault = refundRaceFixture(); nonDefault.order('ORDER', 'sadec', 'member');
    nonDefault.sqlite.exec("UPDATE orders SET payment_status = 'paid'; UPDATE customers SET tenant_id = 'sadec'; UPDATE cashback_wallets SET tenant_id = 'sadec'; ALTER TABLE loyalty_audit_log DROP COLUMN tenant_id");
    expect(await applyAccrual(nonDefault.db, await loadPolicy(nonDefault.db), {
      orderId: 'ORDER', customerId: 'member', orderTotalVnd: 20000, tenantId: 'sadec',
    })).toMatchObject({ ok: false, reason: 'd1_error', error: expect.stringContaining('tenant scope unavailable for loyalty_audit_log') });
    expect(nonDefault.sqlite.prepare('SELECT loyalty_points FROM customers').get()?.loyalty_points).toBe(0);
    expect(nonDefault.sqlite.prepare('SELECT balance FROM cashback_wallets').get()?.balance).toBe(0);
  });

  it('rejects canceled, null payment_status, and partial payment_status orders before creating a wallet', async () => {
    const f = refundRaceFixture();
    f.sqlite.exec(`DELETE FROM cashback_wallets;
      INSERT INTO orders (id, tenant_id, customer_id, total, status, payment_status) VALUES
        ('ORD-CANCELED', 'default', 'member', 20000, 'canceled', 'paid'),
        ('ORD-NULL-PAY', 'default', 'member', 20000, 'completed', NULL),
        ('ORD-PARTIAL', 'default', 'member', 20000, 'completed', 'partial');`);
    const policy = await loadPolicy(f.db);
    for (const orderId of ['ORD-CANCELED', 'ORD-NULL-PAY', 'ORD-PARTIAL']) {
      expect(await applyAccrual(f.db, policy, {
        orderId, customerId: 'member', orderTotalVnd: 20000, tenantId: 'default',
      })).toEqual({ ok: false, reason: 'order_not_eligible' });
    }
    expect(f.sqlite.prepare('SELECT count(*) n FROM cashback_wallets').get()?.n).toBe(0);
  });
});

describe('order-only retry of a durable pending reference', () => {
  it('resolves the original refunded payment instead of a second paid payment, then completes pending loyalty work once', async () => {
    const f = refundRaceFixture(); f.order('ORDER', 'default', 'member'); f.payment('ORDER', 'completed');
    f.sqlite.exec(`UPDATE orders SET payment_status = 'paid', points_earned = 2; UPDATE customers SET loyalty_points = 2, lifetime_points = 2;
      INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after) VALUES ('original', 'member', 'ORDER', 2, 'purchase', 2);
      CREATE TRIGGER reject_refund_log BEFORE INSERT ON loyalty_point_logs WHEN NEW.reason = 'refund' BEGIN SELECT RAISE(ABORT, 'temporarily unavailable'); END;`);
    const first = await f.refund({ orderId: 'ORDER', amount: 20000, manual_transfer_ref: 'BANK-RETRY' });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ data: { loyalty_reversal: { status: 'failed', retryable: true } } });
    f.sqlite.exec("DROP TRIGGER reject_refund_log; INSERT INTO payments (id, order_id, method, amount, status, transaction_id) VALUES ('second-paid', 'ORDER', 'payos', 20000, 'paid', '999')");
    const before = f.sqlite.prepare('SELECT * FROM payments ORDER BY id').all();
    const retry = await f.refund({ orderId: 'ORDER', amount: 20000, manual_transfer_ref: ' BANK-RETRY ' });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ data: { paymentId: 'pay_ORDER', loyalty_reversal: { status: 'reversed', pointsDeducted: 2 } } });
    expect(f.sqlite.prepare('SELECT * FROM payments ORDER BY id').all()).toEqual(before);
    expect(f.sqlite.prepare('SELECT count(*) n FROM payment_refund_transfers').get()?.n).toBe(1);
    expect(f.sqlite.prepare('SELECT loyalty_points FROM customers').get()?.loyalty_points).toBe(0);
    expect((await f.refund({ orderId: 'ORDER', amount: 20000, manual_transfer_ref: 'BANK-RETRY' })).status).toBe(409);
  });

  it('does not redirect a reference onto another order or reveal a foreign-tenant payment', async () => {
    const f = refundRaceFixture(); f.order('ORDER'); f.payment('ORDER', 'refunded');
    f.order('OTHER'); f.payment('OTHER', 'completed', '888');
    f.sqlite.exec(`UPDATE orders SET payment_status = 'paid'; INSERT INTO payment_refund_transfers (tenant_id, manual_transfer_ref, payment_id, amount, reason, actor_id, created_at)
      VALUES ('default', 'BANK', 'pay_ORDER', 20000, 'original', 'manager', datetime('now'));
      INSERT INTO refund_loyalty_work (tenant_id, reversal_key, payment_id, order_id, amount) VALUES ('default', 'BANK', 'pay_ORDER', 'ORDER', 20000);`);
    const before = f.sqlite.prepare('SELECT * FROM payments ORDER BY id').all();
    expect((await f.refund({ orderId: 'OTHER', manual_transfer_ref: 'BANK' })).status).toBe(409);
    expect((await f.refund({ paymentId: 'pay_ORDER', orderId: 'OTHER', manual_transfer_ref: 'BANK' })).status).toBe(400);
    expect((await f.refund({ orderId: 'ORDER', manual_transfer_ref: 'BANK' }, 'foreign')).status).toBe(404);
    expect(f.sqlite.prepare('SELECT * FROM payments ORDER BY id').all()).toEqual(before);
    expect(f.sqlite.prepare('SELECT status FROM refund_loyalty_work').get()?.status).toBe('pending');
  });
});
