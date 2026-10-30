# Plan: Zero-Error D1 Query Priority & Menu/Table UX Parity

**Plan ID:** `261030-0315-zero-error-d1-query-priority-and-menu-table-ux-parity`
**Created:** 2026-10-30
**Brainstorm Report:** [brainstorm-261030-zero-error-d1-query-priority-and-menu-table-ux-parity.md](../reports/brainstorm-261030-zero-error-d1-query-priority-and-menu-table-ux-parity.md)
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654` (`tracked_product_diff_sha256: 906e6969d65af36959b72f8b216c1a485278ee5b70882676392e3fde1c257fb1`)

## Overview

Eliminate the remaining 20 non-canonical primary SQL queries (`tables`, `vendors`, `dindin_carts`, `bookings`) discovered by compiling all 1,350 `.prepare()` statements against the 126-table production D1 replica, restore the dead `<RecommendationSection />` on `/menu` with full `DrinkCustomizerModal` and cart thumbnail parity, and align `/order` (`TableOrder.tsx`) with canonical D1 tables `01–12` and drink packshots:
1. Promote canonical D1 tables (`cafe_tables`, `suppliers`, `dindin_cart`, `reservations`) to primary `try` blocks in `table-crud-handlers.ts`, `zone-crud-handlers.ts`, `erpnext/vendors.ts`, `dindin-handlers/cart-handlers.ts`, and `cal-booking-webhook-handlers/webhook-handler.ts`, keeping legacy table names in `catch` fallbacks.
2. Wire `<RecommendationSection />` on `/menu` (`src/pages/menu.tsx` & `src/components/menu/recommendation-section.tsx`) to use the already-loaded `useCustomerMenu` catalog and `handleAddToCart` customizer flow.
3. Align `ZONES_FOR_TABLES` in `src/pages/TableOrder.tsx` to canonical tables `01–12`, apply `resolveMenuDrinkImage` to `AURA_VI_ORDER_ITEMS`, and normalize `ID_ALIASES` (`yo001`..`yo004`) in `resolveMenuDrinkPackshots` (`src/lib/menu-drink-images.ts`).
4. Verify all unit, integration, replica, and browser E2E probes locally while keeping cloud/remote D1 execution gated (`UNKNOWN/NOT_RUN`).

## Phases

| Phase | Name | Status | File |
|---|---|---|---|
| 01 | Canonical D1 Table Query Priority in Worker Handlers | Complete | [phase-01-canonical-d1-table-query-priority-in-worker-handlers.md](./phase-01-canonical-d1-table-query-priority-in-worker-handlers.md) |
| 02 | `/menu` `RecommendationSection` Live Catalog & Customizer Parity | Complete | [phase-02-menu-recommendation-section-live-catalog-and-customizer-parity.md](./phase-02-menu-recommendation-section-live-catalog-and-customizer-parity.md) |
| 03 | `TableOrder.tsx` Canonical `01–12` Tables & Drink Packshot Aliases | Complete | [phase-03-table-order-canonical-tables-and-drink-packshot-aliases.md](./phase-03-table-order-canonical-tables-and-drink-packshot-aliases.md) |
| 04 | Full Regression, 126-Table Replica Verification & DAG Lock | Complete | [phase-04-full-regression-replica-verification-and-dag-lock.md](./phase-04-full-regression-replica-verification-and-dag-lock.md) |

## Key Dependencies
- Phases 01, 02, and 03 touch completely disjoint file sets (`worker/src/routes/**` vs `src/components/menu/` + `src/pages/menu.tsx` vs `src/pages/TableOrder.tsx` + `src/lib/menu-drink-images.ts`) and can be executed cleanly without conflicts.
- Phase 04 validates all changes across the 126-table production replica, 54 worker integration suites, 47 audit probes, 171 auth regressions, and 57 customer/KDS E2E checks.
