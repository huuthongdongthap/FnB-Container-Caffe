-- Rollback multi-tenant newsletter and promotional leads capture
DROP INDEX IF EXISTS idx_leads_tenant_created_at;
DROP TABLE IF EXISTS leads;
