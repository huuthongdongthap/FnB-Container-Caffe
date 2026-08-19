-- 014_cod_guest_columns.sql
-- Add COD flag, guest fulfillment, and customer_id to orders table
-- Uses ALTER TABLE ADD COLUMN (idempotent for D1/SQLite)

-- Add customer_id column (links orders to customers table)
ALTER TABLE orders ADD COLUMN customer_id TEXT;

-- Add staff_id column (for staff-created orders)
ALTER TABLE orders ADD COLUMN staff_id TEXT;

-- Add table_number column (human-readable table label)
ALTER TABLE orders ADD COLUMN table_number TEXT;

-- Add is_cod flag (1 = cash on delivery)
ALTER TABLE orders ADD COLUMN is_cod INTEGER DEFAULT 0;

-- Add cod_paid_at timestamp
ALTER TABLE orders ADD COLUMN cod_paid_at TEXT;

-- Add fulfillment_type (DINE_IN, TAKEAWAY, DELIVERY)
ALTER TABLE orders ADD COLUMN fulfillment_type TEXT DEFAULT 'DINE_IN';

-- Add delivery_address column
ALTER TABLE orders ADD COLUMN delivery_address TEXT;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_cod ON orders(is_cod);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment ON orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
