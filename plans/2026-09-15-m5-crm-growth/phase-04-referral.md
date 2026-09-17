# Phase 04 — Referral

**Priority:** MEDIUM — growth loop primitive.
**Status:** ✅ COMPLETE

## Overview
Customer referral: a referrer shares a code; referee signs up + places first paid order; both accrue points per `referral-policy`.

## Key Insights

- Referral code = short 8-char unique per customer.
- Reward triggers on referee's **first paid order** (hook into M4 place-order accrual).
- Idempotent: one reward per (referrer, referee) pair.

## Requirements

- `referral-policy.ts` — pure: reward points for referrer + referee, qualifying action.
- `createReferral(db, customerId, code?)` → { code, link }.
- `redeemReferral(db, code, refereeCustomerId)` → validates + links.
- `getReferralStatus(db, customerId)` → { code, referred[], pendingRewards }.
- Migration: `referrals` table.

## Architecture

```
packages/domain/crm/commands/
├── referral-policy.ts    # pure reward rules
├── referral.ts           # create/redeem/status
```

## Related Code Files

### Create
- `packages/domain/crm/commands/referral-policy.ts`
- `packages/domain/crm/commands/referral.ts`
- `migrations/<date>_02_referrals.up.sql` + `.down.sql`
- `tests/crm-referral.test.ts`

### Modify
- `packages/domain/crm/commands/place-order.ts` — hook: on first order, check pending referral → reward.
- `packages/domain/crm/index.ts` — barrel exports
- `worker/src/routes/crm.ts` — add routes

## Implementation Steps

1. Create `referral-policy.ts` (pure).
2. Create `referral.ts` (create/redeem/status).
3. Migration: `referrals` table.
4. Routes: `GET /customers/:id/referral`, `POST /customers/:id/referral`.
5. Hook into place-order: after accrual, check if referee has pending referral → reward both.
6. Tests: code generation, redeem, reward accrual, idempotency.
7. Run full suite.

## Todo

- [x] `referral-policy.ts`
- [x] `referral.ts` — create/redeem/status
- [x] Migration — NOT NEEDED (tables already in schema.sql)
- [x] Routes — GET /customers/:id/referral, POST /customers/:id/referral/redeem
- [x] Hook into place-order — rewardReferralOnFirstOrder after accrual
- [x] Tests — 18 referral tests (all green)
- [x] Run full suite — 3357 tests passed
- [x] Update CHANGELOG.md

## Success Criteria

- Referral code generated + unique.
- Redeem links referee → referrer.
- First paid order rewards both; idempotent.
- tsc clean.

## Security

- Customer can only create/read own referral.
- Redeem validates code exists + not self-referral.
