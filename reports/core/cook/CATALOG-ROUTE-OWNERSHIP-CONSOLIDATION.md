# Catalog Route Ownership Consolidation Report

**Recipe / Command:** `/cook`  
**Focus Area:** Catalog Route Ownership Consolidation  
**Date:** 2026-10-07  
**Status:** **SUCCESS (All Verifications Passed, 0 Blockers)**

---

## 1. Audit Summary & Problem Statement

Prior to consolidation, Catalog endpoints suffered from split-brain routing and route shadowing:
1. **Duplicate Mounts on App Root (`worker/src/index.ts`)**:
   - `openApiCategoriesRouter` and `openApiProductsRouter` were mounted at root (`/`) in `worker/src/index.ts`, while `categoriesRouter` and `productsRouter` were mounted under `/api/categories` and `/api/products` via `registerFeatureRoutes(app)` in `features-router.ts`.
   - This created ambiguous dispatch where incoming requests traversed overlapping handlers.
2. **Route Precedence & Parameter Shadowing**:
   - In `categoriesRouter`, `GET /:id` was declared before literal subpaths. Requests to `GET /api/categories/tree` were captured as `:id = "tree"`, leading to 404 "Category not found" errors.
   - Similarly, requests to `GET /api/products/slug/:slug` were subject to parameterized path conflicts.
3. **Incomplete Mutation Coverage**:
   - `PATCH /api/categories/:id` and `POST /api/categories/reorder` were missing from the primary domain router, causing mutations to fall through or fail.
   - Category deletion lacked relational integrity protection against existing products.

---

## 2. Final Route Ownership Map

| Endpoint Path | HTTP Method | Single Runtime Owner | Middleware / Guard | Handler Description |
|---|---|---|---|---|
| `/api/categories/tree` | `GET` | `categoriesRouter` | Public | Literal route registered **before** `/:id`; returns category tree |
| `/api/categories/reorder` | `POST` | `categoriesRouter` | `staffAuth` (`owner`, `manager`, `staff`) | Literal route registered **before** `/:id`; updates `sort_order` |
| `/api/categories` | `GET` | `categoriesRouter` | Public | Returns category collection ordered by `sort_order ASC, name ASC` |
| `/api/categories` | `POST` | `categoriesRouter` | `staffAuth` | Validates `createCategorySchema`, inserts canonical Category |
| `/api/categories/:id` | `GET` | `categoriesRouter` | Public | Fetches single category record by ID |
| `/api/categories/:id` | `PUT` | `categoriesRouter` | `staffAuth` | Idempotent update of category properties |
| `/api/categories/:id` | `PATCH` | `categoriesRouter` | `staffAuth` | Partial update of category properties |
| `/api/categories/:id` | `DELETE` | `categoriesRouter` | `staffAuth` | **409 Conflict Guard**: rejects if category has associated products |
| `/api/products/slug/:slug` | `GET` | `productsRouter` | Public | Literal prefix route registered **before** `/:id`; finds product by slug |
| `/api/products` | `GET` | `productsRouter` | Public | Filters: `category`, `status`/`available`, `search`, `minPrice`, `maxPrice`, `tags` |
| `/api/products` | `POST` | `productsRouter` | `staffAuth` + `audit('product_create')` | Validates slug uniqueness (409 on duplicate), inserts canonical Product |
| `/api/products/:id` | `GET` | `productsRouter` | Public | Fetches single product record with joined `category_name` |
| `/api/products/:id` | `PUT` | `productsRouter` | `staffAuth` + `audit('product_update')` | Idempotent full product update |
| `/api/products/:id` | `PATCH` | `productsRouter` | `staffAuth` + `audit('product_update')` | Partial product update |
| `/api/products/:id` | `DELETE` | `productsRouter` | `staffAuth` + `audit('product_delete')` | **Dependency Guard**: soft-deletes (`is_available=0`) if order_items exist |
| `/api/menu` | `GET` | `customerMenuRouter` | Public | Customer menu projection from `menu_items` table |
| `/api/catalog` | `GET` | `catalogRouter` | Public | Full catalog projection |
| `/api/menu-modifiers/*` | `GET`, `POST`, `PUT`, `DELETE` | `menuModifiersRouter` | Public / `staffAuth` | Modifiers and modifier group management |

---

## 3. Kept vs. Retired Handlers

### Kept Handlers (Canonical Runtime Owners)
- **`packages/domain/catalog/commands/categories.ts`**:
  - Authoritative runtime owner for `/api/categories`.
  - Enforces static literal precedence (`/tree`, `/reorder` before `/:id`).
  - Implements unified `handleUpdateCategory` supporting both `PUT` and `PATCH`.
  - Added relational product guard: returns 409 Conflict if category has active products.
  - Sized at **106 LOC** (compliant with < 200 LOC rule).
- **`packages/domain/catalog/commands/products.ts`**:
  - Authoritative runtime owner for `/api/products`.
  - Enforces static literal precedence (`/slug/:slug` before `/:id`).
  - Supports comprehensive query filtering (`category`, `available`, `status`, `search`, `minPrice`, `maxPrice`, `tags`).
  - Added slug conflict guard: returns 409 Conflict if slug already exists.
  - Soft-deletes (`is_available = 0`) when `order_items` exist; hard-deletes when unreferenced.
  - Sized at **146 LOC** (compliant with < 200 LOC rule).
- **`worker/src/routes/customer-menu.ts`**:
  - Dedicated public read projection for online customer ordering (`GET /api/menu`).
- **`worker/src/lib/openapi.ts`**:
  - Maintained as schema doc registry for `/api/json` and Scalar docs `/api/docs`.

### Retired Handlers (Removed Duplicates & Redundant Mounts)
- **`worker/src/index.ts` lines 92-93**:
  - **Removed** `app.route('/', openApiCategoriesRouter)`: Redundant runtime mount that shadowed/competed with `categoriesRouter`.
  - **Removed** `app.route('/', openApiProductsRouter)`: Redundant runtime mount that shadowed/competed with `productsRouter`.

---

## 4. Verification & Invariants Matrix

| Invariant / Check | Target Behavior | Result | Evidence |
|---|---|---|---|
| **Route Precedence** | `/api/categories/tree` & `/reorder` not shadowed by `/:id` | **PASS** | `catalog-route-ownership.test.ts` test 1 |
| **Product Slug Precedence** | `/api/products/slug/:slug` not shadowed by `/:id` | **PASS** | `catalog-route-ownership.test.ts` test 2 |
| **Category Delete Guard** | Returns 409 Conflict if category contains products | **PASS** | `catalog-route-ownership.test.ts` test 3 |
| **Public Customer Menu** | `GET /api/menu` accessible without auth | **PASS** | `catalog-route-ownership.test.ts` test 5 |
| **Mutation Authentication** | `POST`, `PUT`, `PATCH`, `DELETE` require valid staff JWT | **PASS** | `catalog-mutation-security.test.ts` (13/13 passed) |
| **Catalog Canonical DB** | `products` & `categories` schema contracts intact | **PASS** | `catalog-canonical-reconciliation.test.ts` (5/5 passed) |
| **Static Analysis** | TypeScript compilation across frontend & worker | **PASS** | `npm run typecheck:all` -> 0 errors |
| **Linter** | ESLint compliance | **PASS** | `npm run lint` -> 0 errors, 0 warnings |
| **Full Regression** | Complete test suite passes | **PASS** | 181 test files, 3,648 tests passed (0 failures) |

---

## 5. Blockers

- **None**. Route consolidation is complete, fully verified, and zero regressions exist across domain packages, runtime worker, and frontend contracts.
