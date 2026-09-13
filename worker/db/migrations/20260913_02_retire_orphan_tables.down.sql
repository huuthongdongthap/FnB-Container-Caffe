-- Recreates orphan-table shells dropped by 20260913_02.
-- DDL recovered verbatim from live sqlite_master 2026-09-13 (pre-drop dump).
-- All tables were empty (0 rows) — no data restore needed.

CREATE TABLE "users_legacy" (
    id           TEXT PRIMARY KEY,
    phone        TEXT UNIQUE NOT NULL,
    full_name    TEXT,
    tier         TEXT DEFAULT 'Silver',
    total_points INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE checkin_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT NOT NULL,
    campaign_code   TEXT NOT NULL,        -- 'CHECKIN_WEEK_6_6' hoặc 'CHECKIN_DISCOUNT_THANG_6'
    reward_type     TEXT NOT NULL,        -- 'POINTS_20K' hoặc 'DISCOUNT_10PCT'
    reward_value    INTEGER NOT NULL,     -- 20000 hoặc 10 (%)
    post_platform   TEXT,                 -- 'FB', 'ZALO', 'IG', 'OTHER'
    post_url        TEXT,                 -- link/screenshot URL nếu có
    staff_id        TEXT NOT NULL,        -- người approve
    order_id        TEXT,                 -- nếu liên kết với 1 đơn cụ thể (DISCOUNT_10PCT)
    notes           TEXT,
    checkin_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE odoo_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  odoo_invoice_id INTEGER NOT NULL,
  invoice_number TEXT,
  pdf_path TEXT,
  vat_submission_status TEXT DEFAULT 'pending',
  vat_invoice_number TEXT,
  vat_signed_xml TEXT,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE odoo_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_type TEXT NOT NULL CHECK (local_type IN ('order', 'customer', 'product')),
  local_id TEXT NOT NULL,
  odoo_id INTEGER NOT NULL,
  odoo_model TEXT NOT NULL,
  sync_status TEXT DEFAULT 'synced',
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(local_type, local_id)
);

CREATE TABLE odoo_customer_consent (
  customer_id TEXT PRIMARY KEY,
  consent_sync BOOLEAN DEFAULT 0,
  consent_email BOOLEAN DEFAULT 0,
  consent_marketing BOOLEAN DEFAULT 0,
  consented_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE odoo_product_sync (
  product_id TEXT PRIMARY KEY,
  odoo_product_id INTEGER NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  odoo_write_date TEXT,
  cached_stock INTEGER,
  cached_price REAL
);

CREATE TABLE odoo_sync_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('sale.order', 'product.product')),
  local_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create', 'write')),
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  last_attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, local_id, operation)
);

CREATE TABLE odoo_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mapping_id INTEGER,
  attempt INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mapping_id) REFERENCES odoo_mappings(id)
);

CREATE TABLE "erpnext_invoices" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  erpnext_invoice_id INTEGER NOT NULL,
  invoice_number TEXT,
  pdf_path TEXT,
  vat_submission_status TEXT DEFAULT 'pending',
  vat_invoice_number TEXT,
  vat_signed_xml TEXT,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
