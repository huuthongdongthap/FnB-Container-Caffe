---
title: Housekeeping Sprint — Worker Consolidation + Dead Code + Hygiene
description: >-
  Consolidate dual TS/JS worker files into TypeScript canonical, remove dead
  code, deduplicate types, split large files, fix naming inconsistencies. TDD
  mode.
status: pending
priority: P2
branch: main
tags:
  - housekeeping
  - refactor
  - worker
  - typescript
  - cleanup
blockedBy: []
blocks: []
created: '2026-07-01T07:37:02.204Z'
createdBy: 'ck:plan'
source: plans/reports/brainstorm-260701-1259-housekeeping-sprint.md
mode: tdd
effort: 6-10h
---

# Housekeeping Sprint — Worker Consolidation + Dead Code + Hygiene

## Overview

Consolidate dual TS/JS worker files (7 behavioral divergences found), remove dead code (4 unreachable pages, 2 dead files, 7 duplicate type exports), split 5 oversized files, fix 2 naming inconsistencies. All 510 tests must keep passing.

## Phases

| Phase | Name | Status | Priority | Depends |
|-------|------|--------|----------|---------|
| 1 | [TDD Gate: Worker Consolidation Tests](./phase-01-tdd-gate-worker-consolidation-tests.md) | Pending | P1 | In Progress |
| 2 | [Worker Consolidation: Resolve Divergences + Delete JS Shims](./phase-02-worker-consolidation-delete-js.md) | Pending | P1 | 1 |
| 3 | [TS Canonical: Delete Remaining JS Dual Files](./phase-03-ts-canonical.md) | Pending | P1 | 2 |
| 4 | [Dead Code Removal: Routes + Dedup + Cleanup](./phase-04-dead-code-removal-routes-dedup-cleanup.md) | Pending | P2 | — |
| 5 | [File Hygiene: Split Large Files + Fix Naming](./phase-05-file-hygiene-split-large-files-fix-naming.md) | Pending | P2 | — |
| 6 | [Integration Verify: Full Suite + Build + Deploy Smoke](./phase-06-integration-verify-full-suite-build-deploy-smoke.md) | Pending | P1 | 1,2,3,4,5 |

## Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Worker source files | 2 index + 5 dual middleware | 1 index (TS canonical) |
| Unreachable pages | 4 | 0 (all routed + 404 catch-all) |
| Dead files | 2 | 0 |
| Duplicate type exports | 7 | 0 (single source) |
| Files >200 lines | 14 | ~9 |
| Naming violations | 2 | 0 |

## Non-Negotiables

- All 510 tests keep passing
- Build: 0 errors
- No API contract changes
- No DB schema changes
- TDD: behavioral changes tested first
