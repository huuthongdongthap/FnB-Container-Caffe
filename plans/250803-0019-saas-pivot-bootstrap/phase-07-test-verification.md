# Phase 7: Test & Verification

## Overview
**Priority:** P2 - Final gate before production deploy
**Status:** completed (depends on all prior phases)

Comprehensive verification that the SaaS pivot bootstrap preserves all cafe operations while new SaaS features work correctly. Uses existing test infrastructure: Vitest (unit/integration) + Playwright (E2E).

## Key Insights
- Vitest config at worker/vitest.config.ts and root vitest.config.ts
- Playwright config at playwright.config.ts and playwright.config.prod.ts
- Test command: npm test (Vitest), npm run test:e2e (Playwright)
- CI gate: npm run ci runs typecheck, lint, test, secrets audit
- MUST NOT ignore failing tests per CLAUDE.md workflow rules

## Requirements
1. All existing cafe tests pass (regression gate)
2. New SaaS features have unit tests
3. Pricing page has component tests
4. Tenant isolation has integration tests
5. Auth tier gating has middleware tests
6. E2E test: anonymous user sees pricing, registered user sees dashboard
7. Build passes: npm run build -> 0 TypeScript errors

## Architecture
### Test Pyramid
E2E (Playwright)        - 2-3 flows: pricing page, tier gate, tenant isolation
Integration (Vitest)    - API endpoint tests, middleware tests, DB assertions
Unit (Vitest)           - Component rendering, utility functions, validators

### Test Matrix
| Layer | What | Tool | Count Target |
|-------|------|------|-------------|
| Unit | Component rendering | vitest + happy-dom | 20+ |
| Unit | Utility functions | vitest | 10+ |
| Integration | API endpoints | vitest | 15+ |
| Integration | Middleware | vitest | 10+ |
| E2E | Full user flows | Playwright | 3-5 |

## Related Code Files
- worker/__tests__/ - existing worker test directory
- src/__tests__/ - existing frontend test directory
- vitest.config.ts - root Vitest config
- worker/vitest.config.ts - worker Vitest config
- playwright.config.ts - Playwright config
- src/test-setup.ts:1 - test setup utilities (REUSE)
- src/test-utils.tsx:1 - test utilities (REUSE)

## Implementation Steps
1. Run baseline: npm test (all existing tests must pass)
2. Run baseline: npm run build (0 errors)
3. Write unit tests for PricingCard component
4. Write unit tests for TierBadge component
5. Write integration tests for /api/saas/pricing
6. Write integration tests for tenant isolation middleware
7. Write integration tests for tier-gate middleware
8. Write E2E: anonymous lands on pricing page
9. Write E2E: registered BASIC user sees limited dashboard
10. Write E2E: registered PREMIUM user sees advanced features

## Todo List
- [ ] Run baseline: npm test (all existing tests pass)
- [ ] Run baseline: npm run build (0 errors)
- [ ] Unit tests: PricingCard component
- [ ] Unit tests: TierBadge component
- [ ] Integration: /api/saas/pricing endpoint
- [ ] Integration: tenant isolation middleware
- [ ] Integration: tier-gate middleware
- [ ] E2E: anonymous user sees pricing
- [ ] E2E: BASIC user sees limited dashboard
- [ ] E2E: PREMIUM user sees advanced features

## Success Criteria
- npm test exits 0 (all existing + new tests pass)
- npm run build exits 0 (0 TypeScript errors)
- npm run test:e2e passes (3 E2E flows)
- No failing tests ignored
- 100% of new SaaS code has tests

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing tests fail after changes | Medium | High | Run baseline FIRST, fix before proceeding |
| E2E tests flaky | Medium | Medium | Retry logic in Playwright config |
| Tenant isolation untested | Low | Critical | Integration test for every SaaS query |
| Test coverage drops | Low | Medium | CI gate enforces minimum coverage |

## Security Considerations
- No credentials in test output
- Mock payment webhooks (no real transactions in tests)
- Test data uses non-production tenant_ids
- Auth tokens in tests are mock JWTs

## Next Steps
- Final gate before production deploy
- Feeds deployment verification (CF-direct doctrine)
- CI gate: npm run ci must pass
