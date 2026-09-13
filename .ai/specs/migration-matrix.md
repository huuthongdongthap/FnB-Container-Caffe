---
date: 2026-09-12
version: 1.1
status: approved draft (binding for M1/M2; resequenced per v4)
source: docs/architecture/REPO_MIGRATION.md + v2 §17 ladder + v4 §20/§23 + VIVA_STAR_LEGACY_MAP L1–L9
v4-reconciliation: plans/2026-09-12-aura-master-v4-reconciliation/plan.md (approved 2026-09-12)
---
# MIGRATION MATRIX — every artifact/truth-source → action

Legend: OLD → TARGET → STATUS → BEHAVIOR PRESERVED → TEST → ROLLBACK.
Actions: KEEP / MOVE / MERGE / REWRITE / ARCHIVE / RETIRE (RETIRE =
v2 §17 final ladder step for truth sources).

**v4 note (2026-09-12):** customer data is **zero-based** (v4 §6/§13) —
there is NO migration of Viva Star customer data, no waiting for a
Viva Star API. The `customers` table + `customer_phone` order key
already implement this in production (verified worker/schema.sql:114).
M1 formalizes identity/consent/events on top.

## 1. Repo artifacts (code)

| Artifact (OLD) | Action | TARGET | Status | Behavior preserved | Test | Rollback |
|---|---|---|---|---|---|---|
| 31 D1 tables + data | KEEP | packages/db, migrations keep applying | live | ✅ data untouched | row-count verify | migration down-files |
| `payments` + `payments_new` | — | RESOLVED-NOT-NEEDED (2026-09-13): `migrations/006` was recreate+rename, no `_new` table exists in prod D1 (live sqlite_master verified) | closed | n/a | n/a | n/a |
| `subscription_invoices` + `subscription_invoices_new` | — | RESOLVED-NOT-NEEDED (2026-09-13): `migrations/013` same recreate+rename pattern; subscription family never provisioned in prod | closed | n/a | n/a | n/a |
| customer identity/consent/events/visits | CREATE | new tables on existing `customers` (additive, zero-based) | **done 2026-09-13** (migration 20260913_01, batch 1) | ✅ no existing behavior touched | customer-domain unit + smoke | additive down-migration |
| 9 orphan tables (users_legacy, checkin_log, odoo_*, erpnext_invoices) | RETIRE | dropped from prod D1, DDL preserved in down-migration | **done 2026-09-13** (migration 20260913_02) | ✅ 0 rows, zero code consumers (verified) | live sqlite_master + row-count spot check | `20260913_02_retire_orphan_tables.down.sql` recreates shells |
| `products` + `menu_items` | MERGE | Catalog context single concept (D10 exemplar) | planned M2 (moved from M1 per v4 pivot) | ✅ menu rendering identical | 4800 suite + menu smoke | revert route wiring to tree/ path |
| `customers` + `customer_phone` key | KEEP (zero-based) | packages/domain/customer + crm: add identity/consents/customer_events/visits tables | planned M1 (FIRST, v4 pivot) | ✅ guest checkout unchanged | new customer-domain tests + live checkout smoke | new tables additive; drop only new tables |
| `tree/` domain files (18 trees) | MOVE | packages/domain contexts | planned M2+ | ✅ logic ported verbatim first | existing unit tests move with code | old tree/ stays until verified |
| `routes/` (91 files) | REWRITE(thin) | packages/api VALIDATE→AUTH→USE CASE→MAP | planned M2+ | ✅ same responses | route contract tests | keep old route files until new pass |
| erpnext-*.ts (5 route files) | MOVE | integrations adapter port | planned M3 | ✅ mapping+sync_log | existing tests | old routes stay |
| admin/* pages | MOVE | apps/hq | planned M2+ | ✅ same features | page smoke | old pages live until hq passes |
| kds surfaces (×3) | MERGE | canonical /kds (D8) | planned M2 | ✅ /kds behavior | kds polling test | dupes stay archived not deleted |
| checkout surfaces (×3) | MERGE | canonical /checkout (D8) | planned M1 | ✅ order-type contract (1e86d65) | checkout e2e | dupes archived |
| track-order surfaces (×2 dup) | MERGE | canonical StitchTrackOrderNew (D8) | done pattern | ✅ timeline | track tests shipped 5b9417f | old variants archived |
| 41 stitch one-offs | ARCHIVE | apps/space after grep-audit | planned M2 | demo-only expected | grep-audit log | git history |
| PWA offline queue | KEEP | apps/space core | live | ✅ | existing | — |
| i18n vi/en (1833 keys ×2) | MERGE | packages/i18n per glossary (D9) | planned M1 | ✅ rendered copy identical | key-mapping table + smoke | old keys retained until verify |
| saas_* tables | KEEP (incubate) | untouched until M8 (D4) | live-inert | ✅ | existing | — |
| 4800 tests | KEEP | move-with-code | live | ✅ evidence base | — | — |
| ADRs, runbooks | KEEP | docs/decisions | live | ✅ | — | — |
| Xibo docs | ARCHIVE | docs/decisions | planned | n/a | — | — |

## 2. Legacy truth sources (Viva Star, L1–L8 from LEGACY_MAP)

| Truth source | Ladder step today | MIRROR plan | VERIFY gate | SWITCH trigger | RETIRE in |
|---|---|---|---|---|---|
| L1 Excel revenue (DOANH THU) | MAPped | import 90 days to Reporting; daily dual-entry 2 shifts | totals match D1 orders ±0 for 14 days | owner reads dashboard first | M2 end |
| L2 Excel inventory + eyes | MAPped | Task-14 schema seed; morning count in app + on paper | stock accuracy ≥95% over 14 counts | counts app-only | M2 end |
| L3 Telegram order pings | adapter already | notify-only role (event spine feeds it) | n/a (no truth role) | already switched | M1 (verify adapter) |
| L4 Zalo group | MAPped | ZNS/notify adapter | n/a | staff comms tool, not truth | — (not a truth source for data) |
| L5 handwritten purchase notes | MAPped | PO flow (Purchasing context) | every direct-buy entered as PO for 14 days | zero paper for a week | M2 end |
| L6 SOP paper wall copies | MAPped | digitize into SOP module (Kit content) | SOP steps checkable in app (M7) | — (paper stays as backup) | M7 Kit |
| L7 FaceID/app attendance | MAPped | MIRROR to staff_shifts; Shift open/close records | attendance matches app record | — | M2 |
| L8 owner memory/month-end | MAPped | HQ dashboard TODAY/WHY/ACTION | owner answers daily questions from dashboard | owner stops month-end Excel | M2 end |
| L9 Viva Star brand layer (signage/menu/supplier naming) | MAPped | gradual fade: "roast by" credit → co-brand → full AURA (M2→M3) | customer sentiment + regular retention monitored during fade | AURA brand standalone; Viva Star = 1 of 2–3 suppliers | M3 end |

## 3. Binding migration rules (unchanged + v2 additions)

1. NEVER DELETE → REWRITE → HOPE (spec §26)
2. Each workflow maintains: Legacy behavior / AURA behavior / Gap / Risk
   / Test / Owner / Cutover date / Rollback (v2 §17 row per workflow)
3. Critical workflows keep a live rollback procedure during transition
4. MIRROR gate: 14 consecutive days zero/low-variance before SWITCH
5. RETIRE = archive the artifact (Excel file to docs/legacy/, not trash)
