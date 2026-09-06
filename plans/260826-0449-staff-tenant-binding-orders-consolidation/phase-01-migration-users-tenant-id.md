# Phase 01 — Migration: users.tenant_id + backfill

## Overview
- Priority: P1 | Status: pending
- Adds durable tenant binding column to D1 `users`; backfills owners from `saas_tenants`.

## Context Links
- Brainstorm: plans/reports/from-brainstorm-to-handoff-staff-tenant-binding-and-orders-endpoint-consolidation-report.md
- Precedent migration: worker/db/migrations/20260824_04_users_recreate.sql (users_legacy rename)
- Canonical schema: worker/schema.sql:602

## Implementation Steps

1. Create `worker/db/migrations/20260826_01_users_tenant_binding.sql`:
   ```sql
   ALTER TABLE users ADD COLUMN tenant_id TEXT;
   CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
   UPDATE users SET tenant_id = (
     SELECT t.id FROM saas_tenants t WHERE t.owner_user_id = users.id
   ) WHERE tenant_id IS NULL AND EXISTS (
     SELECT 1 FROM saas_tenants t WHERE t.owner_user_id = users.id
   );
   ```
   - No plan refs in comments; domain slug filename only.
   - Note: `ALTER TABLE ADD COLUMN` errors if column exists → document manual idempotency check or wrap per D1 constraints (D1 lacks IF NOT EXISTS for columns). Prefer: run once via wrangler d1 migrations; add README note in migrations dir if re-run risk.
2. Sync `worker/schema.sql:602` — add `tenant_id TEXT` to CREATE TABLE users + index line.
3. Verify migration applies on local dev DB (`wrangler d1 migrations apply AURA_DB --local`).

## Todo List
- [ ] Migration file created
- [ ] schema.sql synced
- [ ] Local apply verified

## Success Criteria
- Fresh DB + legacy-rename DB both end with users.tenant_id, owners backfilled
- Existing tests unaffected (no code change this phase)

## Risks
- Remote DB drift (empty users table) → SELECT count before apply; follow 20260824_04 notes
