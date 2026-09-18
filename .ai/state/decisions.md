# Decisions — AURA OS

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
