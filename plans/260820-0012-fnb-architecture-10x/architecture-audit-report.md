# AURA CAFE — Architecture Audit Report

**Date:** 2026-08-20 | **Scope:** Full-stack F&B architecture review | **Status:** Complete

---

## Executive Summary

AURA CAFE is a production-grade F&B system with **~140,000 LOC** across frontend (89K) and backend (51K). It has 90+ API endpoints, 26 D1 tables, 65 route modules, and 28 Zustand stores. While functionally complete, it has **15 critical gaps** compared to modern F&B cafe standards.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React SPA (Vite + TS) — 1180 files, 89K LOC          │  │
│  │  - 28 Zustand stores                                   │  │
│  │  - 346 Stitch components + 42 regular pages            │  │
│  │  - 27 routes, lazy-loaded                             │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    Cloudflare Worker                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Hono app — 358 files, 51K LOC                        │  │
│  │  - 65 route modules (single index.ts: 636 LOC)        │  │
│  │  - 26 D1 tables, 5 migrations                         │  │
│  │  - 12 integration pillars (ERPNext, pretix, Mautic...) │  │
│  │  - 90+ API endpoints, no versioning                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Top 15 Gaps vs F&B Industry Standards

| # | Gap | Severity | Effort | Impact |
|---|-----|----------|--------|--------|
| 1 | Monolithic worker entry (636 LOC) | 🔴 Critical | 2d | Hard to maintain, risk of conflicts |
| 2 | No order state machine | 🔴 Critical | 3d | Invalid transitions, lost orders |
| 3 | No table-order association | 🔴 Critical | 3d | No real-time table status |
| 4 | Cart lacks modifiers/add-ons | 🟡 High | 3d | Poor customer experience |
| 5 | Duplicate UI layers (346 Stitch + 42 regular) | 🟡 High | 2d | Confusion, maintenance burden |
| 6 | No kitchen station routing | 🟡 High | 3d | Inefficient kitchen ops |
| 7 | No proper POS for staff | 🟡 High | 4d | Slow order processing |
| 8 | No tip management | 🟡 High | 2d | Revenue leakage |
| 9 | No real-time capacity management | 🟡 High | 3d | Poor table utilization |
| 10 | API has no versioning | 🟠 Medium | 1d | Breaking changes risky |
| 11 | Order type unification needed | 🟠 Medium | 3d | Code duplication |
| 12 | No split bill in cart | 🟠 Medium | 3d | Poor group dining experience |
| 13 | No proper error boundaries | 🟠 Medium | 1d | Bad UX on failures |
| 14 | i18n incomplete (~30%) | 🟠 Medium | 3d | Limited to Vietnam |
| 15 | No proper loading states | 🟢 Low | 2d | Poor perceived performance |

---

## Improvement Plan: 8 Weeks, 4 Phases

### Phase 1: Architecture Foundation (Week 1-2)
- Split worker into 20 domain modules
- Add `/api/v1/` versioning
- Create OrderStateMachine
- Add error boundaries per route
- Delete duplicate Stitch pages
- Consolidate 28 stores → 15

### Phase 2: F&B Core Features (Week 3-4)
- Table-Order association + table_sessions
- Cart modifier/addon system
- Time-based pricing (happy hour)
- Kitchen station routing
- Order type unification
- Tip management

### Phase 3: Staff Operations (Week 5-6)
- Enhanced POS (quick-add, hold/recall)
- Split bill UI flow
- Real-time floor plan
- Station-specific KDS views
- Staff tip tracking

### Phase 4: Quality & Polish (Week 7-8)
- Full i18n extraction (155 strings)
- Consistent skeleton/loading states
- Fix 12 deferred audit findings
- E2E tests for 5 critical flows
- Performance optimization

---

## Expected Results

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
| Bundle size | Unknown | <500KB total |

---

## Unresolved Questions

1. **Stitch vs standard components:** Should we keep Stitch as the UI framework or migrate to shadcn/ui?
2. **ERPNext integration:** Blocked on credentials — build mock mode?
3. **Multi-tenant architecture:** Needed for v3.x or defer to v4?
4. **Mobile app:** PWA sufficient or need React Native wrapper?

---

*Audit completed: 2026-08-20 00:30 ICT*