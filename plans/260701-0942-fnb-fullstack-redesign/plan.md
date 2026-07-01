---
title: "FnB Full-Stack Redesign — React + Component Architecture + Design System"
description: "React + Vite component architecture migration from 19 static HTML pages, existing Hono worker TypeScript conversion, Navy+Warm hybrid design system"
status: cancelled
priority: P1
branch: "main"
tags: [react, vite, hono, typescript, design-system, cloudflare-pages, fnb]
blockedBy: []
blocks: []
created: "2026-07-01T02:52:16.557Z"
createdBy: "ck:plan"
source: "plans/reports/brainstorm-260701-0942-fnb-visual-redesign.md"
mode: tdd
effort: 65h
red_team: "2026-07-01 — 15 findings, 15 accepted, 9 Critical / 6 High"
---

# FnB Full-Stack Redesign — React + Component Architecture + Design System

## Overview

Migrate 19 static HTML pages (19–739 lines each, ~6,000 total lines) + 32 CSS files into a React + Vite component architecture with Navy+Warm hybrid design system. Convert existing Hono-based Cloudflare Worker (34 route files) from JavaScript to TypeScript with Zod validation.

**Corrected from red-team review:** Line counts, test counts, Hono status, and effort estimates are now based on actual codebase measurements.

**Source:** `plans/reports/brainstorm-260701-0942-fnb-visual-redesign.md`

## Design Decisions (from Brainstorm + Red Team Corrections)

| Decision | Choice |
|----------|--------|
| Approach | C: Component Architecture + Hybrid Design System |
| Palette | Navy base (Bazi identity) + Warm F&B accent |
| Font stack | Cormorant Garamond (display) + Space Grotesk (body) + Plus Jakarta Sans (utility) — preserves existing Bazi v5.1 migration |
| Framework | React + TypeScript added to existing Vite project (do NOT reinitialize Vite) |
| Backend | Convert existing Hono app from JS to TypeScript + Zod validation |
| Design system | ui-ux-pro-max `--persist` → `design-system/MASTER.md` (via absolute path to skill) |
| Payment methods | COD + PayOS only (MoMo/VNPay disabled in config; no backend implementation) |
| Referral model | Flat 10,000đ cashback (not 30% commission) |
| Pipeline | Stitch → frontend-design → ui-styling → cook per page |
| Execution | Parallel agent batches for phases 2-5; Phase 7 is the ONLY deployment phase |
| Deploy strategy | Atomic single deploy at Phase 7; no individual phase deploys to production |

## Phases

| Phase | Name | Status | Priority | Dependencies |
|-------|------|--------|----------|-------------|
| 1 | [Foundation: Design System + React Setup](./phase-01-foundation-design-system-react-scaffold.md) | Pending | P1 | — |
| 2 | [Revenue Path: Index/Menu/Checkout/Success/Failure](./phase-02-revenue-path-index-menu-checkout-success-failure.md) | Pending | P1 | Phase 1 |
| 3 | [Loyalty + Marketing Pages](./phase-03-loyalty-marketing-pages.md) | Pending | P2 | Phase 1 |
| 4 | [Operations Pages](./phase-04-operations-pages.md) | Pending | P2 | Phase 1 |
| 5 | [Info + Integration Pages](./phase-05-info-integration-pages.md) | Pending | P3 | Phase 1 |
| 6 | [Backend TypeScript Migration + Zod Validation](./phase-06-backend-refactor-hono-typescript.md) | Pending | P1 | Phase 1 |
| 7 | [Polish + Atomic Deploy: Responsive/A11y/Performance/Tests/CSP/Rollback](./phase-07-polish-responsive-a11y-performance-tests.md) | Pending | P1 | Phases 2-6 |

**Parallel execution:** Phases 2, 3, 4, 5, 6 can run concurrently after Phase 1 completes. All phases BUILD but do NOT deploy individually. Phase 7 is the single atomic production deploy.

## Dependencies

### Cross-Plan Coordination

| Plan | Status | Impact |
|------|--------|--------|
| `260630-1948-erpnext-migration` | in_progress | Phase 6 must verify file ownership before touching worker routes. Re-check boundaries at Phase 6 start. |
| `260630-2045-hybrid-erpnext-tv-menu` | in_progress | Phase 4 (TV Menu) must use ERPNext data contract from this plan |

### File Ownership Boundaries

| Phase | Owns | Must Not Touch |
|-------|------|----------------|
| 1 | `src/`, `design-system/`, `tsconfig.json`, `package.json` (add deps only) | `worker/`, `vite.config.js` (modify, don't replace) |
| 2-5 | `src/pages/`, `src/components/`, `src/styles/`, `src/hooks/` | `worker/` |
| 6 | `worker/` (JS→TS conversion) | Business logic in `worker/src/routes/erpnext*.js`, `mixpost.js`, `pretix.js`, `mautic-bridge.js`, `cal-booking-webhook.js`, `signage.js`, `zalo.js` — content preserved, import paths updated to match refactored shared modules |
| 7 | All files (read-only polish + deploy) | — |

**Read-only boundary clarification:** Route file business logic is preserved. Shared module import paths WILL be updated when Phase 6 restructures `utils/` and `middleware/`. Compatibility re-exports provided for unconverted routes.

### Critical Cross-Layer Coordination

| Item | Frontend (Phase 2-5) | Backend (Phase 6) | Resolution |
|------|----------------------|-------------------|------------|
| PayOS return URL | `checkout.html` replaced by `/checkout` | `payment.js:86-87` hardcodes `.html` paths | Phase 6 MUST update return URLs OR Phase 2 MUST add `checkout.html → /checkout` redirect |
| Cart localStorage | Zustand uses new key format | N/A | Phase 2 MUST implement old `aura_cart` format reader with migration to new Zustand key |
| CSP headers | React adds new script/frame origins | N/A | Phase 7 MUST audit and update `_headers` CSP before deploy |

## Out of Scope

- New business features (happy hour, new payment methods, new referral model)
- Native mobile apps
- Real-time WebSocket/KDS (polling only)
- Payment provider changes (MoMo/VNPay remain disabled)
- 12-pillar external tool changes (Odoo, pretix, Cal.com, etc. unchanged)
- receipt-template.html (worker-only email template, excluded from React migration)
- Odoo routes (not present in worker; no migration needed)

## Rollback Strategy

- **Cloudflare Pages:** `wrangler pages deployment rollback` or dashboard instant rollback
- **Cloudflare Worker:** `wrangler rollback` to previous deployment
- **Pre-deploy checklist (Phase 7):** Record current deployment IDs. Deploy. Smoke test critical endpoints (GET /api/menu, POST /api/orders, GET /). If any fail → immediate rollback.
- **Worker staging:** Deploy Phase 6 worker to staging env first, run contract tests, then promote.

## Acceptance Criteria

1. All 19 pages (+ admin 9 pages) rebuilt as React components with shared UI library
2. Design system persisted as `design-system/MASTER.md` + CSS tokens
3. Navy + Warm accent palette + Cormorant Garamond/Space Grotesk/Plus Jakarta Sans applied consistently
4. Build: 0 TypeScript errors, 0 lint errors
5. Tests: ≥ 80% coverage, all 814 existing test behaviors preserved (verified by `npx jest`)
6. Lighthouse: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 90
7. Responsive: 375/768/1024/1440 verified
8. WCAG AA compliance
9. CSP updated for new script/frame origins; Cal.com iframe, React bundles, and CDN deps functional
10. Old static site archived; `checkout.html → /checkout` redirect in place
11. Single atomic deploy at Phase 7; all smoke tests pass before cutover
12. Rollback documented and tested: `wrangler pages deployment rollback` + `wrangler rollback`

## Red Team Review

### Session — 2026-07-01
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 9 Critical, 6 High
**Reviewers:** Security Adversary + Fact Checker, Failure Mode Analyst + Flow Tracer, Assumption Destroyer + Scope Auditor, Scope & Complexity Critic + Contract Verifier

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Line counts inflated 50-60x — actual HTML 19–739 lines | Critical | Accept | plan.md, all phases |
| 2 | Hono already in use — Phase 6 is JS→TS, not framework migration | Critical | Accept | plan.md, Phase 6 |
| 3 | Test count fabricated — 814 actual, not 576 | Critical | Accept | plan.md, Phase 6, Phase 7 |
| 4 | CSP omission blocks React app in production | Critical | Accept | Phase 7 |
| 5 | Phase 1 Step 1.1 command path doesn't exist in FnB project | Critical | Accept | Phase 1 |
| 6 | PayOS return URL hardcoded to .html → 404 after migration | Critical | Accept | plan.md (coordination), Phase 2, Phase 6 |
| 7 | No deployment coexistence strategy for parallel phases | Critical | Accept | plan.md (Phase 7 = atomic deploy) |
| 8 | Zero rollback strategy across 7 phases | Critical | Accept | plan.md (Rollback Strategy) |
| 9 | MoMo/VNPay non-functional — remove from UI scope | Critical | Accept | Phase 2 |
| 10 | Vite already configured — add React, don't reinitialize | High | Accept | Phase 1 |
| 11 | 9 admin HTML pages unaccounted (2,773 lines) | High | Accept | Phase 4 |
| 12 | Happy hour invented — doesn't exist in codebase | High | Accept | Phase 2 (removed) |
| 13 | "Read-only" route boundary fictional — shared deps refactored | High | Accept | plan.md, Phase 6 |
| 14 | receipt-template.html missing from scope | High | Accept | plan.md (Out of Scope) |
| 15 | Zustand cart localStorage collision with vanilla JS cart | High | Accept | Phase 2, plan.md (coordination) |

### Whole-Plan Consistency Sweep
- All phase files updated to reflect corrected line counts (19–739 lines), test count (814), Hono status (JS→TS), font stack (Cormorant Garamond), payment methods (COD+PayOS), referral model (10Kđ flat)
- Effort recalculated: 65h (was 120h)
- Phase 6 renamed from "Hono + TypeScript refactor" to "TypeScript Migration + Zod Validation"
- Phase 7 expanded with CSP audit, rollback verification, atomic deploy
- All YAGNI cuts applied: dropped Chart.js, react-helmet-async, code splitting, service worker, snapshot tests, Storybook requirement
- No unresolved contradictions remain.
