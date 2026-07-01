---
phase: 6
title: "Backend TypeScript Migration + Zod Validation"
status: pending
priority: P1
dependencies: [1]
effort: "10h"
---

# Phase 6: Backend TypeScript Migration + Zod Validation

## Overview

Convert the existing Hono-based Cloudflare Worker from JavaScript to TypeScript with Zod input validation, typed D1/KV bindings, and structured error handling. **The worker already uses Hono v4.12.12** — this is a JS→TS conversion of an existing Hono application, NOT a framework migration.

**Red-team corrections:** All route file extensions in "read-only" list corrected to `.js`. Shared module import paths WILL be updated when `utils/` and `middleware/` are restructured — compatibility re-exports provided. PayOS return URL paths must be updated.

## Architecture

```
worker/
├── src/
│   ├── index.ts                  # Hono app entry (convert from index.js)
│   ├── app.ts                    # Route registration + middleware
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification (convert from admin-auth.js)
│   │   ├── cors.ts               # CORS + jsonResponse/errorResponse helpers
│   │   ├── rate-limit.ts         # D1-based rate limiter
│   │   ├── logger.ts             # Structured request logging (convert from utils/logger.js)
│   │   └── error-handler.ts      # Global error boundary → JSON responses
│   ├── routes/
│   │   ├── auth.ts, menu.ts, orders.ts, loyalty.ts
│   │   ├── referrals.ts, payments.ts, reservations.ts
│   │   ├── contact.ts, stats.ts, cron.ts, webhooks.ts
│   │   └── compatibility/        # Re-export shims for unconverted routes
│   ├── lib/
│   │   ├── db.ts                 # D1 client (typed)
│   │   ├── kv.ts                 # KV helpers
│   │   ├── jwt.ts                # JWT sign/verify
│   │   └── validators.ts         # Zod schemas (shared with frontend)
│   ├── types/
│   │   ├── api.ts, models.ts, env.ts
│   └── __tests__/
│       ├── routes/ (auth.test.ts, menu.test.ts, orders.test.ts, ...)
│       └── middleware/ (auth.test.ts, rate-limit.test.ts, error-handler.test.ts)
├── package.json                  # Already has hono ^4.12.12
├── tsconfig.json                 # NEW
├── vitest.config.ts              # NEW
└── wrangler.toml                 # Existing, may need compatibility_date
```

## Files NOT Touched (Business Logic Preserved)

These route files have their business logic preserved. Import paths WILL be updated to match refactored shared modules:

```
worker/src/routes/erpnext.js          # Owned by 260630-1948-erpnext-migration
worker/src/routes/erpnext-pos.js
worker/src/routes/erpnext-invoices.js
worker/src/routes/mixpost.js          # Owned by 260701-0040-mixpost (complete)
worker/src/routes/pretix.js           # Owned by 260701-0120-pretix (complete)
worker/src/routes/mautic-bridge.js    # Owned by 260630-2230-mautic (complete)
worker/src/routes/cal-booking-webhook.js  # Owned by 260630-2147-cal-com (complete)
worker/src/routes/signage.js          # Owned by 260701-0000-xibo (complete)
worker/src/routes/zalo.js             # Standalone, read-only
```

**Compatibility strategy:** When `utils/logger.js` → `lib/logger.ts`, keep `utils/logger.js` as a re-export shim: `export { createLogger } from '../lib/logger'`. Same pattern for `middleware/cors.js`. Unconverted routes continue importing from `.js` shims; converted routes import from `.ts` modules directly.

**Note:** No `odoo*` route files exist in the worker. Removed from "read-only" list.

## Critical: PayOS Return URL Fix

`worker/src/routes/payment.js:86-87` hardcodes `checkout.html?payment=pending`. After React migration, this is a 404. MUST update to:
```ts
const returnUrl = `${baseUrl}/checkout?payment=pending&order_id=${order_id}`;
const cancelUrl = `${baseUrl}/checkout?cancelled=true&order_id=${order_id}`;
```
Or make the path an env var (`FE_CHECKOUT_PATH`) for independent deployability.

## TDD: Tests to Write First

1. `worker/src/__tests__/routes/auth.test.ts` — register valid/invalid, login returns JWT, me requires auth, logout invalidates
2. `worker/src/__tests__/routes/menu.test.ts` — list all, filter by category/available, get by ID, 404 on missing
3. `worker/src/__tests__/routes/orders.test.ts` — create order, get by ID, update status, admin list with filters
4. `worker/src/__tests__/routes/loyalty.test.ts` — get tier/points, earn points on order, redeem reward, tier upgrade
5. `worker/src/__tests__/routes/payments.test.ts` — PayOS webhook signature, order status update, IPN idempotency, PayOS return URL uses new React paths
6. `worker/src/__tests__/middleware/auth.test.ts` — valid JWT passes, expired rejects, missing returns 401
7. `worker/src/__tests__/middleware/error-handler.test.ts` — ZodError → 400 with field errors, generic Error → 500, AppError → status code
8. `worker/src/__tests__/middleware/rate-limit.test.ts` — within limit passes, after threshold blocks, window reset
9. `worker/src/__tests__/lib/jwt.test.ts` — sign/verify roundtrip, expiry, invalid signature
10. `worker/src/__tests__/lib/validators.test.ts` — matches frontend validators, VN phone regex, payment method enum (cod|payos only)

## Implementation Steps

### 6.1 Pre-Flight: Re-verify File Ownership
- Check `260630-1948-erpnext-migration` plan status and file changes before touching any worker routes
- Verify which shared modules are imported by read-only routes
- Create compatibility shim plan for each shared module being moved

### 6.2 TypeScript Conversion (P1: Core Routes)
- Convert `worker/src/index.js` → `worker/src/index.ts` (preserve existing Hono app structure)
- Auth routes: register/login/logout/me (match existing API contract exactly)
- Menu routes: list with filters, get by ID
- Orders routes: create with validation, get/update, admin list, **add Zod enum on payment_method (cod|payos)**
- Payments routes: PayOS webhook receiver, **update return URLs to new React paths**

### 6.3 TypeScript Conversion (P2: Engagement + Ops)
- Loyalty routes: tier/points/rewards/checkin/birthday
- Referrals routes: code generation, stats, **flat 10,000đ cashback (v3)**
- Reservations routes: tables CRUD, Cal.com webhook
- Contact, Stats, Cron routes
- Webhook routes: unified receiver

### 6.4 Shared Types + Compatibility Shims
- Extract Zod validators to shared location (used by both frontend and worker)
- API contract types (request/response shapes, error format)
- D1 model types matching migration schema
- Environment bindings type for Hono `Env`
- Create re-export shims for unconverted routes (`utils/logger.js`, `middleware/cors.js`)

### 6.5 Integration Verification
- Test: frontend (React) → worker → D1 → response (full flow)
- Verify PayOS IPN webhook end-to-end with new return URLs
- Verify JWT auth flow across all protected routes
- Run ALL 814 existing tests against refactored worker
- Deploy to staging worker first (`wrangler deploy --env staging`), run contract tests, then promote

## Success Criteria

- [ ] All 10 TDD test files written and passing
- [ ] All 814 existing tests pass against refactored worker
- [ ] API responses match existing contract (field names, status codes, error format)
- [ ] PayOS return URLs updated to new React paths
- [ ] Zod enum validation on payment_method (cod|payos only)
- [ ] 0 TypeScript errors, 0 lint errors
- [ ] Worker deploys to staging, contract tests pass, then promote to production
- [ ] All read-only route imports resolved via compatibility shims
- [ ] D1 migrations apply cleanly (no schema changes)
- [ ] Pre-flight re-verification of ERPNext plan boundaries complete

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Route behavior mismatch breaks frontend | Contract tests: replay real request/response pairs |
| JWT library change breaks tokens | Same secret, same algorithm (HS256), same payload |
| Shared module renames cascade to read-only routes | Compatibility re-export shims; verify all imports resolve |
| PayOS return URL change causes payment redirect failures | Test with PayOS sandbox; add CI contract test for old URL → new URL redirect |
| Staging worker has different D1 bindings | Use same D1 database ID, different env prefix |
