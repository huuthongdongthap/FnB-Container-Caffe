-- Financial transfer identities and pending loyalty work must survive code rollback.
-- Intentionally non-destructive. Use a forward migration for schema corrections.
-- Data restoration requires a separately authorized, reconciled recovery procedure.
SELECT 1;
