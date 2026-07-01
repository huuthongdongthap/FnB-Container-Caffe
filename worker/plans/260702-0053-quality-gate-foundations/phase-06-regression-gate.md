---
phase: 6
title: Regression Gate — Final Verification
status: pending
priority: P0
effort: 1h
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Regression Gate

## Overview

Final verification after all Phase 1-5 changes. Full build + test + deploy smoke test. Must be 100% green before considering Sub-project A complete.

## Checks

### 1. Build Gate
```bash
npm run build
```
Must exit 0 with 0 TypeScript errors.

### 2. Test Gate
```bash
npm test
```
Must pass 770/770, 0 failures, 75/75 suites.

### 3. Lint Gate
```bash
npm run lint
```
No new lint errors. Pre-existing warnings acceptable.

### 4. TypeScript Strictness Audit
```bash
# Zero :any in routes
grep -rn ":any\|as any" worker/src/routes/ | grep -v __tests__
```
Must return empty (no matches).

### 5. Zod Coverage Audit
```bash
# Every POST/PATCH/PUT handler uses Zod
grep -rn "c.req.json()" worker/src/routes/ | grep -v __tests__
```
All remaining `c.req.json()` calls should be followed by Zod validation (or be GET/DELETE handlers).

### 6. API Compatibility Check
Verify no breaking changes to public contracts:
- All route paths unchanged
- All response shapes unchanged
- All error codes unchanged (400 for validation, 401 for auth, etc.)

### 7. Deploy Smoke Test
```bash
bash deploy-cloudflare.sh
```
Must exit 0. Pages + Worker both deployed.

### 8. SHA Verification
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://aura-space-worker.agencyos-openclaw.workers.dev/api/version | python3 -c "import sys,json; print(json.load(sys.stdin)['shortSha'])")
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
```
Must match.

### 9. Quick Health Check
```bash
curl -s https://auraspace.cafe | grep -q "AURA" && echo "OK" || echo "FAIL"
curl -s https://aura-space-worker.agencyos-openclaw.workers.dev/api/health
```
Both must return healthy responses.

## Success Criteria

- [ ] `npm run build` → 0 errors
- [ ] `npm test` → 770/770 pass
- [ ] Zero `:any`/`as any` in route files
- [ ] Zod validation on all API inputs
- [ ] Deploy succeeds with SHA verified
- [ ] Health check passes on production URLs
