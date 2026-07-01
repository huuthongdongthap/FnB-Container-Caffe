---
title: Quality Gate Foundations — Zod + TypeScript + pretix Fix
description: >-
  Sub-project A of meta-plan. Apply Zod validation to all API inputs,
  eliminate :any types from route files, fix 2 pre-existing pretix test failures.
status: pending
priority: P0
branch: main
tags: [zod, typescript, validation, type-safety, tdd]
blockedBy: []
blocks: [deploy-pipeline-hardening, test-coverage-blitz]
created: '2026-07-02T00:53:00.000Z'
source: brainstorm
sourceReport: worker/plans/reports/brainstorm-260702-0053-quality-pipeline-foundations.md
mode: tdd
effort: 8-12h
supersedes: []
---

# Quality Gate Foundations

## Overview

Eliminate the two biggest quality gaps in the codebase: zero Zod validation on most API inputs, and 82+ `:any`/`as any` escapes in route files. Fix 2 pre-existing test failures to reach 770/770 green.

**Source:** `worker/plans/reports/brainstorm-260702-0053-quality-pipeline-foundations.md`

## Key Numbers

| Metric | Current | Target |
|--------|---------|--------|
| API inputs with Zod | 9 of 34 routes | 34/34 routes |
| `:any` / `as any` in routes | 82 occurrences | 0 |
| Test failures | 2 (pretix) | 0 |
| Build errors | 0 | 0 |
| Test suite | 768/770 | 770/770 |

## Phases

| # | Phase | Effort | Dependencies | Status |
|---|-------|--------|-------------|--------|
| 1 | Fix pretix tests → 770/770 | 0.5h | — | pending |
| 2 | Add missing Zod schemas to validators.ts | 2h | — | pending |
| 3 | Apply Zod validation to all routes | 3h | 2 | pending |
| 4 | TypeScript `:any` cleanup — Context types | 2h | — | pending |
| 5 | TypeScript `:any` cleanup — client/env casts | 2h | — | pending |
| 6 | Regression gate + final verification | 1h | 1-5 | pending |

## TDD Contract

Each phase follows:
1. Write/verify tests lock current behavior
2. Make changes (fix, add Zod, replace :any)
3. Run tests — must stay green
4. Commit if all pass

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Zod schemas too strict break APIs | High | Match manual validation exactly. Use `.passthrough()` for unknown fields |
| TypeScript changes reveal hidden bugs | Medium | Per-file cleanup. Test after each file |
| Existing Zod schemas in validators.ts drift from usage | Low | Phase 2 audit + align before Phase 3 apply |

## Success Criteria

- 770/770 tests pass (0 failures)
- Zod validation on all POST/PATCH/PUT handlers
- Zero `:any` / `as any` in `worker/src/routes/` production code
- Build: 0 TypeScript errors
