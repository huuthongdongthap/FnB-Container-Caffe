---
date: 2026-09-12
version: 1.0
status: M0 legacy discovery (v2 §13 M0, §21 point 3)
evidence: CURRENT_OPERATION.md, VIVA_STAR_LEGACY_MAP.md, FEATURE_MATRIX.md, OPERATIONS_2026 specs
---
# AURA GAP ANALYSIS — current state vs M2 "independent daily operation"

## 0. Method

Compare the as-run operation (CURRENT_OPERATION) against v2's
independence checklist (§18) and M2 acceptance ("open, operate,
reconcile, close a normal business day using AURA"). Rate each of the 15
Mini-ERP modules (v2 §5): ✅ covered · 🟡 partial · ❌ missing.

## 1. Module-by-module (15 Mini-ERP modules)

| # | Module (v2 §5) | Status | Gap | Target phase |
|---|---|---|---|---|
| 1 | Catalog | 🟡 | dual tables `products`/`menu_items` — consolidation debt, not a functional gap | M1 |
| 2 | Menu | ✅ | none — /menu, /tv-menu PROD | — |
| 3 | Order | ✅ | none — order types contract doc'd; timeline live | — |
| 4 | Payment | ✅ | none — Stripe/NOWPayments/COD PROD; SePay docs-only (verify or drop) | — |
| 5 | Table | ✅ | QR check-in + floor plan live | — |
| 6 | Kitchen | ✅ | KDS canonical /kds; 2 duplicate surfaces to retire | M2 |
| 7 | Inventory | 🟡 | Excel truth; Task-14 schema (41 ingredients) spec'd, UI partial, auto-deduct unverified | **M2 priority** |
| 8 | Purchasing | ❌ | manual direct-buy, no PO, no audit trail, no low-stock suggestions | **M2 priority** |
| 9 | Staff | 🟡 | roles+shifts live; attendance app-based; performance/uniform specs unimplemented | M2 |
| 10 | Shift | 🟡 | staff_shifts table + opening/closing SOPs exist; no cash reconciliation per shift | M2 |
| 11 | Customer | ✅ | customers table, guest→profile enrichment exists | — |
| 12 | CRM | 🟡 | thin admin view; no visit history/product preference/frequency views (v2 §6 questions) | M3 |
| 13 | Promotion | ✅ | promotions/vouchers live | — |
| 14 | Reservation | ✅ | live; conflict policy in route (move to domain) | M2 cleanup |
| 15 | Reporting | 🟡 | metrics + sales-reports split; **owner Excel revenue consolidation still the real system** | **M2 priority** |

## 2. Gap clusters (what actually blocks M2 independence)

**Cluster A — Inventory/Purchasing/COGS (biggest gap).**
The audit's 7 gaps: no auto low-stock alert, manual counts, no PO
trail, no COGS/waste math, multi-supplier absent, no recipe auto-deduct.
Tasks 14–18 are already spec'd with schema + seed (41 ingredients) —
M2 executes them, not reinvents.

**Cluster B — Shift reconciliation (cash vs system).**
Two daily shifts run; SOP has cash counting but system has no
per-shift cash reconciliation report. Needed for "reconcile and close a
normal business day" (M2 acceptance).

**Cluster C — Owner reporting (v2 §15 dashboard).**
Today = Excel + Telegram + memory. Target = one screen answering
TODAY (revenue/orders/AOV/open orders/delayed tickets/top products/low
stock/cash recon/reservations/new vs returning customers/CRM alerts).

**Cluster D — CRM depth.**
v2 §6 ladder (identity→visits→orders→preferences→frequency→value→
promotions→loyalty→feedback→comms permission) — data mostly already
captured (orders, checkins, reviews, loyalty) but no views that answer
"who should we invite back?"

**Cluster E — Brand/supply transition (new, owner 2026-09-12).**
Viva Star is the primary coffee supplier AND the still-licensed brand.
AURA brand building is deliberate and gradual. Gaps: (a) no multi-
supplier purchasing to de-risk coffee continuity, (b) no provenance
fields on menu items (origin/roast decoupled from brand), (c) no brand
narrative plan for regulars who know the coffee as "Viva Star".
Mechanism: Purchasing module M2 (multi-supplier) + Catalog provenance
fields M1 design + marketing fade plan M2→M3. See VIVA_STAR_LEGACY_MAP
§1.1, §6.

## 3. What is NOT a gap (explicitly)

- Core F&B loop — fully PROD (FEATURE_MATRIX finding 1)
- Payments — 3 methods live, webhook-synced
- Loyalty — 4-tier ladder complete
- Channel split / multi-tenancy / AI — deliberately deferred (D3, D4, D5)

## 4. M1→M2 sequencing implication

M1 (core loop hardening: Catalog consolidation exemplar + domain
contract + API law) is **architecture work on already-working flows**.
M2 is where the real business gaps close (inventory, purchasing, shift
recon, owner dashboard). M3 closes CRM depth. This inverts the
original "rebuild first" instinct: **the café runs today; we're
consolidating truth and closing the independence gaps, not rescuing a
broken system.**
