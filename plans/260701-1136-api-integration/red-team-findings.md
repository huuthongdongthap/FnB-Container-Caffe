# Red-Team Findings — API Integration Plan

**Date:** 2026-07-01 | **Reviewers:** Security, Architecture, Integration
**Plan:** `plans/260701-1136-api-integration/`
**Verdict:** 3 Critical / 6 High / 4 Medium — all fixable, plan structure sound

---

## CRITICAL (3)

### #1: API URLs wrong — plan references endpoints that don't exist at those paths

**Evidence:** Grepped worker route files. Actual routes:
- `/api/payment/create-link` (NOT `/api/payments/create-link` — no 's')
- `/api/loyalty/referral/code` (NOT `/api/referrals/code`)
- `/api/loyalty/referral/apply` (NOT `/api/referrals/apply`)
- `/api/loyalty/referral/stats` (NOT `/api/referrals/stats`)

**Impact:** Stores calling wrong URLs → all referral/payment API calls fail at runtime.

**Fix:** Update plan.md API contract table and all phase files to use actual route paths.

### #2: Payment endpoint requires JWT auth — plan says "Auth: No"

**Evidence:** `paymentRouter.post('/create-link', requireAuth(['customer', 'owner', 'staff']), ...)`

**Impact:** Guest checkout flow in plan is impossible. User MUST be logged in before paying.

**Fix:** Update plan to document payment auth requirement. Aligns with user's choice of "Full auth — login required to order."

### #3: API base URL mismatch between code and deployed worker

**Evidence:** `api-client.ts` defaults to `https://aura-sadec.agencyos.workers.dev`. Deployed worker is at `https://aura-space-worker.agencyos-openclaw.workers.dev`.

**Impact:** All API calls fail in production unless `VITE_API_BASE` is set.

**Fix:** Update default in api-client.ts OR document that VITE_API_BASE must be set.

---

## HIGH (6)

### #4: Loyalty/referral endpoints use phone-auth, not JWT — two auth systems coexist

**Evidence:** Loyalty has `POST /api/loyalty/phone-auth`. `c.get('customer')` pattern throughout loyalty/referral routes — customer context comes from phone-auth, not JWT `c.get('user')`.

**Impact:** Phase 3 (Loyalty) can't just use JWT from Phase 1. Customer must also authenticate via phone.

**Fix:** Add phone-auth flow to Phase 1 or Phase 3. Document dual-auth model.

### #5: No integration tests for cross-store flows

**Evidence:** Phase 6 smoke tests are manual. No automated test for: menu.fetchMenu → cart.addItem → order.createOrder → payment.createPaymentLink.

**Impact:** Critical revenue flow has zero automated coverage. Regressions silently break checkout.

**Fix:** Add 1 integration test in Phase 6 covering the full checkout flow.

### #6: AuthProvider test missing from Phase 1 test list

**Evidence:** Phase 1 lists 4 test files. AuthProvider.tsx is created but never tested.

**Impact:** localStorage hydration, token validation on mount — untested.

**Fix:** Add `src/components/auth/__tests__/AuthProvider.test.tsx` to Phase 1.

### #7: 401 auto-logout in api-client not covered by any test

**Evidence:** Phase 1 modifies api-client to call `use-auth-store.getState().logout()` on 401. No test verifies this behavior.

**Impact:** Critical security flow (token invalidation) has zero test coverage.

**Fix:** Add api-client auth test to Phase 1.

### #8: Empty cart checkout not prevented in frontend

**Evidence:** Phase 2 wire checkout-form but doesn't mention validation guard for empty cart.

**Impact:** Users can submit empty orders, hitting backend validation errors with poor UX.

**Fix:** Add "disable submit when cart is empty" to Phase 2 checkout form wiring step.

### #9: Transactional gap: createOrder succeeds, createPaymentLink fails

**Evidence:** Phase 2 checkout flow calls createOrder then createPaymentLink independently. If payment link creation fails, the order exists without payment.

**Impact:** Orphaned unpaid orders accumulate in the database.

**Fix:** Document this as acceptable (orders have status field, unpaid orders expire). Or add order cancellation on payment failure.

---

## MEDIUM (4)

### #10: Phone-auth for loyalty creates inconsistent UX

Customer has JWT from login, but loyalty pages need phone-auth separately. Two auth tokens to manage.

**Mitigation:** Document in Phase 3. Phone-auth token stored separately in Zustand.

### #11: Zustand loading/error pattern deviates from cart-store

cart-store has no loading/error. New stores add these fields. This is a necessary extension but should be called out as intentional.

**Mitigation:** Phase 1 documents the extended pattern.

### #12: Menu data cached indefinitely

use-menu-store fetches once, never refetches. Menu changes on backend won't show until page refresh.

**Mitigation:** Add optional `refetchMenu()` action. Acceptable for café menu (changes infrequently).

### #13: Rate limit errors not handled in UI

Worker has rate limits on auth + orders. Frontend doesn't display rate limit errors specially.

**Mitigation:** api-client error handling treats 429 same as other errors. Add 429-specific message in Phase 6 polish.

---

## Accepted Corrections

| # | Severity | Finding | Action |
|---|----------|---------|--------|
| 1 | Critical | Wrong API URLs | Fix all endpoint paths in plan + phase files |
| 2 | Critical | Payment requires auth | Update API contract table |
| 3 | Critical | API base URL mismatch | Fix default in plan + api-client |
| 4 | High | Phone-auth for loyalty | Document dual-auth in Phase 3 |
| 5 | High | No cross-store integration test | Add to Phase 6 |
| 6 | High | Missing AuthProvider test | Add to Phase 1 test list |
| 7 | High | 401 auto-logout untested | Add api-client auth test to Phase 1 |
| 8 | High | Empty cart not prevented | Add validation guard to Phase 2 |
| 9 | High | Orphaned unpaid orders | Document as acceptable (status field) |
| 10 | Medium | Phone-auth UX | Document in plan |
| 11 | Medium | Loading/error pattern | Document as extension |
| 12 | Medium | Menu cache | Add refetchMenu() |
| 13 | Medium | Rate limit UX | Add to Phase 6 polish |
