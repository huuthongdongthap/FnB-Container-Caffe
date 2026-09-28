# Decisions — AURA OS

## Backend Stabilization & Edge Resilience

### D-17: Guest Checkout Unblocked via Optional Authentication on Payment Creation
**Decision:** `POST /api/payment/create-link` (PayOS) and `POST /momo/create/create` use `optionalAuth()` instead of `requireAuth()`.
**Rationale:** Guests scanning QR codes at tables or placing orders from the web storefront do not have customer JWT accounts. Enforcing `requireAuth` returned 401 Unauthorized, completely blocking the payment funnel for guest diners. With `optionalAuth()`, unauthenticated guests can initiate payments while authenticated customer sessions remain protected against IDOR.
**Verification:** `tests/payments.test.ts` and `worker/src/__tests__/routes/payments-momo-smoke.test.ts` assert guest link creation succeeds and cross-customer tampering is rejected with 403.

## M4-D Customer Order Tracking & History UI

### D-12: Domain-Scoped Sub-Router Middleware
**Decision:** Every OpenAPI sub-router applies auth via a domain-prefixed path — `router.use('/api/orders/*', requireAuth(...))` — never `use('*', ...)`.
**Rationale:** Hono sub-routers mounted at the app root (e.g. `app.route('/', openApiOrdersRouter)`) match their wildcard middleware against *every* inbound request, not just their own. A `use('*', ...)` gate therefore 401'd unrelated public endpoints (`/api/health`, `/api/version`) and made the failure look like a broken health check rather than a routing-scope bug.
**Reversibility:** Low — a regression here silently locks down unrelated routes.
**Verification:** `tests/api-versioning.test.ts` asserts `/api/health` and `/api/version` are reachable without credentials.

### D-13: Payments Webhook Path Exempted From Sub-Router Auth
**Decision:** `openApiPaymentsRouter` scopes `requireAuth` to `/api/payments/*` but keeps the inbound provider webhook path outside the gate; the webhook authenticates by signature instead of bearer token.
**Rationale:** Payment providers call the webhook server-to-server and cannot present a user JWT. Applying the domain-wide gate indiscriminately would have broken payment confirmation — a failure mode only reachable once D-12's scoping was introduced.
**Verification:** Payment route tests exercise the webhook path without an `Authorization` header.

### D-14: Positive-Allowlist Customer Projection
**Decision:** `formatCustomerOrder()` builds its object literal field-by-field from an allowlist. It must never spread the raw DB row.
**Rationale:** A spread inverts the default: any column added to `orders` later (margin inputs, supplier references, `server_staff_id`) leaks automatically. An explicit allowlist means new columns stay private until deliberately exposed.
**Fields deliberately omitted:** `source`, `payments`, `customer_id`, `location_id`, `table_id`, `happyHourApplied`, `server_staff_id`, `served_at`, `completed_at`, `cancelled_at`.
**Verification:** `tests/m4d-customer-order-projection.test.ts` asserts each omitted key is `undefined` and that output passes `CustomerOrderResponseSchema`.

### D-15: Line-Item Identifiers Stripped From Guest Payloads
**Decision:** `formatCustomerOrderItem()` drops `id`, `order_id`, `product_id`, `menuItemId`, and reduces modifiers to `{ name, priceAdjustment }`.
**Rationale:** Product and modifier-option IDs are procurement-side references. A guest needs to recognise what they ordered, not resolve it back into the catalog graph. Retaining them would let a client enumerate internal product IDs from order history.
**Verification:** `tests/m4d-customer-order-projection.test.ts` asserts item keys and modifier shapes.

### D-16: Retire Unauthenticated Legacy Order Reads
**Decision:** Removed the unauthenticated `GET /api/orders/:id` and the phone-number-based `GET /api/orders/my-orders`. Order reads flow only through the scoped `GET /api/orders` and `GET /api/orders/:id` handlers.
**Rationale:** The phone-based lookup accepted a caller-supplied number and returned the matching customer's orders with no proof of ownership — a straight data-leak path, and the direct motivation for M4-D.
**Reversibility:** None — deliberately irreversible.
**Verification:** `tests/m4d-order-history.test.ts` asserts a customer token reaches only its own `customer_id` and that unauthenticated callers receive 401.

## M4-C Order Pipeline & Server-Authoritative Cart Engine

### D-08: Server-Authoritative Price Evaluation
**Decision:** All price calculations occur on the server via `calculateOrderSnapshot()`; the client submits intent only (`menuItemId`, `quantity`, modifier choice IDs, `channel`).
**Rationale:** Closes client-side price tampering. Client-supplied `price`, `subtotal`, `totalAmount`, `discountAmount` are stripped by schema validation and never reach the database.
**Verification:** `OrderCreateSchema strips client-supplied price/total/discount fields` in `worker/src/__tests__/routes/openapi-orders.test.ts`.

### D-09: Ownership-Scoped Order Reads (IDOR Prevention)
**Decision:** `GET /api/orders/:id` and `GET /api/orders` scope reads via `resolveCustomerScope()`. Staff roles (`owner`, `manager`, `staff`) see all orders; `customer` role sees only rows whose `customer_id` matches its JWT subject; non-staff with no resolvable owner matches nothing (`AND 1=0`, fail closed).
**Rationale:** Prevents horizontal privilege escalation where one customer inspects another customer's order by guessing or enumerating order IDs.
**Reversibility:** Low — security invariant. Foreign orders return 404 to avoid ID enumeration.
**Verification:** `Security acceptance: IDOR prevention` in `worker/src/__tests__/routes/openapi-orders.test.ts`.

### D-10: Dual-Gate Transition Authorization
**Decision:** `PATCH /api/orders/:id` and `POST /api/orders/:id/cancel` evaluate structural state-machine legality (`canTransition()`, yielding 400) before evaluating role authority (`canActorTransition()`, yielding 403).
**Rationale:** Distinguishes between "this transition makes no sense in the workflow" (client error, fix the request) and "you lack permission to perform this transition" (authorization failure, fix the credentials). Aligns OpenAPI handlers with the canonical `updateOrder` command in `@aura/domain-order`.
**Verification:** `worker/src/__tests__/routes/openapi-orders.test.ts` asserts 400 and 403 are both documented in the OpenAPI route spec and enforced by the handlers.

### D-11: Customer Route-Level Auth Expansion
**Decision:** Broadened `openApiOrdersRouter.use('*', requireAuth(['owner', 'manager', 'staff', 'customer']))` to include `'customer'`.
**Rationale:** The previous gate excluded `'customer'`, making every order route staff-only. Without this change, guest sessions could never authenticate and the ownership-scoped read handlers were dead code.
**Verification:** `Security acceptance: IDOR prevention` suite exercises the customer-token path.

## M4-B Digital Menu

### D-01: Canonical Customer Menu Endpoint
**Decision:** `GET /api/menu` + `GET /api/menu/:id` are the single canonical customer-facing contract.
**Rationale:** Eliminated three-way duplication between legacy flat list, domain projection `/api/catalog/menu/customer`, and CRM `/api/crm/menu` (which exposed a duplicate implementation with potential field leakage).
**Reversibility:** High — legacy `packages/domain/catalog/queries/menu.ts` retained unchanged for backward compatibility.

### D-02: Customer-Safe Projection Layer
**Decision:** `getCustomerMenu()` explicitly selects only `id, name, description, price, category, image_url, tags, available` from `menu_items`.
**Rationale:** Prevents leakage of `cost`, `supplier`, `supplier_price`, `purchase_price`, `ingredient_cost`, `recipe`, `margin`, `profit`, `internal_stock`, `staff_notes`.
**Verification:** `tests/m4b-digital-menu-contract.test.ts` Section 2 asserts FORBIDDEN_FIELDS never appear.

### D-03: Preserve Legacy Query Functions
**Decision:** `getMenu(req, env)` and `getMenuItem(req, env, id)` remain exported and functional.
**Rationale:** `tests/menu.test.ts` and `worker/src/__tests__/routes/menu.test.ts` call these functions directly, not via Hono HTTP routing. Deleting would regress 9 tests. These are internal utilities, not customer-facing routes.
**Note:** The HTTP `/api/menu` route now serves the customer projection; the legacy functions are consumed only by tests.

### D-04: Retire CRM Menu Duplicate
**Decision:** Removed `router.get('/menu', ...)` from `worker/src/routes/crm-handlers/order-handlers.ts` and deleted `tests/crm-customer-menu.test.ts`.
**Evidence:** `grep -rn "crm/menu" src/ worker/ tests/` returned zero callers prior to deletion.

### D-05: Graceful D1 Degradation
**Decision:** D1 query failures return empty customer menu `{ categories: [], totalItems: 0 }` rather than HTTP 500.
**Rationale:** Prevents customer-facing frontend crashes during D1 outages.

### D-06: Locale Strategy
**Decision:** `locale` query param defaults to `vi-VN`; `en-US` supported; `meta.locale` echoed in response.
**Rationale:** Vietnamese-first product; explicit locale metadata enables future i18n without breaking contract.

### D-07: OpenAPI Contract Registered
**Decision:** `MenuRoutes` in `packages/domain/catalog/schemas/menu.ts`, registered in `worker/src/lib/openapi.ts`.
**Rationale:** Satisfies AUDIT #08 — OpenAPI must match runtime.
