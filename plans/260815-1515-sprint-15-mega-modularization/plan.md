# Sprint 15 — Mega-Component Modularization

**Date:** 2026-08-15 | **Target:** 8 files over 200 LOC → under 200 LOC

## Targets

| # | File | LOC | Extracted Files |
|---|------|-----|-----------------|
| 1 | `src/pages/stitch/digital-menu-2/index.tsx` | 350 | types, constants, hooks, header, category-nav, menu-item, cart-sidebar, footer |
| 2 | `src/tree/analytics/use-analytics-store.ts` | 347 | types, constants, utils, selectors |
| 3 | `src/pages/account/index.tsx` | 342 | types, constants, hooks, profile-section, orders-section, settings-section, loyalty-section |
| 4 | `src/components/stitch/StitchContactNew.tsx` | 342 | types, constants, hooks, contact-form, map-section, info-cards |
| 5 | `src/components/admin/PeriodComparisonChart.tsx` | 340 | types, constants, hooks, chart-header, chart-body, comparison-table, stats-cards |
| 6 | `src/components/stitch/StitchTrackOrderNew.tsx` | 333 | types, constants, hooks, order-timeline, status-badge, order-details, footer |
| 7 | `src/pages/subscriptions/index.tsx` | 330 | types, constants, hooks, plan-card, subscription-list, billing-section, upgrade-modal |
| 8 | `src/components/stitch/StitchGalleryNew.tsx` | 326 | types, constants, hooks, gallery-grid, lightbox, image-card, filter-bar |

## Rules
- Each extracted file: kebab-case, < 200 LOC
- Parent file re-exports for backward compatibility
- No breaking changes to imports
- Run `npx tsc --noEmit` after each extraction
