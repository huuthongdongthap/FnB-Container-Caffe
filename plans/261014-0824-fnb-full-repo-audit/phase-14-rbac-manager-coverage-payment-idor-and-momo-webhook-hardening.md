# Phase 14: Store Manager RBAC Coverage, Payment IDOR Prevention & MoMo Webhook Hardening

## Context Links
- [Master Audit Plan](plan.md)
- [Phase 13: OpenAPI Auth, Auth Tree & Order/Catalog Hardening](phase-13-openapi-auth-password-tree-auth-and-domain-error-hardening.md)
- `worker/src/routes/orders-unified.ts`
- `worker/src/routes/orders-core.ts`
- `worker/src/index.ts`
- `worker/src/routes/features-router.ts`
- `worker/src/routes/checkin.ts`
- `worker/src/routes/admin-qr.ts`
- `worker/src/routes/campaigns-handlers/routes.ts`
- `worker/src/routes/admin-audit-logs-handlers/routes.ts`
- `worker/src/routes/refunds-handlers/`
- `packages/domain/table/commands/tables.ts`
- `packages/domain/payment/commands/momo-create.ts`
- `worker/src/routes/openapi-payments-handlers/`
- `worker/src/routes/webhooks/momo.ts`

---

## Overview
- **Priority:** P1 (High — Manager Role Lockout on KDS/Checkout/Tables/Reports, Payment IDOR Risk & Missing MoMo Secret Key Bypass)
- **Current Status:** In Progress
- **Brief Description:** Expand store `'manager'` role coverage to all operational routes (KDS, POS checkout, order status, table state transitions, checkin approvals, refunds, audit logs, and reports) where only `['owner', 'staff']` were previously allowed; enforce customer ownership IDOR checks on OpenAPI payment creation and retrieval; replace pseudo-random IDs with CSPRNG; and fail closed on missing `MOMO_SECRET_KEY` in the MoMo IPN webhook handler.

---

## Key Insights (Verified by Code Inspection)
1. **Manager Role Omission on Core Operations (`orders-unified.ts`, `tables.ts`, `checkin.ts`, `features-router.ts`, `index.ts`)**:
   - `orders-unified.ts:55,56,71,79`, `orders-core.ts:143`, and `index.ts:75` restrict `/kds`, `/checkout`, `/:id/status`, and `/:id` to `['owner', 'staff']`, locking out store managers from KDS operations and POS checkouts even though managers are authorized on `/summary` and `/cancel`.
   - `packages/domain/table/commands/tables.ts:90,101,112` restricts table occupy, release, and status updates to `['owner', 'staff']`.
   - `checkin.ts:88,115`, `refunds-handlers/`, `admin-qr.ts:17`, `campaigns-handlers/`, `admin-audit-logs-handlers/`, and `features-router.ts:87,89,126,131,150` omit `'manager'`.
2. **OpenAPI Payments Customer Lockout & IDOR Risk (`openapi-payments-handlers/`)**:
   - `routes.ts:17` blocked `customer` from `POST /api/payments` and `GET /api/payments/:id`.
   - In `read-handlers.ts:112` and `mutation-handlers.ts:8`, if customer access is enabled, customer identity (`customer_id`, `customer_phone`, `customer_email`) must be verified against the order record to prevent IDOR attacks.
   - `mutation-handlers.ts:65` and `web-payment-handlers.ts:64-65` used `Math.random()` to generate payment and transaction IDs.
3. **MoMo Webhook Signature Bypass on Missing Secret Key (`worker/src/routes/webhooks/momo.ts:63-66`)**:
   - When `MOMO_SECRET_KEY` was missing/empty, the handler logged a warning and skipped signature verification entirely instead of failing closed with HTTP 500.

---

## Requirements

### Functional Requirements
1. Include `'manager'` in `requireAuth` across:
   - `worker/src/index.ts:75` (`/api/kds/orders/*`)
   - `worker/src/routes/orders-unified.ts` (`/kds`, `/checkout`, `/:id/status`, `/:id`)
   - `worker/src/routes/orders-core.ts` (`/:id`)
   - `worker/src/routes/orders-hono-handlers/checkout-handlers.ts` (`/checkout`)
   - `worker/src/routes/orders-hono-handlers/kds-handlers.ts` (`/kds`, `/:id/status`)
   - `packages/domain/table/commands/tables.ts` (`/:id/occupy`, `/:id/release`, `/:id/status`)
   - `worker/src/routes/checkin.ts` (`/:id/approve`, `/:id/reject`)
   - `worker/src/routes/refunds-handlers/read-handlers.ts` and `mutation-handlers.ts`
   - `worker/src/routes/features-router.ts` (`/api/stats`, `/api/dashboard/*`, `/api/broadcast/*`, `/api/analytics/*`, `/api/reports/*`)
   - `worker/src/routes/admin-qr.ts`, `worker/src/routes/campaigns-handlers/routes.ts`, `worker/src/routes/admin-audit-logs-handlers/routes.ts`
   - `packages/domain/payment/commands/momo-create.ts` (`/create`)
2. In `worker/src/routes/openapi-payments-handlers/`:
   - Permit `customer` role on `POST /api/payments` and `GET /api/payments/:id`, keeping `refund` and payment listing restricted to `['owner', 'manager', 'staff']`.
   - Enforce order ownership verification when `user.role === 'customer'` on both `POST /api/payments` and `GET /api/payments/:id`, returning `403` on mismatch.
   - Use CSPRNG for payment IDs and transaction IDs.
3. In `worker/src/routes/webhooks/momo.ts`:
   - If `c.env.MOMO_SECRET_KEY` is not configured, log error and return `500` Server misconfiguration.

### Non-Functional Requirements
- Maintain 100% test pass rate across all 436 test files.
- Strictly adhere to Git preservation rules.

---

## Related Code Files
- **Modify:**
  - `worker/src/index.ts`
  - `worker/src/routes/orders-unified.ts`
  - `worker/src/routes/orders-core.ts`
  - `worker/src/routes/orders-hono-handlers/checkout-handlers.ts`
  - `worker/src/routes/orders-hono-handlers/kds-handlers.ts`
  - `packages/domain/table/commands/tables.ts`
  - `worker/src/routes/checkin.ts`
  - `worker/src/routes/refunds-handlers/read-handlers.ts`
  - `worker/src/routes/refunds-handlers/mutation-handlers.ts`
  - `worker/src/routes/features-router.ts`
  - `worker/src/routes/admin-qr.ts`
  - `worker/src/routes/campaigns-handlers/routes.ts`
  - `worker/src/routes/admin-audit-logs-handlers/routes.ts`
  - `packages/domain/payment/commands/momo-create.ts`
  - `worker/src/routes/openapi-payments-handlers/routes.ts`
  - `worker/src/routes/openapi-payments-handlers/mutation-handlers.ts`
  - `worker/src/routes/openapi-payments-handlers/read-handlers.ts`
  - `worker/src/routes/openapi-payments-handlers/web-payment-handlers.ts`
  - `worker/src/routes/webhooks/momo.ts`
  - `worker/src/__tests__/routes/webhooks-momo-smoke.test.ts`
  - `worker/src/__tests__/routes/openapi-payments.test.ts` (or add new tests)

---

## Implementation Steps
1. Update `requireAuth(['owner', 'manager', 'staff'])` across operational and admin route handlers.
2. In `openapi-payments-handlers/`:
   - Update `routes.ts` middleware.
   - Add customer ownership checks and CSPRNG IDs in `mutation-handlers.ts`, `read-handlers.ts`, and `web-payment-handlers.ts`.
3. In `webhooks/momo.ts`:
   - Fail closed with HTTP 500 when `MOMO_SECRET_KEY` is missing.
4. Add regression tests for manager access, payment IDOR rejection, and MoMo webhook fail-closed behavior.
5. Execute full test suite, typecheck, lint, and gate verification.

---

## Todo List
- [x] Add 'manager' role to KDS, POS, orders, tables, checkin, refunds, and feature routes
- [x] Harden OpenAPI payments route authorization, customer IDOR guards, and CSPRNG IDs
- [x] Fail closed on unconfigured MOMO_SECRET_KEY in MoMo webhook
- [x] Add regression tests for Phase 14 changes
- [x] Run `npm run lint`, `npm run typecheck:all`, `npm run verify:gates`, and `npx vitest run`

---

## Success Criteria
- Store managers can successfully perform KDS updates, POS checkouts, table status changes, and view analytics/reports.
- Customers cannot create or view payments for orders that do not belong to them (HTTP 403 IDOR rejection).
- Requests to `/api/webhooks/momo` without `MOMO_SECRET_KEY` return HTTP 500 instead of skipping verification.
