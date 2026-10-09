-- Migration: Canonical Audit Trail & Operational Event Contract
-- Extends audit_logs with operational scope, tenant binding, and correlation tracking.

ALTER TABLE audit_logs ADD COLUMN operating_unit_id TEXT;
ALTER TABLE audit_logs ADD COLUMN tenant_id TEXT;
ALTER TABLE audit_logs ADD COLUMN status TEXT DEFAULT 'success';
ALTER TABLE audit_logs ADD COLUMN correlation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_operating_unit ON audit_logs(operating_unit_id, created_at);
