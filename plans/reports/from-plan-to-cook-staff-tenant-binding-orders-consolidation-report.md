# Cook Report — Staff↔Tenant Binding + Orders Listing Consolidation

Date: 2026-08-26 | Plan: plans/260826-0449-staff-tenant-binding-orders-consolidation/

## Results

### Phase 01 — Migration ✅
- `worker/db/migrations/20260826_01_users_tenant_binding.sql`: ALTER users ADD tenant_id + idx_users_tenant + owner backfill from saas_tenants
- `worker/schema.sql`: users DDL synced (tenant_id column + index)
- Local apply: project uses `d1 execute --file`, NOT `migrations apply` (stale `worker/migrations/` dir conflicts). Local DB lacks saas_tenants → migration targets remote only; guarded by IF EXISTS semantics in UPDATE

### Phase 02 — Login binding ✅
- `tree/auth/login.ts`: dual-source lookup — `users.tenant_id` (D1) first, saas_tenants.owner fallback; non-fatal try/catch preserved
- `tree/auth/register-staff.ts`: optional `tenant_id` body param (zod max 64) → KV user object + best-effort D1 mirror INSERT OR IGNORE
- 4 new tests in login.test.ts (binding present/absent, owner fallback, D1 failure non-fatal) — all PASS
- Bug found in test harness: prior describe leaked `jwtCreds.generateError=true` into new block — fixed via full state reset in new beforeEach

### Phase 03 — Shared listing ✅
- NEW `tree/orders/shared-listing.ts` (~70 LOC): buildOrderFilterClause + buildOrderTail
- `admin-orders.ts`: filters + tail + count query delegate to shared module (count strips alias)
- `orders-hono.ts GET /kds`: ORDER/LIMIT clause via buildOrderTail (IN-clause kept local — equality builder doesn't model IN)
- NEW `shared-listing.test.ts` (8 cases): defaults, explicit sort, invalid-sort fallback, clamping
- Contract preserved: invalid sort → created_at fallback (NOT throw), matching existing endpoint behavior verified by test

### Fixes during cook
1. shared-listing initially threw on filter columns (`o.payment_status`) — filters are server-side constants, validation removed; sort whitelist retained (user input path)
2. Invalid sort throw broke documented fallback behavior → changed to silent created_at fallback per existing test contract
3. schema.sql edit accidentally truncated users table tail → restored (created_at/updated_at/indexes)

## Validation
- Worker: **1547/1547 PASS** (151 files) — baseline was 1537, +10 new tests
- tsc worker + FE: clean
- FE KDS consumer tests: 16/16 PASS (no FE changes needed)

## Unresolved Questions
1. Remote migration apply needs manual run: `wrangler d1 execute AURA_DB --remote --file=db/migrations/20260826_01_users_tenant_binding.sql` (local DB missing saas_tenants so backfill untested locally — SQL reviewed, logic mirrors register flow)
2. Legacy staff (KV-only, pre-migration) remain unbound until next staff edit — middleware 'default' fallback covers them
