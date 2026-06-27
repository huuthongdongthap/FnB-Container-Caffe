-- Odoo CRM Sync tables (Phase 3)
-- Customer lead mapping and consent tracking

CREATE TABLE IF NOT EXISTS odoo_customer_consent (
  customer_id TEXT PRIMARY KEY,
  consent_sync BOOLEAN DEFAULT 0,
  consent_email BOOLEAN DEFAULT 0,
  consent_marketing BOOLEAN DEFAULT 0,
  consented_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for consent lookups
CREATE INDEX IF NOT EXISTS idx_odoo_customer_consent_sync ON odoo_customer_consent(consent_sync);
