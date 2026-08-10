--- phase: 8
title: "E2E Smoke + Deploy Verification"
status: completed
priority: P0
effort: "0.5d"
dependencies: [1,2,3,4,5,6,7]
---

# Phase 08: E2E Smoke + Deploy Verification

## Overview
Smoke test script + deploy checklist validating each user-facing path end-to-end against the deployed worker before merge to main.

## Requirements
- Manual or scripted checklist covering all 8 phases
- npm run build: 0 errors
- npm test: 100% pass
- /api/version SHA matches deployed commit

## Architecture
- Checklist file: plans/260804-0515-saas-launch-ready/smoke-checklist.md
- Script: scripts/smoke-saas.sh (curl-based smoke hits)

## Related Code Files
- Create: plans/260804-0515-saas-launch-ready/smoke-checklist.md
- Create: scripts/smoke-saas.sh
- Modify: CI or deploy config if smoke gate needed

## Implementation Steps
1. Write smoke-checklist.md with checkboxes for each user path: register → login → create tenant → onboarding wizard → view dashboard → pay invoice → cancel subscription.
2. Write smoke-saas.sh: curl POST /api/auth/register (test user), curl POST /api/auth/session, curl POST /saas-tenants/create, curl GET /saas/dashboard, etc.
3. Add smoke-saas.sh to deploy gate or run manually before merge.
4. Verify npm run build output has 0 TS errors.
5. Verify npm test exit 0.

## Success Criteria
- [ ] All smoke paths hit HTTP 2xx
- [ ] npm run build: 0 TypeScript errors
- [ ] npm test: all pass
- [ ] Deploy SHA matches local
