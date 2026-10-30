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

### 5. Phase 5 Deep Brainstorm — Working-Tree Convergence & Live Cutover Readiness
- **Track 5A — Dual-Table Unification & Deploy Contract Convergence**:
  - Ship completed Loyalty/Inventory dual-table canonical D1 unification (`261030-0945`: `openapi-loyalty-handlers/*`, `openapi-inventory-handlers/*`, `loyalty.ts`, `inventory-forecasting.ts`, `20261030_02_replica_schema_parity_and_waste_log_cutover.sql`).
  - Ship completed Deployment Contract & Pre-Flight Gates (`261030-1315`: `scripts/deploy-branded.sh`, `scripts/deploy-fix.sh`, `.github/workflows/deploy.yml`, `setup/aura-deploy/*`, `eslint.config.js`, `package.json`).
  - Re-lock `evidence/source-drift-revalidation.json` to the converged `HEAD` and re-verify `run-local-security-dag.py` + `verify-audit-artifacts.py`.
- **Track 5B — D1 Time-Travel Rollback Governance (`GATE_3_ROLLBACK_READINESS`)**:
  - Use `wrangler d1 time-travel restore` + pre-deploy D1 export snapshots as the authoritative rollback mechanism instead of destructive `DROP TABLE`/`DROP COLUMN` `.down.sql` scripts.
- **Track 5C — Out-of-Band Secret Rotation & Staging Gate Provisioning (`SCAN-01..06`, `GATE_4_STAGING_CREDENTIALS`)**:
  - Rotate live Cloudflare API token, `JWT_SECRET`, PayOS, Sepay, SendGrid, OpenAI, and Gemini credentials via `wrangler secret put` without rewriting git history.

### 6. Phase 6 Deep Brainstorm — Edge Telemetry, AI Customer Assistant, Cal.com Bookings & Cron Secret Isolation
- **E1. `/api/chat/assistant` Cross-Tenant Order, Table Bill & Loyalty Profile Leakage (`worker/src/routes/customer-assistant.ts:53,63,88,132`)**:
  - Replace tautological `WHERE (tenant_id = ? OR ? = 'default' OR tenant_id IS NULL)` (which matches all tenants when `tenantId === 'default'`) with `WHERE (tenant_id = ? OR (? = 'default' AND tenant_id IS NULL))`.
  - Fail closed in `catch` fallback blocks unless the error specifically indicates `no such column: tenant_id`.
  - Scope `customers` phone lookup in `loyalty_points` intent by `(tenant_id = ? OR (? = 'default' AND tenant_id IS NULL))`.
- **E2. `/api/edge/telemetry/heartbeat` Secret Enforcement & Constant-Time Check (`worker/src/routes/container-telemetry.ts:30-42`)**:
  - Compare `providedSecret` against `expectedSecret` via `timingSafeEqual`.
  - Enforce `requireAuth(['owner', 'admin', 'manager', 'staff'])` whenever `isProd || Boolean(expectedSecret) || Boolean(c.req.header('Authorization')) || Boolean(providedSecret)` unless valid secret is provided, preventing unauthenticated callers from forging CRITICAL Telegram alerts when `EDGE_TELEMETRY_SECRET` is configured.
- **E3. `/api/cal-booking-webhook/bookings` Tenant Scoping (`worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts:27-55`)**:
  - Filter `reservations` queries by `(tenant_id = ? OR (? = 'default' AND tenant_id IS NULL))` using `getTenantId(c)`.
- **E4. `/cron/alerts` & `/cron/digest` Constant-Time Secret Verification (`worker/src/routes/cron-admin.ts:20-30`)**:
  - Replace `secret === c.env.CRON_SECRET` with `timingSafeEqual(secret, c.env.CRON_SECRET)`.

### 7. Phase 7 Deep Brainstorm — Admin Sales CSV Export, Floor Plan, Table Sessions & Admin Customer Fail-Closed Boundaries
- **F1. `/api/admin/sales/csv` Cross-Tenant Data Export & CSV Formula Injection (`worker/src/routes/admin-sales.ts:32-78`)**:
  - Scope `SELECT * FROM orders` by `getTenantId(c)` (`(tenant_id = ? OR (? = 'default' AND tenant_id IS NULL))`, falling back only on `/no such column:\s*tenant_id/i`).
  - Neutralize CSV formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) in `esc(val)` by prefixing `'` before quoting so customer-controlled fields (`customer_name`, `customer_phone`, `customer_address`, `items`, `notes`) cannot execute spreadsheet formulas.
- **F2. `/api/floor-plan` & `/api/floor-plan/:id/no-show|release` Cross-Tenant Floor Plan Leakage & Table Mutation (`worker/src/routes/floor-plan.ts:47-148`)**:
  - Scope `cafe_tables` and `orders` reads in `loadFloorPlan(db, tenantId)` by `(tenant_id = ? OR (? = 'default' AND tenant_id IS NULL))` and filter `table_sessions` to only those belonging to the tenant's `cafe_tables`.
  - Verify target table belongs to `getTenantId(c)` before executing `POST /api/floor-plan/:id/no-show` or `POST /api/floor-plan/:id/release` (`404` when table belongs to another tenant).
- **F3. `/api/table-sessions` Cross-Tenant Session Listing, Opening & Order Bill-Merge (`worker/src/routes/table-sessions-handlers/session-handlers.ts:11-215`, `worker/src/routes/table-sessions-handlers/order-handlers.ts:8-108`)**:
  - Scope `cafe_tables` and `orders` lookups/updates by `getTenantId(c)` across session list, get, open, patch, order attach (`POST /api/table-sessions/:id/orders`), and session orders list (`GET /api/table-sessions/:id/orders`), preventing cross-tenant table occupation or cross-tenant order attachment.
- **F4. `admin-handlers.ts` Fail-Closed Customer Tenant Fallback (`worker/src/routes/admin-handlers.ts:58-77,207-238`)**:
  - In `getAdminCustomers`, `updateAdminCustomer`, and `deleteAdminCustomer`, preserve `COALESCE(NULLIF(tenant_id, ''), 'default') = ?` in fallback queries unless the database error specifically matches `/no such column:\s*(?:c\.)?tenant_id/i`.

### 8. Phase 8 Deep Brainstorm — POS Customer Lookup, Admin Loyalty Export/KPIs, Admin QR Isolation & Birthday Redemption Guards
- **G1. `/api/pos/customer` Unselected `tenant_id` Column & Cross-Tenant Phone Lookup (`worker/src/routes/pos-customer.ts:48-83`)**:
  - Include `c.tenant_id` in the `SELECT` list and filter `WHERE c.phone = ? AND (c.tenant_id = ? OR (? = 'default' AND c.tenant_id IS NULL))` (with fallback only when `no such column: c.tenant_id`), and scope the `visit_count` subquery on `orders` to the same tenant.
- **G2. `/api/admin-loyalty/*` Multi-Tenant Scoping & CSV Formula Neutralization (`worker/src/routes/admin-loyalty.ts:38-313`)**:
  - Scope `/widgets`, `/tiers`, `/top-customers`, and `/export` queries on `customers` and `orders` by `getTenantId(c)`.
  - Neutralize spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) across all exported CSV cells in `GET /api/admin-loyalty/export`.
- **G3. `/api/admin/qr/*` Cross-Tenant QR Table Isolation & Scoped Regeneration (`worker/src/routes/admin-qr.ts:20-227`)**:
  - Filter `cafe_tables` by `getTenantId(c)` in `GET /api/admin/qr/tables` and `POST /api/admin/qr/regenerate`.
  - Scope `DELETE FROM table_qr_codes` in `/regenerate` to only the current tenant's table IDs instead of wiping all tenants' QR codes, and verify table tenant ownership in `/:slug/download` and `/:slug/png`.
- **G4. `/api/loyalty/birthday/*` Tenant-Scoped Customer Lookup & Redemption Guard (`worker/src/routes/birthday.ts:22-48,194-244`)**:
  - Scope `findBirthdayCustomer` to `getTenantId(c)`.
  - Require staff or matching customer authentication on `POST /redeem` when `JWT_SECRET` or `ENVIRONMENT === 'production'` is active so unauthenticated callers cannot exhaust a customer's annual birthday redemption.

### 9. Phase 9 Deep Brainstorm — Subscription Receipt Ownership, Broadcast Tenant Isolation, Referral PII Masking & Signage Scoping
- **H1. `/api/subscriptions/invoices/:id/receipt` Cross-Customer IDOR & Tenant Isolation (`worker/src/routes/subscription-receipt.ts:10-63`)**:
  - Select `s.customer_id, s.tenant_id` alongside `s.customer_name, s.customer_email` in `getInvoiceReceipt`.
  - When the authenticated caller has `role === 'customer'`, require `s.customer_id === user.id || s.customer_email === user.email` (`403` / `404` on mismatch), and enforce `matchesTenantRow(inv, getTenantId(c))` across all roles.
- **H2. `/api/broadcast/send` Cross-Tenant Bulk Messaging & HTML Escaping (`worker/src/routes/broadcast-handlers/send-handler.ts:38-64,136-148`)**:
  - Filter `customers` returned by `segmentSQL(segment)` against `getTenantId(c)` (`SELECT *, ... FROM customers` or row-level tenant check) so broadcasts only target the caller's tenant.
  - Escape HTML special characters (`&`, `<`, `>`, `"`, `'`) in `message` before converting `\n` to `<br>` in `sendEmail`.
- **H3. `/api/loyalty/referral/apply` & `/stats` Tenant Verification & Phone PII Masking (`worker/src/routes/referrals.ts:85-194`)**:
  - Verify `referrer` belongs to the same tenant (`getTenantId(c)`) in `POST /api/loyalty/referral/apply`.
  - Mask `referred_phone` in `GET /api/loyalty/referral/stats` (e.g., `090****123`) so full phone numbers of referred customers are not exposed in plaintext.
- **H4. `/api/signage/menu` & `/api/signage/promos` Tenant Scoping (`worker/src/routes/signage.ts:53-138`)**:
  - Scope `products` and `promotions` queries in `/api/signage/menu` and `/api/signage/promos` by `getTenantId(c)` so tenant-specific promo codes and catalog items are not exposed across stores.

### 10. Phase 10 Deep Brainstorm — Check-In Atomic CAS & Tenant Isolation, Audit Log CSV Neutralization, DinDin Order Scoping & Reviews Isolation
- **I1. `/api/checkin` Cross-Tenant Isolation & Atomic Approval CAS (`worker/src/routes/checkin.ts:43-238`)**:
  - Scope customer lookup in `POST /api/checkin`, check-in ownership in `PATCH /api/checkin/:id/approve` & `PATCH /api/checkin/:id/reject`, and listing in `GET /api/checkin` by `getTenantId(c)`.
  - Enforce conditional `UPDATE checkins SET status = 'approved' ... WHERE id = ? AND status = 'pending'` checking `meta.changes > 0` (`409` on concurrent race) before crediting `cashback_wallets`, and replace `Math.random()` wallet ID generation with CSPRNG.
- **I2. `/api/admin/audit-logs/export` CSV Formula Injection Neutralization (`worker/src/routes/admin-audit-logs-handlers/csv-helper.ts:5-12`)**:
  - Prefix cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with `'` before wrapping in double quotes in `escapeCsv(value)` so user-controlled strings in `actor_name`, `resource_id`, or `details` cannot trigger spreadsheet formula execution.
- **I3. `/api/admin/dindin/*` Cross-Tenant Order Leakage & Unscoped QC Status Mutation (`worker/src/routes/dindin-handlers/checkout-handlers.ts:19-109,208-230`)**:
  - Filter `GET /api/admin/dindin/checkouts` by `getTenantId(c)`.
  - Verify target order belongs to `getTenantId(c)` in `POST /api/admin/dindin/checkout/:orderId/qc` and `/print` (`404` when order belongs to another tenant).
  - Include CSPRNG entropy in `DIN` order IDs and persist `tenant_id` on `POST /api/admin/dindin/checkout`.
- **I4. `/api/reviews` CSPRNG Review IDs & Tenant-Scoped Order Review Isolation (`worker/src/routes/reviews.ts:28-95`)**:
  - Replace `Math.random()` review ID generation with `crypto.getRandomValues`.
  - Verify target `order_id` (when present in `orders`) belongs to `getTenantId(c)` on `POST /api/reviews`, and scope `GET /api/reviews` and `GET /api/reviews/stats` to exclude reviews linked to foreign-tenant orders.

## Unresolved Questions
- None. All findings are reproducible in local harness with unambiguous domain fixes.
