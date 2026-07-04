---
title: "Stitch Component Quality Pass"
description: "Fix 4 systemic quality gaps in 26 Stitch New components: missing i18n, font issues, bronze-over-chrome palette, accessibility, and token migration. 5 phases, parallel execution."
status: completed
priority: P2
branch: "main"
tags: [stitch, quality, i18n, accessibility, design-tokens]
blockedBy: []
blocks: []
created: "2026-07-04T11:18:53.568Z"
createdBy: "ck:plan"
source: skill
---

# Stitch Component Quality Pass

## Overview

After integrating 26 Stitch New components into 13 page routes (build + 1161 tests green), a comprehensive quality audit surfaced 4 systemic issue clusters. This plan addresses all in parallel via 4 independent workstreams + 1 verification phase.

**Context:** [Brainstorm Report](/Users/macbook/FnB-Container-Caffe/plans/reports/brainstorm-full-quality-pass-260704-1815-stitch-quality-pass-report.md)

## Phases

| Phase | Name | Status | Priority | Parallel |
|-------|------|--------|----------|----------|
| 1 | [i18n + Fonts](./phase-01-1-i18n-fonts.md) | Completed | P1 | ✅ 3 sub-tasks |
| 2 | [Palette Alignment](./phase-02-2-palette-alignment.md) | Completed | P2 | ✅ 2 sub-tasks |
| 3 | [Accessibility](./phase-03-3-accessibility.md) | Completed | P1 | ✅ 3 sub-tasks |
| 4 | [Token Migration](./phase-04-4-token-migration.md) | Completed | P3 | ✅ 1 task |
| 5 | [Verify](./phase-05-5-verify.md) | Completed | P0 | Barrier |

**Execution model:** Phases 1-4 run in parallel. Phase 5 runs after all complete (barrier). Within each phase, sub-tasks run as parallel agents.

## Dependencies

- Phase 5 depends on phases 1-4 all completing
- No cross-dependencies between phases 1-4 (independent file ownership)
- Brainstorm report: `plans/reports/brainstorm-full-quality-pass-260704-1815-stitch-quality-pass-report.md`

## Success Criteria (Overall)

- [x] `npm run build` → 0 TypeScript errors
- [x] `npm test` → 1161/1161 tests passing
- [x] All 5 i18n namespaces populated in both en.json and vi.json (184 keys added)
- [x] Bronze accent (#D4A574) eliminated (0 remaining instances)
- [x] Focus traps working in 3 mobile drawers + Escape key handlers
- [x] Skip-to-content link in StitchAppLayout
- [x] Touch targets ≥ 44px on all quantity controls
- [x] Hardcoded hex colors reduced by 80%+ (94 replaced, 6 remaining)
