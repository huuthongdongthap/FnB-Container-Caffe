# Catalog Contract Reconciliation Report

**Recipe:** `recipes/core/cook.json`  
**Command:** `/cook`  
**Goal:** Implement the frozen Catalog contract and reconcile Cloudflare D1 + OpenAPI / runtime handlers.  
**Date:** 2026-10-07  
**Status:** **SUCCESS (All Gates Passed)**

---

## 1. Executive Summary & Architectural Decisions

The catalog subsystem has been formally reconciled and aligned with the frozen source-of-truth contract:

1. **`products` = Canonical Product Master**:
   - Authoritative table for all catalog items across POS, Kitchen Display System (KDS), Recipes/BOM, and ERPNext ledgers.
   - Schema fields: `id TEXT PRIMARY KEY`, `category_id TEXT`, `name TEXT`, `slug TEXT`, `price INTEGER`, `compare_at_price INTEGER`, `description TEXT`, `image_url TEXT`, `tags TEXT`, `badge TEXT`, `is_available BOOLEAN`, `sort_order INTEGER`, `created_at`, `updated_at`.
2. **`categories` = Canonical Category Master**:
   - Authoritative classification table for all products.
   - Schema fields: `id TEXT PRIMARY KEY`, `name TEXT`, `slug TEXT UNIQUE`, `description TEXT`, `sort_order INTEGER`, `image_url TEXT`, `display_name_vi TEXT`, `display_name_en TEXT`, `created_at`, `updated_at`.
3. **`menu_items` = Legacy Customer-Menu Read Projection**:
   - Retained exclusively to satisfy customer-facing QR/online menu views (`GET /api/menu`) without breaking legacy clients.
   - Dual-projection on `/api/menu` serves both legacy `items` array and grouped `data.categories` structure.
4. **Domain IDs Remain `TEXT`**:
   - AURA domain entities maintain flexible string identifiers (`prod_...`, `cat_...`, `tc001`, `hc001`, `ORD-...`).
   - SQLite D1 pragmatism avoids forced binary UUID migration, preserving existing relational keys, test fixtures, and production seed data.
5. **ERPNext Integration Boundary**:
   - ERPNext remains an external integration target via `erpnext_mappings` (`local_type = 'product'`, `local_id = products.id`) and `erpnext_sync_queue`.
   - ERPNext is never an authoritative master.
6. **Inventory Out-of-Scope Isolation**:
   - Recipes link `recipes.product_id` to canonical `products.id`.
   - Raw ingredient and inventory tables (`ingredients`, `stock_movements`, `purchase_orders`) remain completely decoupled from catalog product master records.
7. **Shadow Table & Field Reconciliation**:
   - Shadow tables (`product_translations`, `category_translations`) and shadow columns (`base_price`, `nutrition_info`) are eliminated from the canonical database schema.
   - OpenAPI read handlers project `base_price` dynamically from `p.price` and structure default translations in-memory for API consumers requiring schema parity.

---

## 2. DDL Migrations & Canonical Schemas

### A. Backward-Compatible Migration
- **File:** `worker/db/migrations/20261007_01_catalog_canonical_reconciliation.sql`
- **Contents:**
```sql
-- 20261007_01_catalog_canonical_reconciliation.sql
-- Catalog DB Contract Reconciliation:
-- 1. Freezes products as canonical Product master table.
-- 2. Ensures categories has image_url and sort_order indexes.
-- 3. Adds missing slug, compare_at_price, sort_order to products table.
-- 4. Ensures legacy menu_items customer-menu projection has image_url column.

ALTER TABLE categories ADD COLUMN image_url TEXT;

ALTER TABLE products ADD COLUMN slug TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN compare_at_price INTEGER;
ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;

ALTER TABLE menu_items ADD COLUMN image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
```

### B. Canonical D1 Schemas (`worker/schema.sql`)
- **`categories` Table**:
  ```sql
  CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      image_url TEXT,
      display_name_vi TEXT,
      display_name_en TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- **`products` Table**:
  ```sql
  CREATE TABLE products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT DEFAULT '',
      price INTEGER NOT NULL,
      compare_at_price INTEGER,
      description TEXT,
      image_url TEXT,
      tags TEXT,
      badge TEXT,
      is_available BOOLEAN DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
  );
  ```

---

## 3. Changed Handlers & Subsystems

| Module | File Path | Key Changes & Contract Enforcement |
|:---|:---|:---|
| **Domain Products Router** | `packages/domain/catalog/commands/products.ts` | Aligned CRUD with canonical columns (`name`, `slug`, `price`, `compare_at_price`, `category_id`, `image_url`, `is_available`, `sort_order`). Scoped authorization to `owner`, `manager`, `staff`. |
| **Domain Categories Router** | `packages/domain/catalog/commands/categories.ts` | Enforced category CRUD over `categories` table with `sort_order`, `slug`, `image_url`. Added auth guards on mutations. |
| **OpenAPI Products Read** | `worker/src/routes/openapi-products-handlers/read-handlers.ts` | Direct SQL query against canonical `products` with `LEFT JOIN categories`. Dynamic sort whitelist supporting `sort_order`, `name`, `price`, `base_price`. |
| **OpenAPI Products Helpers** | `worker/src/routes/openapi-products-handlers/helpers.ts` | Standardized `formatProduct` DTO mapping from DB row `price` to response `base_price` and memory translations. |
| **Product Validators** | `worker/src/lib/validators/products.ts` | Zod schema validation for canonical properties, with input preprocessors translating legacy frontend keys (`basePrice` -> `price`, `categoryId` -> `category_id`). |

---

## 4. Downstream Relational Integrity Preserved

All dependent downstream foreign keys and linkages were validated:

1. **`order_items.product_id` -> `products.id`**:
   - Order line items record `product_id` corresponding to the canonical `products.id`.
2. **`product_modifier_groups.product_id` -> `products.id`**:
   - Modifier groups link directly to `products.id`.
3. **`recipes.product_id` -> `products.id`**:
   - Recipe Bill-of-Materials (BOM) maps each product recipe directly to `products.id`.
4. **`erpnext_mappings.local_id` -> `products.id`**:
   - External ERP synchronization records `local_type = 'product'` and `local_id = products.id`.
5. **Customer Menu (`GET /api/menu`) Contract**:
   - Public menu remains completely unauthenticated and operational, returning both legacy `items` and structured `data.categories`.
6. **Seed Data Integrity**:
   - All 49 seed items (Viva Star physical menu across 10 categories) cleanly seed both `menu_items` and canonical `products`.

---

## 5. Verification & Test Metrics

### A. Fresh In-Memory DB & FK Verification
- **Execution**: Initialized SQLite in-memory instance, executed `worker/schema.sql`, applied `worker/seed.sql`, and evaluated all migrations.
- **Results**:
  - `PRAGMA foreign_key_check`: **0 violations (clean)**
  - Table counts: 10 categories, 49 products, 49 menu items.

### B. Catalog Integration & Security Test Suites
```bash
npx vitest run worker/src/__tests__/integrations/catalog-canonical-reconciliation.test.ts worker/src/__tests__/integrations/catalog-mutation-security.test.ts
```
- **Test Files:** 2 passed (2)
- **Tests:** 23 passed (23)
- **Duration:** 2.02s

### C. Full Project Regression Test Run
```bash
npx vitest run
```
- **Test Files:** 400 passed (400)
- **Tests:** 3,669 passed (3,669)
- **Regressions:** **0**

### D. Static Type & Lint Checks
```bash
npm run typecheck:all
npm run lint
```
- **Frontend TS (`tsc --noEmit`):** 0 errors
- **Worker TS (`tsc --project worker/tsconfig.json --noEmit`):** 0 errors
- **ESLint (`eslint worker/src/ --ext .ts`):** 0 errors, 0 warnings

---

## 6. Blockers & Risks

| ID | Severity | Item | Status / Mitigation |
|:---:|:---:|:---|:---|
| **BLK-01** | Low | Dual table existence (`products` vs `menu_items`) | Fully managed. Public customer menu reads `menu_items`, while admin POS/KDS/inventory routes manage `products`. Dual-table synchronization hooks can be implemented when unifying customer views. |
| **BLK-02** | None | Migration idempotency on D1 | `worker/db/migrations/20261007_01_catalog_canonical_reconciliation.sql` statements are non-destructive and safe for existing D1 databases. |
