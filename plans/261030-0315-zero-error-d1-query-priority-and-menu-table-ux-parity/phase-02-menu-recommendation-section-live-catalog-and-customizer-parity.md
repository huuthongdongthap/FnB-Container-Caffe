# Phase 02: `/menu` `RecommendationSection` Live Catalog & Customizer Parity

## Context Links
- Brainstorm Report: `plans/reports/brainstorm-261030-zero-error-d1-query-priority-and-menu-table-ux-parity.md`
- Menu Page: `src/pages/menu.tsx`
- Recommendation Section: `src/components/menu/recommendation-section.tsx`

## Overview
- **Priority**: P0 (Customer-facing `/menu` UX & modifier safety)
- **Current Status**: Complete
- **Description**: `RecommendationSection` on `/menu` currently reads `useMenuStore((s) => s.items)` which is never populated by `MenuPage` (since `MenuPage` uses `useCustomerMenu`), causing `<RecommendationSection />` to return `null` 100% of the time on `/menu`. Additionally, clicking a recommendation calls `addItem` without `image` and bypasses `MenuPage.handleAddToCart` (`DrinkCustomizerModal`).

## Key Insights
- Passing the already-loaded `stitchItems` / `CustomerMenuItem[]` and `onAddToCart` callback from `src/pages/menu.tsx` into `<RecommendationSection />` activates recommendations on `/menu` with zero extra network calls and full `DrinkCustomizerModal` + cart image parity.

## Requirements
- **Functional**:
  - Add optional `catalogItems?: Array<{ id: string; name: string; price: number; image_url?: string; tags?: string[] }>` and `onAddItem?: (itemId: string) => void` props to `RecommendationSectionProps` in `src/components/menu/recommendation-section.tsx`.
  - When `catalogItems` is passed, use it instead of `useMenuStore((s) => s.items)`.
  - In `RecommendationSection.handleAddToCart`, if `onAddItem` is provided, call `onAddItem(item.id)`; otherwise call `addItem({ id: item.id, productId: item.id, name: item.name, price: item.price, image: item.image })`.
  - Pass `catalogItems` and `onAddItem` from `src/pages/menu.tsx:186` to `<RecommendationSection />`.

## Related Code Files
- Modify: `src/components/menu/recommendation-section.tsx`
- Modify: `src/pages/menu.tsx`

## Todo List
- [x] Extend `RecommendationSectionProps` in `src/components/menu/recommendation-section.tsx` with `catalogItems` & `onAddItem` and pass `image: item.image` to fallback `addItem`
- [x] Wire `catalogItems` and `onAddItem` in `src/pages/menu.tsx`

## Success Criteria
- `<RecommendationSection />` renders on `/menu` using `useCustomerMenu` items.
- Clicking a craft drink or required-modifier drink in `RecommendationSection` on `/menu` opens `DrinkCustomizerModal` (or adds ready-to-serve items with their packshot `image`).
