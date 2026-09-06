-- 20260826_01_users_tenant_binding.sql
-- Durable tenant binding for staff accounts.
-- Owners were already resolvable at login via saas_tenants.owner_user_id;
-- staff had no path to a tenant claim, so the JWT always omitted it and the
-- middleware fell back to 'default'. Backfills owners so both sources agree.

ALTER TABLE users ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

UPDATE users SET tenant_id = (
  SELECT t.id FROM saas_tenants t WHERE t.owner_user_id = users.id
)
WHERE tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM saas_tenants t WHERE t.owner_user_id = users.id);
