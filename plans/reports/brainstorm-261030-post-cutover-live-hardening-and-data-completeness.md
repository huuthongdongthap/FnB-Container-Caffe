# Deep Brainstorm Report: Post-Cutover Live Hardening & Data Completeness (`2026-10-30`)

## 1. Executive Context & Live Baseline

Following the Go-Live D1 schema & handler cutover (`b1bdc51`), production infrastructure is live and verified:
- **Cloudflare D1 (`fnb-caffe-db`, `97ae7a5f-fc4d-460d-b019-8535332bd81f`)**: Migrated through `20261029_03..11` (`126` tables, bookmark `00003edf-0000005a-00005113-826a144a2a2537e35c14c09f3b3e1960`).
- **Cloudflare Worker (`aura-space-worker`)**: Live at `https://aura-space-worker.sadec-marketing-hub.workers.dev` (`Version ID: 173e2f58-f622-438f-81c3-d7e19b813ef1`), `/api/health` returning `200 OK` (`database: true`, `latency_ms: 8`).
- **Cloudflare Pages (`fnb-caffe-container` / `auraspace.cafe`)**: Live at `https://auraspace.cafe` (`https://2ee814d8.fnb-caffe-container.pages.dev`).
- **SQL Table Coverage Audit**: Full AST/literal scan of `worker/src` and `packages/domain` against the 126-table production D1 snapshot confirms **0 missing multi-word tables**.

---

## 2. Empirical Findings from Post-Cutover Live Production Probe

### Finding 1 — Live D1 Catalog Image URLs (`products.image_url` & `menu_items.image_url`) Are `NULL` Across All 49 SKUs
- **Evidence**:
  - Live `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/menu` returns `categories: 8, items: 49, withImages: 0` (`"imageUrl": null` on all 49 items `bt001`..`yg004`).
  - Live `GET /api/v1/menu` also returns `image_url: null` for all 49 rows.
  - While `src/components/landing/featured-menu.tsx:22` calls `resolveMenuDrinkImage(item.id, item.imageUrl)` as a client fallback, `src/pages/menu.tsx:28` maps `imageSrc: item.imageUrl ?? ''` directly without calling `resolveMenuDrinkImage(item.id, item.imageUrl)`.
- **Impact**:
  - The primary `/menu` ordering page (`src/pages/menu.tsx`), cart drawer thumbnails, drink customizer modal, and external `/api/v1/menu` consumers receive empty `imageSrc: ""` / `imageUrl: null` despite all 49 WebP/AVIF packshots (`400w`, `800w`, `1200w`) already being deployed on `https://auraspace.cafe/menu/aura-drinks/*.webp`.
- **Root-Cause Fix**:
  1. Create D1 migration `20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql` to backfill `products.image_url` and `menu_items.image_url` for all 49 canonical drink IDs (`bt001`..`yg004`, plus `yo001`..`yo004` aliases) using the exact `/menu/aura-drinks/<slug>.webp` paths from `src/lib/menu-drink-images.ts`.
  2. Wire `resolveMenuDrinkImage(item.id, item.imageUrl)` into `src/pages/menu.tsx:28` (`transformToStitchItem`) for defense-in-depth parity with `featured-menu.tsx`.

### Finding 2 — `recipe_ingredients` (0 Rows vs `recipe_items` 46 Rows) & `cron_jobs` (0 Rows) Data Completeness
- **Evidence**:
  - Live D1 has `recipes` (`14` rows) and `recipe_items` (`46` rows), whereas `recipe_ingredients` (created in `20261029_11`) has `0` rows.
  - `worker/src/routes/openapi-inventory-handlers/ingredient-handlers.ts:319` checks `SELECT COUNT(*) FROM recipe_ingredients WHERE ingredient_id = ?` before allowing ingredient deletion (`INGREDIENT_IN_USE` guard). With `recipe_ingredients` empty, active BOM ingredients in `recipe_items` are not protected from deletion via `/api/v1/inventory/ingredients/:id`.
  - Live D1 `cron_jobs` table has `0` rows, so `GET /api/cron/jobs` and `/api/v1/cron/jobs` return an empty list until each job manually executes or is seeded.
- **Root-Cause Fix**:
  1. In `20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql`, backfill `recipe_ingredients (id, recipe_id, item_id, ingredient_id, quantity, unit)` idempotently from `recipe_items JOIN recipes ON recipes.id = recipe_items.recipe_id`.
  2. Seed the 5 canonical scheduled jobs (`payos_reconciliation`, `campaign_engine`, `erpnext_sync`, `inventory_forecast`, `cashback_expiry`) into `cron_jobs` with `INSERT OR IGNORE`.

### Finding 3 — Cloudflare Pages `/api/*` Fallback Returns SPA `index.html` & Breaks Service Worker Offline Order Sync
- **Evidence**:
  - `curl -sI https://auraspace.cafe/api/health` returns `HTTP/2 200` with `content-type: text/html; charset=utf-8` (the SPA shell) because `public/_redirects` ends with `/* /index.html 200` and has no `/api/*` rule.
  - `public/sw.js:239` (`syncPendingOrders`) calls `await fetch('/api/orders/sync', { method: 'POST', ... })` using a relative path on `https://auraspace.cafe`. Because `/api/orders/sync` is not routed on Pages and Worker uses `POST /api/orders`, the Service Worker receives `200 OK` HTML from `/* /index.html 200` and silently deletes queued offline orders (`store.delete(order.id)`) without ever reaching the Worker!
- **Root-Cause Fix**:
  1. Add `/api/* https://aura-space-worker.sadec-marketing-hub.workers.dev/api/:splat 200` before `/* /index.html 200` in `public/_redirects` so any relative `/api/*` call on `auraspace.cafe` proxies/redirects to the Worker API instead of returning HTML.
  2. Harden `public/sw.js` `syncPendingOrders()` to validate `response.headers.get('content-type')?.includes('application/json')` before deleting queued IndexedDB orders, and target the canonical order creation endpoint (`/api/orders`).

### Finding 4 — `cash-reconciliation-policy.ts` Queries Non-Existent `shifts` Table Before `staff_shifts`
- **Evidence**:
  - Our AST SQL table scan identified `shifts` in `packages/domain/shift/src/policies/cash-reconciliation-policy.ts:37` (`getShiftWindow`).
  - Unlike `shift-lifecycle-policy.ts` (which queries `staff_shifts` first and only falls back to `shifts` for legacy test mocks), `cash-reconciliation-policy.ts:36-50` queries `SELECT clock_in, clock_out FROM shifts WHERE id = ?` first, throwing a D1 exception twice on every shift reconciliation (`getCashPaymentsForShift` + `getCashPayoutsForShift`) before falling back to `staff_shifts`.
- **Root-Cause Fix**:
  - Swap the query order in `getShiftWindow()` in `packages/domain/shift/src/policies/cash-reconciliation-policy.ts` so canonical `staff_shifts` is queried first, preserving the `shifts` fallback only when `staff_shifts` throws or returns null.

---

## 3. Options Evaluated (Binh Pháp Strategic Matrix)

| Option | Scope | Pros | Cons / Risks | Verdict |
|---|---|---|---|---|
| **Option A: Client-Only Patch** | Patch `src/pages/menu.tsx` & `public/_redirects` only | Fast UI fix for `/menu` images | Leaves D1 `products.image_url` & `menu_items.image_url` `NULL` for `/api/v1/menu`, POS, KDS, and Admin; leaves `recipe_ingredients` (`0` rows) and `cron_jobs` (`0` rows) empty | Rejected |
| **Option B: Full Data-Layer + Edge Proxy + Policy Hardening (Recommended)** | Migration `20261030_01` (49 drink images + BOM `recipe_ingredients` + `cron_jobs` seed) + `menu.tsx` + `_redirects` + `sw.js` JSON guard + `cash-reconciliation-policy.ts` query order | Fixes both D1 source-of-truth (`/api/menu` & `/api/v1/menu` return `withImages: 49/49`) and client fallbacks; protects BOM ingredients from accidental deletion; fixes SW silent offline order drop; zero D1 exception noise on shift close | Requires 1 additive idempotent D1 migration + Worker/Pages redeploy | **Selected** |

---

## 4. Verification Criteria for Next `/cook` Execution

1. `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/menu` returns `items: 49, withImages: 49`.
2. `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/v1/menu` returns non-null `image_url` on all 49 catalog items.
3. Remote D1 `recipe_ingredients` count matches `recipe_items` (`46` rows) and `cron_jobs` has `5` canonical rows.
4. `curl -sI https://auraspace.cafe/api/health` no longer serves `text/html` SPA `index.html`.
5. Full unit & integration test suites pass (`0` errors).

## Unresolved Questions
- None — all 4 findings are empirically verified against live production (`b1bdc51`) and local source files.
