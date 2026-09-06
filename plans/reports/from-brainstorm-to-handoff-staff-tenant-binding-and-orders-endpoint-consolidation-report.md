# Brainstorm Handoff — Staff↔Tenant Binding + Orders Endpoint Consolidation

Date: 2026-08-26 | Mode: --auto | Status: contract ready → `/mk:plan`

## Context (from previous session)

Phase A–D shipped: tenant isolation (JWT-only tenant resolution), cookie session, KDS SSE, 1537+3105 tests PASS. Open proposals: (1) staff↔tenant binding schema migration, (2) consolidate `/api/admin/orders` vs `/kds`.

## Brainstorm Contract

| Field | Value |
|-------|-------|
| **Outcome** | Staff accounts carry a durable tenantId (D1 + JWT); orders listing logic exists once, both endpoints reuse it |
| **Constraints** | No breaking change to either endpoint URL/response shape (FE stores untouched); migration must apply on existing remote DB (users_legacy rename precedent); files ≤200 LOC; conventional commits |
| **Non-goals** | NO tenant_id on business tables (orders/products/categories); NO true multi-tenant rollout; NO endpoint URL merge; NO DO/WebSocket revival; NO FE changes |
| **Acceptance Criteria** | ① Migration applies clean on fresh + legacy DB ② staff login JWT contains tenantId (fallback path tested: staff w/o binding → omitted → middleware 'default') ③ shared listing module <200 LOC used by both handlers ④ worker suite green ⑤ FE admin/KDS stores consume unchanged payloads |

## Evidence (scouted, verified)

### Task 1 — staff↔tenant binding

- `worker/db/migrations/20260824_04_users_recreate.sql:13-21` — `users` D1 table has **no tenant_id** (id, name, role, phone, is_active, timestamps only)
- Auth users live in **KV** (`AUTH_KV user:{email}`), not D1 — `worker/src/tree/auth/login.ts:17`
- TenantId resolved ONLY via `saas_tenants.owner_user_id` (`login.ts:46-55`) → owners only; **staff always undefined**
- Middleware fallback `'default'` — `worker/src/middleware/tenant.ts:25-33`
- Deployment is single-tenant today (one D1 `fnb-caffe-db`, one AUTH_KV — `worker/wrangler.toml`) despite SaaS scaffolding (saas_tenants, subscriptions, MRR)
- **No tenant_id column exists on ANY business table** (schema.sql grep: zero hits)

⚠️ Key insight: binding alone gives identity, not isolation — there is nothing to filter against yet. That's fine: it closes the audit gap (JWT tenant claim correctness) and pre-wires the column for future tenancy. Isolation enforcement is a separate, larger decision (see Approaches).

### Task 2 — orders endpoint duplication

| | `/api/admin/orders` | `/api/kds/orders/kds` |
|---|---|---|
| Mount | `index.ts:207` (guard `/api/admin/*` owner+staff) | `orders-hono.ts:84` (guard `index.ts:192`) |
| Query | paginated, sort whitelist, COUNT query, LEFT JOIN payments | `status IN (?,'preparing') LIMIT 50` fixed |
| Shape | payment fields flattened | items JSON-parsed + `elapsed_minutes` |
| FE consumer | `use-admin.ts`, `use-admin-orders-store.ts` | `use-kds.ts`, `mobile/kitchen-display.tsx` |
| Tenant filter | none | none |

- Verdict: **do NOT merge** — response contracts differ materially; merging bloats both payloads or breaks FE
- Real debt: 7 orders route files (`kds-mobile, kds-stream, order-stream, orders-hono, orders-mobile, orders.ts, realtime-orders`) — shared SQL-building logic belongs in one module
- Coupling: if tenant_id-on-orders ever lands, the WHERE clause should be written **once** in the shared module → sequence Task 1 before any future tenancy work

## Approaches Considered

| | A. Minimal plumbing ✅ | B. True multi-tenant | C. Defer both |
|---|---|---|---|
| Scope | users.tenant_id + login reads it + shared listing module | tenant_id on all business tables + every query + backfill | docs only |
| Regression risk | low (additive) | high (1537 tests touch queries) | zero |
| Closes audit gap | yes | yes | papered over |
| YAGNI verdict | fits | premature — no tenant #2 exists | acceptable but weak |

## Recommended Direction — Approach A

**Phase 1 — staff↔tenant binding**
1. Migration `20260826_01_users_tenant_binding.sql`: `ALTER TABLE users ADD COLUMN tenant_id TEXT`; `CREATE INDEX idx_users_tenant`; backfill `UPDATE users SET tenant_id = (SELECT id FROM saas_tenants WHERE owner_user_id = users.id)`; guard for empty users table (legacy-rename precedent)
2. `login.ts`: after KV auth, read `tenant_id` from D1 users row first, fall back to existing `saas_tenants` owner lookup
3. Staff-create/update paths (admin) accept + persist tenant_id
4. Tests: staff-without-tenant → JWT omits claim → middleware 'default'; staff-with-tenant → claim present; migration idempotency

**Phase 2 — orders listing consolidation**
1. New `worker/src/tree/orders/shared-listing.ts`: query builder (filters/sort/pagination) + tenant-ready param slot (unused now)
2. `admin-orders.ts` + `orders-hono.ts GET /kds` both delegate; response shapes preserved byte-for-byte
3. Tests: existing suites prove no payload drift

## Unresolved Questions

1. Should staff assignment UI (owner picks tenant when creating staff) ship in Phase 1, or API-only first?
2. When tenant #2 actually onboards, business-table tenancy becomes unavoidable — flag for roadmap now or later?

## Handoff

→ `/mk:plan plans/reports/from-brainstorm-to-handoff-staff-tenant-binding-and-orders-endpoint-consolidation-report.md` (contract above = scope fence)
