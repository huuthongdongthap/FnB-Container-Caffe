# Plan — Staff↔Tenant Binding + Orders Listing Consolidation

Date: 2026-08-26 | Source: plans/reports/from-brainstorm-to-handoff-staff-tenant-binding-and-orders-endpoint-consolidation-report.md
Mode: --auto | Status: **ready for /cook**

## Scope (from brainstorm contract)

| Field | Value |
|-------|-------|
| Outcome | Staff JWT carries tenantId (D1-backed); orders listing SQL built once |
| Constraints | No endpoint URL/response change; migration safe on legacy DB; ≤200 LOC/file |
| Non-goals | No tenant_id on business tables; no FE changes; no URL merge; no DO revival |
| Acceptance | Migration idempotent; staff login emits tenantId when bound; shared module <200 LOC; worker suite green; payloads byte-for-byte identical |

## Resolved Defaults

- Q1: API-only — register-staff accepts optional `tenant_id`, no admin UI this sprint
- Q2: roadmap flag only (`docs/04_ROADMAP.md` note) — business-table tenancy deferred until tenant #2 exists

## Key Facts (scout-verified)

1. `users` DDL lives in `worker/schema.sql:602` + `worker/db/migrations/20260824_04_users_recreate.sql` — **no tenant_id**
2. Auth users stored in KV `AUTH_KV user:{email}`; D1 `users` is a projection used by staff-tips join
3. TenantId today: `login.ts:46` queries `saas_tenants.owner_user_id` → **owners only**, staff always unbound
4. Staff write path: `tree/auth/register-staff.ts` (KV put, line 42); list via KV list in `list-staff.ts`
5. Middleware fallback `'default'`: `middleware/tenant.ts:25-33`
6. Duplication: `tree/orders/admin-orders.ts` (paginated+payments join) vs `orders-hono.ts:84 GET /kds` (fixed LIMIT 50 + items parse) — different contracts, shared SQL-builder opportunity
7. Existing tests to extend: `__tests__/middleware/tenant.test.ts` (4 cases), auth tests

## Phases

| Phase | File | Status |
|-------|------|--------|
| 01 — Migration: users.tenant_id + backfill + schema.sql sync | phase-01-migration-users-tenant-id.md | pending |
| 02 — Login reads D1 tenant_id first; register-staff persists it; tests | phase-02-login-staff-binding.md | pending |
| 03 — shared-listing.ts; admin-orders + kds delegate; payload parity tests | phase-03-shared-orders-listing.md | pending |

Dependencies: 01 → 02 → 03.

## Risks

- Migration on remote DB with empty users_legacy scenario → guard with IF NULL checks, follow 20260824_04 precedent
- Payload drift in Phase 3 → snapshot existing responses before refactor, assert equality in tests
