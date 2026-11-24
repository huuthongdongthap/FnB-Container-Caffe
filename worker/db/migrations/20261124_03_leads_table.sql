-- Multi-tenant newsletter and promotional leads capture
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'promotions_newsletter',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created_at
  ON leads(tenant_id, created_at DESC);
