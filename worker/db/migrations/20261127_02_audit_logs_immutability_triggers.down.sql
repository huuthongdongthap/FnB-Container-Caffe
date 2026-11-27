-- Rollback append-only immutability triggers on audit_logs and saas_audit_logs.

DROP TRIGGER IF EXISTS trg_audit_logs_no_update;
DROP TRIGGER IF EXISTS trg_audit_logs_no_delete;
DROP TRIGGER IF EXISTS trg_saas_audit_logs_no_update;
DROP TRIGGER IF EXISTS trg_saas_audit_logs_no_delete;
