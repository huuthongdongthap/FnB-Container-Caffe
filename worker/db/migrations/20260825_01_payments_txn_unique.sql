-- Prevents duplicate payment rows for the same gateway order code.
-- Partial index: empty transaction_id rows (COD placeholders) stay allowed.
-- Applied remotely 2026-08-25 after verifying no duplicate transaction_id values exist.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_txn_unique
ON payments(transaction_id) WHERE transaction_id != '';
