-- Enforce append-only immutability on audit_logs and saas_audit_logs (SOC2 CC7.2 / ISO 27001 A.8.15).
-- Prevents UPDATE or DELETE tampering at the database engine layer.
-- Drop legacy AFTER INSERT sync trigger first: its UPDATE on audit_logs would otherwise abort every INSERT.

DROP TRIGGER IF EXISTS trg_audit_logs_sync;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only and cannot be updated');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only and cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_saas_audit_logs_no_update
BEFORE UPDATE ON saas_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'saas_audit_logs is append-only and cannot be updated');
END;

CREATE TRIGGER IF NOT EXISTS trg_saas_audit_logs_no_delete
BEFORE DELETE ON saas_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'saas_audit_logs is append-only and cannot be deleted');
END;
