# Phase 01: UI/UX M3 Contrast, i18n Key Leaks, Route Guards & Asset Integrity

## Context Links
- Brainstorm Report: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/reports/brainstorm-20261017-wave4-deep-audit.md`
- Overview Plan: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Eliminate all raw i18n key leaks (`chat`, `tvMenu`, `brand`, Stitch `aria-label` keys), sync `public/locales/{vi,en}/translation.json` with `src/locales/{vi,en}.json`, protect unguarded `/kds`, `/stitch/order-management`, and `/saas/*` routes, fix `/photos/IMG_6564.webp` OG image reference, fix dead navigation links, and upgrade remaining `-600` dark-on-dark badges to M3 dark tokens (`-300`/`-400`).

## Key Insights
- `public/photos/IMG_6558.webp` does not exist on disk; `public/photos/IMG_6564.webp` exists and is 2MB high-res space photo.
- `ChatInbox.tsx`, `ChatInbox-detail-view.tsx`, `TVMenu.tsx`, `BrandGuideline.tsx`, `brand-voice-section.tsx`, and `materials-section.tsx` call `t(...)` without default fallbacks on keys missing from `src/locales/{vi,en}.json`.
- `/order-failure` matches `/order` in `MD3_SHELL_CONFIG` because `pathname.startsWith('/order')` matches `/order-failure`.

## Requirements
- Add all missing `chat`, `tvMenu`, `brand`, `loyalty.*AriaLabel`, `orderSuccess.SupportAria`, and `menu.CategoryNavAria` keys to `src/locales/vi.json` and `src/locales/en.json`, and sync to `public/locales/{vi,en}/translation.json`.
- Add fallback strings to `t(...)` calls in `TVMenu.tsx`, `BrandGuideline.tsx`, `brand-voice-section.tsx`, `materials-section.tsx`, and Stitch `aria-label` attributes.
- Wrap `/kds` and `/stitch/order-management` in `ProtectedRoute` in `src/App.tsx`, and wrap `/saas/dashboard`, `/saas/onboard/tenant`, `/saas/onboard` in `ProtectedRoute` in `src/routes/public-routes.tsx`.
- Guard `SystemHub.tsx` store fetches behind auth token check and replace hardcoded `"Localhost:5173"` with `window.location.host`.
- Update `DEFAULT_OG_IMAGE` in `src/components/seo/HelmetHead.tsx` and `config/brand.json` to `/photos/IMG_6564.webp`.
- Replace `-600` dark-on-dark text classes with `-300`/`-400` in owned admin/brand/tracking components.

## Architecture
- Localization: `src/locales/{vi,en}.json` is canonical; `public/locales/{vi,en}/translation.json` mirrors it.
- Shell routing: `src/components/stitch/shell-config.ts` matches exact `/order-failure` before `/order`.

## Related Code Files
- Modify:
  - `src/locales/vi.json`
  - `src/locales/en.json`
  - `public/locales/vi/translation.json`
  - `public/locales/en/translation.json`
  - `src/App.tsx`
  - `src/routes/public-routes.tsx`
  - `src/pages/TVMenu.tsx`
  - `src/pages/BrandGuideline.tsx`
  - `src/pages/brand-voice-section.tsx`
  - `src/pages/materials-section.tsx`
  - `src/pages/SystemHub.tsx`
  - `src/pages/KDS.tsx`
  - `src/pages/stitch-screen-gallery/screen-data.ts`
  - `src/pages/stitch-screen-gallery/screen-card.tsx`
  - `src/components/seo/HelmetHead.tsx`
  - `config/brand.json`
  - `src/components/stitch/shell-config.ts`
  - `src/components/stitch/loyalty-referral-block.tsx`
  - `src/components/stitch/loyalty-tier-benefits.tsx`
  - `src/components/stitch/loyalty-tier-card.tsx`
  - `src/components/stitch/loyalty-weekly-streak.tsx`
  - `src/components/stitch/loyalty-footer.tsx`
  - `src/components/stitch/StitchOrderSuccessNew-footer.tsx`
  - `src/components/stitch/StitchMenuNew-header.tsx`
  - `src/components/stitch/StitchContactNew-constants.ts`
  - `src/components/stitch/StitchNotFoundNew-Footer.tsx`
  - `src/components/admin/StatsCard.tsx`
  - `src/components/admin/SyncStatus.tsx`
  - `src/components/admin/performance-section-shared.tsx`
  - `src/components/brand/BaziExplanation.tsx`
  - `src/components/brand/LogoUsage.tsx`
  - `src/components/tracking/EstimatedTime.tsx`
  - `src/pages/admin/AuditLogViewer-table.tsx`
  - `src/pages/admin/CampaignsManager-table-row.tsx`

## Implementation Steps
1. Update `src/locales/vi.json` and `src/locales/en.json` with `chat`, `tvMenu`, `brand`, `loyalty`, `orderSuccess`, and `menu` keys; copy to `public/locales/{vi,en}/translation.json`.
2. Add default fallbacks in `TVMenu.tsx`, `BrandGuideline.tsx`, `brand-voice-section.tsx`, `materials-section.tsx`, and Stitch `aria-label` components; fix `/brand-guideline` -> `/brand` and footer links (`/support` -> `/contact`, `/privacy` & `/terms` -> `/about`).
3. Add `ProtectedRoute` around `/kds`, `/stitch/order-management` in `src/App.tsx` and `/saas/dashboard`, `/saas/onboard*` in `src/routes/public-routes.tsx`; guard `SystemHub.tsx` admin API calls when unauthenticated.
4. Update `HelmetHead.tsx` and `config/brand.json` OG image to `/photos/IMG_6564.webp`; guard missing `/sounds/new-order.mp3` in `KDS.tsx`.
5. Update `shell-config.ts` and replace `-600` text colors on dark backgrounds in `AuditLogViewer-table.tsx`, `CampaignsManager-table-row.tsx`, `StatsCard.tsx`, `SyncStatus.tsx`, `performance-section-shared.tsx`, `BaziExplanation.tsx`, `LogoUsage.tsx`, and `EstimatedTime.tsx`.

## Todo List
- [x] Populate missing `vi.json` & `en.json` keys and sync `public/locales/`
- [x] Add `ProtectedRoute` to `/kds`, `/stitch/order-management`, and `/saas/*`
- [x] Fix `SystemHub.tsx` unauthenticated fetches and host label
- [x] Point `HelmetHead.tsx` & `config/brand.json` to `/photos/IMG_6564.webp`
- [x] Fix dead links and `-600` dark contrast classes

## Success Criteria
- Zero raw i18n keys rendered on `/brand`, `/tv`, `/admin/chat`, `/loyalty`, `/menu`, `/order-success`.
- `/photos/IMG_6564.webp` exists in `public/photos/`.
- `npm run check:contrast` and unit tests pass.

## Risk Assessment
- Existing route tests may render `/kds` or `/saas/dashboard` — verify tests provide auth state or mock `ProtectedRoute` as needed.

## Security Considerations
- Prevents unauthenticated access to KDS, Stitch Order Management, and SaaS tenant onboarding/dashboard routes.

## Next Steps
- Proceed to Phase 02–05 in parallel.
