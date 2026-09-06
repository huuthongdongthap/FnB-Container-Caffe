# Cook Report — Remote D1 Partial Migration (users.tenant_id)

Date: 2026-08-26 | Plan: plans/260826-0449-staff-tenant-binding-orders-consolidation/

## Results

Applied to production D1 (AURA_DB --remote) per user approval "Apply 2 lệnh đầu":

1. ✅ `ALTER TABLE users ADD COLUMN tenant_id TEXT;`
2. ✅ `CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);`
3. ⏭️ SKIPPED UPDATE backfill — remote has no `saas_tenants` table (verified pre-flight); nothing to backfill

## Verification (post-apply)

- `PRAGMA table_info(users)`: `[id, name, role, phone, is_active, created_at, updated_at, tenant_id]` — column present
- Row count unchanged: 6 users, `COUNT(tenant_id)=0` (all NULL, expected)
- Index built (rows_written=7 consistent with index creation over 6 rows)
- schema.sql + local migration file already synced from Phase 01

## Notes

- Owner binding activates automatically when `saas_tenants` is created remotely — login.ts falls back to `saas_tenants.owner_user_id` lookup when `users.tenant_id` is NULL
- Legacy KV-only staff stay unbound until next staff edit; middleware 'default' fallback covers them
- Local DB still lacks saas_tenants → full migration file remains remote-only for the UPDATE statement

## Unresolved Questions

None.
