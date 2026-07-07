-- Orders Table Extensions — QR Table Ordering support
-- Adds columns for table association, guest checkout, and payment tracking.

-- table_id: INTEGER referencing cafe_tables(id), NULL for non-table orders
-- customer_id: TEXT referencing customers(id), NULL for guest orders
-- order_source: 'app' | 'qr_guest' | 'kds' | 'admin' — tracks origin
-- payment_url: stores MoMo/PayOS checkout URL for deferred payment flow
-- paid_at: timestamp when payment was confirmed
ALTER TABLE orders ADD COLUMN table_id INTEGER REFERENCES cafe_tables(id);
ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'app';
ALTER TABLE orders ADD COLUMN payment_url TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;

-- Indexes for common queries (no partial indexes — SQLite compat)
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders(order_source);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_url ON orders(payment_url);
