# Phase 04: Domain Catalog, CRM, Order, Payment & Customer Hardening

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave7-deep-audit.md](reports/brainstorm-20261018-wave7-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**: `packages/domain/{catalog,crm,order,payment,customer}/**`

---

## Related Code Files
- `packages/domain/catalog/commands/get-customer-menu.ts`
- `packages/domain/catalog/commands/happy-hour.ts`
- `packages/domain/catalog/policies/pricing-resolver.ts`
- `packages/domain/crm/commands/accrual.ts`
- `packages/domain/crm/lookup-profile.ts`
- `packages/domain/crm/commands/place-order.ts`
- `packages/domain/crm/commands/referral.ts`
- `packages/domain/crm/commands/refund-reversal.ts`
- `packages/domain/crm/commands/segments.ts`
- `packages/domain/crm/commands/update-consent.ts`
- `packages/domain/order/commands/create-order.ts`
- `packages/domain/order/commands/create-order-side-effects.ts`
- `packages/domain/order/commands/update-order.ts`
- `packages/domain/order/policies/loyalty-trigger.ts`
- `packages/domain/order/commands/split-orders.ts`
- `packages/domain/order/queries/admin-orders.ts`
- `packages/domain/order/queries/get-order.ts`
- `packages/domain/order/queries/stats.ts`
- `packages/domain/payment/commands/momo-create.ts`
- `packages/domain/payment/commands/nowpayments-ipn.ts`
- `packages/domain/customer/policies/customer-lifecycle-policy.ts`
- `packages/domain/customer/events/customer-crm-event-contract.ts`

---

## Implementation Steps

1. **Domain Catalog (`packages/domain/catalog/**`)**:
   - `get-customer-menu.ts`: Add `try/catch` + empty-result fallback from `menu_items` to `products` in `getCustomerMenu` and `getCustomerMenuCategories`, pass `productId: item.id` and `categoryId: item.category` to `resolveItemPrice`, and safely parse `item.tags` with a `try/catch` helper.
   - `happy-hour.ts`: Add `try/catch` + empty-result fallback from `products` to `menu_items` in `GET /api/happy-hour/now`.
   - `pricing-resolver.ts`: Select `category_id` / `category` and pass `categoryId` to `resolveItemPrice` so category-scoped Happy Hour rules apply during server-side order pricing.

2. **Domain CRM (`packages/domain/crm/**`)**:
   - `accrual.ts`: Wrap `SELECT total, cashback_used FROM orders WHERE id = ?` with a fallback `SELECT * FROM orders WHERE id = ?` if `cashback_used` column is missing, and wrap `db.batch(stmts)` in a `try/catch` that falls back to executing the core customer/wallet/loyalty updates individually if optional tables/columns (`loyalty_audit_log`, extended `cashback_transactions` columns, `orders.points_earned`) fail.
   - `lookup-profile.ts`: When `customer_identities` returns no match (or throws), fall back to querying `customers WHERE phone = ? OR phone = ?` with normalized and raw phone values.
   - `place-order.ts`: Pass `kv` (when available) instead of `db as any` to `resolveReferralPolicy`.
   - `referral.ts`: Check `SELECT id, status FROM referral_redemptions WHERE referred_customer_id = ?` (without `AND status = 'pending'`) so already-completed/reversed referrals return `{ success: false, reason: 'already_referred' }` instead of throwing a UNIQUE constraint error; in `rewardReferralOnFirstOrder`, also credit referee bonus (`pointsReferee` / `cashbackRefereeVnd`) when > 0 and update `total_cashback_earned_vnd` in cashback mode.
   - `refund-reversal.ts`: Also reverse proportional `cashback_earned` on `cashback_wallets` and `orders` (wrapped in `try/catch` so mock DBs with fewer prepared statements continue to work seamlessly).
   - `segments.ts`: Call `await resolveBandPolicy(kv)` in `buildSegment`, and compute days since `first_order_at` (falling back to `last_order_at`) for `new_first_week`.
   - `update-consent.ts`: Add `'kitchen' | 'barista' | 'chef'` to `UpdateConsentInput['actorRole']`.

3. **Domain Order (`packages/domain/order/**`)**:
   - `create-order.ts` & `create-order-side-effects.ts`: Move `ORDER_BROADCASTER` notification after table validation and D1 `INSERT INTO orders` (with a `try/catch` fallback on `INSERT INTO orders` if extended columns fail), and in `runPostOrderSideEffects` update `orders.customer_id = customerIdForCapture` when a new customer row was created for a guest order.
   - `loyalty-trigger.ts` & `update-order.ts`: In `creditLoyaltyIfEligible`, only accrue when the order is paid or fulfilled (`orderRow.payment_status === 'paid' || orderRow.status === 'completed' || orderRow.status === 'served'`, or when neither `payment_status` nor `status` is present on minimal test mocks, while rejecting `'pending'`, `'confirmed'`, `'preparing'`, `'ready'`, `'cancelled'`, `'failed'`, `'expired'` unless `payment_status === 'paid'`).
   - `split-orders.ts`: Wrap `INSERT INTO order_items` after each split order insert (best-effort `try/catch`).
   - `admin-orders.ts` & `get-order.ts` & `stats.ts`: Add `try/catch` fallback in `admin-orders.ts` and `get-order.ts` when `refund_status`/`points_earned` columns are absent, and use `datetime(created_at) >= datetime(?)` in `stats.ts` with fallback to direct comparison.

4. **Domain Payment & Customer (`packages/domain/payment/**`, `packages/domain/customer/**`)**:
   - `momo-create.ts`: Select `status` on `orders` and reject `'cancelled' | 'failed' | 'expired'` orders with 409; in the `INSERT INTO payments` retry loop, keep the `orderCode` registered with MoMo (`const attemptCode = orderCode`) so `transaction_id` always matches MoMo's IPN callback.
   - `nowpayments-ipn.ts`: If `row.status === 'paid'` when `paymentStatus === 'finished' || paymentStatus === 'confirmed'`, return `{ ok: true }` immediately without extending `subscriptions.current_period_end` a second time.
   - `customer-lifecycle-policy.ts`: Use `COALESCE(name, '') || ' [MERGED]'` and ensure the primary customer has a `cashback_wallets` row (`INSERT OR IGNORE INTO cashback_wallets ...`) before adding the secondary balance in `mergeCustomerProfiles`.
   - `customer-crm-event-contract.ts`: Recursively sanitize nested objects and arrays in `sanitizeCustomerEventPayload` (with `WeakSet` cycle protection and `Date` preservation).

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors, and all domain & worker tests pass.
