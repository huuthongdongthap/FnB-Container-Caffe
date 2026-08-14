# Brainstorm: Next Phase — AURA CAFE

**Date:** 2026-08-14 | **After:** Sprints 1-6 + Stitch P0-P2 complete

---

## Current State

| Metric | Value |
|--------|-------|
| Production | v3.1.0 (Cloudflare Pages + Workers + D1) |
| Tests | 2914/2914 (0 failures, 312 files) |
| Stitch coverage | 34/39 (87.2%) |
| Admin coverage | 10/25+ (40%) |
| Files >200 LOC | ~55 (down from 107) |
| Modularized files | 8 (Sprint 2+4) |
| Pillars complete | 7/12 (Cal.com, pretix, Xibo, Mautic, Mixpost, Pay, SMTP) |
| Pillars blocked | ERPNext (VPS credentials) |
| Pillars unstarted | OpenWISP, TastyIgniter, Home Assistant, Frigate (~100h) |

---

## Option Analysis

### Option A: Modularization Sprint 3 — Stitch Mega-Components

**What:** Break down remaining 8 stitch files 500+ LOC into <200 LOC modules.

| File | LOC | Extractable |
|------|-----|-------------|
| StitchEventsNew2 | 928 | types, hooks, cards, timeline, form, empty |
| StitchLandingNew | 921 | hero, features, zones, cta, types |
| StitchReferralNew2 | 919 | rewards, steps, form, types |
| StitchOrderSuccessNew | 894 | summary, items, tracking, confetti |
| StitchOrderMgmtNew | 884 | filters, table, status-badge, types |
| StitchReviewsNew | 875 | list, form, rating, types |
| StitchKDSNew | 872 | orders, status-board, timer, types |
| StitchStoryNew | 871 | timeline, values, team, types |

**Effort:** 6-8h | **Risk:** Low | **Impact:** High — prerequisite for all future maintenance

### Option B: Integration Tests — Order Flow + Checkout

**What:** End-to-end tests covering the critical money path: menu → cart → checkout → payment → order → KDS.

**Effort:** 4-6h | **Risk:** Medium | **Impact:** High — catches regression in revenue-critical flow

### Option C: Unblocked Pillar Integration — TastyIgniter + Home Assistant

**What:** Wire up remaining open-source pillars (100h total, but2 smaller ones are quick wins):
- Home Assistant (15h) — IoT sensor data, ambiance control
- TastyIgniter (35h) — full F&B ordering engine alternative

**Effort:**50h | **Risk:** High | **Impact:** Medium — pillars are mostly research/integration, not blocking production

### Option D: ERPNext Phase 08 — Unblocking

**What:** Resolve ERPNext VPS credentials, complete the final integration phase.

**Effort:** 8-12h | **Risk:** High (blocked on external factor) | **Impact:** High — completes the ERP backbone

### Option E: i18n Completion — Full Internationalization

**What:** Wrap remaining35 components with `t()` calls for Vietnamese + English support.

**Effort:** 11-12h | **Risk:** Medium | **Impact:** Medium — enables bilingual production

### Option F: Admin Test Coverage Expansion

**What:** Expand from10/25+ to18/25+ admin pages tested.

**Effort:** 4-6h | **Risk:** Low | **Impact:** Medium — reduces admin regression risk

---

## Recommendation: Option A + B (Sequential)

**Rationale:**

1. **Modularization (A) is foundational** — 8 files at 870-928 LOC each are time bombs for future work. Every feature addition or bug fix in these files is painful. Breaking them down first makes everything else easier.

2. **Integration tests (B) protect revenue** — the checkout/payment/order flow is the money path. Unit tests cover components in isolation; integration tests catch cross-component state bugs that would lose real orders.

3. **Why not pillars (C/D):** ERPNext is blocked on external credentials. TastyIgniter + Home Assistant are 50h of infra work that doesn't affect the current production site. They're Q3-Q4 roadmap items, not immediate priorities.

4. **Why not i18n (E):** The35 unwrapped components are non-critical UI polish. The i18n mock pattern is established; this can be batched later without risk.

5. **Why not admin tests (F):** Already at40% — good enough for now. The stitch components (87%) are the better-tested surface.

---

## Proposed Execution Order

```
Sprint 7: Modularization Sprint 3 (8 stitch mega-components)
  └── Break 8 files into <200 LOC modules
  └── Verify: 0 TS errors, all tests pass

Sprint 8: Integration Tests (order flow E2E)
  └── Menu → Cart → Checkout → Payment → Order → KDS
  └── Mock worker API responses
  └── Verify: new integration test suite passes

Sprint 9: Remaining Admin Tests (optional)
  └── Expand from10/25+ to18/25+
  └── Verify: all tests pass
```

---

## Unresolved Questions

1. **ERPNext VPS credentials** — timeline? This blocks 45h of pillar integration work.
2. **TastyIgniter vs existing order system** — is TastyIgniter replacing the current POS or supplementing it?
3. **Home Assistant** — what specific IoT integrations are needed for a container café?
4. **i18n priority** — does the café need bilingual support at launch, or is Vietnamese-only sufficient?
