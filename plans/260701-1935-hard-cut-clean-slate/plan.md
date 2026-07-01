---
title: "Hard Cut + Clean Slate — React SPA Unification"
description: "Delete ~52 legacy static HTML files + ~83 dead CSS/JS files. Migrate 41 worker JS→TypeScript + Zod. Fix 60 unit + 28 E2E failures. Atomic Cloudflare Pages deploy."
status: pending
priority: P1
branch: "main"
tags: [react, spa, cleanup, typescript, vitest, cloudflare-pages, tdd, hard-cut]
blockedBy: []
blocks: []
created: "2026-07-01T12:35:54.684Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260701-1856-hard-cut-clean-slate.md"
mode: tdd
effort: 27-42h
supersedes:
  - "260701-0942-fnb-fullstack-redesign"
  - "260701-1259-housekeeping-sprint"
  - "260701-1655-x100-design-polish"
---

# Hard Cut + Clean Slate — React SPA Unification

## Overview

React SPA already has ~95% page parity (27 pages, 85 components). Static HTML + legacy CSS/JS = dead weight. This plan deletes the legacy layer (preserving production digital signage), finishes backend TypeScript migration, fixes all tests, and deploys atomically.

**Source:** `plans/reports/brainstorm-260701-1856-hard-cut-clean-slate.md`

## Key Numbers

| Metric | Before | After |
|--------|--------|-------|
| Static HTML files | 46 | 1 (`index.html` Vite entry) + 3 (signage-widgets preserved) |
| CSS files in `css/` | 32 | 0 |
| JS files in `js/` | 35 | 0 |
| Backend JS files | 41 | 0 |
| Test runner | Jest (current) | Vitest (after Phase 4) |
| `!important` count | 212 | <50 |
| Unit test failures | 60 | 0 |
| E2E test failures | TBD (capture in Phase 1) | 0 |
| Codebase size | ~100% | ~70% (↓30%) |

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Audit & Inventory](./phase-01-audit-inventory.md) | Pending | 2-3h |
| 2 | [Hard Cut — Remove Legacy](./phase-02-hard-cut-remove-legacy.md) | Pending | 3-4h |
| 3 | [Backend TypeScript Migration](./phase-03-backend-typescript-migration.md) | Pending | 12-18h |
| 4 | [Fix Tests → Green CI](./phase-04-fix-tests-green-ci.md) | Pending | 8-12h |
| 5 | [Atomic Deploy + Verify](./phase-05-atomic-deploy-verify.md) | Pending | 2-3h |

## Dependencies

Phases are strictly sequential:
- **Phase 1 (Audit)** must complete before Phase 2 (need inventory to know what to delete)
- **Phase 2 (Hard Cut)** must complete before Phase 3 (worker tests need clean file tree)
- **Phase 3 (Backend TS)** must complete before Phase 4 (tests must pass against final TS code)
- **Phase 4 (Fix Tests)** must complete before Phase 5 (green CI is deploy gate)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Delete vs archive legacy | Delete | Git history preserves old files. No dual-maintenance. |
| `_redirects` wildcard | `/*.html /:splat 301` | Single line covers all 30+ legacy URLs |
| Jest→Vitest migration | Full migration, delete Jest | Vitest already works (417/418 pass). Jest CJS can't parse TS `export` |
| Backend TS conversion | Incremental leaf-first | Convert files with 0 deps first, work up dependency chain |
| Zod validation | Split from Phase 3 | Core TS conversion first. Zod deferred to follow-up plan to de-risk deploy gate |
| homepage-v6.css | Delete entirely | Loaded by 4 static HTML only. React SPA uses Tailwind v4 |
| `--tdd` | Tests before each phase | Lock current behavior, refactor, verify no regression |
| Deploy | `bash deploy-cloudflare.sh` | Project's existing deploy script. Cloudflare Pages atomic swap |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| External links to .html URLs break | Medium | `_redirects` 301 covers all .html → SPA route |
| Admin direct access needed | Medium | React SPA already serves `/admin/*` routes |
| Third-party scripts reference legacy files | Low | Grep all JS for `.html` refs before delete |
| Deploy breaks production | High | Atomic deploy + SHA verify + flow walkthrough |
| homepage-v6.css visual regression | Low | React SPA uses Tailwind v4, never loaded homepage-v6.css |

## Success Metrics

- `npm run build` → 0 errors
- `npm test` → 646/646 pass (0 failures)
- `npx playwright test` → all pass (count captured in Phase 1)
- Static HTML deleted: 49 files
- Legacy CSS deleted: 48 files
- Legacy JS deleted: 35 files
- `!important` count: 212 → <50
- Codebase: ~30% smaller
- Production deployed + verified via `bash deploy-cloudflare.sh`
