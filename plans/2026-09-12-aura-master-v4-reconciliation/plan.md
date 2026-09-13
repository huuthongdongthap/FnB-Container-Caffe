---
date: 2026-09-12
version: 1.0
status: APPROVED by owner 2026-09-12 ("ok" — all 4 open questions accepted; artifacts updated same day)
trigger: "/plan cập nhật plan mới và phối /Users/mac/Downloads/AURA_OS_Master_Rearchitecture_Plan_v4.md"
authority-triad: v4 = newest strategy · v2 = retained where not superseded · repo-root = architecture contract
sources:
  - /Users/mac/Downloads/AURA_OS_Master_Rearchitecture_Plan_v4.md (1227 lines, newest)
  - docs/architecture/AURA_OS_Master_Plan_v2.md (existing business strategy)
  - docs/architecture/AURA_FnB_OS_Rebuild_Master_Spec.md (repo-root architecture contract)
  - .ai/specs/* (M0 legacy work, reconciled below)
  - docs/architecture/BLUEPRINT.md (approval artifact — update §6 + key fact #1 + top risk + M2 row)
---

# MASTER PLAN V4 RECONCILIATION

Re-plans the AURA rebuild around the **v4 Master Re-architecture Plan**
(2026-09-12 download) which supersedes prior M0 + v2 + v2-bootstrap
framing. This is a **documentation/spec reconciliation only** — no code
changes. M1 code start still blocked on BLUEPRINT.md §6 owner sign-off.

## Three-spec authority (locked)

| Source | Role | Wins on |
|---|---|---|
| **v4** (newest) | Strategic direction — zero-based customer DB, Viva Star software strategy A→D, channel-as-adapter law, source-of-truth transition table, independence definition, M0→M8 milestone map | strategy / scope / sequencing / customer-data model |
| **v2** | Retained where v4 is silent (golden-loop 9 events, 4-tier loyalty ladder, MD3 design system, 4800-test evidence base, glossary D9, channel taxonomy) | details v4 does not restate |
| **repo-root spec** | Engineering law — NEVER DELETE→REWRITE→HOPE, MIRROR 14-day gate, rollback-live, spec §6/§9/§10 handler shape, D1-D10 decision register | process / safety / migration mechanics |

Conflict rule: **v4 > v2 > repo-root** on strategy; **repo-root > v4 > v2**
on engineering safety. v4 adds constraints (it does not relax repo-root
spec §26 migration law).

## What changes vs prior M0+v2+bootstrap

1. **Zero-based customer DB** (v4 §6): no migration from Viva Star —
   AURA earns customer relationships transaction-by-transaction from Day 1.
   Repo already does this: `customers` is empty-profile; orders key on
   `customer_phone`. v4 makes this explicit policy, not accident.
2. **Customer-identity capture is P0** (v4 M1 — Customer, Identity,
   Consent, Customer Events, Visit, Order linkage, CRM profile,
   lookup). Prior M1 was "Catalog exemplar + contract hardening".
   **M1 scope pivots**: customer/data foundation FIRST, then Catalog.
3. **Viva Star software 4-stage strategy** (v4 §12): observe → coexist →
   AURA becomes primary → Viva Star fully replaceable. Integration must
   **never** be a prerequisite for AURA. Do NOT wait for Viva Star API.
4. **Channel = adapter** (v4 §15): all channels (IN_STORE_POS / QR_TABLE
   / ONLINE_PICKUP / ONLINE_DELIVERY / CART) use the SAME Order domain —
   already law in v2 §9, now reinforced.
5. **Brand transition = 4 stages A→D** (v4 §4): co-brand → AURA-first →
   ecosystem; speed may differ per channel; never force rebrand.
6. **Source-of-truth transition table** (v4 §23): explicit Initial →
   Intermediate → Target with Viva Star retaining legacy sales records
   during transition.
7. **Mini ERP M-sequence resequenced** (v4 §20): M1=Customer+Data,
   M2=ERP Core (Catalog/Menu/Order/Payment/Kitchen/Table/Staff/Shift),
   M3=Independent Ops (+Recipe/Inventory/Purchasing/Supplier/POS/Reporting),
   M4=Online, M5=CRM/Growth, M6=Cart, M7=Kit, M8=AURA OS.
8. **Anti-patterns registry** (v4 §24) — explicit Do/Don't list adopted.
9. **"No Viva Star-specific concepts leak into domain/"** (v4 §20) —
   architecture law added to monorepo design.
10. **Definition of independence** (v4 §25): AURA CAFE independent when
    OPEN→PREPARE→SELL→PAY→KIT→SERVE→CRM→INVENTORY→RECONCILE→CLOSE runs
    without Viva Star software.

## What v4 does NOT break (verified against repo)

- Existing production order/payment/kitchen/table/loyalty flows — all keep running.
- D1-D10 decision register — still binding (v4 adds, does not replace).
- 4800-test evidence base — v4 says "prove at one café", not "rewrite".
- Glossary, MD3, i18n, offline PWA queue — v4 silent = retained.
- Viva Star = active primary supplier + valid brand license (memory
  viva-star-supplier-brand-truth) — v4 §1 "café may continue using Viva
  Star brand initially" matches, v4 §5 supplier model matches.

## Resequenced M0→M8 phase map (v4-aligned)

| Phase | v4 module set | Acceptance (v áp dụng) | Prior mapping | Delta |
|---|---|---|---|---|
| **M0** DISCOVER | map Viva Star operation + real workflow | CURRENT_OPERATION · LEGACY_MAP · GAP_ANALYSIS · spec reconciliation | done (this session + bootstrap) | +v4 reconciliation artifact (this plan) |
| **M1** CUSTOMER + DATA FOUNDATION | Customer / Identity / Consent / Customer Events / Visit / Order linkage / CRM profile / lookup | AURA starts clean customer DB from Day 1 | was "Catalog exemplar" | **SCOPE PIVOT** — customer before Catalog |
| **M2** AURA MINI ERP CORE | Catalog / Menu / Order / Payment / Kitchen / Table / Staff / Shift | AURA controls critical workflow without Viva Star data | M1 contract hardening + M2 Inventory/Purchasing | Catalog/Purchasing/Inventory SHIFT: Catalog→M2, Inventory/Purchasing→M3 |
| **M3** INDEPENDENT OPS | Recipe / Inventory / Purchasing / Supplier / POS / Reservation / Reporting | AURA CAFE open→sell→produce→serve→reconcile→close on AURA | was M2 Inventory/Purchasing | +Recipe/Supplier/Reporting; this is the first production milestone |
| **M4** AURA ONLINE | Digital Menu / Online Order / Pickup / Delivery / Customer Account / CRM | Online channel uses same core | deferred M4 | aligned |
| **M5** CRM / GROWTH | Loyalty / Membership / Promotion / Segments / Campaign / Referral / Feedback | v2 §6 ladder complete + visit materialization | M3 CRM depth | promoted from M3 tie-in to own phase |
| **M6** AURA CART | mobile operating unit | launch | M6 cart | aligned |
| **M7** AURA CAFE KIT | reproducible package | real café → package | M7 | aligned |
| **M8** AURA OS | Multi-location / Multi-brand / Tenant / Channel / Integration / AI | generalize | M8 | aligned |

## Risk register updates (v4 adds)

| ID | Severity | Risk | v4 source | Mitigation |
|---|---|---|---|---|
| R20 | 🔴 | Customer-identity capture is now M1 critical path — if phone/consent/event pipeline is weak, AURA earns no relationship data and the whole "zero-based DB" strategy stalls | v4 M1 | build Customer/Identity/Events BEFORE Catalog; reuse existing `customers` table + `customer_phone` order key; consent gate before CRM |
| R21 | 🟡 | M1 scope pivot delays Catalog consolidation exemplar (the prior M1 batch plan) | v4 §20 M1 | accept the pivot — domain split (apps/+packages/) and D1 merges stay M1; Catalog contract hardening shifts to M2 |
| R22 | 🟡 | Viva Star software co-existence: staff run two systems (Viva Star POS + AURA) until M3 | v4 §12 Stage A/B | AURA captures CRM + order events as read-only mirror at first; no integration prerequisite |
| R23 | 🟡 | Channel divergence temptation: building separate online/cart apps instead of adapters | v4 §15 + §24 | single Order domain law enforced in code review; channel adapters only |
| R24 | 🟢 | Brand-transition speed differs per channel; inconsistent customer experience | v4 §4 | fade plan per LEGACY_MAP §6; monitor regular retention during fade |
| R18 | 🔴 | Single-supplier coffee dependence on Viva Star during brand transition | owner 2026-09-12 | multi-supplier Purchasing in M3; Viva Star = first supplier entity, not special case |
| R19 | 🟡 | Brand transition confuses regulars | owner 2026-09-12 | gradual "roast by" fade → co-brand → full AURA |

Top risk at new M1 gate: **R20** (customer-identity capture). M1 is no
longer "catalog consolidation" — it is **earning the first clean
customer record**.

## M1 restart scope (what this reconciliation authorizes once owner signs)

1. **Scaffold `apps/{space,ops,hq}` + `packages/domain/*`** — same as
   prior M1 batch 1, no behavior change. ✅ DONE 2026-09-13 (batch 4
   phase 1: npm-workspaces root, customer moved, re-export shim).
2. **Customer/Identity/Events domain** (NEW M1 first):
   - `packages/domain/customer` — entities: Customer, Consent, Identity.
     ✅ DONE 2026-09-13 (batch 1 writes + batch 4 move).
   - `packages/domain/crm` — CustomerEvents, Visit, CRM profile.
     ✅ DONE 2026-09-13 (batch 4 phase 2: lookup-profile reads existing
     D1 tables, toCrmView staff shape, 5 tests).
   - Wire existing `customers` table + `customer_phone` order key. ✅
     (batch 1–3 migrations).
   - CustomerCreated / CustomerIdentified / ConsentGiven events on
     the golden-loop spine.
3. **i18n consolidation** to glossary keys (unchanged).
4. **D1 duplicate merges** with down-migrations (money tables first).
5. **Catalog exemplar** follows customer domain (shifted from M1-first
   to M1-after-customer).
6. **Order→Payment→Kitchen** follow the exemplar pattern.

Old bundle stays deployable; rollback kept live; nothing ships without
tests green + acceptance per batch (repo-root spec §26 still law).

## Open questions (only the user can answer)

→ RESOLVED 2026-09-12, see sign-off block above.

## Open questions (only the user can answer)

→ RESOLVED 2026-09-12, see sign-off block above.

## Owner sign-off (v4 reconciliation)

> I have read plan.md (this reconciliation), the v4 Master Plan
> `/Users/mac/Downloads/AURA_OS_Master_Rearchitecture_Plan_v4.md`, and the
> existing v2 + repo-root spec + M0 legacy work. I approve the
> three-spec authority (v4 > v2 > repo-root on strategy; repo-root wins
> on engineering safety), the resequenced M0→M8 phase map, the M1 scope
> pivot (customer/data before Catalog), and authorize updating the
> M0 artifacts per the table above. M1 code start awaits final sign-off
> on BLUEPRINT.md §6.

- [x] Approved by owner — date: 2026-09-12 ("ok")
- [x] Amendments: none

## Open questions (RESOLVED 2026-09-12)

1. M1 scope pivot → **accepted** (Customer/Identity/Consent/Events/Visit/
   CRM profile/lookup first; Catalog exemplar moves to M2)
2. Viva Star sales software → **Stage A (observe + document)** for M1–M2;
   no integration prerequisite; AURA captures customer/order events in
   parallel
3. Brand-fade cadence → **per LEGACY_MAP §6** (4-stage, per-channel
   triggers, monitor regular retention); fade spans M3→M5
4. Reconciliation sign-off → **granted 2026-09-12**

## References

- v4 Master Plan: `/Users/mac/Downloads/AURA_OS_Master_Rearchitecture_Plan_v4.md`
- v2 Master Plan: `docs/architecture/AURA_OS_Master_Plan_v2.md`
- Repo-root spec: `docs/architecture/AURA_FnB_OS_Rebuild_Master_Spec.md`
- BLUEPRINT: `docs/architecture/BLUEPRINT.md`
- Memory: `viva-star-supplier-brand-truth.md` (Viva Star = active
  supplier + valid brand license)
- Prior M0 reconciliation: `plans/2026-09-12-aura-master-plan-v2-bootstrap/`
