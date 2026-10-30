# Deep Brainstorm Report: Zero-Error D1 Query Priority & Menu/Table UX Parity (`2026-10-30`)

- **HEAD:** `3083c95713b192a2cf2a4aa98333f576d8028a49` (dirty tree preserved)
- **Tracked Product Diff SHA-256 (`source-baseline.json`):** `9f34e2f6a196e48ea8061e7b46b743f0db32b6725ad6567c1a1db03b0e207da5`
- **Environment:** Local Node v22.22.3 (`node:sqlite` compiler probe over `1,350` `.prepare()` statements against the 126-table production replica + `20261029_01..11` + `20261030_01`)
- **Cloud/Live Gate Status (`DB_ADMIN_LIVE`, `REAL_STAFF_ROSTER`, `DEPLOYED_ORIGIN_LIVE`, `PRODUCTION_READINESS`):** **`UNKNOWN / NOT_RUN`** (no remote D1/cloud/deploy commands executed).

---

## 1. Executive Context & Why This Phase Exists

In Plan `261030-0035-post-cutover-live-hardening-and-data-completeness`, we backfilled all 49 drink packshots (`20261030_01`), populated `recipe_ingredients` (`46` rows) and `cron_jobs` (`5` rows), hardened `public/_redirects` and `public/sw.js`, and fixed `cash-reconciliation-policy.ts` to query `staff_shifts` before legacy `shifts`.

To ensure **zero hidden SQL or UX traps remain across the entire monorepo**, we executed a full `node:sqlite` statement-compilation audit across all **1,350** `.prepare(...)` queries in `worker/src/**` and `packages/domain/**` against the 126-table production D1 replica (`20261029_03..11` + `20261030_01`), combined with a cross-surface UI contract trace of `/menu`, `/order`, and `/pos/tables`.

---

## 2. Empirical Findings (Verified with File:Line & SQL Compiler Evidence)

### Finding 1 — 5 Worker Route Handlers (20 Primary SQL Queries) Still Query Non-Existent Legacy Tables (`tables`, `vendors`, `dindin_carts`, `bookings`) Before Canonical D1 Tables
- **Evidence**:
  - Compiling all `1,350` `.prepare()` statements against the 126-table production replica identified 5 route handlers where the primary `try` block queries a non-existent table name, throwing `SQLITE_ERROR: no such table` on every request before falling back to the canonical D1 table in `catch`:
    1. **`worker/src/routes/openapi-tables-handlers/table-crud-handlers.ts`** (`lines 50, 55, 144, 189, 209, 277, 316, 328, 400, 423, 461, 492, 518` — 13 queries across `GET/POST/PATCH/DELETE /api/tables` & `/api/tables/bulk-status`): queries `FROM tables` first instead of canonical `cafe_tables`. Additionally, `allowedSorts` (`lines 35-43`) maps `created_at: 't.created_at'` (which does not exist on `cafe_tables`, causing a second caught exception when sorting by `created_at`) and omits `name: 't.name'` and `code: 't.code'` even though `sort = 'name'` is the default on line 12.
    2. **`worker/src/routes/openapi-tables-handlers/zone-crud-handlers.ts`** (`lines 114, 341` in `GET /api/table-zones/:id` and `DELETE /api/table-zones/:id`): queries `FROM tables WHERE zone_id = ?` first instead of `cafe_tables`.
    3. **`worker/src/routes/erpnext/vendors.ts`** (`line 37` in `GET /api/erpnext/vendors`): queries `FROM vendors` first instead of canonical `suppliers`.
    4. **`worker/src/routes/dindin-handlers/cart-handlers.ts`** (`line 19` in `GET /api/dindin/carts`): queries `FROM dindin_carts` (plural) first instead of canonical `dindin_cart` (singular).
    5. **`worker/src/routes/cal-booking-webhook-handlers/webhook-handler.ts`** (`lines 44, 63, 76` in `POST /api/cal-booking-webhook`): queries `INSERT INTO bookings` / `UPDATE bookings` first instead of canonical `reservations` (`createReservationFromBooking` / `UPDATE reservations ... WHERE cal_booking_uid = ?`).
- **Impact**:
  - Every production API call to these endpoints wastes 1–15 remote D1 RPC round-trips throwing `no such table` errors before running the actual query.
- **Root-Cause Fix**:
  - Swap query priority in all 5 handlers so canonical production D1 tables (`cafe_tables`, `suppliers`, `dindin_cart`, `reservations`) execute first, retaining `tables`, `vendors`, `dindin_carts`, and `bookings` in `catch` blocks for backward compatibility with legacy unit test mocks.

### Finding 2 — `<RecommendationSection />` on `/menu` Always Returns `null` (`useMenuStore` Unpopulated) & Bypasses `DrinkCustomizerModal` / Cart Thumbnail
- **Evidence**:
  - `src/pages/menu.tsx:86,186` fetches the menu via `useCustomerMenu()` and renders `<RecommendationSection excludeIds={...} />`.
  - However, `src/components/menu/recommendation-section.tsx:23,27,58` reads `const menuItems = useMenuStore((s) => s.items);` and returns `null` when `menuItems.length === 0`. Because `MenuPage` never populates `useMenuStore`, `RecommendationSection` ("Gợi Ý Cho Bạn") is dead code on `/menu`.
  - Furthermore, `recommendation-section.tsx:60-63` calls `addItem({ id: item.id, productId: item.id, name: item.name, price: item.price })` without `image: item.image` and without delegating to `MenuPage.handleAddToCart` (which opens `DrinkCustomizerModal` for craft drinks and required-modifier items like `bt002`).
- **Root-Cause Fix**:
  - Allow `RecommendationSection` to accept optional `items` and `onSelectItem` props from `MenuPage` (falling back to `useMenuStore` and `addItem({ ..., image: item.image })` when omitted).

### Finding 3 — `TableOrder.tsx` (`/order` & `/pos/tables`) Displays Non-Existent Tables `13`–`20` (`404` on Check-In) & Uses Room Photos Instead of Drink Packshots
- **Evidence**:
  - Canonical D1 `cafe_tables` (`worker/seed.sql:164-176`) and `table_qr_codes` (`20261029_05:189-201`) define **12 tables (`01`–`12`)**, matching `src/pages/checkout.tsx:91-94`.
  - However, `src/pages/TableOrder.tsx:140-146` (`ZONES_FOR_TABLES`) renders buttons for `Bàn 13`..`Bàn 20`. Clicking `Bàn 13`..`20` and submitting triggers `POST /api/orders/guest-checkin` (`src/pages/TableOrder-hooks.ts:64-86`), which returns `404` (`"Mã QR này không hợp lệ."`) because `resolveOrderCreationTable` (`packages/domain/order/policies/order-creation-scope.ts:41-66`) requires the table to exist in `cafe_tables` (`1`–`12`).
  - Additionally, `AURA_VI_ORDER_ITEMS` in `src/pages/TableOrder.tsx:25-137` uses container room photos (`/photos/IMG_6593.webp`, etc.) instead of `resolveMenuDrinkImage(id)`, and `resolveMenuDrinkPackshots` in `src/lib/menu-drink-images.ts:100-104` does not normalize `ID_ALIASES` (`yo001`..`yo004` -> `yg001`..`yg004`).
- **Root-Cause Fix**:
  - Align `ZONES_FOR_TABLES` in `src/pages/TableOrder.tsx:140-146` with the 12 canonical tables (`01`–`12`).
  - Wire `resolveMenuDrinkImage` in `src/pages/TableOrder.tsx` and normalize `ID_ALIASES` in `resolveMenuDrinkPackshots` (`src/lib/menu-drink-images.ts:100-104`).

---

## 3. Strategic Options (Binh Pháp Matrix)

| Option | Scope | Pros | Cons / Risks | Verdict |
|---|---|---|---|---|
| **Option A: Fix UI Only (`RecommendationSection` + `TableOrder.tsx`)** | Frontend patches only | Restores `/menu` recommendations and fixes `/order` table `13–20` 404s | Leaves 20 primary SQL queries in `table-crud-handlers`, `zone-crud-handlers`, `vendors`, `cart-handlers`, and `cal-booking-webhook` throwing caught `no such table` errors on D1 | Rejected |
| **Option B: Full Canonical D1 Query Priority + Menu/Table UX Parity (Recommended)** | 1. Canonical D1 table priority in all 5 Worker handlers (`cafe_tables`, `suppliers`, `dindin_cart`, `reservations` first)<br>2. Wire `RecommendationSection` on `/menu` to `useCustomerMenu` + `handleAddToCart`<br>3. Align `TableOrder.tsx` to canonical tables `01–12` + `resolveMenuDrinkImage` + `ID_ALIASES` in `resolveMenuDrinkPackshots` | Zero thrown `no such table` D1 round-trips on live 126-table schema; `/menu` recommendations work with 0 extra API calls and full customizer/thumbnail support; `/order` & `/pos/tables` never 404 on table selection; zero new D1 migrations needed | Requires careful fallback preservation in `catch` blocks so legacy unit tests with `tables`/`bookings`/`vendors` mocks still pass | **Selected** |

---

## 4. Implementation Plan Created

- **Plan Directory:** `plans/261030-0315-zero-error-d1-query-priority-and-menu-table-ux-parity/plan.md`
  - **Phase 01:** Canonical D1 Table Query Priority (`table-crud-handlers.ts`, `zone-crud-handlers.ts`, `erpnext/vendors.ts`, `dindin-handlers/cart-handlers.ts`, `cal-booking-webhook-handlers/webhook-handler.ts`)
  - **Phase 02:** `/menu` `RecommendationSection` Live Catalog Wiring & Customizer/Thumbnail Parity (`src/components/menu/recommendation-section.tsx`, `src/pages/menu.tsx`)
  - **Phase 03:** `TableOrder.tsx` Canonical `01–12` Table Alignment & Drink Packshot Alias Resolution (`src/pages/TableOrder.tsx`, `src/lib/menu-drink-images.ts`)
  - **Phase 04:** Full Regression, 126-Table Replica Verification & Planning DAG Lock

## 5. Unresolved Questions

- None — all 3 findings are 100% local code and contract fixes (no new D1 migration required), ready for immediate execution via `/cook`.
