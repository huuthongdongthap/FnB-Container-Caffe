-- 014_cod_guest_columns.sql
-- Add COD flag, guest fulfillment columns for solo OPC
-- Idempotent: recreate-table pattern for D1/SQLite (no DO $$ / PLpgSQL)

-- orders: recreate with new columns
CREATE TABLE IF NOT EXISTS orders_new (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  staff_id TEXT,
  table_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  items TEXT NOT NULL DEFAULT '[]',
  total_amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  is_cod INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'payos',
  cod_paid_at TEXT,
  fulfillment_type TEXT DEFAULT 'DINE_IN',
  delivery_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO orders_new
SELECT id, customer_id, staff_id, table_number, status, items, total_amount, note,
  COALESCE(is_cod, 0),
  COALESCE(payment_method, 'payos'),
  cod_paid_at,
  COALESCE(fulfillment_type, 'DINE_IN'),
  delivery_address,
  COALESCE(created_at, datetime('now')),
  COALESCE(updated_at, datetime('now'))
FROM orders;

DROP TABLE IF EXISTS orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE INDEX IF NOT EXISTS idx_orders_cod ON orders(is_cod);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment ON orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
