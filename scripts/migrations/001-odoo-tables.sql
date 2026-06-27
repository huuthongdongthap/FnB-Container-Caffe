-- ============================================
-- ODOO INTEGRATION — DATABASE MIGRATION
-- Phase 1: Odoo Accounting (E-invoicing)
-- Created: 2026-06-26
-- ============================================

-- Table 1: odoo_mappings
-- Maps local entities to Odoo database IDs (idempotent sync)
CREATE TABLE IF NOT EXISTS odoo_mappings (
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

-- Table 2: odoo_invoices
-- Tracks e-invoices for compliance and VAT submission
CREATE TABLE IF NOT EXISTS odoo_invoices (
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

-- Table 3: odoo_sync_logs
-- Audit log for all Odoo API calls
CREATE TABLE IF NOT EXISTS odoo_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mapping_id INTEGER,
  attempt INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mapping_id) REFERENCES odoo_mappings(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_odoo_mappings_local ON odoo_mappings(local_type, local_id);
CREATE INDEX IF NOT EXISTS idx_odoo_mappings_status ON odoo_mappings(sync_status);
CREATE INDEX IF NOT EXISTS idx_odoo_invoices_order ON odoo_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_odoo_sync_logs_mapping ON odoo_sync_logs(mapping_id);

-- ============================================
-- END MIGRATION
-- ============================================
