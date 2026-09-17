---
date: 2026-09-12
version: 1.1 (updated 2026-09-12 — Viva Star = active supplier + brand license)
status: M0 legacy discovery (v2 §13 M0)
evidence: 05_Demos/ worker tasks, OPERATIONS_2026, git log 2026-05→06 + owner correction
---
# VIVA STAR LEGACY MAP — what the legacy actually is and where it lives

## 1. Corrected understanding (supersedes v2's assumption + prior M0 draft)

Two corrections from owner (2026-09-12) refine the initial M0 draft:

1. **Viva Star is not just an expired franchise brand.** It is currently
   the **primary coffee supplier** for AURA CAFE (green beans / roasted
   beans / equipment — exact product TBD). The supplier relationship is
   **active and ongoing** during the AURA brand transition.
2. **The Viva Star brand license for the café is still valid** — the café
   is permitted to operate under the Viva Star brand today. The shift to
   AURA brand is a **deliberate, gradual strategic move**, not forced by
   contract expiry.
3. The franchise rename task (`WORKER_TASKS_V6/06-rename-aura-café.md`)
   reflects the *brand identity the owner chose*, not a legal requirement
   to stop using Viva Star.

**Revised M0 conclusion:** migration is **truth consolidation + brand
transition**, not system cutover. The MAP→MIRROR→VERIFY→PARALLEL→SWITCH→
STABILIZE→RETIRE ladder applies to:
- Each **truth source** (Excel sheets, manual counts) — retire into AURA.
- Each **supply chain dependency** on Viva Star — diversify gradually.
- The **brand layer** — transition visibility from Viva Star → AURA over
  M1→M3, never a hard cut.

### 1.1 Supplier dependency (new risk class)

| Aspect | Current state | Transition target |
|---|---|---|
| Coffee supply (beans) | Viva Star is primary supplier | Diversify to 2–3 suppliers + direct trade lots |
| Brand on signage/menu | Viva Star still permitted | Phase out visibility gradually (M2–M3) |
| Customer perception | Some regulars know "Viva Star" | Reintroduce as "AURA by former Viva Star roaster" narrative |
| Contractual tie | Brand license (not franchise fee) | Exit gracefully when AURA brand is established |

### 1.2 Why this matters for the rebuild

- **Menu/catalog must decouple "origin/roast" from brand.** A coffee's
  provenance (Viva Star lot, region, roast date) is supply-chain data;
  the brand shown to customers is a presentation choice. Catalog design
  (M1 exemplar) keeps these separate fields.
- **Supply diversification = resilience.** AURA should not single-source
  coffee from a brand it's trying to move away from. Purchasing module
  (M2) will support multi-supplier from day one.
- **Brand transition is a narrative, not a rebrand.** Sudden removal of
  Viva Star may confuse regulars. Plan: keep Viva Star mention as "roast
  by" → co-brand "AURA × Viva Star" → full AURA.

## 2. Legacy truth-source inventory

| # | Legacy truth source | Content | System of record today | Target authority (v2 §16) | Retire path |
|---|---|---|---|---|---|
| L1 | `BAO-CAO thang *.xlsx` — DOANH THU sheet | Daily revenue 2 shifts, ~77 rows/mo | Excel on owner/staff machine | AURA Reporting (HQ) | MIRROR: import 90 days → VERIFY totals match D1 orders → SWITCH dashboard → RETIRE sheet |
| L2 | Excel inventory sheets | Ingredient stock levels | Excel + eyes | AURA Inventory | MIRROR: Task-14 schema seed (41 ingredients) → PARALLEL daily count → RETIRE |
| L3 | Telegram order pings | Order creation notice | Telegram bot | AURA Order events | already evented (DO broadcast); Telegram becomes notify-only adapter |
| L4 | Zalo group | Staff/customer chatter | Zalo | AURA Ops notifications | adapter-ify (ZNS mockup exists) |
| L5 | Handwritten purchase notes | What was bought, when, cost | paper | AURA Purchasing | build PO → PARALLEL → RETIRE paper |
| L6 | SOP paper wall copies | Opening/closing/recipes/cashier/cleaning/safety/receiving | laminated paper at counter | AURA SOP module (Kit asset) | digitize into Kit; paper stays as backup |
| L7 | FaceID/app attendance | Staff check-in | HR app (already app-based) | AURA Staff/Shift | MIRROR → SWITCH |
| L8 | Owner memory + month-end Excel | Business health | owner | AURA HQ dashboard (v2 §15) | dashboard answers TODAY/WHY/ACTION |
| L9 | **Viva Star brand layer** (signage, menu mentions, supplier naming) | Café's permitted brand identity + coffee provenance | physical + menu copy | AURA brand (owner strategic choice) | gradual: co-brand → full AURA over M1→M3; never hard cut |

Viva Star supplier rows are **not** in this legacy table — an active
supplier is a Purchasing-context entity (see §1.1), not a truth source
to retire. Only the *brand visibility* (L9) retires.

## 3. Brand layer status (updated)

Two brand threads to keep separate:

1. **Viva Star → AURA (customer-facing, active license):** the café is
   still permitted to use the Viva Star brand. Owner chose AURA CAFE as
   the identity on 2026-06-06; transition is gradual and deliberate.
   Ladder in §1.1: keep "roast by" mention → co-brand → full AURA.
2. **aura-space-sadec naming debt (internal, cosmetic):** package name
   `aura-space-sadec`, Cloudflare project `fnb-caffe-container`, domain
   auraspace.cafe. One cleanup batch in M2, low priority.

Do not conflate: thread 1 is a *supplier/brand strategy* (needs owner
narrative decisions); thread 2 is *internal naming* (pure engineering).

## 4. Historical timeline (git + docs)

| Date | Event | Evidence |
|---|---|---|
| 2026-05-27 | OPERATIONS_2026 specs written (inventory Tasks 14–18, HR 19–23, SOPs 01–07) | `OPERATIONS_2026/README.md` |
| 2026-05-30 | Deep-check audit of launch plan; master plan revised (organic student strategy) | `99_DEEP_CHECK_AUDIT_30-5.md` |
| 2026-06-06 | AURA CAFE opens (rebrand from Viva Star franchise) | `KHAI_TRUONG_6-6/` |
| 2026-06→09 | Platform hardening: order types, loyalty ladder, timeline tracking, DO broadcast | git log (5b9417f, aa9602f, 3472ba4) |

## 5. Franchise lessons worth keeping (Viva Star as teacher, not target)

The franchise period produced: 25 signature recipes (SOP 03), opening/
closing discipline, cashier routines, hygiene schedules — process assets
now AURA's. v2 §13 says "do not judge the legacy before mapping it" —
mapped: the legacy's *discipline* is good, its *truth storage* is the
problem.

## 6. Brand transition plan (Viva Star → AURA, gradual)

Owner intent (2026-09-12): "chuyển dần sang build thương hiệu AURA" —
build the AURA brand gradually while Viva Star remains supplier.

| Stage | Customer sees | Supplier naming on menu | Trigger |
|---|---|---|---|
| Now | AURA CAFE identity (already chosen) | Viva Star coffee lots visible where relevant | today |
| M2 | AURA CAFE + provenance lines ("100% Arabica Sa Đéc" etc.) | reduce Viva Star mentions to roast/origin credit | Purchasing module tracks lots |
| M3 | AURA CAFE strong standalone brand | AURA as the brand; Viva Star = one supplier among 2–3 | supplier diversification done |

**Rules:**
- Never remove Viva Star credit in one cut — regulars identify the coffee
  by it. Fade, don't flip.
- The AURA platform already carries AURA branding (rename task 06 was
  P0-complete). Customer-facing surfaces are already AURA.
- Multi-supplier Purchasing (Task 14 schema) is the mechanism that makes
  brand independence *real* (not just visual) — coffee continuity no
  longer depends on one supplier.
