-- Additive migration: durable PayOS payment reconciliation lease and retry ledger
-- All timestamp fields use millisecond UTC epoch strings for lexicographical comparison.

CREATE TABLE IF NOT EXISTS payment_reconciliation_jobs (
  payment_id TEXT PRIMARY KEY,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  lease_owner TEXT,
  last_checked_at TEXT,
  last_outcome TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_reconcile_due
  ON payment_reconciliation_jobs(next_attempt_at, lease_until);
