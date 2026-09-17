---
date: 2026-09-11
version: 1.0
status: proposed (not yet approved)
source: AURA_FnB_OS_Rebuild_Master_Spec.md §25–§27, CURRENT_STATE.md, DOMAIN_MAP.md, APP_MAP.md
---
# REPO MIGRATION — Sequence & Rules

## 0. Binding rules (spec §26–27)

- `DISCOVER → CLASSIFY → SPECIFY → MIGRATE → TEST → EVAL → VERIFY → CLEAN`
- NEVER `DELETE → REWRITE → HOPE`
- For every migrated capability maintain: OLD → TARGET → STATUS → BEHAVIOR PRESERVED → TEST → ROLLBACK
- DONE = SPEC + implementation + tests pass + acceptance passes + no critical regression + i18n complete + security checked + observability adequate + state updated + obsolete removed/archived (spec §27)

## 1. Migration matrix (artifact classification)

| Artifact | Class | Target |
|---|---|---|
| worker/src/tree/ (18 domains) | **KEEP+MOVE** | packages/domain/* (contracts extracted) |
| worker/src/schemas/ (zod) | **KEEP+MOVE** | packages/domain/*/schemas |
| worker/src/routes/ (91 files) | **MOVE+THIN** | packages/api — logic pushed down to domain/application |
| worker/src/lib/ + clients/ | **MOVE** | packages/integrations (port per provider) |
| worker/src/middleware/ + jwt.ts | **KEEP+MOVE** | packages/auth |
| worker/schema.sql + migrations | **KEEP** (data!) | packages/db — duplicate tables merged via explicit migration + rollback |
| src/components/ui + md3 + tokens | **MERGE+MOVE** | packages/ui (one token source) |
| src/locales (vi/en, 1833 keys) | **KEEP+CONSOLIDATE** | packages/i18n — dedupe terms via glossary |
| customer pages/routes | **MOVE** | apps/space |
| admin pages (29 routes) | **SPLIT** | apps/hq (analytics) + apps/ops (POS/orders/tables/staff) |
| kds + mobile + dindin | **MOVE** | apps/ops |
| src/pages/stitch/ (41 variants) | **MERGE→ARCHIVE** | best variant → apps/space; rest archived post-verify |
| docs/06_ADR (10 ADRs) | **KEEP** | docs/decisions (renumber into series) |
| docs/ runbooks (deploy/D1 backup/incident) | **KEEP+MOVE** | docs/operations |
| docs/03_ARCHITECTURE (stale 2025-06) | **ARCHIVE** | superseded by CURRENT_STATE.md |
| ~35 misc root docs (guides, proposals, handbooks) | **CLASSIFY** | per-file: product/operations/archive |
| tests (4800) | **KEEP** | tests/{unit,integration} — update imports during move |
| 40+ scripts (root) | **CLASSIFY** | scripts/ — keep deploy/CI, archive one-off fixups |

## 2. Phase sequence (spec §25)

### Phase 0 — Discovery (this artifact set) ✅ IN PROGRESS
Deliverables: CURRENT_STATE ✓ · TARGET_STATE ✓ · DOMAIN_MAP ✓ · APP_MAP ✓ · REPO_MIGRATION ✓ · FEATURE_MATRIX ✓ · CUSTOMER_JOURNEY ✓ · .ai/context/{product,architecture,glossary} ✓

### Phase 1 — Product Truth (no code)
Personas (customer, waiter, kitchen staff, manager, owner, SaaS tenant) · customer/staff/owner journeys · feature hierarchy · terminology glossary ratified · IA per surface

### Phase 2 — Foundation (smallest safe scaffolding)
1. Monorepo scaffold: apps/{space,ops,hq} + packages/* (workspaces, shared vite/vitest config) — old tree keeps running untouched
2. packages/ui: token consolidation (MD3 + brand) — one source
3. packages/i18n: glossary-driven key consolidation (kill duplicate terms)
4. packages/auth: extract from worker middleware (behavior-identical, tests port)
5. packages/db: duplicate-table merge migrations (payments, subscription_invoices) with rollback + data verify
6. packages/api: route-handler thinning pattern applied to ONE exemplar domain (Catalog)

### Phase 3 — Core F&B Loop (migrate with tests)
Catalog → Menu → Order → Payment → Kitchen → Customer. Each: OLD→TARGET row in `.ai/state/migrations.md`, acceptance scenarios per spec §19 (order creation, payment success/failure, webhook replay, kitchen transition, role authorization).

### Phase 4 — Operations
POS · KDS (absorb 3 duplicates) · Tables · Staff · Inventory · Reservation (conflict tests)

### Phase 5 — Growth
CRM · Loyalty (4-tier ladder preserved) · Membership · Promotion · Campaign · Analytics · SaaS decision (tenants exist in schema; product call needed)

### Phase 6 — AI copilots (only after contracts stable)

## 3. Rollback & safety

- Deploy-level: existing runbooks (`docs/runbook-deploy-rollback.md`, Cloudflare Pages/Workers version rollback — verified working 2026-09-11)
- DB-level: every merge migration ships with a down-script + D1 point-in-time restore runbook (`docs/runbook-d1-backup-restore.md`)
- Code-level: old surfaces remain deployed until replacement passes acceptance; stitch archives are git-reversible

## 4. First implementation milestone (post-approval)

**M1 — Catalog exemplar slice (Phase 2, smallest safe change):**
- packages/domain/catalog (model, schemas from worker/src/schemas/products+categories, queries, policies: pricing/availability)
- packages/api catalog handlers thinned to VALIDATE→AUTH→USE CASE→MAP
- apps/space Menu page consuming the new contract behind existing UI
- Acceptance: menu renders from new path, product availability enforced server-side, prices computed server-side, all 4800 tests still green, FE/BE deployable
- Rollback: revert route wiring to tree/ path (old code untouched during M1)

## 5. Risks

| Risk | Mitigation |
|---|---|
| 85-route SPA split breaks deep links (auraspace.cafe live) | Route map preserved verbatim in APP_MAP; old bundle stays until new surface passes acceptance |
| D1 data loss in table merges | Down-migrations + backup-restore runbook + verify counts before cutover |
| i18n key dedupe breaks live copy | Key-by-key mapping table; vi canonical; smoke-test rendered pages |
| 41 stitch variants hide business rules | Grep-audit each before archiving; only demo/landing logic expected |
| Test suite churn during moves | Move-then-fix in same commit; never delete failing tests (spec §29) |
| Worker bundle size (2.2MB today) grows with monorepo | Split workers per surface if needed in Phase 4; keep single worker until measured |
