-- Migration: Add signup extra fields to customers
-- Date: 2026-05-19
-- Applied once — ALTER TABLE safe (nullable columns, no default)

ALTER TABLE customers ADD COLUMN date_of_birth TEXT;
ALTER TABLE customers ADD COLUMN zalo TEXT;
ALTER TABLE customers ADD COLUMN source TEXT DEFAULT 'unknown';

SELECT '=== customers signup fields added ===' AS info;
SELECT name FROM pragma_table_info('customers') ORDER BY cid;
