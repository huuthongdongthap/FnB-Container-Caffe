-- ============================================
-- ODOO INTEGRATION — PHASE 2 (POS / Sales Orders)
-- Database migration: product sync cache + sync failures for POS entities
-- Created: 2026-06-26
-- ============================================

-- Table 1: odoo_product_sync
-- Cache for product sync state and last-known Odoo values
CREATE TABLE IF NOT EXISTS odoo_product_sync (
  product_id TEXT PRIMARY KEY,
  odoo_product_id INTEGER NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  odoo_write_date TEXT,
  cached_stock INTEGER,
  cached_price REAL
);

-- Table 2: odoo_sync_failures
-- Tracks failed sync operations for POS entities (sale.order, product.product)
CREATE TABLE IF NOT EXISTS odoo_sync_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('sale.order', 'product.product')),
  local_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create', 'write')),
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  last_attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, local_id, operation)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_odoo_product_sync_odoo_id
  ON odoo_product_sync(odoo_product_id);
CREATE INDEX IF NOT EXISTS idx_odoo_sync_failures_entity
  ON odoo_sync_failures(entity_type, local_id);

-- ============================================
-- END MIGRATION
-- ============================================
