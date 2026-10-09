# Catalog Product → Menu Projection Report

**Recipe / Command:** `/cook`  
**Focus Area:** Catalog Product → Menu Projection Synchronization  
**Date:** 2026-10-07  
**Status:** **SUCCESS (All Verifications Passed, 0 Blockers)**

---

## 1. Executive Summary & Problem Statement

Prior to this synchronization implementation:
1. **Dual-Table Divergence**:
   - `products` served as the internal product master for POS, KDS, inventory, and staff catalog mutations (`/api/products`).
   - `menu_items` served as the customer-facing read projection queried by `GET /api/menu` (`getCustomerMenu`).
   - No runtime synchronization path existed: mutations to `products` (create, price updates, availability toggles, soft-deletes) did not propagate to `menu_items`, causing customer-facing menu drift.
2. **Contract Preservation Requirements**:
   - `products` must be the sole canonical source of truth for products.
   - `menu_items` is strictly a downstream customer-facing read projection.
   - TEXT ID policy, existing seed data (49 items), and the public `GET /api/menu` contract must remain 100% compatible.
   - Zero modifications to Order snapshots, pricing policies, inventory, ERPNext, or UI.

---

## 2. Projection Contract

### Master vs. Projection Matrix

| Attribute | Canonical Master (`products`) | Customer Read Projection (`menu_items`) | Mapping Rule |
|---|---|---|---|
| **ID** | `TEXT PRIMARY KEY` | `TEXT PRIMARY KEY` | Exact 1:1 ID preservation (`p.id = m.id`) |
| **Category** | `category_id TEXT` (FK `categories.id`) | `category TEXT` (slug) | Resolved from `categories.slug` (fallback: `category_id`) |
| **Name** | `name TEXT NOT NULL` | `name TEXT NOT NULL` | Direct copy |
| **Price** | `price INTEGER NOT NULL` | `price INTEGER NOT NULL` | Direct copy (integer VND cents) |
| **Compare-at Price**| `compare_at_price INTEGER` | *Excluded* | Customer-safe exclusion (internal operational field) |
| **Description** | `description TEXT` | `description TEXT` | Direct copy (`description \|\| ''`) |
| **Image URL** | `image_url TEXT` | `image_url TEXT` | Direct copy (`image_url \|\| ''`) |
| **Tags** | `tags TEXT` (JSON) | `tags TEXT` (JSON) | Direct copy (`tags \|\| null`) |
| **Badge** | `badge TEXT` | `badge TEXT` | Direct copy (`badge \|\| null`) |
| **Availability** | `is_available BOOLEAN` (0/1) | `available BOOLEAN` (0/1) | Normalized to integer flag `(is_available ? 1 : 0)` |
| **Timestamps** | `updated_at DATETIME` | `updated_at DATETIME` | Synchronized on every mutation |

### Defined Lifecycle Behaviors

1. **Create (`POST /api/products`)**:
   - Inserts product row into `products`.
   - Atomically executes `syncProductToMenuProjection(db, id)` which resolves `categories.slug` and performs `INSERT INTO menu_items ... ON CONFLICT(id) DO UPDATE SET ...`.
2. **Update (`PUT` / `PATCH /api/products/:id`)**:
   - Updates `name`, `slug`, `price`, `description`, `category_id`, `image_url`, `tags`, `sort_order` in `products`.
   - Executes `syncProductToMenuProjection(db, id)` to update projection fields and category slug in `menu_items`.
3. **Availability Change**:
   - Updating `is_available` to `0` or `1` immediately syncs `menu_items.available = (is_available ? 1 : 0)`.
   - Items with `available = 0` are excluded by default in customer menu query `getCustomerMenu` (`WHERE available = 1`).
4. **Soft-Delete / Archive**:
   - If referenced by `order_items`, `DELETE /api/products/:id` sets `products.is_available = 0`.
   - Executes `syncProductAvailabilityProjection(db, id, 0)`, immediately hiding item from public customer menu while maintaining relational integrity for order history.
5. **Hard-Delete**:
   - If unreferenced by `order_items`, removes row from `products`.
   - Executes `deleteProductProjection(db, id)`, deleting record from `menu_items`.
6. **Category Slug Rename**:
   - If `categories.slug` changes in `categoriesRouter`, `syncCategorySlugToMenuProjection(db, catId, newSlug)` updates `menu_items.category` for all child products.
7. **Drift Healing**:
   - `reconcileAllMenuProjections(db)` provides an automated reconciliation routine to reproject all active canonical products into `menu_items`.

---

## 3. Sync & Mapping Implementation

### A. Dedicated Projection Engine
- **`packages/domain/catalog/policies/menu-projection.ts`** (174 LOC):
  - `mapProductToMenuProjection(product, categorySlug)`: Pure mapping function.
  - `syncProductToMenuProjection(db, productId)`: D1 prepared upsert statement.
  - `syncProductAvailabilityProjection(db, productId, isAvailable)`: Target flag update.
  - `deleteProductProjection(db, productId)`: Projection removal.
  - `syncCategorySlugToMenuProjection(db, categoryId, newSlug)`: Category slug sync.
  - `reconcileAllMenuProjections(db)`: Full-table drift healing.

### B. Command Hook Wiring
- **`packages/domain/catalog/commands/products.ts`** (155 LOC):
  - Authoritative runtime owner for `/api/products`.
  - Wired `syncProductToMenuProjection` on `POST /` and `handleUpdateProduct` (PUT/PATCH).
  - Wired `syncProductAvailabilityProjection` (soft-delete) and `deleteProductProjection` (hard-delete) on `DELETE /:id`.
- **`packages/domain/catalog/commands/categories.ts`** (110 LOC):
  - Wired `syncCategorySlugToMenuProjection` on `PUT` / `PATCH /:id` when category slug changes.
- **`worker/src/routes/openapi-products-handlers/mutation-handlers.ts`** (195 LOC):
  - Wired projection sync on OpenAPI mutation endpoints.

---

## 4. Changed Files Summary

| File | Change Type | LOC | Purpose |
|---|---|---|---|
| `packages/domain/catalog/policies/menu-projection.ts` | **NEW** | 174 | Deterministic projection engine and mapping functions |
| `packages/domain/catalog/commands/products.ts` | Modified | 155 | Integrated projection sync into single runtime product owner |
| `packages/domain/catalog/commands/categories.ts` | Modified | 110 | Integrated category slug projection update |
| `packages/domain/catalog/model/catalog-types.ts` | Modified | 66 | Added `tags` and `badge` fields to `Product` interface |
| `packages/domain/catalog/index.ts` | Modified | 47 | Exported projection functions and types from barrel |
| `worker/src/routes/openapi-products-handlers/mutation-handlers.ts` | Modified | 195 | Synchronized OpenAPI mutation handlers |
| `worker/src/__tests__/integrations/catalog-product-menu-projection.test.ts` | **NEW** | 198 | Automated test suite verifying zero-drift sync invariants |

*All files strictly adhere to the project standard of < 200 LOC per file.*

---

## 5. Verification & Invariants Matrix

| Invariant / Check | Expected Behavior | Result | Evidence |
|---|---|---|---|
| **Product Creation Sync** | `POST /api/products` creates master row and upserts into `menu_items` | **PASS** | `catalog-product-menu-projection.test.ts` test 1 |
| **Customer-Safe Projection** | `menu_items` receives customer fields, excludes `compare_at_price` | **PASS** | `catalog-product-menu-projection.test.ts` test 1 |
| **Product Update Sync** | `PATCH /:id` updates master row and projection row synchronously | **PASS** | `catalog-product-menu-projection.test.ts` test 2 |
| **Soft-Delete Sync** | Product soft-delete sets `menu_items.available = 0` | **PASS** | `catalog-product-menu-projection.test.ts` test 3 |
| **Hard-Delete Sync** | Product hard-delete removes row from `menu_items` | **PASS** | `catalog-product-menu-projection.test.ts` test 3 |
| **Drift Healing** | `reconcileAllMenuProjections` projects all canonical products | **PASS** | `catalog-product-menu-projection.test.ts` test 4 |
| **Route Ownership Tests** | Literal precedence and category/product guards pass | **PASS** | `catalog-route-ownership.test.ts` (5/5 passed) |
| **TypeScript Compilation** | Zero type errors across frontend and worker | **PASS** | `npm run typecheck:all` -> 0 errors |
| **ESLint Compliance** | Strict linting rules honored | **PASS** | `npm run lint` -> 0 errors, 0 warnings |
| **Full Regression Suite** | 402 test files, 3,678 tests passing | **PASS** | `npm test` -> 3,678/3,678 passed (0 failures) |
| **Production Build** | Frontend production bundle | **PASS** | `npm run build` -> vite: build ok |

---

## 6. Remaining Blockers

- **None**. The Catalog Product → Menu projection is completely implemented, deterministic, zero-drift verified, and fully integrated with existing runtime routes and database models.
