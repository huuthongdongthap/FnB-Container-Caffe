# Phase 11: Home Assistant Auth Bypass, Staff Mobile Router Guard, Pretix RBAC & Integration 500 Sanitization

## Context Links
- [Master Audit Plan](plan.md)
- [Phase 10: Multi-Tenant IDOR Isolation, IoT Telemetry Guard & Order Rate-Limit Hardening](phase-10-multi-tenant-idor-and-edge-telemetry-hardening.md)
- `worker/src/routes/homeassistant/index.ts`
- `worker/src/routes/staff-mobile.ts`
- `worker/src/routes/orders-mobile.ts`
- `worker/src/routes/tables-mobile.ts`
- `packages/domain/kitchen/commands/kds-mobile.ts`
- `worker/src/routes/pretix-handlers/routes.ts`
- `worker/src/routes/pretix-handlers/webhook.ts`
- `worker/src/routes/pretix-handlers/generate.ts`
- `worker/src/routes/integrations/tastyigniter.ts`
- `worker/src/routes/integrations/frigate.ts`
- `worker/src/routes/cron-admin.ts`
- `worker/src/routes/wifi.ts`

---

## Overview
- **Priority:** P1 (High — Unauthenticated Smart-Building Control, Mobile Sub-Route Auth Wiring, Pretix RBAC & Webhook Guards)
- **Current Status:** Complete
- **Brief Description:** Eliminate the permissive no-op `requireAuth` fallback and webhook token-omission bypass in `worker/src/routes/homeassistant/index.ts`, wire `requireStaff` across all sub-routes in `worker/src/routes/staff-mobile.ts`, enforce RBAC and production webhook secret guards on Pretix and TastyIgniter routes, and scrub raw `(err as Error).message` from HTTP 500 responses across Home Assistant, Staff Mobile, Pretix, TastyIgniter, Frigate, Cron Admin, and WiFi endpoints.

---

## Key Insights (Verified by Code Inspection)
1. **Home Assistant No-Op `requireAuth` Fallback & Webhook Token-Omission Bypass (`worker/src/routes/homeassistant/index.ts:15-31, 175-182`)**:
   - `homeassistant/index.ts` resolved `requireAuth` from `globalThis.requireAuth` (never defined in Cloudflare Workers runtime) and fell back to `permissiveAuth` (a no-op middleware), leaving `/api/ha/devices`, `/api/ha/devices/:id/toggle`, `/api/ha/climate`, `/api/ha/climate/:id/set`, `/api/ha/scenes`, and `/api/ha/scenes/:id/activate` unauthenticated in production.
   - `POST /api/ha/webhook` evaluated `if (token && token !== secret)`, allowing an attacker who omits `x-ha-token` / `Authorization` / `?token=` to bypass `HA_WEBHOOK_SECRET` verification completely.
2. **Incomplete `requireStaff` Sub-Route Mounting in `staff-mobile.ts` (`worker/src/routes/staff-mobile.ts:31-67`)**:
   - `staffMobileRouter` only attached `requireStaff` to `/devices/*`, `/kds/orders/:id/status`, `/notifications/:id/read`, `/tables/:id`, and `/orders` (exact path), leaving `GET /api/mobile/kds/orders`, `GET /api/mobile/notifications`, `POST /api/mobile/notifications/subscribe`, `GET /api/mobile/tables`, and `GET /api/mobile/orders/:id` without `requireStaff` middleware in the HTTP router pipeline.
   - Additionally, `orders-mobile.ts:49,90,129`, `tables-mobile.ts:29,72`, and `packages/domain/kitchen/commands/kds-mobile.ts:51,107` returned raw `Lỗi: ${(err as Error).message}` on HTTP 500.
3. **Unauthenticated Pretix Order/Check-in/Generate Endpoints & Fail-Open Webhook (`worker/src/routes/pretix-handlers/routes.ts:15-21`, `webhook.ts:19-46`, `generate.ts:104`)**:
   - `/api/pretix/orders`, `/api/pretix/checkin`, and `/api/pretix/generate` had no RBAC middleware, and `POST /api/pretix/webhook` allowed unsigned payloads in production if `PRETIX_WEBHOOK_SECRET` was unset.
4. **TastyIgniter Fail-Open Production Webhook & Raw 500 Leaks (`tastyigniter.ts`, `frigate.ts`, `cron-admin.ts`, `wifi.ts`)**:
   - `POST /api/integrations/tastyigniter/webhook` failed open in production when `TASTYIGNITER_WEBHOOK_SECRET` was unset, and `tastyigniter.ts:55,75,113`, `frigate.ts:39`, `cron-admin.ts:108,126`, and `wifi.ts:92` returned raw `(err as Error).message` in HTTP 500 responses.

---

## Requirements

### Functional Requirements
1. Wire real `requireAuth` from `../../middleware/auth` into `worker/src/routes/homeassistant/index.ts` (enforced in production or when `Authorization` header is present, while honoring `globalThis.requireAuth` if injected by unit tests), fix `POST /api/ha/webhook` to reject missing or mismatched tokens (`!token || token !== secret`) and fail closed in production when no secret is configured, and sanitize HTTP 500 responses.
2. Mount `requireStaff` on all sub-routers (`mobileDevices`, `mobileKds`, `mobileNotifs`, `mobileTables`, `mobileOrders`) in `worker/src/routes/staff-mobile.ts`, and sanitize HTTP 500 responses in `orders-mobile.ts`, `tables-mobile.ts`, and `packages/domain/kitchen/commands/kds-mobile.ts`.
3. Guard `/api/pretix/orders`, `/api/pretix/checkin`, and `/api/pretix/generate` with `requireAuth(['owner', 'manager', 'staff'])` in production or when `Authorization` is provided, enforce `PRETIX_WEBHOOK_SECRET` in production on `POST /api/pretix/webhook`, and sanitize HTTP 500 in `generate.ts`.
4. Enforce `TASTYIGNITER_WEBHOOK_SECRET` in production on `POST /api/integrations/tastyigniter/webhook`, and sanitize HTTP 500 responses in `tastyigniter.ts`, `frigate.ts`, `cron-admin.ts`, and `wifi.ts`.

### Non-Functional Requirements
- Preserve 100% compatibility with existing unit and integration tests (`homeassistant.test.ts`, `pretix-bridge.test.ts`, `mobile-orders.test.ts`, `mobile-tables.test.ts`, `mobile-kds.test.ts`, `mobile-notifications.test.ts`).
- Respect strict git state preservation (no `git reset`, `git stash`, `git commit`, `git push`, or live deployment).

---

## Related Code Files
- **Modify:**
  - `worker/src/routes/homeassistant/index.ts`
  - `worker/src/routes/staff-mobile.ts`
  - `worker/src/routes/orders-mobile.ts`
  - `worker/src/routes/tables-mobile.ts`
  - `packages/domain/kitchen/commands/kds-mobile.ts`
  - `worker/src/routes/pretix-handlers/routes.ts`
  - `worker/src/routes/pretix-handlers/webhook.ts`
  - `worker/src/routes/pretix-handlers/generate.ts`
  - `worker/src/routes/integrations/tastyigniter.ts`
  - `worker/src/routes/integrations/frigate.ts`
  - `worker/src/routes/cron-admin.ts`
  - `worker/src/routes/wifi.ts`
  - `worker/src/__tests__/routes/homeassistant.test.ts`
  - `worker/src/__tests__/routes/mobile-orders.test.ts`
  - `tests/pretix-bridge.test.ts`

---

## Implementation Steps
1. **Home Assistant Auth & Webhook Hardening (`worker/src/routes/homeassistant/index.ts`)**:
   - Import `requireAuth as jwtRequireAuth` from `../../middleware/auth`.
   - Enforce `jwtRequireAuth(roles)` when `isProd || Boolean(c.req.header('Authorization'))` (unless `globalThis.requireAuth` is explicitly set).
   - In `POST /webhook`, require `secret` in production (`503` if unset), and reject when `!token || token !== secret` (`401`).
   - Replace raw `(err as Error).message` on HTTP 500 with generic messages.
2. **Staff Mobile Router & Handler Hardening (`staff-mobile.ts`, `orders-mobile.ts`, `tables-mobile.ts`, `kds-mobile.ts`)**:
   - Attach `.use('*', requireStaff(...))` on `mobileDevices`, `mobileKds`, `mobileNotifs`, `mobileTables`, and `mobileOrders` sub-routers.
   - Replace raw `Lỗi: ${(err as Error).message}` in 500 blocks with sanitized Vietnamese error messages.
3. **Pretix & Integration Hardening (`pretix-handlers/*`, `tastyigniter.ts`, `frigate.ts`, `cron-admin.ts`, `wifi.ts`)**:
   - Add conditional `requireAuth(['owner', 'manager', 'staff'])` middleware to `/orders`, `/checkin`, and `/generate` in `pretix-handlers/routes.ts`.
   - Require `PRETIX_WEBHOOK_SECRET` in production in `pretix-handlers/webhook.ts` and `TASTYIGNITER_WEBHOOK_SECRET` in production in `tastyigniter.ts`.
   - Scrub raw `(err as Error).message` in 500 blocks across `generate.ts`, `tastyigniter.ts`, `frigate.ts`, `cron-admin.ts`, and `wifi.ts`.
4. **Regression Tests**:
   - Add tests in `worker/src/__tests__/routes/homeassistant.test.ts` verifying production unauthenticated rejection (`401`), webhook missing-token rejection (`401`), and sanitized 500 error responses.
   - Add tests in `worker/src/__tests__/routes/mobile-orders.test.ts` verifying full `staffMobileRouter` JWT authentication on `GET /orders/:id` and `GET /tables`, and sanitized 500 error responses.
   - Add tests in `tests/pretix-bridge.test.ts` verifying production auth enforcement on `/orders` and fail-closed webhook guard.

---

## Todo List
- [x] Harden `worker/src/routes/homeassistant/index.ts` auth middleware, webhook token check, and 500 responses
- [x] Wire `requireStaff` across all sub-routers in `worker/src/routes/staff-mobile.ts` and sanitize 500 responses in mobile handlers
- [x] Harden Pretix routes/webhook/generate and sanitize 500 responses in `tastyigniter.ts`, `frigate.ts`, `cron-admin.ts`, and `wifi.ts`
- [x] Add regression tests in `homeassistant.test.ts`, `mobile-orders.test.ts`, and `pretix-bridge.test.ts`
- [x] Run `npm run lint`, `npm run typecheck:all`, `npm run verify:gates`, and `npx vitest run` (436 test files, 3,949 tests passed)

---

## Success Criteria
- Unauthenticated calls to `/api/ha/devices` in production return `401`.
- `POST /api/ha/webhook` with configured `HA_WEBHOOK_SECRET` and omitted token returns `401` (not `200`).
- `staffMobileRouter` authenticates valid staff JWTs on `GET /tables`, `GET /kds/orders`, `GET /notifications`, and `GET /orders/:id`, and rejects unauthenticated requests with `401`.
- `POST /api/pretix/webhook` and `POST /api/integrations/tastyigniter/webhook` fail closed in production when webhook secrets are missing or invalid.
- Zero raw `(err as Error).message` leaks on HTTP 500 in modified routes.
