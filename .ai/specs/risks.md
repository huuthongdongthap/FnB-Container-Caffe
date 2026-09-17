---
date: 2026-09-12
version: 1.1
status: live register (review each phase gate)
v4-reconciliation: plans/2026-09-12-aura-master-v4-reconciliation/plan.md (approved 2026-09-12)
---
# RISK REGISTER — AURA rebuild + Viva Star truth consolidation

Severity: 🔴 high · 🟡 medium · 🟢 low. Every mitigation has an evidence
or owner. Review at each phase gate.

## Strategy / migration risks

| ID | Sev | Risk | Mitigation | Evidence/owner |
|---|---|---|---|---|
| R1 | 🔴 | Split-brain truth persists: staff keep Excel even after dashboard ships (L1/L2) | 14-day MIRROR gate + owner-led SWITCH (owner stops asking for Excel); archive file visible as RETIRED | LEGACY_MAP L1; owner |
| R2 | 🔴 | M1 architecture work breaks the live café (menu/checkout PROD since opening) | Smallest-safe-change batches; old bundle stays live until new surface passes acceptance (D-deployment continuity); 4800 tests green per batch | REPO_MIGRATION rules |
| R3 | 🟡 | Excel 90-day import pollutes Reporting with bad rows | import as clearly-marked legacy_source rows; D1 order totals are the only authoritative revenue | migration-matrix L1 |
| R4 | 🟡 | Parallel-run fatigue: staff double-enter (app + Excel) and rebel | Keep window short (14d); one person (Cường/Khánh) owns daily dual-entry; owner announces SWITCH date | SOP staff roles |
| R5 | 🟡 | Recipe auto-deduct (Task 16) drifts from real pours → stock chaos | VERIFY against manual counts 14 days before it becomes authority; variance alert threshold | OPERATIONS_2026 Task 16 |
| R6 | 🟢 | Branding residue ("aura-space-sadec", auraspace.cafe) confuses staff | one cosmetic cleanup batch M2, no functional risk | rename task 06 |
| R18 | 🔴 | **Single-supplier dependence on Viva Star while transitioning brand away from it** — coffee quality/price/continuity hinges on the brand being exited | Purchasing module (M3) supports multi-supplier from day one; diversify to 2–3 suppliers + direct trade before brand fully AURA; never hard-cut Viva Star credit | owner strategy (2026-09-12); VIVA_STAR_LEGACY_MAP §1.1 |
| R19 | 🟡 | Brand transition confuses regulars ("Viva Star" is how they identify the coffee) | gradual fade: "roast by" credit → co-brand → full AURA (M3→M5); keep provenance lines ("100% Arabica Sa Đéc") independent of supplier name | VIVA_STAR_LEGACY_MAP §6 |
| R20 | 🔴 | **Customer-identity capture is the M1 critical path (v4 pivot)** — if phone/consent/event pipeline is weak, zero-based DB strategy stalls and AURA earns no relationship data | Customer/Identity/Events domain built BEFORE Catalog; consent gate before any CRM write; reuse existing `customer_phone` order key (verified worker/schema.sql:114) + `customers` table; phone identifier at checkout/loyalty signup | v4 §6/§7/§20 M1 |
| R21 | 🟡 | M1 scope pivot delays Catalog consolidation exemplar (prior M1 batch plan) | accepted trade-off: monorepo scaffold + D1 merges + i18n stay M1; Catalog contract hardening moves to M2 with Order/Payment/Kitchen | v4-reconciliation plan.md |
| R22 | 🟡 | Viva Star software co-existence: staff run two systems until AURA is primary | v4 Stage A/B: AURA observes + captures customer/order events in parallel; NO integration prerequisite, never wait for Viva Star API; SWITCH only after M3 independence proof | v4 §12 |
| R23 | 🟡 | Channel divergence: separate online/cart apps instead of adapters | single Order domain law (v2 §9, v4 §15); channel adapters only; code-review gate rejects channel-owned business logic | v4 §24 |
| R24 | 🟢 | Brand-fade speed differs per channel → inconsistent customer experience | fade plan per LEGACY_MAP §6 with per-channel triggers; monitor regular retention during fade | v4 §4 |

## Engineering risks

| ID | Sev | Risk | Mitigation | Evidence/owner |
|---|---|---|---|---|
| R7 | 🔴 | D1 table merges (payments, subscription_invoices) lose data | down-migrations + backup-restore runbook + row-count verification before cutover (D7) | DOMAIN_MAP §5 |
| R8 | 🔴 | 85-route SPA split breaks live deep links (auraspace.cafe) | route map preserved verbatim in APP_MAP; old bundle stays until new surface passes acceptance | APP_MAP |
| R9 | 🟡 | i18n dedupe breaks live Vietnamese copy | key-by-key mapping table, vi canonical per glossary (D9), smoke-test rendered pages | glossary yaml |
| R10 | 🟡 | 41 stitch variants hide business rules | grep-audit each before archiving; only demo/landing logic expected | FEATURE_MATRIX |
| R11 | 🟡 | Worker bundle 2.2MB grows with monorepo packages | keep single worker until measured; split per surface if needed in M2 | CURRENT_STATE §7 |
| R12 | 🟡 | KDS/checkout dedup (D8) removes a surface staff actually use | confirm canonical usage from real staff behavior before archiving dupes; dupes archived not deleted | gap analysis |
| R13 | 🟢 | Offline promises without conflict rules (v2 §14 trap) | contract law: each context's offline note states explicit conflict/recovery rule or "requires connectivity" | domain-contracts §0 |

## Product/scope risks

| ID | Sev | Risk | Mitigation | Evidence/owner |
|---|---|---|---|---|
| R14 | 🟡 | Premature generalization (multi-tenancy, cart, Kit) distracts from café | locked by D4/D8 until M6/M7/M8; one-location assumption holds | v2 §22 |
| R15 | 🟡 | AI copilots dragged forward by enthusiasm | locked by D5 behind M3 stability | v2 §19 |
| R16 | 🟡 | M4 online channel forks business logic (channel divergence) | domain-contracts cross-law 2: channels are adapters, same commands; code review gate | v2 §9 |
| R17 | 🟢 | Key-person risk: much ops knowledge in owner/staff heads (4 staff) | SOP corpus is the capture mechanism; M2 shift-recon digitizes the rest | CURRENT_OPERATION §6 |

## Top 3 to watch at M1 gate (updated for v4 pivot 2026-09-12)

1. **R20 customer-identity capture** — M1 is now "earning the first
   clean customer record", not catalog consolidation; phone/consent/
   event pipeline must work from the first batch
2. R2 live-café protection — every M1 batch must keep checkout green
3. R7 payment-table merge — the only M1 change touching money data

## Top risk at M3 gate (updated 2026-09-12)

**R18 supplier dependence** — Purchasing/Inventory module (M3) is now
also the *brand-independence mechanism*: multi-supplier capability is
what makes AURA brand transition real, not just visual rebranding.
M3 = first production independence milestone
(open→sell→produce→serve→reconcile→close fully in AURA, v4 §25).
