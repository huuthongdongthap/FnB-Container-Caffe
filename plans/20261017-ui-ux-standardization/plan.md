# UI/UX Standardization & M3 Compliance Plan (`FnB-Container-Caffe`)

- **Plan Directory:** `plans/20261017-ui-ux-standardization/`
- **Audit Report:** [`plans/reports/ui-ux-deep-audit-20261017.md`](../reports/ui-ux-deep-audit-20261017.md)
- **Execution Mode:** Parallel (`--parallel`) across Phases 01–04, followed by Phase 05 Gate.

## Phases Overview

| Phase | Title | Status | Priority | File Ownership (Non-Overlapping) |
|-------|-------|--------|----------|----------------------------------|
| [Phase 01](./phase-01-brand-truth-address-logo-assets.md) | Brand Truth, Store Address, Master Logo & Assets | Completed | P0 | `README.md`, `index.html`, `public/**`, `src/locales/**`, `src/components/home/**`, `src/components/contact/**`, `src/components/seo/**`, `src/components/ui/AuraImage.tsx`, `src/pages/RecruitmentPage.tsx`, `src/pages/SystemHub.tsx`, `src/pages/stitch/our-story/**`, `src/pages/stitch/contact-new/**`, `src/pages/stitch/luxury-landing/**`, `src/components/stitch/StitchContactNew*`, `src/components/stitch/StitchLayout.tsx`, `src/components/stitch/StitchLandingNew-footer.tsx` |
| [Phase 02](./phase-02-m3-tokens-css-contrast.md) | M3 Dark Tokens, CSS Architecture & Contrast Gate | Completed | P0/P1 | `src/styles/**`, `src/config/brand-theme.ts`, `scripts/contrast-check.mjs`, `src/components/ui/drawer.tsx`, `src/components/ui/adapters/SkeletonAdapter.tsx`, `src/components/loyalty/PointsToast.tsx`, `src/pages/TableReservation.tsx`, `src/pages/CustomerDisplay.tsx`, `src/pages/OrderSuccess.tsx`, `src/components/menu/RecommendationCarousel.tsx`, `src/pages/admin/Analytics.tsx`, `src/pages/admin/Bookings-calendar-view.tsx` |
| [Phase 03](./phase-03-customer-flows-shell-wcag-a11y.md) | Customer Flows, Single Shell, Currency Fix & WCAG 2.1 AA | Completed | P0/P2 | `src/components/md3/**`, `src/components/stitch/CustomerShell.tsx`, `src/components/stitch/shell-config.ts`, `src/components/stitch/StitchLandingNew-nav.tsx`, `src/components/stitch/StitchMenuNew*`, `src/components/stitch/StitchTrackOrderNew*`, `src/components/stitch/StitchOrderTrackingNew.tsx`, `src/components/stitch/StitchOrderSuccessNew*`, `src/components/stitch/StitchAccountDashNew*`, `src/components/stitch/StitchCheckoutNew*`, `src/components/stitch/StitchMobileOrderNew*`, `src/components/menu/DrinkCustomizerModal.tsx`, `src/components/menu/recommendation-section.tsx`, `src/components/menu/ItemDetailDrawer.tsx`, `src/components/cart/**`, `src/components/chat/**`, `src/components/pwa/**`, `src/pages/menu.tsx`, `src/pages/menu-page.tsx`, `src/pages/loyalty.tsx`, `src/pages/order-success.tsx`, `src/pages/TableOrder*.tsx`, `src/pages/stitch/track-order/**`, `src/pages/stitch/reservation-new/**`, `src/pages/stitch/gallery-new/**`, `src/pages/account/**` |
| [Phase 04](./phase-04-admin-pos-kds-ux.md) | Admin Shell, POS VND/Layout & KDS Polling/Ergonomics | Completed | P0/P2 | `src/routes/admin-routes.tsx`, `src/hooks/use-kds.ts`, `src/pages/KDS.tsx`, `src/pages/kds-toolbar.tsx`, `src/pages/admin/Login.tsx`, `src/pages/admin/POS.tsx`, `src/pages/admin/Orders.tsx`, `src/pages/admin/SalesReports.tsx`, `src/pages/admin/ERPNExtSync.tsx`, `src/pages/admin/staff-list-tab.tsx`, `src/components/stitch/AdminShell.tsx`, `src/components/stitch/StitchAdmin*`, `src/components/stitch/StitchOrderMgmtNew*`, `src/components/stitch/StitchPOSNew*`, `src/components/stitch/StitchKDSNew.tsx`, `src/components/stitch/stitch-kds-*` |
| [Phase 05](./phase-05-verification-tests-contrast-gate.md) | Verification: Contrast Check, TypeScript Build & Test Suite | Completed | P0 | `src/**/__tests__/**`, `tests/**` |

## Key Dependencies

- **Phases 01, 02, 03, 04** have strictly disjoint file ownership boundaries and can execute **in parallel** (`/cook --auto --parallel`).
- **Phase 05** depends on completion of Phases 01–04 to run `npm run check:contrast`, `npm run build`, and `npx vitest run`.
