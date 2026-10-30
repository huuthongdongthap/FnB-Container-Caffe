# Brainstorm & Remediation Plan — Project Security Audit (2026-10-30)

## Scope & Threat-Model Verification
- Source report: `reports/sec/full-audit/261030-0724-project-security/full-audit-261030-0724-project-security-report.md`
- Verified against live codebase and reproducible audit probes (`financial-controls.audit.test.ts`, `access-probes.test.ts`, `access-order-claim.test.ts`, `scan-probes.test.ts`).
- Preserved product invariants:
  - Non-delivery (`dine_in`, `takeaway`) COD orders remain postpaid and kitchen-preparable before payment (`DEF-POSTPAID`).
  - Delivery (`order_type === 'delivery'`) orders require online prepayment (`payos`) at creation and `payment_status === 'paid'` before appearing in KDS actionable queue or transitioning to `preparing`.
  - Existing 289+ security regression tests remain green.

## Remediation Matrix

### 1. Financial & Fulfillment Controls
- **Delivery prepayment & KDS gating** (`worker/src/lib/validators/order.ts`, `worker/src/routes/orders-hono-handlers/kds-handlers.ts`, `packages/domain/kitchen/commands/kds-mobile.ts`, `packages/domain/kitchen/commands/kds-stream.ts`, `packages/domain/order/policies/order-status-transition.ts`):
  - Reject `order_type === 'delivery'` with `payment_method !== 'payos'` in `createOrderSchema`.
  - Exclude unpaid delivery orders (`COALESCE(order_type, '') = 'delivery' AND COALESCE(payment_status, 'unpaid') != 'paid'`) from KDS active queue queries (fallback-safe if `order_type`/`payment_status` columns absent in minimal test schemas).
  - Block transition to `preparing` in `transitionOrderStatus` when `order_type === 'delivery'` and `payment_status !== 'paid'` (`409`).
- **Promotion tenant scoping, `WELCOME` deactivation, atomic quota reservation, and `/redeem` order validation** (`packages/domain/order/commands/create-order.ts`, `worker/src/routes/promotions-handlers/admin-handlers.ts`, `worker/src/routes/promotions-handlers/validation-handlers.ts`):
  - Query `promotions` by `UPPER(code)` without `is_active = 1` first so explicitly disabled (`is_active = 0`) rows (including `WELCOME`) are rejected instead of falling back to `DEFAULT_WELCOME_PROMO`.
  - Enforce `tenant_id` match against `getTenantId(c)` / `resolvePilotStore(env)` across admin CRUD, `/validate`, `/redeem`, and `handleCreateOrder`.
  - Reserve promotion quota atomically via conditional `UPDATE promotions SET usage_count = usage_count + 1 WHERE UPPER(code) = ? AND is_active = 1 AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)` and inspect `meta.changes` before persisting order; roll back increment if order batch fails.
  - Require existing tenant-matching order in `orders` before `/api/promotions/redeem` increments `usage_count`.

### 2. Access Control, Identity & Multi-Tenant Boundaries
- **Phone-auth email link verification** (`worker/src/tree/loyalty/phone-auth-handler.ts`, `worker/src/tree/auth/login.ts`):
  - Include `emailVerified` and `authVersion` in customer JWTs minted at login.
  - In `/api/loyalty/phone-auth`, allow customer bearer proof for an existing phone customer only when `verifiedPayload.id === customer.id`, or when `verifiedPayload.email === customer.email` AND the email login record in `AUTH_KV` (`user:${customer.email}`) has `email_verified === true`.
- **Cross-client OTP single-use serialization** (`worker/src/tree/loyalty/helpers.ts`):
  - Key `consumedOtpClaims` on `(kv as { data?: object }).data ?? kv` so independent `AUTH_KV` client wrappers sharing a backing store enforce single-use OTP consumption under concurrency.
- **Customer session revocation on password change** (`worker/src/tree/auth/change-password.ts`, `worker/src/tree/auth/login.ts`, `worker/src/lib/staff-session-auth.ts`):
  - Increment `user.auth_version` in `AUTH_KV` (`user:${email}`) on password change and verify `claims.authVersion` against `user.auth_version` in `authenticateRequest` for customer JWTs.
- **Table & report tenant scoping** (`worker/src/routes/tables-mobile.ts`, `packages/domain/table/commands/tables.ts`, `worker/src/routes/reports-handlers/grouped-sales-handlers.ts`, `worker/src/routes/reports-handlers/export-handlers.ts`):
  - Scope mobile and domain table reads/mutations by `getTenantId(c)`.
  - Scope report overview, grouped sales, and CSV export queries by `getTenantId(c)`.
- **Guest order claim tenant & CAS guard** (`worker/src/routes/openapi-orders-handlers/order-claim-handlers.ts`, `packages/domain/customer/policies/order-ownership-policy.ts`):
  - Pass `tenantId: getTenantId(c)` into `claimGuestOrder`.
  - Verify target order `tenant_id` matches caller `tenantId`, and execute conditional `UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ? AND customer_id IS NULL` checking `meta.changes > 0` (`409` on concurrent race loss).

### 3. SAST, Webhook, Rate-Limit, CI, Client Storage & Dev Host Hardening
- **Push subscription auth & SSRF guard** (`worker/src/routes/push.ts`, `worker/src/lib/validators/push.ts`):
  - Require `https:` URL with non-loopback/non-private hostname in `pushSubscribeSchema`.
  - Require authenticated staff session when subscribing with non-customer role or manual staff entry; otherwise force `role = 'customer'`.
- **Zalo webhook fail-closed in production** (`worker/src/routes/zalo-webhook.ts`):
  - Reject webhook in production when `ZALO_OA_SECRET` / `ZALO_WEBHOOK_SECRET` is unset (`503`).
- **Rate-limit atomic serialization & client-error payload ceiling** (`worker/src/middleware/rate-limit.ts`, `worker/src/routes/client-errors.ts`):
  - Serialize per-backing-store + key increments in `rateLimit` middleware so concurrent bursts cannot bypass `maxRequests`.
  - Enforce 64 KB raw payload ceiling on `/api/client-error` (`413`).
- **CI workflow expression hardening** (`.github/workflows/deploy.yml`):
  - Bind workflow inputs via `env:`, validate version UUIDs, quote shell variables, and use `npx --no-install`.
- **CSV formula neutralization & logger recipient redaction** (`worker/src/routes/reports-handlers/export-handlers.ts`, `worker/src/middleware/logger.ts`):
  - Prefix leading `=`, `+`, `-`, `@` in CSV cells with `'`.
  - Add `to` and `recipient` to `REDACTED_KEYS` in logger.
- **Offline order queue session/tenant isolation** (`src/lib/offline-db.ts`, `src/lib/client-session.ts`, `src/hooks/stores/use-order-store.ts`):
  - Stamp `actorId` and `tenantId` on queued offline orders, filter by active session in `getPendingOrders()`, and clear mismatching/logged-out offline orders on `invalidateClientSession()`.
- **Vite dev server loopback binding** (`vite.config.js`):
  - Bind `server.host` to `process.env.VITE_DEV_HOST || '127.0.0.1'`.

### 4. Deep-Hardening & Cross-Surface Convergence
- **Cross-surface KDS prepaid delivery gate** (`packages/domain/kitchen/commands/kitchen-stations.ts`):
  - Exclude unpaid delivery orders from `/api/kitchen-stations/:id/tickets` and block `/api/kitchen-stations/tickets/:orderId/items/:itemId/start` (`409`) until `payment_status === 'paid'`.
- **Domain-wide Zod collection upper bounds** (`worker/src/lib/validators/*`, `worker/src/schemas/*`, `worker/src/routes/*`, `packages/domain/*`):
  - Enforce explicit `.max(...)` bounds across all array-accepting request schemas (`order.ts`, `orders.ts`, `common.ts`, `purchase-orders.ts`, `erpnext.ts`, `mixpost.ts`, `promotions/models.ts`, `tables.ts`, `sop-admin.ts`, `push.ts`, `subscription.ts`, `marketing.ts`, `loyalty/models.ts`, `ingredients.ts`, `cron/models.ts`, `split-orders.ts`, `categories.ts`, `products.ts`, `ai-barista.ts`, `dynamic-pricing.ts`, `tastyigniter.ts`).
- **Fail-closed tenant fallbacks, webhooks, test-harness gating & realtime confinement**:
  - Fail-closed tenant exception paths in `profile-handlers.ts`, `lookup-handler.ts`, and `customer-handlers.ts`.
  - Explicit test-harness environment gating (`ENVIRONMENT=development|test` or `ALLOW_PLAYWRIGHT_TEST_HEADER=true`) for `x-playwright-test` in `auth.ts` and `rate-limit.ts`.
  - Fail-closed webhook signature & secret verification across `nowpayments-ipn.ts`, `zalo-webhook.ts` (including `/simulate` auth gate), `homeassistant/index.ts`, `tastyigniter.ts`, and `pretix/hmac-validator.ts`.
  - Default-tenant confinement on `/api/realtime/kitchen` in `worker/src/index.ts`, canonical Worker `Content-Security-Policy` in `worker/src/middleware/security-headers.ts`, and recipient PII masking in `worker/src/lib/email.ts`.

## Unresolved Questions
- None. All findings are reproducible in local harness with unambiguous domain fixes.
