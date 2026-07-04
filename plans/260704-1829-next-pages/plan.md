---
title: "Next Phase: New Pages + Fonts + Chunk Splitting"
description: "Wire 12 unused Stitch components into production routes, fix font files, code-split large chunks."
status: pending
priority: P2
branch: "main"
tags: [stitch, pages, fonts, performance]
blockedBy: []
blocks: []
created: "2026-07-04T11:35:51.769Z"
createdBy: "ck:plan"
source: skill
---

# Next Phase: New Pages + Fonts + Chunk Splitting

## Overview

After completing the Stitch quality pass (i18n, palette, a11y, tokens), 12 unused Stitch New components remain. This plan wires them into production routes, fixes missing font files, and reduces JS chunk sizes.

**Context:** [Brainstorm Report](../reports/brainstorm-next-pages-260704-1829-next-pages-report.md)
**Previous:** [Quality Pass](../260704-1815-stitch-quality-pass/) (completed)

## Phases

| Phase | Name | Status | Priority | Parallel |
|-------|------|--------|----------|----------|
| 1 | [Fonts + Perf](./phase-01-1-fonts-perf.md) | Pending | P1 | 2 sub-tasks |
| 2 | [Customer Pages](./phase-02-2-customer-pages.md) | Pending | P1 | 3 sub-tasks |
| 3 | [Admin Pages](./phase-03-3-admin-pages.md) | Pending | P2 | 3 sub-tasks |
| 4 | [Verify](./phase-04-4-verify.md) | Pending | P0 | Barrier |

**Execution:** Phases 1-3 parallel. Phase 4 after all complete.

## Routes to Create/Wire

| Route | Component | Type |
|-------|-----------|------|
| `/order` | StitchMobileOrderNew | Customer |
| `/container` | StitchContainerNew1/2 | Customer |
| `/events` (replace) | StitchEventsNew2 | Customer |
| `/admin/*` (layout) | StitchAdminTerminalNew | Admin |
| `/admin/order-mgmt` | StitchOrderMgmtNew | Admin |
| `/admin/pos` | StitchPOSNew | Admin |

## Success Criteria

- [ ] Build 0 errors, no font 404 warnings
- [ ] 1161/1161 tests
- [ ] 3 new customer routes render correctly
- [ ] 3 admin enhancements working
- [ ] JS chunks < 500KB after code-splitting
