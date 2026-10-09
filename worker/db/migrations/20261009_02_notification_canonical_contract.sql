-- 20261009_02_notification_canonical_contract.sql
-- Notification Contract: Adds idempotency, event correlation, and provider tracking

ALTER TABLE notification_audit_log ADD COLUMN event_id TEXT;
ALTER TABLE notification_audit_log ADD COLUMN idempotency_key TEXT;
ALTER TABLE notification_audit_log ADD COLUMN correlation_id TEXT;
ALTER TABLE notification_audit_log ADD COLUMN provider TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_audit_idempotency ON notification_audit_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notification_audit_correlation ON notification_audit_log(correlation_id);
