-- 20261009_03_integration_boundary_contract.sql
-- Integration Boundary Contract: Records sync status, reconciliation logs, and correlation IDs

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  external_id TEXT,
  sync_status TEXT NOT NULL,
  correlation_id TEXT,
  error_message TEXT,
  discrepancy TEXT,
  last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_provider_entity ON integration_sync_logs(provider, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_status ON integration_sync_logs(sync_status);
