---
phase: 3
title: "Quality Gates + Infrastructure Fixes"
status: completed
priority: P1
dependencies: []
---

# Phase 3: Quality Gates + Infrastructure Fixes

## Overview

Fix the stale quality gate thresholds, Playwright config, missing logger utility, and add proper rollback procedure. These are infrastructure issues that the red team found to be inaccurate or missing.

## Issues to Fix

| # | Issue | Severity | Current State | Target |
|---|-------|----------|--------------|--------|
| 1 | Playwright config has dead env var | High | `NEXT_PUBLIC_MOCK_AI_SERVICES=true` (copy-paste from Sophia) | Remove dead var |
| 2 | No rollback procedure | High | Plan says "revert dist" (impossible, dist is overwritten) | Add CF Pages rollback |
| 3 | No logger utility | High | Quality gate requires it but none exists | Create light logger |
| 4 | Test count thresholds stale | Medium | Hardcoded "309" and "129+" | Use CI exit code |
| 5 | Bundle size not monitored | Medium | No performance budget | Add bundle check note |

## Implementation Steps

### Step 1: Fix Playwright config (15 min)
- Edit `playwright.config.ts`: remove `NEXT_PUBLIC_MOCK_AI_SERVICES=true` from webServer.command
- Verify: `npx playwright test` still works

### Step 2: Add rollback procedure (30 min)
- Document in `scripts/deploy-rollback.sh`:
```bash
#!/bin/bash
# List deployments: npx wrangler pages deployment list --project-name aura-cafe
# Rollback: npx wrangler pages rollback <deployment-id>
# Verify: curl -s https://auraspace.cafe/api/version | grep shortSha
```
- Add rollback section to `docs/deployment-guide.md`

### Step 3: Create logger utility (30 min)
- Create `src/lib/logger.ts` with structured logging:
  - `logger.info(msg, ctx?)` - general info
  - `logger.warn(msg, ctx?)` - warnings
  - `logger.error(msg, ctx?)` - errors with stack traces
  - `logger.debug(msg, ctx?)` - debug (silent in production)
- Uses `console.error` internally but with structured context
- No external dependencies (just wraps console with conventions)
- Update `src/lib/api-client.ts` to use logger instead of raw console.error

### Step 4: Fix quality gate thresholds (15 min)
- Update `plan.md` quality gates to use verified counts (1,091 unit, 48 E2E)
- Document: gates use CI exit code, not hardcoded thresholds

### Step 5: Bundle size note (15 min)
- Current largest chunk: 804KB (index)
- Vendor chunks: properly split (react, i18n, ui, query)
- Run `npx vite build` and verify no chunk exceeds 1MB
- Document that route-based lazy loading already handles code splitting

## Related Code Files

- Modify: `playwright.config.ts` (remove dead env var)
- Create: `src/lib/logger.ts` (structured logger)
- Modify: `src/lib/api-client.ts` (use logger)
- Create: `scripts/deploy-rollback.sh` (rollback script)
- Modify: `docs/deployment-guide.md` (add rollback section)

## Success Criteria

- [ ] Playwright config has no `NEXT_PUBLIC_MOCK_AI_SERVICES` reference
- [ ] `npx playwright test` runs without env var warnings
- [ ] Rollback script created and tested (dry run)
- [ ] `logger.error()` works in api-client.ts
- [ ] No `console.error` in production code (except logger internals)
- [ ] Build completes with all chunks under 1MB

## Risk Assessment

- Logger creation is straightforward - no risk of breaking existing code since imports are additive
- Playwright config fix is a one-line change
- Rollback script is documentation + one wrangler command - run a `--dry-run` to verify
