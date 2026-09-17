---
date: 2026-09-12
version: 1.0
status: approved (user "ok" 2026-09-12 — defaults accepted)
sources:
  - AURA_FnB_OS_Rebuild_Master_Spec.md (repo root — architecture contract)
  - /Users/mac/Downloads/AURA_OS_Master_Plan_v2.md (business strategy)
  - assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/ (Viva Star legacy evidence)
---
# SPEC RECONCILIATION — two masters, one plan

## 0. Authority ruling (approved)

> **AURA_OS_Master_Plan_v2.md is the business strategy.**
> **AURA_FnB_OS_Rebuild_Master_Spec.md is the architecture contract.**
> Where they conflict, **v2 wins on strategy/scope/sequencing**; the
> repo-root spec wins on **engineering law** (domain rules, API shape,
> migration discipline). This memo is the record of that ruling and the
> 10 decisions made 2026-09-12.

## 1. What Viva Star actually is (M0 evidence, from `05_Demos/`)

- **"Viva Star Coffee"** was a franchised café brand whose contract
  expired; the physical café in Sa Đéc kept the source, rebranded to
  **AURA CAFE**, opened 2026-06-06 (`06-rename-aura-cafe.md`).
- Legacy ≠ software. Legacy = **operating process**: paper/Excel
  reporting, Telegram order pings, Zalo group, staff notebook, owner
  memory (`00_MASTER_PLAN_REVISED_30-5.md`, `03_DAILY_CHECKLIST`).
- The **repo already replaced the POS** — AURA SPACE web platform
  (menu/cart/checkout/KDS/tracking) is live at auraspace.cafe since
  before opening. So the "legacy system" is NOT a competing POS; it's
  **fragmented truth across Excel/Telegram/Zalo/staff/owner** (v2 §4).

**Consequence:** M0 is lighter than v2 assumed — we don't migrate
software cutover; we map residual manual processes and eliminate
split-brain truth.

## 2. Merge table (v2 ↔ repo-root spec)

| Topic | v2 (business) | Repo-root (architecture) | Merged ruling |
|---|---|---|---Evidence |
|---|---|---|---|---|
| First product | self-running AURA CAFE | AURA F&B OS platform | **Café first**; OS emerges from proven reference café | v2 §1, §22 |
| Bounded contexts | 15 Mini-ERP modules + CRM | 20 contexts | **15 modules map onto the 20** (merge analytics into Reporting, identity into Customer/Staff, etc.) | v2 §5 ↔ spec §6 |
| Phases | M0–M8 (roadmap) | Phase 0–6 (build) | **One taxonomy: M0–M8**, with Phase 2–6 work nested inside M1–M5 | v2 §13 ↔ spec §25 |
| Migration | MAP→MIRROR→VERIFY→PARALLEL→SWITCH→STABILIZE→RETIRE | DISCOVER→CLASSIFY→SPECIFY→MIGRATE→TEST→EVAL→VERIFY | **Merged execution loop** (§4 below) | v2 §17 ↔ spec §26 |
| Channels | in-store/online/delivery/cart | apps/{space,ops,hq} | **apps/ops = in-store channel surface; apps/space = online+customer; cart = future light profile of ops** | v2 §9 ↔ spec §5 |
| Offline | graceful degradation (menu/orders/table/KDS/shift/basic POS) | (absent) | **Added to domain contracts** as resilience notes per context | v2 §14 |
| SaaS/multi-tenancy | don't generalize prematurely | Phase 5 decision gate | **Incubate only until M8**; saas_* tables stay but no product commitment | v2 §22 ↔ spec §25 |
| AI | automate a known OS, near the end | Phase 6 copilots | **Deferred past M3 stability** (both agree) | v2 §19 ↔ spec §25 |
| Events | golden-loop events as CRM/analytics feed | spec §11 event model | **Golden-loop events ARE the spec §11 events** — one event spine | v2 §8 ↔ spec §11 |

## 3. What each spec contributes to the merged plan

**From v2 (strategy):** Reference-Café test (6 questions), ONE SOURCE OF
TRUTH law, 15-module Mini ERP boundary, CRM-as-core, golden loop as the
primary flow, channel architecture, cart-as-location-profile, replication
ladder, offline resilience, owner dashboard (§15), parallel-run migration.

**From repo-root spec (engineering):** monorepo apps/{space,ops,hq} +
packages/*, domain package contract (rules in domain, thin API), 20
architecture laws, DONE=VERIFIED, never DELETE→REWRITE→HOPE, i18n
glossary law, port/adapter integrations, .ai/ control plane (specs,
state, evals), eval harness.

## 4. Merged execution loop (binding)

```
DISCOVER (repo — done)
+ MAP     (Viva Star residual manual ops — this M0)
→ SPECIFY (BLUEPRINT v2 + domain contracts)
→ IMPLEMENT (smallest-safe-change batches)
→ TEST    (4800-test suite + acceptance scenarios)
→ VERIFY  (DONE = verified per spec §27)
→ MIRROR/PARALLEL (Viva Star truth sources read-only mirror: Excel→D1, Telegram→events)
→ SWITCH  (workflows cut over one by one)
→ STABILIZE (parallel-run observation window)
→ RETIRE  (legacy truth source archived)
```

## 5. The 10 decisions (approved 2026-09-12, "ok")

| # | Decision | Ruling | Evidence |
|---|---|---|---|
| D1 | Spec authority | v2 = strategy, repo-root = architecture contract, conflict → v2 strategy/engineering-law split as §0 | this memo |
| D2 | Viva Star mapping source | **Repo evidence first** (`05_Demos/`), stakeholder interview only for gaps | `05_Demos/KHAI_TRUONG_6-6/` |
| D2b | Viva Star software? | No competing POS — rebrand 6/6/2026; legacy = fragmented manual truth, not software cutover | `06-rename-aura-cafe.md` |
| D3 | M1 channel scope | **In-store core loop first** (Catalog→Menu→Order→Payment→Kitchen→Customer); online channel = M4, but channels must share one core (adapters, no separate logic) | v2 §9, §13 M1/M4 |
| D3b | Offline depth | **Graceful degradation for menu browse + current-order tracking first** (PWA offline queue already exists); full offline POS deferred with explicit conflict rules when each workflow gets them | v2 §14, PWA row in FEATURE_MATRIX |
| D4 | SaaS/multi-tenancy | **Incubate until M8**; no product commitment; saas_* tables stay, single-tenant operationally | v2 §22, CURRENT_STATE §7 |
| D5 | AI copilots | **Deferred** until after M3 operations stable | v2 §19, spec §25 |
| D6 | Repo shape | **Monorepo in this repo** — keeps 4800 tests + git history + deployments | discovery plan open-decision 1 |
| D7 | D1 duplicate-table merges | **Proceed** with down-migrations + backup-restore runbook + row-count verification before cutover | DOMAIN_MAP §5 |
| D8 | Stitch/surface dedupe | Canonical: track-order = **StitchTrackOrderNew**, KDS = **/kds**, checkout = **/checkout**; others archived after verify | FEATURE_MATRIX key findings |
| D9 | Glossary | Ratify vi-VN canonical: referral = "Giới thiệu bạn bè", tiers = Đồng/Bạc/Vàng/Kim cương, keep loanwords (Voucher, Check-in) | `.ai/context/glossary.vi-en.yaml` |
| D10 | First milestone of Rebuild | **M1 Catalog exemplar** (per REPO_MIGRATION §4) — port-and-verify since core loop already in prod | FEATURE_MATRIX finding 1 |

## 6. Non-negotiables (both specs, unchanged)

1. ONE SOURCE OF TRUTH — POS/Excel/FB/Telegram/staff/owner must agree (v2 §4)
2. Domain owns business rules — never in React/hooks/routes (spec §2)
3. DONE = VERIFIED (spec §27)
4. Never DELETE → REWRITE → HOPE (spec §26)
5. vi-VN canonical terminology (spec §15, glossary yaml)
6. Integrations = adapters, never authorities (v2 §16, spec §21)
7. AI near the end (v2 §19, spec §25)
8. Do not generalize prematurely (v2 §22)
8. Do not generalize prematurely (v2 §22)
9. Golden loop as the primary operational flow (v2 §8)
