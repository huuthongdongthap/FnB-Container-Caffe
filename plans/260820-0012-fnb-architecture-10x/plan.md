# AURA CAFE — Architecture 10X Improvement Plan

**Date:** 2026-08-20 | **Status:** Phase 3 Complete — Phase 4 in progress | **Scope:** Full-stack F&B architecture audit + improvement

---

## Current State Summary

| Metric | Value | Industry Std |
|--------|-------|-------------|
| Frontend LOC | 89,315 (1180 files) | — |
| Backend LOC | 51,108 (358 files) | — |
| Total LOC | ~140,000 | — |
| Worker route files | 65 | Should be ≤20 modules |
| Zustand stores | 28 (17 user + 11 admin) | Should be ≤15 |
| Stitch components | 346 files | Duplicate UI layers |
| Admin pages | 140 files | Over-fragmented |
| React pages | 42 files | Lazy-loaded ✅ |
| Test files | 27 stitch + ~50 others | Low coverage |
| DB tables | 26 (D1 SQLite) | — |
| API endpoints | ~90+ | No versioning |

---

## CRITICAL GAPS vs F&B Industry Standards

### Gap 1: Monolithic Worker Entry (636 LOC)

**Current:** `worker/src/index.ts` imports 60+ modules, mounts 90+ routes inline.

**Industry Standard:** Hono route groups, max 50 LOC per module.

**Fix:** Split into domain modules: `orders/`, `payments/`, `auth/`, `menu/`, `loyalty/`, `admin/`, `integrations/`.

---

### Gap 2: No Order State Machine

**Current:** Order status is a string field, updated via raw SQL patches.

**Industry Standard:** Finite state machine (FSM) with validated transitions:
```
pending → confirmed → preparing → ready → served → completed
                  ↘ cancelled    ↘ refunded
```

**Fix:** Create `OrderStateMachine` with transition guards, audit trail, and timeout escalations.

---

### Gap 3: No Table-Order Association

**Current:** Orders have `table_id` but no relational integrity. No table status tracking.

**Industry Standard:** Table → Session → Orders hierarchy. Real-time table status (available/seated/ordering/pending-payment).

**Fix:** Add `table_sessions` table, enforce table state transitions, link orders to sessions.

---

### Gap 4: Cart Lacks F&B Essentials

**Current:** Cart has `id, name, price, quantity, modifiers?, notes?`. No addons, no portion sizes, no time-based pricing.

**Industry Standard:**
- Item modifiers (sugar level, ice level, size)
- Add-ons (extra shot, toppings)
- Time-based pricing (happy hour auto-applied)
- Table-aware cart (auto-associate with table session)

**Fix:** Extend CartItem schema, add modifier system, integrate happy hour pricing.

---

### Gap 5: Duplicate UI Layers (Stitch + Regular)

**Current:** 346 Stitch component files coexist with 42 regular page files. Two menu pages (StitchMenuNew, StitchMenu2New), two order pages, etc.

**Industry Standard:** Single component library, no duplicate implementations.

**Fix:** Consolidate to Stitch-only, delete legacy pages, unify component naming.

---

### Gap 6: No Kitchen Routing

**Current:** KDS shows all orders to all stations. No station assignment.

**Industry Standard:** Items routed to stations (coffee station, food station, bar) based on category.

**Fix:** Add `kitchen_stations` table, route items by category, station-specific KDS views.

---

### Gap 7: No Proper POS for Staff

**Current:** `StitchPOSNew` exists but lacks: quick-add, table switching, hold/recall, split payment.

**Industry Standard:** One-touch reorder, table grid view, quick product grid, receipt printing.

**Fix:** Enhance POS with full staff workflow.

---

### Gap 8: No Tip Management

**Current:** No tip field anywhere in order or payment flow.

**Industry Standard:** Pre-set tip percentages (10%, 15%, 20%, custom), tip tracking, staff tip distribution.

**Fix:** Add tip to order schema, UI selectors, daily tip reports.

---

### Gap 9: No Real-time Capacity Management

**Current:** Reservations exist but no real-time table occupancy tracking.

**Industry Standard:** Live floor plan, table status colors, auto-release after timeout, walk-in vs reservation management.

**Fix:** WebSocket-driven table status, auto-timeout, capacity dashboard.

---

### Gap 10: API Has No Versioning

**Current:** All routes under `/api/` with no version prefix.

**Industry Standard:** `/api/v1/`, `/api/v2/` for breaking changes.

**Fix:** Introduce `/api/v1/` prefix, keep `/api/` as alias for backward compat.

---

### Gap 11: No Order Type Unification

**Current:** Dine-in, takeaway, delivery handled by separate code paths.

**Industry Standard:** Single order model with `type` field, type-specific behavior via strategy pattern.

**Fix:** Unify order creation, add `order_type` enum, type-specific fields (delivery_address, pickup_time).

---

### Gap 12: No Split Bill in Cart

**Current:** `splitOrders` exists in backend but no cart-level split support.

**Industry Standard:** Select items → assign to person → pay individually.

**Fix:** Add split-bill UI flow, per-person subtotals, individual payment.

---

### Gap 13: No Proper Error Boundaries

**Current:** Single `React.Suspense` in App.tsx, no error boundaries per route.

**Industry Standard:** Error boundaries per major section, graceful fallbacks.

**Fix:** Add `ErrorBoundary` per route group, retry mechanisms.

---

### Gap 14: i18n Incomplete

**Current:** Only `vi`/`en` routes. Hardcoded Vietnamese strings in components.

**Industry Standard:** Full i18n with fallback chains, no hardcoded strings.

**Fix:** Extract all strings to i18n files, add `useTranslation()` everywhere.

---

### Gap 15: No Proper Loading States

**Current:** Mix of skeletons, spinners, and empty divs.

**Industry Standard:** Consistent skeleton screens per page type, progressive loading.

**Fix:** Create skeleton component library, standardize loading patterns.

---

## Improvement Phases

### Phase 1: Architecture Foundation (Week 1-2)

**Goal:** Clean architecture, reduce complexity, prepare for F&B features.

| # | Task | LOC Delta | Risk |
|---|------|-----------|------|
| 1.1 | Split `worker/src/index.ts` into domain modules | +0 (reorg) | Low | ✅ done |
| 1.2 | Add `/api/v1/` versioning prefix | +20 | Low | ✅ done |
| 1.3 | Create `OrderStateMachine` with transition guards | +150 | Medium | ✅ done |
| 1.4 | Add `ErrorBoundary` per route group | +80 | Low | ✅ done |
| 1.5 | Delete duplicate Stitch pages (keep one version) | -2000 | Low | ✅ done |
| 1.6 | Consolidate stores (28 → 15) | -500 | Medium | ✅ done |

---

### Phase 2: F&B Core Features (Week 3-4)

**Goal:** Implement missing F&B essentials.

| # | Task | LOC Delta | Risk |
|---|------|-----------|------|
| 2.1 | Table-Order association + `table_sessions` table | +400 | Medium | ✅ done |
| 2.2 | Cart modifier/addon system | +300 | Low | ✅ done |
| 2.3 | Time-based pricing (happy hour auto-apply) | +150 | Low | ✅ done |
| 2.4 | Kitchen station routing | +350 | Medium | ✅ done |
| 2.5 | Order type unification (dine-in/takeaway/delivery) | +200 | Medium | ✅ done |
| 2.6 | Tip management | +200 | Low | ✅ done |

---

### Phase 3: Staff Operations (Week 5-6)

**Goal:** Complete staff-facing features.

| # | Task | LOC Delta | Risk |
|---|------|-----------|------|
| 3.1 | Enhanced POS (quick-add, hold/recall) | +500 | Medium | ✅ done |
| 3.2 | Split bill UI flow | +300 | Low | ✅ done |
| 3.3 | Real-time floor plan with table status | +400 | Medium | ✅ done |
| 3.4 | Station-specific KDS views | +250 | Low | ✅ done |
| 3.5 | Staff tip tracking + daily reports | +200 | Low | ✅ done |

---

### Phase 4: Quality & Polish (Week 7-8)

**Goal:** Production hardening.

| # | Task | LOC Delta | Risk |
|---|------|-----------|------|
| 4.1 | Full i18n extraction (vi/en) | +120 | Low | ✅ done |
| 4.2 | Consistent skeleton/loading states | +200 | Low | ✅ done |
| 4.3 | Fix 12 deferred audit findings | +300 | Medium | ✅ done |
| 4.4 | E2E tests for critical flows | +800 | Low | ✅ done |
| 4.5 | Performance optimization (bundle analysis) | -20 | Low | ✅ done |
| 4.3 | Audit findings triage (CSP / XSS / i18n / perf / a11y) | +20 | Low | ✅ done |

---

## Execution Order

```
Phase 1 (Foundation) → Phase 2 (F&B Core) → Phase 3 (Staff Ops) → Phase 4 (Quality)
```

Each phase produces deployable increments. No big-bang rewrite.

---

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Worker modules | 65 files | ≤20 domain modules |
| Zustand stores | 28 | ≤15 consolidated |
| Duplicate components | 346 Stitch + 42 regular | Single library |
| Order state transitions | String patch | FSM with audit |
| Cart modifiers | None | Full modifier/addon system |
| Kitchen routing | None | Station-based routing |
| Tip management | None | Full tip flow |
| i18n coverage | ~30% | 100% |
| E2E test coverage | 0 flows | All critical paths |

---

## Unresolved Questions

1. Should we keep Stitch as the UI framework or migrate to a standard component library (shadcn/ui)?
2. ERPNext integration is blocked on credentials — should we build a mock mode?
3. Multi-tenant architecture — is this needed for v3.x or defer to v4?
4. Mobile app — PWA sufficient or need React Native wrapper?

---

*Plan created: 2026-08-20 00:30 ICT*
