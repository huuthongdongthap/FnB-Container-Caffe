// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import { clockOut } from '../../../../packages/domain/shift/commands/attendance';
import { shiftScope } from '../../../../packages/domain/shift/commands/shift-access';
import { reconcileShiftCash } from '../../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { orderCreationFixture } from '../integrations/order-creation-fixture';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
afterEach(() => { for (const value of fixtures.splice(0)) value.sqlite.close(); });
function fixture() {
  const fx = orderCreationFixture(); fixtures.push(fx);
  fx.sqlite.exec(`INSERT INTO users (id,name,role,tenant_id) VALUES ('collector','Collector','cashier','store');
    INSERT INTO staff_shifts (id,tenant_id,staff_id,staff_name,date,shift,clock_in,opening_cash,attendance_state)
      VALUES (1,'store','collector','Collector','2026-11-21','attendance','2026-11-21T01:00:00Z',0,'active');
    INSERT INTO orders (id,tenant_id,items,total,status,payment_status,payment_method,customer_name,customer_phone)
      VALUES ('sale','store','[]',50000,'ready','pending','cod','Guest','0900000000');
    INSERT INTO payments (id,order_id,tenant_id,method,amount,status)
      VALUES ('payment','sale','store','cod',50000,'pending');`);
  const db = fx.env.AURA_DB as D1Database;
  const collect = (target = db) => collectCodPayment(target, 'sale', 'store', 'collector');
  const reconcile = (target = db, amount = 0) => reconcileShiftCash(target,
    { shift_id: '1', opening_float: 0, denominations: { denominations: [{ denomination: 1, count: amount }] } }, 'collector', 'store');
  const close = async () => clockOut(await shiftScope(fx.env, { id: 'collector' } as never), 'collector');
  const unchanged = () => {
    expect(fx.sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('pending');
    expect(fx.sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('pending');
    expect(fx.sqlite.prepare('SELECT COUNT(*) n FROM cash_payment_attributions').get()?.n).toBe(0);
    expect(fx.sqlite.prepare('SELECT cash_sales,total_sales,order_count FROM staff_shifts WHERE id=1').get())
      .toMatchObject({ cash_sales: 0, total_sales: 0, order_count: 0 });
  };
  const beforeBatch = (action: () => void | Promise<void>) => ({ ...db, async batch(statements: Parameters<D1Database['batch']>[0]) {
    await action(); return db.batch(statements);
  } }) as D1Database;
  return { ...fx, db, collect, reconcile, close, unchanged, beforeBatch };
}

describe('COD financial cutoff (real SQLite)', () => {
  it('rejects reconcile → collect → clock-out without moving any money', async () => {
    const fx = fixture();
    await fx.reconcile();
    expect(await fx.collect()).toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
    expect(await fx.close()).toMatchObject({ attendance_state: 'completed' });
    expect(fx.sqlite.prepare('SELECT cash_payment_total,expected_cash FROM shift_reconciliations').get())
      .toMatchObject({ cash_payment_total: 0, expected_cash: 0 });
  });
  it('counts once, reconciles once and replays paid after cutoff/clock-out without adding sales', async () => {
    const fx = fixture();
    expect(await fx.collect()).toMatchObject({ success: true });
    expect(await fx.collect()).toMatchObject({ success: true, idempotent: true });
    expect(await fx.reconcile(fx.db, 50000)).toMatchObject({ cash_payment_total: 50000, variance: 0 });
    await fx.close();
    expect(await fx.collect()).toMatchObject({ success: true, idempotent: true });
    expect(fx.sqlite.prepare('SELECT cash_sales,total_sales,order_count FROM staff_shifts').get())
      .toMatchObject({ cash_sales: 50000, total_sales: 50000, order_count: 1 });
    expect(fx.sqlite.prepare('SELECT COUNT(*) n FROM cash_payment_attributions').get()?.n).toBe(1);
  });
  it('rejects clock-out after the shift pre-read, even when another shift replaces it', async () => {
    const fx = fixture();
    const race = fx.beforeBatch(async () => {
      await fx.close();
      fx.sqlite.exec(`INSERT INTO staff_shifts (id,tenant_id,staff_id,staff_name,date,shift,clock_in)
        VALUES (2,'store','collector','Collector','2026-11-21','attendance','2026-11-21T12:00:00Z');`);
    });
    expect(await fx.collect(race)).toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
  });
  it('rejects a reconciliation inserted after the collecting shift pre-read', async () => {
    const fx = fixture();
    expect(await fx.collect(fx.beforeBatch(() => fx.reconcile().then(() => undefined))))
      .toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
  });
  it.each(['orders', 'payments', 'staff_shifts', 'cash_payment_attributions'])('rolls back every settlement write when %s silently ignores its write', async table => {
    const fx = fixture();
    const operation = table === 'cash_payment_attributions' ? 'INSERT' : 'UPDATE';
    fx.sqlite.exec(`CREATE TRIGGER ignore_write BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(IGNORE); END;`);
    expect(await fx.collect()).toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
  });
  it('has no orphan attribution after an order CAS loss', async () => {
    const fx = fixture();
    expect(await fx.collect(fx.beforeBatch(() => { fx.sqlite.exec("UPDATE orders SET status='cancelled'"); })))
      .toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
  });
  it('rejects ledger changes between pre-read and batch', async () => {
    const fx = fixture();
    expect(await fx.collect(fx.beforeBatch(() => { fx.sqlite.exec("UPDATE payments SET amount=1"); })))
      .toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
  });
  it.each(['shift_reconciliations', 'cash_payment_attributions'])('does not downgrade shifted settlement when %s is missing', async table => {
    const fx = fixture(); fx.sqlite.exec(`DROP TABLE ${table}`);
    expect(await fx.collect()).toMatchObject({ success: false, statusCode: 409 });
    expect(fx.sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('pending');
    expect(fx.sqlite.prepare('SELECT status FROM payments').get()?.status).toBe('pending');
    expect(fx.sqlite.prepare('SELECT cash_sales FROM staff_shifts').get()?.cash_sales).toBe(0);
  });
  it('rejects shifted settlement without payments ledger', async () => {
    const fx = fixture(); fx.sqlite.exec('DROP TABLE payments');
    expect(await fx.collect()).toMatchObject({ success: false, statusCode: 409 });
    expect(fx.sqlite.prepare('SELECT payment_status FROM orders').get()?.payment_status).toBe('pending');
  });
  it('preserves no-shift collection with absent optional attendance/cutoff schema', async () => {
    const fx = fixture(); fx.sqlite.exec('DROP TABLE staff_shifts; DROP TABLE shift_reconciliations; DROP TABLE cash_payment_attributions');
    expect(await fx.collect()).toMatchObject({ success: true });
    expect(await fx.collect()).toMatchObject({ success: true, idempotent: true });
  });
  it('revalidates no-shift policy when a shift opens before settlement', async () => {
    const fx = fixture(); fx.sqlite.exec("UPDATE staff_shifts SET clock_out='2026-11-21T02:00:00Z'");
    expect(await fx.collect(fx.beforeBatch(() => { fx.sqlite.exec('UPDATE staff_shifts SET clock_out=NULL'); })))
      .toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
  });
  it('rolls back stale reconciliation before publishing its cutoff when collection wins the race', async () => {
    const fx = fixture();
    await expect(fx.reconcile(fx.beforeBatch(() => fx.collect().then(() => undefined))))
      .rejects.toMatchObject({ status: 409 });
    expect(fx.sqlite.prepare('SELECT COUNT(*) n FROM shift_reconciliations').get()?.n).toBe(0);
    expect(fx.sqlite.prepare('SELECT cash_sales FROM staff_shifts').get()?.cash_sales).toBe(50000);
    expect(await fx.reconcile(fx.db, 50000)).toMatchObject({ cash_payment_total: 50000 });
  });
  it('rejects an ignored reconciliation insert instead of reporting a nonexistent cutoff', async () => {
    const fx = fixture();
    fx.sqlite.exec('CREATE TRIGGER ignore_reconciliation BEFORE INSERT ON shift_reconciliations BEGIN SELECT RAISE(IGNORE); END;');
    await expect(fx.reconcile()).rejects.toMatchObject({ status: 409 });
    expect(fx.sqlite.prepare('SELECT COUNT(*) n FROM shift_reconciliations').get()?.n).toBe(0);
    fx.unchanged();
    fx.sqlite.exec('DROP TRIGGER ignore_reconciliation');
    await fx.reconcile();
    expect(await fx.collect()).toMatchObject({ success: false, statusCode: 409 });
    fx.unchanged();
  });
  it('rolls back a stale payout snapshot before publishing reconciliation', async () => {
    const fx = fixture();
    const race = fx.beforeBatch(() => { fx.sqlite.exec("INSERT INTO cash_payouts (id,tenant_id,shift_id,amount) VALUES ('payout','store','1',100)"); });
    await expect(fx.reconcile(race)).rejects.toMatchObject({ status: 409 });
    expect(fx.sqlite.prepare('SELECT COUNT(*) n FROM shift_reconciliations').get()?.n).toBe(0);
  });
});
