# Phase 15: OpenAPI Table Zones Auth, ORDER BY SQLi, Staff Security & Payment/Loyalty Hardening

**Context Links:**
- [Overview Plan](plan.md)
- [Phase 14: Manager RBAC, Payment IDOR & MoMo Webhook Hardening](phase-14-rbac-manager-coverage-payment-idor-and-momo-webhook-hardening.md)

## Overview
- **Priority:** P0 / P1 (Critical Security, Auth, SQL Injection, Cryptography & Payment Integrity)
- **Current Status:** Complete
- **Description:** Remediates verified security, cryptographic, and data-integrity defects across OpenAPI Table Zones, OpenAPI Staff/Shifts/Attendance/Cron `ORDER BY` clauses, OpenAPI Loyalty reward redemption, `@aura/domain-payment` MoMo/PayOS/Web-Payment command handlers, and frontend checkout/cart state hydration.

## Key Insights
1. **Unauthenticated OpenAPI Table Zones Access & Mutation:** `openApiTablesRouter` (`worker/src/routes/openapi-tables-handlers/routes.ts`) is mounted at `/` in `worker/src/index.ts:91`. While `/api/tables/*` registers `requireAuth`, `/api/table-zones` and `/api/table-zones/*` lack auth middleware, allowing unauthenticated `GET`, `POST`, `PATCH`, and `DELETE` requests to read and mutate `table_zones` in D1 before audit logging fails on `user.id`.
2. **Unvalidated `ORDER BY` Interpolation Across 6 OpenAPI Handlers:** `zone-crud-handlers.ts`, `staff-handlers.ts`, `shift-handlers.ts`, `attendance-handlers.ts`, `job-crud-handlers.ts`, and `run-handlers.ts` interpolate `${sort} ${order.toUpperCase()}` directly into SQL `ORDER BY` clauses without column allowlisting.
3. **Broken OpenAPI Staff Password Hashing, Plaintext Audit Logging & Privilege Escalation:** `worker/src/routes/openapi-staff-handlers/staff-handlers.ts` defines a local `hashPassword` that hashes `password + crypto.randomUUID()` with SHA-256 and discards the random UUID salt (making passwords impossible to verify via PBKDF2 `verifyPassword`), logs raw `JSON.stringify(body)` containing plaintext `password` into `audit_logs.metadata`, and allows `'manager'` users to create, update, or delete `'owner'` accounts.
4. **Loyalty Reward Redemption Crash & Conditional Points Bypass:** `worker/src/routes/openapi-loyalty-handlers/reward-handlers.ts:200` calls `const { id } = c.req.valid('param')` on `POST /api/loyalty/rewards/redeem` (which defines `rewardId` in JSON body, not path params), and gates `account.current_points < reward.points_cost` behind `if (tierConfig && ...)`, bypassing points validation when `loyalty_tier_configs` has no row for the account's tier. Furthermore, `openapi-loyalty-handlers/routes.ts` blocks `'customer'` from customer-facing loyalty endpoints while `reward-handlers.ts` (`create`, `update`) and `tier-handlers.ts` (`update`) lack role checks.
5. **Domain Payment MoMo Broken Middleware Fallback, Invalid WebCrypto Algorithm & IDOR:** `packages/domain/payment/commands/momo-create.ts` uses a fallback `requireAuth` returning an empty `new Response()` without calling `_next()`, passes invalid algorithm `'sign'` instead of `'HMAC'` to `crypto.subtle.sign`, lacks `customer_id` ownership verification when authenticated, leaks raw `err.message` on 500, and uses `Math.random()`. `payos-helpers.ts` omits `'manager'` in `validatePayOSAccess`, and `process-web-payment.ts` lacks `canAccessOrder` verification when `user` is present.
6. **Legacy Cart Migration & Checkout Amount Integrity:** `src/hooks/stores/use-cart-store.ts` omits `productId` when migrating legacy `aura_cart` items from `localStorage`. `src/pages/checkout.tsx` sends client-calculated `effectiveTotal` instead of `order.totalAmount || effectiveTotal` and omits `credentials: 'include'` on `/api/payments/payment-request`. `packages/domain/order/policies/order-snapshot.ts` and `split-orders.ts` need `NaN`/non-negative fee guards.

## Requirements
- **Functional:**
  - Require `['owner', 'manager', 'staff']` authentication on `/api/table-zones` and `/api/table-zones/*`.
  - Allowlist `ORDER BY` sort columns and directions across all OpenAPI handlers.
  - Use canonical PBKDF2 `hashPassword` in OpenAPI staff handlers, strip `password` from audit metadata, and block `'manager'` from creating/modifying/deleting `'owner'` accounts.
  - Fix `POST /api/loyalty/rewards/redeem` to read `body.rewardId`, enforce `account.current_points < reward.points_cost` unconditionally, and enforce role checks on reward/tier mutations.
  - Fix `momo-create.ts` auth middleware, `'HMAC'` signing algorithm, order ownership check, 500 error masking, and CSPRNG IDs; add `'manager'` to `validatePayOSAccess`; enforce `canAccessOrder` in `process-web-payment.ts`.
  - Preserve `productId` during `aura_cart` migration, send server-authoritative order total with `credentials: 'include'` in `checkout.tsx`, and guard `NaN`/negative fees in `order-snapshot.ts` and `split-orders.ts`.
- **Non-Functional:**
  - Zero regressions across existing test suites; 100% green `typecheck:all`, `lint`, `vitest`, `build`, and `verify:gates`.

## Related Code Files
- `worker/src/routes/openapi-tables-handlers/routes.ts`
- `worker/src/routes/openapi-tables-handlers/zone-crud-handlers.ts`
- `worker/src/routes/openapi-staff-handlers/routes.ts`
- `worker/src/routes/openapi-staff-handlers/staff-handlers.ts`
- `worker/src/routes/openapi-staff-handlers/shift-handlers.ts`
- `worker/src/routes/openapi-staff-handlers/attendance-handlers.ts`
- `worker/src/routes/openapi-cron-handlers/routes.ts`
- `worker/src/routes/openapi-cron-handlers/job-crud-handlers.ts`
- `worker/src/routes/openapi-cron-handlers/run-handlers.ts`
- `worker/src/routes/openapi-loyalty-handlers/routes.ts`
- `worker/src/routes/openapi-loyalty-handlers/reward-handlers.ts`
- `worker/src/routes/openapi-loyalty-handlers/tier-handlers.ts`
- `packages/domain/payment/commands/momo-create.ts`
- `packages/domain/payment/commands/payos-helpers.ts`
- `packages/domain/payment/commands/process-web-payment.ts`
- `worker/src/routes/referrals.ts`
- `packages/domain/crm/commands/referral.ts`
- `packages/domain/order/policies/order-snapshot.ts`
- `packages/domain/order/commands/split-orders.ts`
- `worker/src/routes/orders-core.ts`
- `src/hooks/stores/use-cart-store.ts`
- `src/hooks/stores/use-auth-store.ts`
- `src/pages/checkout.tsx`

## Implementation Steps
1. Harden `openapi-tables-handlers` (`routes.ts`, `zone-crud-handlers.ts`) with `/api/table-zones` auth middleware and `ORDER BY` allowlisting.
2. Harden `openapi-staff-handlers` (`routes.ts`, `staff-handlers.ts`, `shift-handlers.ts`, `attendance-handlers.ts`) with PBKDF2 `hashPassword`, audit password redaction, manager->owner privilege guard, and `ORDER BY` allowlisting.
3. Harden `openapi-cron-handlers` (`routes.ts`, `job-crud-handlers.ts`, `run-handlers.ts`) with `ORDER BY` allowlisting.
4. Harden `openapi-loyalty-handlers` (`routes.ts`, `reward-handlers.ts`, `tier-handlers.ts`) with `body.rewardId`, unconditional points check, and admin role guards on mutations.
5. Harden `@aura/domain-payment` (`momo-create.ts`, `payos-helpers.ts`, `process-web-payment.ts`) and referral CSPRNG generators (`referrals.ts`, `referral.ts`).
6. Harden `order-snapshot.ts`, `split-orders.ts`, `orders-core.ts`, `use-cart-store.ts`, `use-auth-store.ts`, and `checkout.tsx`.
7. Add dedicated regression tests and run full verification gates.

## Todo List
- [x] Audit and verify all Phase 15 code paths
- [x] Apply OpenAPI Table Zones, Staff, Cron, and Loyalty hardening
- [x] Apply Domain Payment, Order Snapshot/Split, and Frontend Checkout/Cart hardening
- [x] Add Vitest regression suites for Phase 15 fixes
- [x] Run `npm run typecheck:all`, `npm run lint`, `npx vitest run`, `npm run build`, and `npm run verify:gates`
