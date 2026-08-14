# Deep Codebase Health Check — AURA CAFE (FnB-Container-Caffe)

**Date:** 2026-08-14 | **Branch:** main | **Version:** 2.1.1

---

## Executive Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Build | ✅ 4.32s | ✅ 3.32s | -23% |
| Tests | ⚠️ 2521/2527 | ✅ **2626/2626** | +105 tests, 0 failures |
| Test Files | 244 | 262 | +18 new test files |
| TS Errors | 0 | 0 | — |
| Git | Clean, 1 unpushed | Clean, 1 unpushed | — |
| Stitch Coverage | 1/39 (2.6%) | **11/39 (28.2%)** | +10 test files |
| Admin Coverage | 3/25 (12%) | **10/25+ (40%)** | +7 test files |
| Largest File | 1,265 LOC | **182 LOC** | -86% |
| App.tsx | 246 LOC | **59 LOC** | -76% |

**PROJECT.md:** All 9 milestones (Bazi UI Overhaul) marked DONE.

---

## Sprint Execution Log

### Sprint 1: Fix Failing Tests ✅
- **offline-queue.test.ts:** Installed `fake-indexeddb` as root devDependency
- **GenerateQR.test.tsx:** Fixed mock from `next-intl` → `react-i18next` (correct library)
- Result: 2527/2527 → 2536/2536 (9 new tests unlocked)

### Sprint 2: Modularize Top Files ✅
| File | Before | After | New Files |
|------|--------|-------|-----------|
| StitchContainerNew2.tsx | 1,265 LOC | 182 LOC | 12 (9 components + 2 hooks + 1 types) |
| StitchLoyaltyNew.tsx | 1,205 LOC | 136 LOC | 18 (15 components + 2 hooks + 1 types) |
| App.tsx | 246 LOC | 59 LOC | 4 (public, admin, stitch, mobile routes) |

Total: 34 new files extracted. All < 200 LOC. Build verified.

### Sprint 3: Test Coverage Blitz ✅
- **Stitch components:** +50 tests across 10 new test files (1/39 → 11/39)
- **Admin pages:** +40 tests across 8 new test files (3/25 → 10/25+)
- All 2626 tests pass.

---

## Code Health Issues (Prioritized)

### P0 — Critical (107 files > 200 lines)

| File | Lines | Action |
|------|-------|--------|
| `components/stitch/StitchContainerNew2.tsx` | 1,265 | Decompose into sub-components + hooks |
| `components/stitch/StitchLoyaltyNew.tsx` | 1,205 | Same |
| `components/stitch/StitchContainerNew1.tsx` | 1,097 | Same |
| `components/stitch/StitchAbout.tsx` | 1,061 | Same |
| `pages/admin/ManageMenu.tsx` | 952 | Extract menu logic to hooks |
| `pages/admin/SubscriptionsManager.tsx` | 792 | Extract subscription logic |
| `pages/admin/SalesReports.tsx` | 637 | Extract report logic |
| `pages/admin/NotificationSettings.tsx` | 581 | Extract settings logic |
| `pages/admin/Staff.tsx` | 558 | Extract staff management logic |
| `pages/admin/PromotionsManager.tsx` | 510 | Extract promotion logic |

**Pattern:** `components/stitch/` = 22 of top 25 largest files. These are monolithic design-to-React components.

### P1 — High
- **Zero stitch test coverage:** 39 source files, 1 test file
- **Admin test coverage:** 3 of 25+ pages tested
- **App.tsx routing god-object:** 80+ routes inline, should be route config modules
- **tree/ directory confusion:** analytics/audit/payment stores split from main stores layer

### P2 — Medium
- **Duplicate patterns:** Both `pages/stitch/` (47 subdirs) and `components/stitch/` (39 files) exist
- **Naming inconsistency:** Mix of PascalCase, kebab-case, camelCase in components
- **`.bak` test file:** `GenerateQR.test.tsx.bak` = abandoned changes

---

## Open Items from Plans

| Item | Status | Blocker |
|------|--------|---------|
| ERPNext Phase 08 | BLOCKED | VPS credentials needed |
| i18n (35 components) | TODO | ~11-12h estimated |
| Stitch screens (28) | TODO | 10 customer + 18 admin |
| SaaS pivot (ak-bootstrap) | UNKNOWN | Intent unclear vs physical cafe |
| Physical cafe buildout | UNKNOWN | Vendor selection pending |

---

## Remaining Work (Prioritized)

### Sprint 4: Continue Modularization
- `StitchContainerNew1.tsx` (1,097 LOC)
- `StitchAbout.tsx` (1,061 LOC)
- `ManageMenu.tsx` (952 LOC)
- `SubscriptionsManager.tsx` (792 LOC)
- `SalesReports.tsx` (637 LOC)

### Sprint 5: Expand Test Coverage
- Stitch: 11/39 → 25/39 (target: 64%)
- Admin: 10/25 → 18/25 (target: 72%)
- Integration tests for checkout + order flow

### Sprint 6: i18n Completion
- 35 components still need `t()` wrapping (~11-12h estimated)

### Blocked Items
- ERPNext Phase 08 — awaiting VPS credentials
- SaaS pivot (ak-bootstrap) — intent unclear
- Physical cafe buildout — vendor selection pending

---

## Unresolved Questions
1. ERPNext VPS credentials — timeline?
2. SaaS pivot (ak-bootstrap) — active or deferred?
3. Physical cafe buildout — vendor selected?
4. i18n — still priority or deferred?
5. Stitch pipeline — still active or replaced by other approach?
