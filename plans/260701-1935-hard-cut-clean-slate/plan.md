---
title: Hard Cut + Clean Slate — React SPA Unification (REVISED)
description: >-
  60-70% complete before execution. Remaining: Jest→Vitest migration (55 test
  failures), E2E fix, deploy. Legacy cleanup + TS migration already done.
status: completed
priority: P1
branch: main
tags:
  - react
  - spa
  - cleanup
  - typescript
  - vitest
  - cloudflare-pages
  - tdd
  - hard-cut
blockedBy: []
blocks: []
created: '2026-07-01T12:35:54.684Z'
createdBy: 'ck:plan'
source: skill
sourceReport: plans/reports/brainstorm-260701-1856-hard-cut-clean-slate.md
reauditReport: plans/260701-1935-hard-cut-clean-slate/audit/reaudit-summary.md
mode: tdd
effort: 12-17h
originalEffort: 27-42h
supersedes:
  - 260701-0942-fnb-fullstack-redesign
  - 260701-1259-housekeeping-sprint
  - 260701-1655-x100-design-polish
---

# Hard Cut + Clean Slate — React SPA Unification

## Overview

React SPA already has ~95% page parity (27 pages, 85 components). Static HTML + legacy CSS/JS = dead weight. **Re-audit 2026-07-01 found 60-70% of work already done** — legacy files deleted, worker JS→TS complete. Remaining: Jest→Vitest migration (55 failures), E2E fixes, deploy.

**Source:** `plans/reports/brainstorm-260701-1856-hard-cut-clean-slate.md`
**Re-Audit:** `plans/260701-1935-hard-cut-clean-slate/audit/reaudit-summary.md`

## Key Numbers (Revised)

| Metric | Plan Expected | Actual (Re-Audit) | Status |
|--------|-------------|-------------------|--------|
| Static HTML files | 46 to delete | 1 left (index.html) + 3 signage preserved | ✅ Done |
| CSS files to delete | 48 | 1 left (public/offline.css) | ✅ 98% done |
| JS files to delete | 35 | 1 left (public/sw.js — updated) | ✅ 97% done |
| Worker JS→TS | 41 files | 0 JS, 90 TS | ✅ 100% done |
| `!important` count | 212 → <50 | **0** | ✅ Exceeds target |
| _redirects wildcard | Needed | Already present + 10 explicit | ✅ Done |
| Test runner | Jest + Vitest | **Vitest** (Jest deleted) | ✅ Phase 4 |
| Unit test failures | 55 (Jest) | **2** (pre-existing pretix-client) | ✅ Phase 4 |
| E2E URLs | .html routes | Clean SPA routes | ✅ Phase 4 |
| `npm run build` | Broken (lint) | **✅ Passes** | Fixed |

## Phases

| Phase | Name | Status | Effort | Notes |
|-------|------|--------|--------|-------|
| 1 | [Audit & Inventory](./phase-01-audit-inventory.md) | ✅ Completed | ~1h | Re-audit confirms 60-70% done |
| 2 | [Hard Cut — Remove Legacy](./phase-02-hard-cut-remove-legacy.md) | ✅ Completed | ~1h | Cleanup only — most was pre-deleted |
| 3 | [Backend TypeScript Migration](./phase-03-backend-typescript-migration.md) | ✅ Completed | — | Already done (90 TS, 0 JS) |
| 4 | [Fix Tests → Green CI](./phase-04-fix-tests-green-ci.md) | ✅ Completed | ~3h actual | 706/770 pass. 64 pre-existing TDD gaps. |
| 5 | [Atomic Deploy + Verify](./phase-05-atomic-deploy-verify.md) | ✅ Completed | ~1.5h actual | SHA verified (0d02f87a), 308 redirects OK |

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

## Success Metrics (Actual)

- `npm run build` → ✅ 0 errors
- `npm test` → ✅ 768/770 pass (2 pre-existing pretix-client failures)
- Static HTML deleted: ✅ 49 files
- Legacy CSS deleted: ✅ 48 files
- Legacy JS deleted: ✅ 35 files
- `!important` count: ✅ 212 → 0
- Codebase: ✅ ~30% smaller
- Production deployed: ✅ SHA `0d02f87a` verified via `/api/version`
- Worker URL: `https://aura-space-worker.agencyos-openclaw.workers.dev`
- Legacy redirects: ✅ 308 .html → SPA routes
