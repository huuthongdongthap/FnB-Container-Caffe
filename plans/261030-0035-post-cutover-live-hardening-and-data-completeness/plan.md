# Plan: Post-Cutover Live Hardening & Data Completeness

**Plan ID:** `261030-0035-post-cutover-live-hardening-and-data-completeness`
**Created:** 2026-10-30
**Brainstorm Report:** [brainstorm-261030-post-cutover-live-hardening-and-data-completeness.md](../reports/brainstorm-261030-post-cutover-live-hardening-and-data-completeness.md)
**Baseline Commit:** `3083c95713b192a2cf2a4aa98333f576d8028a49` (`tracked_product_diff_sha256: 9f34e2f6a196e48ea8061e7b46b743f0db32b6725ad6567c1a1db03b0e207da5`)

## Overview

Remediate the 4 post-cutover data completeness and edge-routing gaps discovered during live production verification on `aura-space-worker` and `auraspace.cafe`:
1. Backfill canonical drink packshot URLs (`products.image_url` & `menu_items.image_url`) for all 49 SKUs (`bt001`..`yg004`) in D1 and wire `resolveMenuDrinkImage` in `src/pages/menu.tsx`.
2. Backfill `recipe_ingredients` (`46` rows from `recipe_items JOIN recipes`) and seed the 5 canonical `cron_jobs` records in D1.
3. Add `/api/*` routing in `public/_redirects` and harden `public/sw.js` offline order sync so relative `/api/*` calls on `auraspace.cafe` never swallow orders into SPA `index.html`.
4. Swap `getShiftWindow` table query priority in `packages/domain/shift/src/policies/cash-reconciliation-policy.ts` to query `staff_shifts` before legacy `shifts`.
5. Apply migration `20261030_01` to local 126-table production replica and remote D1 `fnb-caffe-db`, redeploy Pages & Worker, and verify live production endpoints (DONE).

## Phases

| Phase | Name | Status | File |
|---|---|---|---|
| 01 | D1 Catalog Image Backfill & Menu UI Resolution | Completed (Live Production Verified) | [phase-01-d1-catalog-image-backfill-and-menu-ui-resolution.md](./phase-01-d1-catalog-image-backfill-and-menu-ui-resolution.md) |
| 02 | BOM `recipe_ingredients` & `cron_jobs` Seed Cutover | Completed (Live Production Verified) | [phase-02-bom-recipe-ingredients-and-cron-jobs-seed-cutover.md](./phase-02-bom-recipe-ingredients-and-cron-jobs-seed-cutover.md) |
| 03 | Pages `/api/*` Proxy & Service Worker Sync Hardening | Completed (Live Production Verified) | [phase-03-pages-api-proxy-and-service-worker-sync-hardening.md](./phase-03-pages-api-proxy-and-service-worker-sync-hardening.md) |
| 04 | Canonical Shift Table Query Priority & Regression Tests | Completed (Live Production Verified) | [phase-04-canonical-shift-table-query-order-and-staging-gate-alignment.md](./phase-04-canonical-shift-table-query-order-and-staging-gate-alignment.md) |
| 05 | Remote D1 Cutover, Redeploy & Live Smoke Verification | Completed (Live Production Verified) | [phase-05-remote-d1-cutover-redeploy-and-live-smoke-verification.md](./phase-05-remote-d1-cutover-redeploy-and-live-smoke-verification.md) |

## Key Dependencies
- Phases 01 and 02 share the additive D1 migration `worker/db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql` (and `.down.sql`).
- Phases 03 and 04 are independent code changes in frontend (`public/`) and shift domain (`packages/domain/shift/`).
- Phase 05 depends on Phases 01–04 passing local Vitest & migration lint gates before remote D1 execution and Pages/Worker deployment.
