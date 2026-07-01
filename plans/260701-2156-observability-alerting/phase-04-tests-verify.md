---
phase: 4
title: "Tests + Verify"
status: completed
priority: P1
dependencies: [3]
effort: 2-3h
---

# Phase 4: Tests + Verify

## Overview

Comprehensive test suite for all 3 prior phases. Unit tests for metrics-collector, alert-dispatcher, and admin-metrics endpoint. Integration tests for the full pipeline. Security smoke tests for admin route auth. Verify zero regressions against existing 102-test suite. Final deploy + verify SHA match.

## TDD Structure

```
Step 4-T: Run all tests written in phases 1-3 (they should pass now)
Step 16: Write integration tests (full pipeline)
Step 17: Security smoke tests (auth guard, no metrics leak)
Step 18: Regression run (all 102 existing tests)
Step 19: TypeScript check (npx tsc --noEmit)
Step 20: Deploy + SHA verify
```

## Requirements

- Functional: All unit tests pass (metrics-collector, alert-dispatcher, admin-metrics, useMetricsStore)
- Functional: All integration tests pass (full metrics pipeline)
- Functional: Security smoke tests pass (auth guard, no unauthenticated access)
- Functional: All 102+ existing tests pass (no regressions)
- Functional: `npx tsc --noEmit` exits 0
- Functional: Worker deploys with `--var GIT_COMMIT_SHA` and SHA matches
- Non-functional: Test coverage ≥80% on new code (metrics-collector, alert-dispatcher, admin-metrics, use-metrics-store)
- Non-functional: All test files follow existing Vitest patterns in the repo

## Architecture

```
Test execution order:
  1. Unit tests (fast, parallel)
     ├── metrics-collector.test.ts (6 tests)
     ├── alert-dispatcher.test.ts (8 tests)
     ├── admin-metrics.test.ts (6 tests)
     └── use-metrics-store.test.ts (5 tests)

  2. Integration tests
     ├── Full pipeline: recordMetric → D1 write → admin-metrics query
     └── Alert pipeline: recordAlert → dispatchAlerts → cooldown check

  3. Security smoke tests
     ├── GET /api/admin/metrics without auth → 401
     └── GET /api/admin/metrics with non-staff user → 401

  4. Regression sweep
     └── All 102+ existing tests (vitest run)

  5. Build verification
     ├── npx tsc --noEmit (worker)
     ├── npx tsc --noEmit (frontend, if separate tsconfig)
     └── npm run build
```

## Related Code Files

| Action | File |
|--------|------|
| Verify | `worker/src/__tests__/lib/metrics-collector.test.ts` (Phase 1) |
| Verify | `worker/src/__tests__/lib/alert-dispatcher.test.ts` (Phase 2) |
| Verify | `worker/src/__tests__/routes/admin-metrics.test.ts` (Phase 2) |
| Verify | `src/__tests__/tree/metrics/use-metrics-store.test.ts` (Phase 3) |
| Verify | `src/__tests__/pages/admin/metrics-dashboard.test.tsx` (Phase 3) |
| Create | `worker/src/__tests__/integration/metrics-pipeline.test.ts` |
| Create | `worker/src/__tests__/security/admin-metrics-auth.test.ts` |
| Verify | All 102+ existing test files (no regressions) |

## Implementation Steps

### Step 4-T: Run all pre-written tests

```bash
# Worker tests
cd worker && npx vitest run src/__tests__/lib/metrics-collector.test.ts
cd worker && npx vitest run src/__tests__/lib/alert-dispatcher.test.ts
cd worker && npx vitest run src/__tests__/routes/admin-metrics.test.ts

# Frontend tests
npx vitest run src/__tests__/tree/metrics/use-metrics-store.test.ts
npx vitest run src/__tests__/pages/admin/metrics-dashboard.test.tsx
```

Expected: All pass. If any fail, fix implementation before proceeding.

### Step 16: Write integration tests

File: `worker/src/__tests__/integration/metrics-pipeline.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { createAlertDispatcher } from '../../lib/alert-dispatcher';

describe('metrics pipeline (integration)', () => {
  // Uses miniflare D1 test harness

  it('recordMetric → D1 write → admin-metrics query round-trip');
  it('recordAlert → dispatchAlerts → cooldown prevents re-dispatch');
  it('pruneOldMetrics removes rows older than retention period');
  it('multiple recordMetric calls aggregate correctly in admin-metrics');
  it('alert dispatch fires when threshold breached and cooldown expired');
  it('alert dispatch does NOT fire when threshold not breached');
  it('dispatchDigest formats correct 24h summary');
});
```

### Step 17: Security smoke tests

File: `worker/src/__tests__/security/admin-metrics-auth.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('admin-metrics security', () => {
  it('GET /api/admin/metrics without auth header → 401');
  it('GET /api/admin/metrics with invalid token → 401');
  it('GET /api/admin/metrics with non-staff user → 403');
  it('GET /api/admin/metrics with staff user → 200');
  it('metrics endpoint does not leak env vars in response');
  it('metrics endpoint does not expose raw query results');
});
```

### Step 18: Regression run

```bash
# Run all tests in parallel
cd worker && npx vitest run 2>&1 | tail -20
npx vitest run 2>&1 | tail -20

# Verify count ≥ 102
npx vitest run --reporter=json 2>&1 | grep numTotalTests
```

Expected: All existing tests pass. No test count decrease. Any regression → fix before proceeding.

### Step 19: TypeScript check

```bash
cd worker && npx tsc --noEmit 2>&1
# Frontend (if separate tsconfig)
npx tsc --noEmit 2>&1
```

Expected: 0 errors. Any type error → fix or justify `as any` cast in worker context.

### Step 20: Deploy + SHA verify

```bash
# Push first
git push origin main

# Deploy worker + pages
bash deploy-cloudflare.sh

# Verify SHA
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://auraspace.cafe/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
# Must match
```

## Success Criteria

- [ ] All 25+ new unit tests pass (metrics-collector: 6, alert-dispatcher: 8, admin-metrics: 6, use-metrics-store: 5)
- [ ] All 7 integration tests pass (pipeline round-trip)
- [ ] All 6 security smoke tests pass (auth guard)
- [ ] All 102+ existing tests pass (no regressions)
- [ ] `npx tsc --noEmit` exits 0 for both worker and frontend
- [ ] `npm run build` succeeds
- [ ] Worker deployed with correct GIT_COMMIT_SHA
- [ ] `/api/version` shortSha matches local commit
- [ ] `/api/admin/metrics` returns 200 on production (staff auth)
- [ ] Test coverage ≥80% on new code (verify with `npx vitest run --coverage`)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| D1 test harness differs from production | Miniflare provides accurate D1 simulation |
| Test flakiness from timing-dependent code | Use `vi.useFakeTimers()` for cooldown/retention tests |
| Regression in unrelated module | Full `vitest run` sweep catches all |
| Deploy breaks on unmerged migration | Run `bash scripts/apply-migrations.sh` before deploy |
| SHA verification fails (404 on /api/version) | Known issue: auraspace.cafe domain routing needs CF dashboard update; open separate tracking issue |
