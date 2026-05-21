# Debug Summary — FnB-Container-Caffe

**Date:** 2026-05-19 | **Sprint:** Tasks 08-12 (loyalty v2 launch)

---

## Root Cause

Two interacting issues dominate:

1. **Stale column reference** (`cashback_balance_vnd` on customers table) causes silent
   wrong data in `phone-auth` response — always returns 0 for cashback balance.
2. **Non-atomic read-modify-write** in `redeem` and `spend-cashback` endpoints creates
   double-spend/double-deduct race conditions with no mitigation.

Secondary: two unauthenticated endpoints (`/api/seed-menu`, `/api/test/telegram-sim`)
remain deployed, creating attack surface.

---

## Reproduction Steps

### Bug 1: cashback_balance_vnd always 0 after phone-auth
1. POST /api/loyalty/phone-auth with a phone that has wallet balance
2. Response contains cashback_balance_vnd: 0 regardless of wallet state
3. Column cashback_balance_vnd does not exist on customers table

### Bug 2: Redeem race condition
1. Two concurrent POST /api/loyalty/redeem with same account, same reward
2. Both pass pts >= reward.point_cost check (both read same stale value from authMiddleware)
3. Both deduct points — negative or zero balance without error

### Bug 3: seed-menu unprotected
1. POST /api/seed-menu with no auth header
2. Returns {ok: true} — endpoint accepts unauthenticated calls

---

## Affected Code Paths

| Severity | File | Line(s) | Issue |
|----------|------|---------|-------|
| CRITICAL | worker/src/index.js | 127 | /api/seed-menu no auth |
| CRITICAL | worker/src/index.js | 152 | /api/test/telegram-sim no auth |
| HIGH | loyalty.js | 227 | cashback_balance_vnd undefined column |
| HIGH | loyalty.js | 429-456 | redeem race condition |
| HIGH | loyalty.js | 341-393 | spend-cashback no idempotency/rate-limit |
| HIGH | admin-loyalty.js | 199-216 | CSV injection (phone, source unquoted) |
| HIGH | js/loyalty.js | 443, 379 | XSS via txn.description in innerHTML |
| MEDIUM | index.js | 119-120 | Route order: loyaltyRouter blocks referral |
| MEDIUM | auth.js | 285 | Wrong default tier silver (should be bronze) |
| MEDIUM | loyalty.js | 74 | Customer 404 leaks valid token confirmation |

---

## Fix Recommendations (Priority Order)

### P0 — Deploy Immediately
1. Remove /api/seed-menu or add requireAuth(['owner'])
2. Remove /api/test/telegram-sim or add requireAuth(['owner', 'staff'])

### P1 — Before Launch (6/6)
3. Fix redeem race condition: atomic UPDATE with AND loyalty_points >= ? check
4. Fix spend-cashback double-spend: add WHERE cashback_used = 0 guard + throttle
5. Fix cashback_balance_vnd: remove from phone-auth response (column does not exist)
6. Fix CSV injection: quote phone and source fields in admin export
7. Fix route order: move /api/loyalty/referral before /api/loyalty in index.js

### P2 — Post-Launch
8. Fix tier default: auth.js:285 silver -> bronze
9. Fix XSS: escape txn.description before innerHTML in js/loyalty.js
10. Fix authCustomer 404 leak: return 401 not 404 for missing customer

---

## Test Cases to Add

- spend-cashback same order twice: second call rejected
- Concurrent redeem requests: only one succeeds
- POST /api/seed-menu without token: 401
- phone-auth response cashback_balance_vnd matches wallet balance
- Member export: phone with = prefix is quoted
- Email-registered customer gets bronze tier
- GET /api/loyalty/referral/code with loyalty JWT: referralRouter handles it
