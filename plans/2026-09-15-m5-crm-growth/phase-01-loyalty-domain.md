# Phase 01 — Loyalty Domain (REVISED — Legacy Extraction)

**Priority:** HIGH — foundation for accrual, tier, 360-view, referral rewards.
**Status:** ✅ COMPLETE (2026-09-15)

## Overview
Extract loyalty business logic from `worker/src/tree/loyalty/process-order.ts` (accrual + cashback + tier upgrade/downgrade) and the inline nextTier query from `packages/domain/crm/commands/get-customer-account.ts` into pure, testable commands under `packages/domain/crm/commands/`. Migrate `place-order.ts` to call the extracted accrual hook. Refactor `get-customer-account.ts` to use the extracted computeTier. Delete legacy `tree/loyalty/process-order.ts` after callers migrated.

## Key Insights

- Legacy `process-order.ts` is the SOURCE OF TRUTH for accrual: 1pt/1000VND, cashback rate by tier, 50k/tx earn cap, 50%-of-bill wallet cap, tier upgrade/downgrade on lifetime_points, refund reversal, campaign multiplier.
- `loyalty_tiers.min_points` (0/50/200/500) is the live tier threshold — DO NOT switch to `min_spent_vnd` (0/500k/5M/15M, display-only).
- `get-customer-account.ts` has an inline nextTier query (SELECT next tier WHERE min_points > lifetime_points) — extract to computeTier for reuse.
- `process-order.ts` triggers referral processing on first order (`processReferralCashbackOnFirstOrder`, `processReferralOnFirstOrder`) — Phase 02 will extract those. Phase 01 only extracts the loyalty accrual + tier.
- `process-order.ts` calls `getActiveCampaign` from `tree/loyalty/campaign.ts` for multiplier — Phase 01 extracts this as `loyalty-policy.ts` loadPolicy.

## Requirements

- `loyalty-policy.ts`: pure `loadPolicy(db, kv?)` → { tiers[], defaultRate, campaignMultiplier }. Reads `loyalty_tiers` + `bonus_campaigns` (active) + KV overrides.
- `compute-tier.ts`: pure `computeTier(lifetimePoints, currentTierName, policy)` → { tierName, lifetimePoints, nextTier, pointsToNext }. Uses `min_points` thresholds. No D1 dependency.
- `accrual.ts`: `applyAccrual(db, policy, { customerId, orderId, orderTotalCents, actorId, actorRole })` — writes `loyalty_point_logs`, updates `customers.loyalty_points` + `lifetime_points`, recalculates tier via computeTier, emits tier_upgrade/downgrade to `loyalty_audit_log`. Idempotent: skips if loyalty_point_logs already has reason='order' + orderId.
- `refund-reversal.ts`: `reverseAccrual(db, policy, { customerId, orderId, refundAmountCents })` — negative points_change in loyalty_point_logs, decrements both points columns, recalculates tier if dropped below threshold.
- Refactor `get-customer-account.ts` nextTier query → `computeTier`.
- Hook `applyAccrual` into `place-order.ts` (after order INSERT, before response).

## Architecture

```
packages/domain/crm/commands/
├── loyalty-policy.ts     # loadPolicy — reads loyalty_tiers + bonus_campaigns + KV
├── compute-tier.ts       # pure computeTier(lifetimePoints, currentTier, policy)
├── accrual.ts            # applyAccrual — points + cashback wallet + tier upgrade
└── refund-reversal.ts    # reverseAccrual — negative points + tier downgrade check
```

## Related Code Files

### Modify
- `packages/domain/crm/commands/get-customer-account.ts` — replace inline nextTier with computeTier
- `packages/domain/crm/commands/place-order.ts` — add applyAccrual call after order creation
- `packages/domain/crm/index.ts` — barrel exports for 4 new commands

### Create
- `packages/domain/crm/commands/loyalty-policy.ts`
- `packages/domain/crm/commands/compute-tier.ts`
- `packages/domain/crm/commands/accrual.ts`
- `packages/domain/crm/commands/refund-reversal.ts`

### Delete (after migration verified)
- `worker/src/tree/loyalty/process-order.ts`

## Implementation Steps

1. Read `worker/src/tree/loyalty/process-order.ts` line-by-line to capture exact accrual logic (points formula, cashback rate, earn cap, wallet cap, tier calc, idempotency).
2. Read `worker/src/tree/loyalty/campaign.ts` to capture getActiveCampaign + calcExpiresAt.
3. Read `worker/src/tree/loyalty/helpers.ts` for genId/nowSqlTimestamp (reuse or inline).
4. Create `loyalty-policy.ts` — pure loadPolicy with KV fallback.
5. Create `compute-tier.ts` — pure computeTier using min_points thresholds.
6. Create `accrual.ts` — applyAccrual with idempotency guard on (customer_id, order_id, reason='order').
7. Create `refund-reversal.ts` — reverseAccrual with tier downgrade check.
8. Refactor `get-customer-account.ts` nextTier query → computeTier.
9. Hook applyAccrual into `place-order.ts` (M4 already has order creation — add loyalty accrual).
10. Write `tests/crm-loyalty.test.ts` — tier boundaries (exact min_points), accrual math, cashback math, refund reversal, idempotency, KV override, getCustomerAccount still green.
11. Run full suite. Verify green.

## Todo

- [ ] loyalty-policy.ts
- [ ] compute-tier.ts
- [ ] accrual.ts
- [ ] refund-reversal.ts
- [ ] get-customer-account.ts refactor
- [ ] place-order.ts hook
- [ ] tests/crm-loyalty.test.ts
- [ ] Run full suite
- [ ] Delete process-order.ts

## Success Criteria

- computeTier returns correct tier for every min_points boundary (0, 50, 200, 500) + between values.
- applyAccrual writes exactly 1 loyalty_point_logs row per order (idempotent).
- Cashback wallet credited correctly (rate × orderTotal, capped at 50% of bill + 50k/tx).
- Refund reversal deducts points + recalculates tier if dropped.
- getCustomerAccount behavior byte-identical (nextTier matches computeTier output).
- place-order emits loyalty accrual after successful order.
- tsc clean. No legacy process-order.ts imports remain.

## Security

- actorId + actorRole captured in loyalty_point_logs.description + loyalty_audit_log.metadata.
- accrual verifies order exists + belongs to customer (customer-scoped by phone match).
- No PII in loyalty_point_logs beyond customer_id FK.
- Cashback wallet transactions append-only (no UPDATE, only INSERT).

## CRITICAL INVARIANTS (verified against seed + legacy code)

- Tier calc uses `loyalty_tiers.min_points` against `customers.lifetime_points`. Current thresholds: Bronze 0, Silver 50, Gold 200, Platinum 500.
- Points formula: `Math.floor(orderTotal / 10000 * point_multiplier)` (1 pt per 10k VND × tier multiplier).
- Cashback rates by tier: Bronze 3%, Silver 5%, Gold 7%, Platinum 10%.
- Point multiplier by tier: 1.0 / 1.1 / 1.3 / 1.5.
- Earn cap: 50,000 VND per transaction.
- Wallet spend cap: 50% of bill (`min(walletBalance, total * 0.5)`).
- Referral reward: 10,000 VND to referrer on referee's first qualifying order (≥ 20,000 VND). Extracted in Phase 02.
