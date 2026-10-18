# Phase 04: Domain Payment, Order, Catalog, CRM, Customer & Payment Tests

## Context Links
- Brainstorm Report: [reports/brainstorm-20261018-wave6-deep-audit.md](reports/brainstorm-20261018-wave6-deep-audit.md)
- Plan Overview: [plan.md](plan.md)

## Overview
- **Priority**: High
- **Status**: Pending
- **Scope**: Fix PayOS retry code corruption & link idempotency, expand staff roles in `order-ownership-policy.ts`, fix SQL injection & bind parameter mismatch in `shared-listing.ts` & `admin-orders.ts`, fix category-scoped happy hour discount evaluation, fix CRM accrual/consent/reversal policies, and complete `payments.test.ts` & `admin-payments-stuck.test.ts`.

## Related Code Files (Strict Ownership)
- `packages/domain/payment/commands/payos-helpers.ts`
- `packages/domain/payment/commands/payos-create-link.ts`
- `packages/domain/payment/commands/momo-create.ts`
- `packages/domain/payment/commands/process-web-payment.ts`
- `packages/domain/customer/policies/order-ownership-policy.ts`
- `packages/domain/customer/policies/customer-lifecycle-policy.ts`
- `packages/domain/order/queries/shared-listing.ts`
- `packages/domain/order/queries/admin-orders.ts`
- `packages/domain/order/policies/order-snapshot.ts`
- `packages/domain/catalog/policies/pricing.ts`
- `packages/domain/catalog/commands/happy-hour.ts`
- `packages/domain/catalog/queries/menu.ts`
- `packages/domain/crm/commands/accrual.ts`
- `packages/domain/crm/commands/refund-reversal.ts`
- `packages/domain/crm/commands/update-consent.ts`
- `packages/domain/crm/commands/place-order.ts`
- `worker/src/__tests__/routes/payments.test.ts`
- `worker/src/__tests__/routes/admin-payments-stuck.test.ts`

## Implementation Steps
1. **Domain Payment (`payos-helpers.ts`, `payos-create-link.ts`, `momo-create.ts`, `process-web-payment.ts`)**:
   - In `payos-helpers.ts:130`, change `const attemptCode = attempt === 0 ? orderCode : generateOrderCode();` to `const attemptCode = orderCode;` so that after the `catch` block generates a new `orderCode` and registers it with PayOS, the next loop iteration inserts that exact `orderCode` into `payments.transaction_id`.
   - In `payos-helpers.ts:77-85` and `momo-create.ts:84-92` and `process-web-payment.ts:53,105-110`, include `'waiter'` and `'cashier'` in `isStaffOrOwner`.
   - In `payos-create-link.ts:81-114`:
     - Include `'waiter'` and `'cashier'` in COD staff roles and update `AUTH_KV` on COD confirmation.
     - Support both `payment_url` and `checkout_url` on `existingPayment` (`const existingUrl = existingPayment.payment_url || (existingPayment as { checkout_url?: string }).checkout_url || '';`), and only return the cached response when `existingUrl` is non-empty (so pre-created pending rows with `payment_url = NULL` proceed to create a real PayOS link).
     - Update `orders.payment_method = 'payos'` when creating a PayOS link.
2. **Domain Customer (`order-ownership-policy.ts`, `customer-lifecycle-policy.ts`)**:
   - In `order-ownership-policy.ts:51,83,119`, include `'waiter'`, `'kitchen'`, `'barista'`, `'chef'`, `'cashier'` in the privileged staff role list across `resolveCustomerScope`, `canAccessOrder`, and `projectOrderForActor`.
   - In `customer-lifecycle-policy.ts:34`, add `AND revoked_at IS NULL` to the active consents query, and transfer `cashback_wallets.balance` in `mergeCustomerProfiles` with `try/catch` safety.
3. **Domain Order & Catalog (`shared-listing.ts`, `admin-orders.ts`, `order-snapshot.ts`, `pricing.ts`, `happy-hour.ts`, `menu.ts`)**:
   - In `shared-listing.ts:33-36`, fix `safeSortColumn(raw, prefix = '')` to return `SORTABLE_COLUMNS.has(col) ? `${prefix}${col}` : `${prefix}created_at`` so arbitrary prefix expressions cannot be injected into `ORDER BY`.
   - In `admin-orders.ts:36-47`, pass `'o.'` prefix or remove duplicate `params.push(parseInt(limit), parseInt(offset))` since `buildOrderTail` already interpolates integer `LIMIT` and `OFFSET`.
   - In `order-snapshot.ts:27`, select `id, name, price, available, category` from `products` (with fallback to `SELECT id, name, price, available FROM products` if `category` is missing).
   - In `pricing.ts:55-65`, when `applyTo` is product-scoped or category-scoped and the corresponding `context?.productId` or `context?.categoryId` is missing while `parseApplyIds(w.apply_ids).length > 0`, return `false`.
   - In `catalog/queries/menu.ts`, add fallback from `menu_items` to `products` and guard `JSON.parse` with `try/catch`.
4. **Domain CRM (`accrual.ts`, `refund-reversal.ts`, `update-consent.ts`, `place-order.ts`)**:
   - In `accrual.ts:65-81`, compute `const cashbackUsed = input.cashbackUsedVnd ?? order?.cashback_used ?? 0;`.
   - In `update-consent.ts:60-75`, when inserting a consent update (especially `granted = 0`), also mark prior active rows for `(customer_id, purpose)` with `UPDATE consents SET revoked_at = ? WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL`.
   - In `place-order.ts:101-114`, add `.catch(() => null)` to the `menu_items` query so it cleanly falls back to `products`.
5. **Payment Tests (`payments.test.ts` & `admin-payments-stuck.test.ts`)**:
   - In `payments.test.ts:173-191`, include `payment_url: 'https://pay.payos.vn/existing'` in `existingPayment` mock and uncomment/enable the idempotency assertions (`expect(fetchSpy).not.toHaveBeenCalled()`, `expect(body.cached).toBe(true)`, `expect(body.checkoutUrl).toBe('https://pay.payos.vn/existing')`).
   - In `payments.test.ts:284-290` and `admin-payments-stuck.test.ts`, add real assertions testing `getStuckPayments` masking (`dbAmount: '***'`, `webhookAmount: '***'` for non-owner vs full amounts for owner).

## Success Criteria
- All domain and payment unit/integration tests pass with 0 TypeScript or ESLint errors.
