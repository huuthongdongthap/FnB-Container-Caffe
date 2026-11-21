// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { reconcileShiftCash } from '../../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';

const databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  sqlite.exec(readFileSync(new URL('../../../schema.sql', import.meta.url), 'utf8'));
  function prepare(sql: string) {
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...args: SQLInputValue[]) { values = args; return statement; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values), success: true }; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; },
    };
    return statement;
  }
  const db = { prepare, async batch(ops: ReturnType<typeof prepare>[]) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const op of ops) results.push(await op.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } } as unknown as D1Database;
  sqlite.exec(`INSERT INTO users (id, name, role, tenant_id) VALUES ('operator', 'Operator', 'staff', 'store'), ('other', 'Other', 'staff', 'store'), ('manager-id', 'Manager', 'manager', 'store');
    INSERT INTO staff_shifts (id, tenant_id, staff_id, staff_name, date, shift, clock_in, opening_cash)
    VALUES (1, 'store', 'operator', 'Operator', '2026-11-21', 'morning', '2026-11-21T01:00:00Z', 200000)`);
  return { sqlite, db };
}
const input = (id = '1', opening = 200000, actual = opening) => ({ shift_id: id, opening_float: opening,
  denominations: { denominations: [{ denomination: 1, count: actual }] } });

describe('cash reconciliation SQLite contracts', () => {
  it('uses the recorded opening float for calculations and both persisted fields', async () => {
    const { sqlite, db } = fixture();
    const result = await reconcileShiftCash(db, input(), 'operator', 'store');
    expect(result).toMatchObject({ expected_cash: 200000, opening_float: 200000, variance: 0 });
    expect(sqlite.prepare('SELECT opening_float, opening_cash FROM shift_reconciliations').get()).toMatchObject({ opening_float: 200000, opening_cash: 200000 });
    await expect(reconcileShiftCash(db, input('1', 0), 'operator', 'store')).rejects.toThrow();
  });
  it('counts a pending COD created before the shift when collected during it', async () => {
    const { sqlite, db } = fixture();
    sqlite.exec(`INSERT INTO orders (id, tenant_id, total, status, payment_status, payment_method, items, customer_name, customer_phone) VALUES ('sale', 'store', 50000, 'ready', 'pending', 'cod', '[]', 'Guest', '0900000000');
      INSERT INTO payments (id, order_id, tenant_id, method, amount, status, created_at) VALUES ('pay', 'sale', 'store', 'cod', 50000, 'pending', '2026-11-20T00:00:00Z');`);
    expect(await collectCodPayment(db, 'sale', 'store', 'operator')).toMatchObject({ success: true });
    expect(await reconcileShiftCash(db, input('1', 200000, 250000), 'operator', 'store')).toMatchObject({ cash_payment_total: 50000, variance: 0 });
  });
  it('does not count a collecting operators payment in an overlapping shift', async () => {
    const { sqlite, db } = fixture();
    sqlite.exec(`INSERT INTO staff_shifts (id, tenant_id, staff_id, staff_name, date, shift, clock_in) VALUES (2, 'store', 'other', 'Other', '2026-11-21', 'morning', '2026-11-21T01:00:00Z');
      INSERT INTO orders (id, tenant_id, total, status, payment_status, payment_method, items, customer_name, customer_phone) VALUES ('sale', 'store', 50000, 'ready', 'pending', 'cod', '[]', 'Guest', '0900000000');
      INSERT INTO payments (id, order_id, tenant_id, method, amount, status, created_at) VALUES ('pay', 'sale', 'store', 'cod', 50000, 'pending', '2026-11-20T00:00:00Z');`);
    await collectCodPayment(db, 'sale', 'store', 'operator');
    expect((await reconcileShiftCash(db, input('2', 0), 'other', 'store')).cash_payment_total).toBe(0);
    expect((await reconcileShiftCash(db, input('1', 200000, 250000), 'operator', 'store')).cash_payment_total).toBe(50000);
  });
  it('stores operator and reconciling manager separately', async () => {
    const { sqlite, db } = fixture();
    await reconcileShiftCash(db, input(), 'manager-id', 'store', 'manager');
    expect(sqlite.prepare('SELECT staff_id, reconciled_by FROM shift_reconciliations').get()).toMatchObject({ staff_id: 'operator', reconciled_by: 'manager-id' });
  });
  it('rejects unauthorized and cross-tenant actors', async () => {
    const { db } = fixture();
    await expect(reconcileShiftCash(db, input(), 'other', 'store', 'staff')).rejects.toMatchObject({ status: 403 });
    await expect(reconcileShiftCash(db, input(), 'manager', 'elsewhere', 'manager')).rejects.toThrow('not found');
  });
  it('rejects inconsistent opening float before writing any handover', async () => {
    const { sqlite, db } = fixture();
    await expect(reconcileShiftCash(db, input('1', 0), 'operator', 'store')).rejects.toMatchObject({ status: 409 });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM shift_reconciliations').get()?.n).toBe(0);
  });
  it('rejects unattributed legacy cash when shift responsibility is ambiguous', async () => {
    const { sqlite, db } = fixture();
    sqlite.exec(`INSERT INTO staff_shifts (id, tenant_id, staff_id, staff_name, date, shift, clock_in)
      VALUES (2, 'store', 'other', 'Other', '2026-11-21', 'morning', '2026-11-21T01:00:00Z');
      INSERT INTO orders (id, tenant_id, total, status, payment_status, payment_method, items, customer_name, customer_phone) VALUES ('sale', 'store', 50000, 'ready', 'paid', 'cash', '[]', 'Guest', '0900000000');
      INSERT INTO payments (id, order_id, tenant_id, method, amount, status, created_at, updated_at)
      VALUES ('legacy', 'sale', 'store', 'cash', 50000, 'completed', '2026-11-21T02:00:00Z', '2026-11-21T02:00:00Z');`);
    await expect(reconcileShiftCash(db, input(), 'operator', 'store')).rejects.toMatchObject({ status: 409 });
  });
  it('rejects repeats without changing the ledger', async () => {
    const { sqlite, db } = fixture();
    await reconcileShiftCash(db, input(), 'operator', 'store');
    await expect(reconcileShiftCash(db, input(), 'operator', 'store')).rejects.toThrow('already been reconciled');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM shift_reconciliations').get()?.n).toBe(1);
  });
  it('allows HQ owner/admin and store supervisor to reconcile a store shift', async () => {
    const { sqlite, db } = fixture();
    sqlite.exec(`INSERT INTO users (id, name, role, tenant_id) VALUES
      ('hq-owner', 'HQ Owner', 'owner', 'hq'),
      ('sup-1', 'Supervisor', 'supervisor', 'store');
      INSERT INTO staff_shifts (id, tenant_id, staff_id, staff_name, date, shift, clock_in, opening_cash)
      VALUES (2, 'store', 'other', 'Other', '2026-11-21', 'afternoon', '2026-11-21T09:00:00Z', 100000);`);
    const hqRes = await reconcileShiftCash(db, input('1', 200000, 200000), 'hq-owner', 'store', 'owner');
    expect(hqRes.staff_id).toBe('operator');
    const supRes = await reconcileShiftCash(db, input('2', 100000, 100000), 'sup-1', 'store', 'supervisor');
    expect(supRes.staff_id).toBe('other');
  });
  it('rolls back inserted reconciliation if post-insert verification throws', async () => {
    const { sqlite, db } = fixture();
    let paymentReads = 0;
    const wrappedDb = {
      ...db,
      prepare(sql: string) {
        const stmt = db.prepare(sql);
        if (/FROM payments p/i.test(sql) && /cash_payment_attributions/i.test(sql)) {
          return {
            bind(...args: unknown[]) {
              const bound = stmt.bind(...args);
              return {
                ...bound,
                async all() {
                  paymentReads += 1;
                  if (paymentReads === 2) {
                    throw new Error('simulated post-insert verification failure');
                  }
                  return bound.all();
                },
              };
            },
          };
        }
        return stmt;
      },
    } as unknown as D1Database;
    await expect(reconcileShiftCash(wrappedDb, input('1', 200000, 200000), 'operator', 'store')).rejects.toThrow(
      'simulated post-insert verification failure',
    );
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM shift_reconciliations').get()?.n).toBe(0);
  });
});
