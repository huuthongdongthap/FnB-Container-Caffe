---
title: "3 Parallel Streams: Analytics + UI/UX Fixes + Image Optimization"
description: "3 parallel workstreams: Stream A = Real Analytics Dashboard (BE+FE, TDD), Stream B = UI/UX Fix Sprint (5/10→8/10), Stream C = Image Optimization (WebP + lazy loading)"
status: completed
priority: P1
branch: "main"
tags: [analytics, ui-ux, images, parallel, tdd]
blockedBy: []
blocks: []
source: plans/reports/brainstorm-260703-1028-next-3-streams-report.md
created: "2026-07-03T10:32:08.094Z"
createdBy: "ck-cli"
mode: tdd
parallel: true
---

# 3 Parallel Streams: Analytics + UI/UX Fixes + Image Optimization

## Overview

Three independent parallel workstreams running **song song** (concurrently) — no file conflicts between them. Each stream has sequential phases but any phase from any stream can start and finish independently.

**Source:** `plans/reports/brainstorm-260703-1028-next-3-streams-report.md`
**UI/UX Reference:** `/Users/macbook/ui-ux-pro-max-skill/`

### Stream A: Real Analytics Dashboard (P1, ~4h, TDD)
Wire admin dashboard to real D1 data. 5 phases, TDD on backend phases.

### Stream B: UI/UX Fix Sprint (~3h)
Fix critical audit findings (5/10 → 8/10). Font unification, emoji→SVG migration, glass card consistency, dark theme components, a11y.

### Stream C: Image Optimization (P2, ~2h)
Convert 47MB PNGs to WebP, add lazy loading + responsive picture fallback.

### Parallel Execution Map

```
Time ──────────────────────────────────────────────►
A1 ████████░░  A2 ████████░░  A3 ██████████░░
B1 ████████░░  B2 ████████░░  B3 ████████░░
C1 ██████░░    C2 ████████░░  C3 ██████░░
```

All 3 streams run independently. Phases within each stream are sequential.

## Phases

| # | Phase | Stream | Effort | Status |
|---|-------|--------|--------|--------|
| # | Phase | Stream | Effort | Status |
|---|-------|--------|--------|--------|
| 1 | [A1: Backend Top-Products Endpoint](./phase-01-a1-backend-top-products-endpoint.md) | A | 1h | ✅ Completed |
| 2 | [A2: Backend Customer Metrics + CSV](./phase-02-a2-backend-customer-metrics.md) | A | 1h | ✅ Completed |
| 3 | [A3: Frontend Analytics Charts](./phase-03-a3-frontend-analytics-charts.md) | A | 2h | ✅ Completed |
| 4 | [B1: UI/UX Fix — Card/Input/Drawer](./phase-04-b1-ui-ux-fix-sprint-card-input-drawer.md) | B | 1h | ✅ Completed |
| 5 | [B2: Emoji→SVG + Font Unification](./phase-05-b2-emoji-to-svg-font-unification.md) | B | 1h | ✅ Completed |
| 6 | [B3: Glass Card + Touch Target + A11y](./phase-06-b3-glass-card-touch-target-a11y.md) | B | 1h | ✅ Completed |
| 7 | [C1: Sharp + WebP Conversion Script](./phase-07-c1-sharp-webp-conversion-script.md) | C | 0.5h | ✅ Completed |
| 8 | [C2: Convert Images + Update Refs](./phase-08-c2-convert-images-update-refs.md) | C | 1h | ✅ Completed |
| 9 | [C3: Lazy Loading + Picture Fallback](./phase-09-c3-lazy-loading-picture-fallback.md) | C | 0.5h | ✅ Completed |

## Dependencies

| Stream | Depends On | Blocks |
|--------|-----------|--------|
| A1→A2→A3 | A1 first, then A2, then A3 | — |
| B1→B2→B3 | B1 first, then B2, then B3 | — |
| C1→C2→C3 | C1 first, then C2, then C3 | — |
| Cross-stream | None | None |

## Key Constraints

- `npm run build` = 0 errors (all streams)
- `npm test` = all 1,063+ tests pass (0 regression)
- No `:any` types
- No `console.log` in production code
- Stream B: Do NOT touch `src/pages/admin/` (Stream A's zone)
- All new endpoints use Zod validation
- TDD: write tests for existing behavior before refactoring backend

## Acceptance Criteria (Global)

1. [ ] Analytics Dashboard: real D1 data in all 5 chart widgets, CSV export works
2. [ ] UI/UX score improves from 5/10 to ≥ 8/10 (verified by re-audit)
3. [ ] Image size reduced from 47MB to < 10MB
4. [ ] All pages use WebP + lazy loading
5. [ ] Zero emoji in production UI (Lucide icons only)
6. [ ] All interactive elements have ≥ 48px touch targets
7. [ ] Glass card: single unified style across all pages

## Risks

| Risk | Mitigation |
|------|-----------|
| CSS regression from @theme change | All tokens reference CSS vars, no hardcoded values |
| Emoji→SVG misses instances | Grep for emoji unicode ranges post-migration |
| Analytics BE perf on D1 | Batch queries + KV caching |
| Cross-stream file conflicts | B explicitly excludes admin/ directory |
