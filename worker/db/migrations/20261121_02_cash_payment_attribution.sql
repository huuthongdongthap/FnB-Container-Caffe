-- Quyền thu tiền theo ca / Immutable collecting-shift responsibility.
CREATE TABLE IF NOT EXISTS cash_payment_attributions (
  payment_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  collected_by TEXT NOT NULL,
  settled_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_tenant_shift_unique
  ON shift_reconciliations(tenant_id, shift_id);
