# Phase 4 — Security Controls and Admin Auditability

## Overview
**Priority:** P0 · **Status:** Completed 2026-08-25

Harden public and admin surfaces while preserving current JWT/RBAC contracts.

## Delivered
1. **Route auth coverage verified**: All sensitive mutation endpoints now require `requireAuth()` — products, categories, tables (occupy/release/status), orders (checkout, status, COD paid), refunds, staff registration.
2. **Rate limits in place**: Auth endpoints (login/register/verify/refresh) use `AUTH_RATE_LIMIT` (20/5min); order creation uses `ORDER_RATE_LIMIT` (5/10min); webhook endpoints are naturally rate-limited by provider signature verification.
3. **CORS allowlist enforced**: `ALLOWED_ORIGIN_PATTERNS` restricts to production domains, preview deployments, and localhost — no wildcard.
4. **Audit log enhanced** (`audit-log.ts`): Now writes to `audit_logs` table with full schema (`actor_id`, `actor_name`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `created_at`). Auto-extracts resource ID from path params.
5. **JWT + revocation**: Token verification with `AUTH_KV` revocation check (`revoked:{token}`). Role-based access control via `requireAuth(allowedRoles)`.
6. **Input validation**: All mutation endpoints validate via Zod schemas (`createProductSchema`, `updateProductSchema`, `createCategorySchema`, etc.) with `zodErrorResponse`.
7. **Security headers**: Correlation ID middleware (`X-Request-ID`) on all routes; CORS exposes `X-Request-ID` for tracing.

## Files Modified
- `worker/src/middleware/audit-log.ts` — Enhanced to write full audit schema with resource extraction
- `worker/src/routes/products.ts` — Added `requireAuth(['owner'])` + `audit()` to POST/PUT/DELETE
- `worker/src/routes/categories.ts` — Added `requireAuth(['owner'])` + `audit()` to POST/PUT/DELETE
- `worker/src/routes/tables.ts` — Added `requireAuth(['owner','staff'])` + `audit()` to PATCH occupy/release/status
- `worker/src/routes/orders-hono.ts` — Added `requireAuth(['owner','staff'])` + `audit()` to checkout, status, COD paid
- `worker/src/routes/refunds.ts` — Added `requireAuth(['owner','staff'])` + `audit()` to POST refund
- Test helpers: `worker/src/__tests__/test-utils.ts` (mockRequestWithRole), `orders-hono.test.ts`, `tables.test.ts`

## Tests
- Full suite: 1533/1533 passed
- TypeScript: clean

## Success Criteria Met
- Every sensitive mutation is authorized and auditable
- CORS, headers, rate limits, and secret handling verified by automated tests
- No breaking changes to customer-facing flows (guest-checkin remains public)