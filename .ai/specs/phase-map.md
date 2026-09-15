---
date: 2026-09-12
version: 2.0
status: approved (10 defaults 2026-09-12 + v4 reconciliation 2026-09-12)
source: AURA_OS_Master_Rearchitecture_Plan_v4.md §20 (authority) + v2 §13 + spec §25 + REPO_MIGRATION.md
v4-reconciliation: plans/2026-09-12-aura-master-v4-reconciliation/plan.md (approved 2026-09-12)
---
# PHASE MAP — one taxonomy: M0–M8 (v4 language; supersedes Phase 0–6 and v2 M-map where resequenced)

## 0. Why one taxonomy

Three specs used different numbering (repo-root Phase 0–6 vs v2 M0–M8
vs v4 M0–M8 resequenced). Per v4-reconciliation ruling: **v4's M-phases
are canonical** (newest strategy); repo-root build phases nest inside
them; v2 retained where v4 is silent. Everything below is the single
reference for all future plans, commits scope, and acceptance gates.

## 1. Master table

| Phase | Name (v4) | Nest (repo-root / v2) | Scope | Acceptance | Status |
|---|---|---|---|---|---|
| **M0** | Discover | Phase 0 | repo audit (done) + Viva Star truth-source map (done) + **v4 reconciliation** (done 2026-09-12) | CURRENT_OPERATION + LEGACY_MAP + GAP_ANALYSIS + PROCESS_MAP + 3-spec authority written | ✅ DONE 2026-09-12 |
| **M1** | **Customer + Data Foundation** | Phase 2 Foundation | monorepo scaffold (apps/{space,ops,hq} + packages/domain/*), packages/ui+i18n+auth+db, D1 merges, **Customer/Identity/Consent/Events/Visit/CRM profile/lookup domain (zero-based DB policy)** | "AURA can start building a clean customer database from the first day of deployment" + live checkout never breaks | ⏳ next |
| **M2** | AURA Mini ERP Core | Phase 3 Core Loop | Catalog consolidation exemplar (D10, moved from M1), domain contracts for Catalog→Menu→Order→Payment→Kitchen→Table→Staff→Shift | "AURA can control the critical operational workflow without requiring historical Viva Star data"; order completes on new domain contract | ✅ DONE 2026-09-14 |

- **M2 — Catalog exemplar (D10) — done 2026-09-14**: `packages/domain/catalog/` extracted (products, menu, categories, menu-modifiers + schemas; pricing/availability policies split to `policies/`), all shims deleted, 9 callers migrated, suite green (360 files / 3274 tests, tsc delta within M1 band).
- **M2 — Order/Payment/Kitchen — done 2026-09-13**: `packages/domain/{order,payment,kitchen}/` extracted, all callers migrated to `@aura/domain-*`, shims deleted (fcce027).
- **M2 — Tables — done 2026-09-14**: `packages/domain/table/` extracted (tablesRouter + qrRouter + CafeTable/QrCodeRow model + status policy; v1 permissive transitions preserved as data), 7 callers migrated, shim deleted same session, suite green (360 files / 3274 tests, tsc delta within M1 band).
- **M2 — Staff & Shift exemplar — done 2026-09-14**: `packages/domain/{staff,shift}/` extracted (staff auth, Web Crypto PBKDF2 PIN, bilingual RBAC policy engine, tips, devices, shifts router + model), 5 callers migrated, 4 legacy files deleted without shims, suite green (358 files / 3270 tests, tsc delta within M1/M2 band). M2 core ERP loop extraction complete across Catalog→Menu→Order→Payment→Kitchen→Table→Staff→Shift.
- **M3 — Phase 05+06 (KDS dedupe + reconciliation + verify) — done 2026-09-15**: `station-policy.ts` pure module added to `packages/domain/kitchen/` (14 unit tests, zero Hono imports). `GET /:id/tickets` KDS route rewritten with `filterItemsForStation` — each item appears in exactly one station view. `GET /api/reconciliation` daily reconciliation endpoint added. Full suite green: 362 files / 3297 tests. tsc delta +16 (1317→1333), 0 new error classes. **M3 milestone complete.**
| **M3** | **AURA CAFE Independent Operation** | Phase 4 Operations | inventory (Tasks 14–18), multi-supplier purchasing/PO/suppliers, recipe auto-deduct, shift cash reconciliation, POS, KDS dedupe (canonical /kds), reservation policy→domain, **owner dashboard v1** (v2 §15 TODAY panel) | "AURA CAFE can open→sell→produce→serve→reconcile→close using AURA" — first production milestone; Excel revenue MIRROR→SWITCH→RETIRE; Viva Star software optional | ✅ DONE 2026-09-15 (362 files / 3297 tests, tsc +16 legacy band) |
| **M4** | AURA Online | Phase 5 | Digital Menu / Online Order / Pickup / Delivery / Customer Account / CRM **sharing the same catalog, pricing, order domain as the store** (v4 §15 channel law) | online order end-to-end on same core, no channel-specific business logic | ⏳ |
| **M5** | CRM / Growth | Phase 5 | CRM depth (v2 §6 ladder: visits/orders/preferences/frequency/value views), loyalty extensions, membership, referral, campaigns, segments, retention, feedback | CRM answers the 6 questions (who are our customers? who visited? what did they buy? how often? what do they prefer? who to invite back?); growth loop operates | ⏳ |
| **M6** | AURA Cart | Phase 5 (light) | AURA CART profile = location/unit config on same domain (v4 §16–17): fast order/pay, small inventory, offline tolerance, simple shift, easy settlement | cart operates as a location profile, not a separate app | ⏳ |
| **M7** | AURA CAFE Kit | Phase 5 (light) | reproducible package: brand/menu/catalog/recipes/pricing/supplier/inventory/POS/KDS/CRM/staff roles/SOP corpus (7 SOPs exist on paper)/reporting/training | a new café could launch using the AURA standard | ⏳ |
| **M8** | AURA OS | Phase 6 | multi-location/multi-brand/tenant/channel/integration/AI copilots | external cafés can adopt AURA OS as platform; SaaS economics begin | ⏳ deferred by D4/D5 |

## 2. Milestone sequence inside M1 (first build work — v4 pivot)

1. `apps/{space,ops,hq}` + `packages/` scaffold in-monorepo (D6: this repo)
2. `packages/domain/customer` — Customer, Identity, Consent context
   **first** (v4 M1; zero-based DB on existing `customers` table +
   `customer_phone` order key; new tables: customer_identities,
   consents, customer_events, visits) — **done 2026-09-13**
   (worker/src/tree/customer + migration 20260913_01)
3. `packages/domain/crm` — Customer Events, Visit, CRM profile, lookup
4. `packages/i18n` — glossary-ratified key consolidation (D9) —
   **done 2026-09-13** (batch 2: vi referral labels + errorDescription;
   glossary ratified; drift test in CI)
5. `packages/db` — D1 duplicate-table merges with down-migrations
   (D7: payments, subscription_invoices) — **closed 2026-09-13 as
   RESOLVED-NOT-NEEDED** (live-D1 verification: recreate+rename
   migrations already unified; no `_new` tables exist; subscription
   family never provisioned). Actual D1 hygiene done instead:
   9 verified orphan tables retired (migration 20260913_02,
   users_legacy/checkin_log/odoo_*/erpnext_invoices — 0 rows,
   zero code consumers, DDL preserved in down-migration)
6. Catalog context (consolidates `products`+`menu_items`) opens the
   M2 exemplar work (D10) — starts at the end of M1 if customer
   foundation is green

## 3. Gate rules (binding)

- No phase starts before predecessor acceptance is green (per
  REPO_MIGRATION binding rules).
- Each batch inside a phase follows the merged execution loop
  (spec-reconciliation §4): SPECIFY→IMPLEMENT→TEST→VERIFY→MIRROR→
  PARALLEL→SWITCH→STABILIZE→RETIRE.
- M8 stays locked behind M6 stability + explicit user SaaS decision (D4).
- AI copilots locked behind M3 stability (D5).
