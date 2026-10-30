# Phase 01: D1 Catalog Image Backfill & Menu UI Resolution

## Context Links
- Brainstorm Report: `plans/reports/brainstorm-261030-post-cutover-live-hardening-and-data-completeness.md`
- Image Registry: `src/lib/menu-drink-images.ts`
- Menu Page: `src/pages/menu.tsx`

## Overview
- **Priority**: P0 (Customer-facing `/menu` packshots & `/api/menu`, `/api/v1/menu` payload completeness)
- **Current Status**: Done (Local Replica & Build Verified)
- **Description**: Live D1 `products` and `menu_items` have `image_url IS NULL` across all 49 items (`bt001`..`yg004`), and `src/pages/menu.tsx` does not invoke `resolveMenuDrinkImage(item.id, item.imageUrl)`.

## Key Insights
- `src/lib/menu-drink-images.ts` already maps all 49 drink IDs (`bt001`..`yg004`) plus legacy aliases (`yo001`..`yo004`) to `/menu/aura-drinks/<slug>.webp`, and responsive AVIF/WebP derivatives (`-400`, `-800`, `-1200`) are already deployed in `public/menu/aura-drinks/`.
- `src/components/landing/featured-menu.tsx:22` calls `resolveMenuDrinkImage(item.id, item.imageUrl)`, which is why the landing page displays drink photos even when D1 returns `imageUrl: null`, whereas `src/pages/menu.tsx:28` uses `item.imageUrl ?? ''` directly.

## Requirements
- **Functional**:
  - Backfill `products.image_url` and `menu_items.image_url` in D1 for all 49 canonical drink IDs (`bt001`..`yg004` and `yo001`..`yo004`) where `image_url IS NULL OR image_url = ''`.
  - Update `transformToStitchItem` in `src/pages/menu.tsx` to use `resolveMenuDrinkImage(item.id, item.imageUrl)`.
- **Non-Functional**:
  - Idempotent SQL updates that preserve any custom operator-uploaded `image_url` outside the legacy set.

## Architecture
- `D1 (products.image_url, menu_items.image_url)` → `GET /api/menu` & `GET /api/v1/menu` → `useCustomerMenu` → `src/pages/menu.tsx` (`resolveMenuDrinkImage`) → `StitchMenuNew` responsive `<picture>` (`400w`, `800w`, `1200w` AVIF/WebP).

## Related Code Files
- Modify: `src/pages/menu.tsx`
- Create: `worker/db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql`
- Create: `worker/db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.down.sql`

## Implementation Steps
1. Import `resolveMenuDrinkImage` from `@/lib/menu-drink-images` in `src/pages/menu.tsx` and update `transformToStitchItem` line 28 from `imageSrc: item.imageUrl ?? ''` to `imageSrc: resolveMenuDrinkImage(item.id, item.imageUrl)`.
2. Add idempotent `UPDATE products SET image_url = CASE id ... END` and `UPDATE menu_items SET image_url = CASE id ... END` statements for all 49 drink IDs (`bt001`..`yg004` + `yo001`..`yo004`) in `worker/db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql`.

## Todo List
- [x] Wire `resolveMenuDrinkImage` in `src/pages/menu.tsx`
- [x] Author 49-SKU image backfill SQL in `20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql`
- [x] Add unit/integration test coverage verifying `withImages === 49` and `/api/menu` `imageUrl` resolution

## Success Criteria
- `GET /api/menu` returns `imageUrl: "/menu/aura-drinks/<slug>.webp"` for all 49 items (`withImages: 49`).
- `src/pages/menu.tsx` resolves packshot URLs both when `item.imageUrl` is populated and when falling back by ID.

## Risk Assessment
- **Risk**: Overwriting custom operator image URLs.
- **Mitigation**: Guard `UPDATE` with `WHERE image_url IS NULL OR image_url = ''`.

## Security Considerations
- Static relative asset paths (`/menu/aura-drinks/*.webp`) only; no external origins or user-supplied URLs.

## Next Steps
- Proceed to Phase 02 to include BOM `recipe_ingredients` and `cron_jobs` seeding in `20261030_01`.
