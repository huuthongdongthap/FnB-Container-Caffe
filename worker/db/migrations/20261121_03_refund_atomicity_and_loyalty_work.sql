-- Idempotent forward completion for installations that already applied refund ledger migration 01.
-- Deliberately leaves all tenants disabled until operator attestation after whole-tenant reconciliation.
CREATE TABLE IF NOT EXISTS refund_tenant_readiness (
  tenant_id TEXT PRIMARY KEY,
  reconciled_at TEXT NOT NULL,
  reconciled_by TEXT NOT NULL,
  evidence TEXT NOT NULL CHECK (length(trim(evidence)) > 0)
);
CREATE TABLE IF NOT EXISTS refund_loyalty_work (
  tenant_id TEXT NOT NULL,
  reversal_key TEXT NOT NULL,
  payment_id TEXT,
  order_id TEXT NOT NULL,
  customer_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  points_reversed INTEGER NOT NULL DEFAULT 0,
  cashback_reversed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (tenant_id, reversal_key)
);
CREATE INDEX IF NOT EXISTS idx_refund_loyalty_order
  ON refund_loyalty_work(tenant_id, order_id, status);
-- CHECK constraints let D1 abort the financial batch when a required CAS updates zero rows.
CREATE TABLE IF NOT EXISTS refund_mutation_guards (
  settlement_ok INTEGER NOT NULL DEFAULT 1 CONSTRAINT refund_settlement_conflict CHECK (settlement_ok = 1),
  reversal_ok INTEGER NOT NULL DEFAULT 1 CONSTRAINT refund_reversal_contention CHECK (reversal_ok = 1)
);
CREATE TABLE IF NOT EXISTS payment_refund_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  manual_transfer_ref TEXT NOT NULL CHECK (length(trim(manual_transfer_ref)) BETWEEN 1 AND 200),
  payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, manual_transfer_ref)
);
CREATE INDEX IF NOT EXISTS idx_refund_transfers_payment ON payment_refund_transfers(payment_id);

-- After reconciliation is formally approved, an operator may attest explicitly, e.g.:
-- INSERT INTO refund_tenant_readiness (tenant_id, reconciled_at, reconciled_by, evidence)
-- VALUES ('<tenant>', datetime('now'), '<operator-id>', '<immutable evidence reference>');
-- Never seed readiness from application startup, migration, audit logs, or fixture logic.