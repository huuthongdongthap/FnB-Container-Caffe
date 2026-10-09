/**
 * Canonical Shift, Staff & POS Integration Tests
 * Flow: STAFF → SHIFT OPEN → POS SALES → ORDER → PAYMENT → SHIFT CLOSE → RECONCILIATION
 * Verifies all Contract Invariants (< 200 LOC).
 */
import { describe, it, expect } from 'vitest';
import { openCanonicalShift, recordShiftSale, closeCanonicalShift } from '@aura/domain-shift';

describe('Shift / Staff / POS Contract', () => {
  function createMockDb() {
    const staff_shifts: any[] = [];
    const db = {
      staff_shifts,
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async <T = unknown>() => {
            if (sql.includes('staff_shifts') && sql.includes('staff_id = ?')) {
              return (staff_shifts.find(s => s.staff_id === binds[0] && s.status === 'open') || null) as T;
            }
            if (sql.includes('staff_shifts') && sql.includes('WHERE id = ?')) {
              return (staff_shifts.find(s => s.id === binds[0]) || null) as T;
            }
            return null as T;
          },
          run: async () => {
            if (sql.includes('INSERT INTO staff_shifts')) {
              staff_shifts.push({
                id: binds[0], staff_id: binds[1], staff_name: binds[2], role: binds[3],
                operating_unit_id: binds[4], clock_in: binds[5], clock_out: null, status: 'open',
                opening_cash: binds[6], total_sales: 0, cash_sales: 0, online_sales: 0, order_count: 0,
                notes: binds[7], created_at: binds[8], updated_at: binds[9],
              });
            } else if (sql.includes('staff_shifts') && sql.includes('cash_sales = cash_sales +')) {
              const s = staff_shifts.find(item => item.id === binds[4]);
              if (s) {
                s.cash_sales += (binds[0] as number); s.online_sales += (binds[1] as number);
                s.total_sales += (binds[2] as number); s.order_count += 1; s.updated_at = binds[3];
              }
            } else if (sql.includes('staff_shifts') && sql.includes("status = 'closed'")) {
              const s = staff_shifts.find(item => item.id === binds[6]);
              if (s) {
                s.status = 'closed'; s.clock_out = binds[0]; s.expected_cash = binds[1];
                s.actual_cash = binds[2]; s.cash_variance = binds[3]; s.notes = binds[4] || s.notes;
                s.updated_at = binds[5];
              }
            }
            return { success: true };
          },
        };
        return stmt as any;
      },
    };
    return db;
  }

  it('1. open shift: records server opening cash and initializes zeroed totals', async () => {
    const db = createMockDb();
    const res = await openCanonicalShift(db as any, {
      staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff',
      openingCash: 500000, operatingUnitId: 'pos_counter_1',
    });
    expect(res.ok).toBe(true);
    expect(res.shift?.status).toBe('open');
    expect(res.shift?.opening_cash).toBe(500000);
    expect(res.shift?.total_sales).toBe(0);
  });

  it('2. duplicate active shift: blocks opening second active shift for same staff', async () => {
    const db = createMockDb();
    await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000 });
    const dup = await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 200000 });
    expect(dup.ok).toBe(false);
    expect(dup.error).toBe('duplicate_active_shift');
  });

  it('3. staff authorization: blocks unauthorized roles (e.g. waiter) from opening shift', async () => {
    const db = createMockDb();
    const res = await openCanonicalShift(db as any, { staffId: 'usr_waiter_9', staffName: 'Phục vụ 9', role: 'waiter', openingCash: 100000 });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('unauthorized_role');
  });

  it('4. POS sale & cash payment: increments cash_sales and total_sales server-side', async () => {
    const db = createMockDb();
    const openRes = await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000 });
    const saleRes = await recordShiftSale(db as any, { shiftId: openRes.shift!.id, orderId: 'ord_cash_01', amount: 85000, paymentMethod: 'cash' });
    expect(saleRes.ok).toBe(true);
    expect(db.staff_shifts[0].cash_sales).toBe(85000);
    expect(db.staff_shifts[0].total_sales).toBe(85000);
    expect(db.staff_shifts[0].order_count).toBe(1);
  });

  it('5. POS sale & online payment: increments online_sales without inflating cash_sales', async () => {
    const db = createMockDb();
    const openRes = await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000 });
    await recordShiftSale(db as any, { shiftId: openRes.shift!.id, orderId: 'ord_cash_01', amount: 85000, paymentMethod: 'cash' });
    await recordShiftSale(db as any, { shiftId: openRes.shift!.id, orderId: 'ord_online_02', amount: 120000, paymentMethod: 'payos' });
    expect(db.staff_shifts[0].cash_sales).toBe(85000);
    expect(db.staff_shifts[0].online_sales).toBe(120000);
    expect(db.staff_shifts[0].total_sales).toBe(205000);
    expect(db.staff_shifts[0].order_count).toBe(2);
  });

  it('6. cross-operating-unit access: rejects sale sent to mismatched operating unit', async () => {
    const db = createMockDb();
    const openRes = await openCanonicalShift(db as any, {
      staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000, operatingUnitId: 'pos_counter_1',
    });
    const res = await recordShiftSale(db as any, {
      shiftId: openRes.shift!.id, orderId: 'ord_kiosk', amount: 45000, paymentMethod: 'cash', operatingUnitId: 'kiosk_station_99',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('cross_operating_unit_mismatch');
  });

  it('7. shift close & expected cash calculation: freezes totals and computes expected cash', async () => {
    const db = createMockDb();
    const openRes = await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000 });
    await recordShiftSale(db as any, { shiftId: openRes.shift!.id, orderId: 'ord_01', amount: 85000, paymentMethod: 'cash' });
    const closeRes = await closeCanonicalShift(db as any, {
      shiftId: openRes.shift!.id, closedByStaffId: 'usr_cashier_1', closedByRole: 'staff', actualCash: 585000,
    });
    expect(closeRes.ok).toBe(true);
    expect(closeRes.shift?.status).toBe('closed');
    expect(closeRes.shift?.expected_cash).toBe(585000);
    expect(closeRes.variance).toBe(0);
  });

  it('8. cash variance: explicitly calculates overage or shortage, never silently zeros it', async () => {
    const db = createMockDb();
    const openRes = await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000 });
    await recordShiftSale(db as any, { shiftId: openRes.shift!.id, orderId: 'ord_01', amount: 85000, paymentMethod: 'cash' });
    const closeRes = await closeCanonicalShift(db as any, {
      shiftId: openRes.shift!.id, closedByStaffId: 'usr_cashier_1', closedByRole: 'staff', actualCash: 570000,
    });
    expect(closeRes.ok).toBe(true);
    expect(closeRes.variance).toBe(-15000);
    expect(db.staff_shifts[0].cash_variance).toBe(-15000);
  });

  it('9. closed-shift mutation rejection: strictly blocks new sales after close', async () => {
    const db = createMockDb();
    const openRes = await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000 });
    await closeCanonicalShift(db as any, { shiftId: openRes.shift!.id, closedByStaffId: 'usr_cashier_1', closedByRole: 'staff', actualCash: 500000 });
    const lateSale = await recordShiftSale(db as any, { shiftId: openRes.shift!.id, orderId: 'ord_late', amount: 50000, paymentMethod: 'cash' });
    expect(lateSale.ok).toBe(false);
    expect(lateSale.error).toBe('closed_shift_immutable');
  });

  it('10. unauthorized closer: blocks peer staff from closing another staff shift without manager role', async () => {
    const db = createMockDb();
    const openRes = await openCanonicalShift(db as any, { staffId: 'usr_cashier_1', staffName: 'Thu Ngân 1', role: 'staff', openingCash: 500000 });
    const peerClose = await closeCanonicalShift(db as any, {
      shiftId: openRes.shift!.id, closedByStaffId: 'usr_peer_2', closedByRole: 'staff', actualCash: 500000,
    });
    expect(peerClose.ok).toBe(false);
    expect(peerClose.error).toBe('unauthorized_shift_closer');

    const mgrClose = await closeCanonicalShift(db as any, {
      shiftId: openRes.shift!.id, closedByStaffId: 'usr_mgr_boss', closedByRole: 'manager', actualCash: 500000,
    });
    expect(mgrClose.ok).toBe(true);
    expect(mgrClose.shift?.status).toBe('closed');
  });
});
