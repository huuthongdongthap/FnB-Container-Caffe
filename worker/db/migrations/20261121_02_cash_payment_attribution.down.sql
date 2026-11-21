-- Hoàn tác cấu trúc / Roll back attribution storage.
DROP INDEX IF EXISTS idx_reconciliation_tenant_shift_unique;
DROP TABLE IF EXISTS cash_payment_attributions;
