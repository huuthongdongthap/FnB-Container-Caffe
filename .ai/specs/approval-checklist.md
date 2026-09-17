---
date: 2026-09-12
version: 1.1
status: APPROVED (gates 1–11 + v4 reconciliation + final M1 code sign-off — "go" 2026-09-12; M1 in progress)
v4-reconciliation: plans/2026-09-12-aura-master-v4-reconciliation/plan.md (approved 2026-09-12)
---
# APPROVAL CHECKLIST — sign-off gates for Rebuild M1

User answered "ok" to the 10 open decisions on 2026-09-12 (defaults
accepted). This checklist restates them as gates and adds the one thing
only the user can still confirm: **final sign-off to start M1 code**.

## Gates (all must be YES)

| # | Gate | Ruling (approved defaults) | Confirmed |
|---|---|---|---|
| G1 | Spec authority merged | **3-spec authority: v4 (newest strategy) > v2 > repo-root on strategy; repo-root > v4 > v2 on engineering safety** (v4-reconciliation 2026-09-12) | ✅ ok |
| G2 | M0 Viva Star map accepted | legacy = truth consolidation (Excel/Telegram/paper) + **brand/supply transition** (Viva Star = active primary supplier, license valid; AURA brand built gradually — never hard cut) + **v4 sales-software strategy** (observe→coexist→AURA primary→replaceable; never a prerequisite) | ✅ ok (refined + v4) |
| G3 | M1 scope = **Customer + Data foundation** (v4 pivot 2026-09-12) | M1 = Customer/Identity/Consent/Events/Visit/CRM profile/lookup domain + monorepo scaffold + i18n + D1 merges; **Catalog exemplar moves to M2**; no channel work until M4 | ✅ ok (pivoted) |
| G4 | Offline = graceful degradation first | menu browse + order tracking offline; full offline POS deferred w/ explicit conflict rules | ✅ ok |
| G5 | SaaS incubates until M8 | saas_* tables stay, no product commitment | ✅ ok |
| G6 | AI copilots deferred past M3 | both specs agree | ✅ ok |
| G7 | Monorepo in this repo | keeps history/tests/deployments; **no Viva Star concepts leak into packages/domain/** (v4 §20) | ✅ ok |
| G8 | D1 merges proceed | payments, subscription_invoices, products/menu_items w/ down-migrations + runbooks | ✅ ok |
| G9 | Canonical surfaces | track-order = StitchTrackOrderNew · KDS = /kds · checkout = /checkout | ✅ ok |
| G10 | Glossary ratified | referral = "Giới thiệu bạn bè" · tiers Đồng/Bạc/Vàng/Kim cương · loanwords kept | ✅ ok |
| **G11** | **v4 reconciliation accepted** | 3-spec authority · M1 pivot (Customer before Catalog) · resequenced M0–M8 (Catalog→M2, Inventory/Purchasing→M3, CRM→M5) · anti-pattern registry adopted (§24) · zero-based customer DB policy | ✅ **ok 2026-09-12** |

## Final sign-off (the only remaining gate)

> I have read BLUEPRINT.md v3 (v4-aligned), the v4 Master Plan, the v4
> reconciliation plan, the M0 legacy docs, and the .ai/specs/* artifacts.
> I approve the resequenced M0→M8 phase map and authorize **Rebuild M1**
> to begin with the Customer + Data foundation (then Catalog exemplar
> in M2).

- [x] Approved by owner — date: 2026-09-12 ("go")
- [x] Amendments: none

## What M1 start means (first batch, for transparency — v4 pivot)

1. Scaffold `apps/{space,ops,hq}` + `packages/domain/*` (no behavior
   change; old code stays live)
2. **Customer domain first (v4 M1)**: `packages/domain/customer`
   (Customer, Identity, Consent) + `packages/domain/crm` (Customer
   Events, Visit, CRM profile, lookup) wired to existing `customers`
   table + `customer_phone` order key — zero-based DB from Day 1
3. i18n consolidation to glossary keys (rendered copy identical)
4. D1 duplicate merges with down-migrations (money tables first, verified)
5. Catalog exemplar follows customer domain: `packages/domain` Catalog
   context + thinned API + Menu page consuming new contract (M2 start)
6. Order→Payment→Kitchen follow the exemplar pattern (M2)

Nothing ships to production without tests green + acceptance per batch,
and the old bundle stays deployable at every step (rollback kept live).
