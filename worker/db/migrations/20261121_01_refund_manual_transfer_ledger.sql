-- Sổ ghi chuyển khoản hoàn tiền bền vững / Durable manual refund transfer ledger.
-- Never prune this ledger while the associated financial records are retained.
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
