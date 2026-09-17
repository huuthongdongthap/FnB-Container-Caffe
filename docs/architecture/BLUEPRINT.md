---
date: 2026-09-12
version: 3.0
status: AWAITING OWNER SIGN-OFF (M1 code start)
masters:
  - /Users/mac/Downloads/AURA_OS_Master_Rearchitecture_Plan_v4.md (NEWEST — strategic authority)
  - docs/architecture/AURA_OS_Master_Plan_v2.md (business strategy, retained where v4 silent)
  - AURA_FnB_OS_Rebuild_Master_Spec.md (architecture contract — wins on engineering safety)
v4-reconciliation: plans/2026-09-12-aura-master-v4-reconciliation/plan.md (approved by owner 2026-09-12)
reading order: this page → v4-reconciliation plan.md → .ai/specs/spec-reconciliation.md → docs/product/* (M0) → .ai/specs/*
---
# AURA — BLUEPRINT v3 (approval front page)

## 1. What we are building (one paragraph)

AURA CAFE Sa Đéc already takes orders, payments, kitchen tickets, and
loyalty on its own platform (live at auraspace.cafe since opening day
2026-06-06). The rebuild is **not a rescue** — per **v4** it is a
**zero-based customer-data strategy**: no Viva Star data migration, AURA
earns its customer database transaction-by-transaction from Day 1 (repo
already keys orders on `customer_phone` with empty-profile customers —
v4 makes this policy). The work is (a) building the **Customer + Data
foundation** (identity, consent, events, visits, CRM profile) as M1,
(b) consolidating the remaining manual truth (Excel revenue, paper
inventory, handwritten purchases, owner memory) into ONE SOURCE OF
TRUTH while coexisting with Viva Star sales software (never a
prerequisite), and (c) hardening the working core into clean domain
contracts (monorepo apps/{space,ops,hq} + packages/* — no Viva Star
concepts leak into domain/) until the café can run independently (M3
open→sell→produce→serve→reconcile→close), grow CRM (M5), and later
replicate (M7 Kit → M8 AURA OS). The first product is a **self-running
AURA CAFE**, not a platform (v2 §1, v4 §27).

## 2. The plan in one table (M0–M8)

| Phase | Deliverable | Acceptance | Status |
|---|---|---|---|
| M0 Legacy Discovery | repo audit + Viva Star truth map + **v4 reconciliation** | 4 legacy docs + 10 audit artifacts + 3-spec authority | ✅ **DONE 2026-09-12** |
| M1 Customer + Data foundation | **Customer/Identity/Consent/Events/Visit/CRM profile/lookup domain** (zero-based DB policy) + monorepo scaffold (apps/{space,ops,hq} + packages/*), i18n/db packages, D1 merges, Catalog exemplar follows | AURA starts building a clean customer database from Day 1; order completes on new contract; live checkout never breaks | ⏳ authorized on sign-off |
| M2 Mini ERP core | Catalog/Menu/Order/Payment/Kitchen/Table/Staff/Shift contracts (Catalog exemplar moves here) | AURA controls the critical operational workflow without requiring historical Viva Star data | ⏳ |
| M3 Independent operation | inventory (T14–18), **multi-supplier purchasing/PO/suppliers** (Viva Star = first supplier entity, diversify beyond), Recipe auto-deduct, shift cash recon, POS, Reservation, Reporting, KDS dedupe, **owner dashboard TODAY/WHY/ACTION** | **open→sell→produce→serve→reconcile→close fully in AURA** — first production milestone; Excel RETIRED | ⏳ |
| M4 AURA Online | Digital Menu / Online Order / Pickup / Delivery / Customer Account / CRM on SAME core (no channel logic) | online order end-to-end | ⏳ |
| M5 CRM / Growth | loyalty/membership/campaigns/segments/referral/feedback/retention (CRM ladder: visits/preferences/frequency/value) | growth loop live; CRM answers the 6 questions | ⏳ |
| M6 AURA Cart | mobile operating unit as location profile | cart operates | ⏳ |
| M7 Café Kit | SOP corpus + config package | new café can launch on AURA standard | ⏳ |
| M8 AURA OS | multi-location/multi-brand/tenant/channel/integration/AI (locked) | external cafés adopt | ⏳ locked (D4/D5) |

## 3. Key facts discovered in M0 (read before deciding)

1. **Viva Star is an active supplier + valid brand license, not a dead
   franchise.** Owner is deliberately and gradually building the AURA
   brand while Viva Star remains primary coffee supplier. v4 adds the
   **sales-software strategy** (observe → coexist → AURA primary →
   replaceable — never a prerequisite). Legacy = **fragmented truth
   sources** (L1–L9) + a **brand/supply transition**. See
   `docs/product/VIVA_STAR_LEGACY_MAP.md` §1, §6.
2. **Zero-based customer DB is already how the repo works** — orders
   key on `customer_phone`, `customers` starts empty-profile. v4 turns
   this into policy: no historical migration, no waiting for Viva Star
   API, consent gate before CRM.
3. **The independence gaps are inventory, purchasing, suppliers, recipe
   COGS, shift reconciliation, and owner reporting** — not the order
   loop. M3 is where the business actually changes. See
   `AURA_GAP_ANALYSIS.md`.
4. **The SOP corpus (7 laminated papers) is the embryonic Café Kit** —
   opening/closing/25 recipes/cashier/cleaning/safety/receiving.
5. **Schemas for M3 already exist as specs** — OPERATIONS_2026 Tasks
   14–18 (inventory multi-supplier, PO, recipe auto-deduct, COGS/waste)
   — M3 executes, does not invent.

## 4. Engineering laws that bind every batch

- ONE SOURCE OF TRUTH (v2 §4); authority table v2 §16 (catalog owns
  price, payment owns paid, inventory owns stock…)
- Domain owns rules; handlers thin (VALIDATE→AUTH→USE CASE→MAP)
- DONE = VERIFIED (spec §27) · NEVER DELETE→REWRITE→HOPE (§26)
- Merged execution loop per batch: SPECIFY→IMPLEMENT→TEST→VERIFY→
  MIRROR→PARALLEL→SWITCH→STABILIZE→RETIRE (spec-reconciliation §4)
- vi-VN canonical glossary; loanwords kept; referral = "Giới thiệu bạn
  bè"; tiers Đồng/Bạc/Vàng/Kim cương
- Integrations are adapters (Stripe/ERPNext/Telegram/Zalo), never authorities
- Live café protection: old bundle stays deployable until replacement
  passes acceptance; 14-day mirror gates before any truth-source SWITCH

## 5. Top risks (full register: `.ai/specs/risks.md`)

1. 🔴 M1 architecture work breaks live checkout → smallest-safe-change
   batches, old bundle kept live, 4800 tests green per batch
2. 🔴 payment-table merge loses money data → down-migrations +
   backup-restore runbook + row-count verify before cutover
3. 🔴 single-supplier coffee dependence on Viva Star during brand
   transition → multi-supplier Purchasing (M3) + gradual brand fade;
   never hard-cut Viva Star credit
4. 🔴 customer-identity capture is the new M1 critical path (R20) —
   if phone/consent/event pipeline is weak, the zero-based DB strategy
   stalls → build Customer domain before Catalog; consent gate before
   any CRM write; reuse existing `customer_phone` key

## 5.1 v4 laws adopted (v4 §24 — anti-pattern registry)

Do NOT: wait for Viva Star API · migrate nonexistent customer data ·
assume historical completeness · build full ERP · build microservices ·
build multi-tenant SaaS first · build complex AI first · build separate
apps for online/cart · force immediate rebranding · destroy the current
operation before AURA replacement is proven.

DO: start clean customer DB · capture identity Day 1 · build CRM around
real transactions · build Mini ERP around real café workflows · coexist
with Viva Star · gradually move source of truth to AURA · prove at one
café · package · replicate.

## 6. Approval

Gates G1–G10 pre-answered 2026-09-12 (user "ok"). **v4 reconciliation
approved 2026-09-12 (user "ok")**: three-spec authority (v4 > v2 >
repo-root on strategy; repo-root wins on engineering safety), resequenced
M0–M8 map (M1 = Customer+Data pivot, Catalog→M2, Inventory/Purchasing→M3,
CRM→M5), Viva Star software Stage A (observe, no integration
prerequisite), brand-fade per LEGACY_MAP §6. The single remaining gate
authorizes M1 code.

| Gate | Decision owner | Status |
|---|---|---|
| G1–G10 (spec authority, M0 map, M1 scope, offline depth, SaaS, AI, monorepo, D1 merges, canonical surfaces, glossary) | user | ✅ accepted 2026-09-12 |
| v4 reconciliation (3-spec authority · M1 pivot · resequenced M0–M8 · anti-pattern registry) | user | ✅ accepted 2026-09-12 |
| **Final sign-off — authorize M1 code** | user (anh Còn) | ⏳ **PENDING** |

> **Sign-off:** I approve BLUEPRINT v3 (v4-aligned) and authorize M1
> (Customer + Data foundation first, then Catalog exemplar).
>
> Approved by: owner ("go") Date: 2026-09-12
