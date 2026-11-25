import type { D1Database } from '@cloudflare/workers-types';

export interface CashCollectingShift {
  id: string;
  clock_in: string;
}

/** Absence of attendance is supported; unreadable existing attendance is not a safe cutoff. */
export async function resolveCashCollectingShift(db: D1Database, staffId: string, tenant: string): Promise<{ shift: CashCollectingShift | null; hasShifts: boolean }> {
  if (!staffId) return { shift: null, hasShifts: false };
  try {
    const shift = await db.prepare(`SELECT CAST(id AS TEXT) AS id, clock_in FROM staff_shifts
      WHERE staff_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
      AND clock_in IS NOT NULL AND clock_out IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM shift_reconciliations sr
        WHERE sr.shift_id = CAST(staff_shifts.id AS TEXT)
          AND COALESCE(NULLIF(TRIM(sr.tenant_id), ''), 'default') = ?
      )
      ORDER BY clock_in DESC, id DESC LIMIT 1`)
      .bind(staffId, tenant, tenant).first<CashCollectingShift>();
    return { shift, hasShifts: true };
  } catch (error) {
    if (/no such table:.*\bstaff_shifts\b/i.test(String(error))) return { shift: null, hasShifts: false };
    throw error;
  }
}

/** SQLite zero-row writes do not abort a D1 batch; integer overflow does, on every schema. */
export function assertCashSettlementWrite(db: D1Database) {
  return db.prepare('SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS cash_settlement_guard');
}

/** Freeze only a still-current snapshot; rollback the inserted cutoff on any ledger drift. */
export function assertReconciliationSnapshot(db: D1Database, shiftId: string, tenant: string, clockIn: string, cash: number, payouts: number) {
  return db.prepare(`SELECT CASE WHEN
    EXISTS (SELECT 1 FROM staff_shifts WHERE CAST(id AS TEXT) = ?
      AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND clock_in = ?)
    AND (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
      LEFT JOIN cash_payment_attributions a ON a.payment_id = p.id
        AND a.tenant_id = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
      WHERE p.method IN ('cash', 'cod') AND p.status = 'completed'
        AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?
        AND (a.shift_id = ? OR (a.shift_id IS NULL
          AND julianday(COALESCE(p.updated_at, p.created_at)) >= julianday(?)
          AND julianday(COALESCE(p.updated_at, p.created_at)) <= julianday(COALESCE(
            (SELECT clock_out FROM staff_shifts WHERE CAST(id AS TEXT) = ?), '9999-12-31'))))) = ?
    AND (SELECT COALESCE(SUM(amount), 0) FROM cash_payouts WHERE shift_id = ?
      AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) = ?
    THEN 1 ELSE abs(-9223372036854775808) END AS reconciliation_snapshot_guard`)
    .bind(shiftId, tenant, clockIn, tenant, shiftId, clockIn, shiftId, cash, shiftId, tenant, payouts);
}
