# Phase 10: Multi-Tenant IDOR Isolation, IoT Telemetry Guard & Order Rate-Limit Hardening

## Context Links
- [Master Audit Plan](plan.md)
- [Phase 09: Webhook, Simulation & Customer PII Hardening](phase-09-webhook-simulation-and-customer-pii-hardening.md)
- `worker/src/middleware/tenant.ts`
- `worker/src/routes/container-telemetry.ts`
- `worker/src/routes/dynamic-pricing.ts`
- `worker/src/routes/inventory-forecasting.ts`
- `worker/src/routes/demand-forecast.ts`
- `worker/src/routes/franchise-locations.ts`
- `worker/src/routes/orders-core.ts`
- `worker/src/routes/orders-unified.ts`
- `worker/src/routes/orders-hono-handlers/guest-handlers.ts`
- `worker/src/routes/analytics-handlers/metrics-handlers.ts`

---

## Overview
- **Priority:** P1 (High — Cross-Tenant IDOR Isolation, Production IoT Alert Spoofing & Order Rate Limiting)
- **Current Status:** Complete
- **Brief Description:** Enforce JWT-bound tenant resolution in `getTenantId(c)` and eliminate `?tenant_id=` Cross-Tenant IDOR across protected edge/analytics/forecasting routes, gate `POST /api/edge/telemetry/heartbeat` in production against unauthenticated Telegram alert spoofing, harden `orderRateLimit` against production `Origin: http://localhost` spoofing, and protect `POST /api/orders/guest-checkout` with rate limiting, positive item quantity/price validation, and sanitized HTTP 500 responses.

---

## Key Insights (Verified by Code Inspection)
1. **Cross-Tenant IDOR & Unresolved JWT `tenantId` (`worker/src/middleware/tenant.ts:59-61` & Protected Routes)**:
   - `getTenantId(c)` only checked `c.get('tenantId')`, which is only populated when `tenantMiddleware` is mounted (`/api/saas/tenants/*`). On routes protected by `requireAuth(...)`, `c.get('user')` holds `user.tenantId` while `c.get('tenantId')` is `undefined`, causing `getTenantId(c)` to always return `'default'` and write franchise data into HQ's `'default'` tenant.
   - Furthermore, protected endpoints in `container-telemetry.ts` (`GET /containers/status`, `GET /containers/:id/history`), `dynamic-pricing.ts` (`GET /rules`), `inventory-forecasting.ts` (`GET /run-rate`, `GET /history`), and `demand-forecast.ts` (`GET /forecast`, `GET /forecast/hourly`) evaluated `const tenantId = c.req.query('tenant_id') || getTenantId(c);` without checking `isHQSuperAdmin(user)`, allowing any franchise user to pass `?tenant_id=other_tenant` and read another tenant's operational data.
2. **Unauthenticated Production IoT Heartbeat & Telegram Alert Spoofing (`worker/src/routes/container-telemetry.ts:25`)**:
   - `POST /api/edge/telemetry/heartbeat` has no authentication or shared secret guard in production (`ENVIRONMENT === 'production' || NODE_ENV === 'production'`), enabling anonymous callers to spoof critical thermal/battery telemetry, trigger `sendTelegramMessage` alerts, and poison `container_telemetry_logs`.
3. **Production `Origin: localhost` Bypass in `orderRateLimit` (`worker/src/routes/orders-core.ts:14-30`)**:
   - `orderRateLimit` bypassed KV rate limiting whenever `Origin` or `Referer` included `localhost` or `127.0.0.1` without checking `!isProd`, and lacked `AUTH_KV` null/error handling.
4. **Unguarded `POST /api/orders/guest-checkout` & Raw 500 Leaks (`guest-handlers.ts:78-154`, `franchise-locations.ts:83`, `metrics-handlers.ts:150`)**:
   - `POST /api/orders/guest-checkout` lacked `rateLimitMiddleware(ORDER_RATE_LIMIT)`, did not reject negative/zero item `qty` or negative `price`, and returned raw `(err as Error).message` on HTTP 500.
   - `franchise-locations.ts:83` and `analytics-handlers/metrics-handlers.ts:150` also returned raw `(err as Error).message` on HTTP 500.

---

## Requirements

### Functional Requirements
1. Update `getTenantId(c)` in `worker/src/middleware/tenant.ts` to resolve tenancy from `c.get('user')` when `c.get('tenantId')` is not set: allow `?tenant_id` / `x-tenant-id` override only when `isHQSuperAdmin(user)` is true, and otherwise confine authenticated users to `user.tenantId ?? 'default'`.
2. Replace `c.req.query('tenant_id') || getTenantId(c)` with `getTenantId(c)` on all authenticated endpoints in `container-telemetry.ts`, `dynamic-pricing.ts`, `inventory-forecasting.ts`, and `demand-forecast.ts`.
3. Gate `POST /api/edge/telemetry/heartbeat` in `container-telemetry.ts` in production (or when auth/secret headers are present) via `x-edge-telemetry-secret` (`EDGE_TELEMETRY_SECRET || WEBHOOK_SECRET`) or `requireAuth(['owner', 'manager', 'staff'])`, and isolate D1 errors with `try/catch`.
4. Gate `localhost`/`127.0.0.1` bypass in `orderRateLimit` (`worker/src/routes/orders-core.ts`) on `!isProd` and guard `c.env?.AUTH_KV`.
5. Add `rateLimitMiddleware(ORDER_RATE_LIMIT)` and positive `qty`/`price` validation to `POST /api/orders/guest-checkout`, and sanitize HTTP 500 responses in `guest-handlers.ts`, `franchise-locations.ts`, and `analytics-handlers/metrics-handlers.ts`.

### Non-Functional Requirements
- Preserve 100% compatibility with existing unit and integration tests (`tenant.test.ts`, `multi-tenant-franchise.test.ts`, `autonomous-edge-ops.test.ts`, `ai-automation.test.ts`, `orders-unified.test.ts`, `order-persistence-tamper-schema.test.ts`).
- Respect strict git state preservation (no `git reset`, `git stash`, `git commit`, `git push`, or live deployment).

---

## Related Code Files
- **Modify:**
  - `worker/src/middleware/tenant.ts`
  - `worker/src/routes/container-telemetry.ts`
  - `worker/src/routes/dynamic-pricing.ts`
  - `worker/src/routes/inventory-forecasting.ts`
  - `worker/src/routes/demand-forecast.ts`
  - `worker/src/routes/franchise-locations.ts`
  - `worker/src/routes/orders-core.ts`
  - `worker/src/routes/orders-unified.ts`
  - `worker/src/routes/orders-hono-handlers/guest-handlers.ts`
  - `worker/src/routes/analytics-handlers/metrics-handlers.ts`
  - `worker/src/__tests__/integrations/multi-tenant-franchise.test.ts`
  - `worker/src/__tests__/integrations/autonomous-edge-ops.test.ts`
  - `worker/src/__tests__/routes/orders-unified.test.ts`

---

## Todo List
- [x] Enhance `getTenantId(c)` in `worker/src/middleware/tenant.ts` to enforce JWT tenant confinement and HQ-only `?tenant_id` override
- [x] Remove direct `c.req.query('tenant_id')` bypass on protected routes in `container-telemetry.ts`, `dynamic-pricing.ts`, `inventory-forecasting.ts`, and `demand-forecast.ts`, and include `manager` in `/api/admin/*` outer RBAC guard (`features-router.ts:71`) so `/api/admin/metrics/forecast` reaches its `['owner', 'manager']` route guard
- [x] Add production auth/secret guard and D1 error sanitization to `worker/src/routes/container-telemetry.ts`
- [x] Harden `orderRateLimit` in `worker/src/routes/orders-core.ts` (`!isProd` guard + `AUTH_KV` safety)
- [x] Add rate limit, positive `qty`/`price` validation, and 500 error sanitization to `guest-handlers.ts`, `franchise-locations.ts`, and `metrics-handlers.ts`
- [x] Add regression tests in `multi-tenant-franchise.test.ts`, `autonomous-edge-ops.test.ts`, and `orders-unified.test.ts`
- [x] Run `npm run lint`, `npm run typecheck:all`, `npm run verify:gates`, and `npx vitest run` (436 test files, 3,943 tests passed)
