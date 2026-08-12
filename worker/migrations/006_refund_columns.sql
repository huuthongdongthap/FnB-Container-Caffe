-- 006_refund_columns.sql
-- Add refund tracking columns to payments table
-- Idempotent: recreate-table pattern for D1/SQLite (no DO $$ / PLpgSQL)

CREATE TABLE IF NOT EXISTS payments_new (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  payment_url TEXT,
  refund_status TEXT DEFAULT NULL,
  refund_amount INTEGER DEFAULT 0,
  refund_reason TEXT,
  refunded_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO payments_new
SELECT id, order_id, method, amount, status, transaction_id, payment_url,
  COALESCE(refund_status, NULL),
  COALESCE(refund_amount, 0),
  refund_reason,
  refunded_at,
  COALESCE(created_at, CURRENT_TIMESTAMP),
  COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM payments;

DROP TABLE IF EXISTS payments;
ALTER TABLE payments_new RENAME TO payments;

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
