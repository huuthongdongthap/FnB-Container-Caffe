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

export async function isCashReconciliationActiveForTenant(
  env: Record<string, unknown> | undefined,
  db: D1Database,
  tenantId: string,
): Promise<boolean> {
  const flag = String(env?.CASH_RECONCILIATION_ENABLED ?? '').trim().toLowerCase();
  if (flag !== 'true' && flag !== '1') return false;
  const cleanTenant = (tenantId || '').trim() || 'default';
  const disabledTenants = String(env?.CASH_RECONCILIATION_DISABLED_TENANTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (disabledTenants.includes(cleanTenant)) return false;
  try {
    const res = await db
      .prepare(
        `SELECT value FROM settings
         WHERE key = 'cash_reconciliation_enabled'
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') IN (?, 'default')
         ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .bind(cleanTenant, cleanTenant)
      .all<{ value: string }>();
    const resolved = res.results?.[0]?.value;
    if (resolved !== undefined && ['false', '0'].includes(String(resolved).trim().toLowerCase())) {
      return false;
    }
  } catch {
    // settings table absent -> fall back to env flag
  }
  return true;
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
        AND NOT EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = p.order_id
            AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
            AND (LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'failed', 'expired', 'rejected')
              OR LOWER(COALESCE(o.payment_status, '')) = 'refunded')
        )
        AND (a.shift_id = ? OR (a.shift_id IS NULL
          AND julianday(COALESCE(p.updated_at, p.created_at)) >= julianday(?)
          AND julianday(COALESCE(p.updated_at, p.created_at)) <= julianday(COALESCE(
            (SELECT clock_out FROM staff_shifts WHERE CAST(id AS TEXT) = ?), '9999-12-31'))
          AND (SELECT COUNT(*) FROM staff_shifts s
            WHERE COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?
              AND s.clock_in IS NOT NULL
              AND LOWER(COALESCE(s.attendance_state, 'active')) <> 'cancelled'
              AND LOWER(COALESCE(s.role, '')) NOT IN ('barista', 'kitchen', 'chef', 'bep')
              AND julianday(COALESCE(p.updated_at, p.created_at)) >= julianday(s.clock_in)
              AND julianday(COALESCE(p.updated_at, p.created_at)) <= julianday(COALESCE(s.clock_out, '9999-12-31'))) = 1))) = ?
    AND (SELECT COALESCE(SUM(amount), 0) FROM cash_payouts WHERE shift_id = ?
      AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) = ?
    THEN 1 ELSE abs(-9223372036854775808) END AS reconciliation_snapshot_guard`)
    .bind(shiftId, tenant, clockIn, tenant, shiftId, clockIn, shiftId, tenant, cash, shiftId, tenant, payouts);
}
