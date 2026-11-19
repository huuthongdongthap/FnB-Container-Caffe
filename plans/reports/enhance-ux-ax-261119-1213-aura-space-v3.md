# UX + AX Enhancement Loop Report — AURA SPACE SaaS v3

- **Date:** 2026-11-19
- **Branch:** `feat/saas-commercial-edition-v3-261118`
- **Scope:** 9 routes (`/`, `/menu`, `/pricing`, `/signup`, `/checkin`, `/kds`, `/admin`, `/admin/saas-settings`, `/admin/hq-saas`) × 3 viewports (Desktop `1440×900`, Tablet `768×1024`, Mobile `375×812`) + AX/SEO discovery surface scan.

## Outcome Summary

| Metric | Round 0 (Baseline) | Round 1 (AX + P0/P1 UX) | Round 2 (Responsive + Resilience) | Round 3 (Touch Targets + Semantic H1) |
| --- | --- | --- | --- | --- |
| AX/SEO Discovery `FAIL` | 4 | **0** | **0** | **0** |
| AX/SEO Discovery `WARN` | 24 | **0** | **0** | **0** |
| Horizontal Overflow Views (27 total) | 1 (`tablet /admin/saas-settings`) | 1 | **0** | **0** |
| Undersized Interactive Targets (`<44px`) | 156 | 147 | 119 | **45** (-71.2%) |
| Typecheck (`typecheck:all`) | Pass | Pass | Pass | **Pass** |
| Production Build (`npm run build`) | Pass | Pass | Pass | **Pass** (4.55s) |
| Targeted Unit Tests (5 suites) | — | — | 21/21 | **39/39 passed** |

## Round 1 — AX/SEO Discovery & P0/P1 UX Fixes

1. **AX/SEO Discovery Surfaces (0 FAIL / 0 WARN):**
   - Added `public/llms.txt` and `public/llms-full.txt` describing AURA CAFE & AURA SPACE SaaS platform, pricing tiers, and public endpoints.
   - Generated 11 static markdown twins (`public/index.html.md`, `public/menu.md`, `public/pricing.md`, `public/signup.md`, `public/table-reservation.md`, `public/events.md`, `public/promotions.md`, `public/loyalty.md`, `public/about-us.md`, `public/contact.md`, `public/brand-guideline.md`) and added `X-Robots-Tag: noindex, follow` in `_headers` for `/*.md`, `/llms.txt`, and `/llms-full.txt`.
   - Synced clean `robots.txt` and `sitemap.xml` across root and `public/` (removed internal `/admin/*`, `/kds`, `/pos` routes from sitemap; kept only 11 public routes).
   - Fixed `_redirects` by removing the legacy `/signup /loyalty 301` redirect that broke SaaS self-serve onboarding.
   - Added `<RouteSeoManager />` (`src/components/shared/route-seo-manager.tsx`) and upgraded `index.html` with dynamic canonical URL, Open Graph, Twitter Card, and JSON-LD structured data per route.
2. **KDS Header & Status Badges (`src/pages/KDS.tsx`, `src/components/stitch/StitchKDSNew.tsx`, `stitch-kds-header.tsx`, `stitch-kds-utils.ts`):**
   - Removed floating `KdsToolbar` that overlapped the KDS header; integrated sound toggle and fullscreen toggle directly into the KDS header with `44×44px` touch targets.
   - Fixed `text-[48px]` header wrapping and upgraded status badge contrast for `PREPARING`, `PENDING`, `READY`, and `OVERDUE`.
3. **Mobile Bottom Navigation (`src/components/md3/md3-navigation-bar.tsx`):**
   - Fixed active pill sizing and alignment so the indicator centers cleanly around icons without clipping on 375px screens.

## Round 2 — Tablet/Mobile Responsive Polish & Resilient SaaS Flows

1. **Admin Terminal TopBar at Tablet (`src/components/stitch/StitchAdminTerminalNew-topbar.tsx`):**
   - Fixed `"Quản lý vận hành"` squishing into 4 vertical lines and clipping at `768px` by applying `min-w-0`, `truncate whitespace-nowrap text-lg lg:text-2xl`, and deferring the search input to `lg:block`.
2. **Admin SaaS Settings Layout (`src/pages/admin/SaasSettings.tsx`):**
   - Changed plan grid from `md:grid-cols-3` to `xl:grid-cols-3` and enabled wrapping tabs (`flex-wrap`) with `min-h-[40px]` / `min-h-[44px]` action buttons, eliminating the `+8px` horizontal overflow and price clipping on tablet.
3. **Public SaaS Pricing & Signup (`src/pages/saas/pricing.tsx`, `src/pages/saas/signup.tsx`):**
   - Fixed low-contrast `"Tiết kiệm 20%"` badge inside the active amber toggle (`bg-slate-950 text-emerald-300`) and bumped toggle buttons to `min-h-[44px]`.
   - Added immediate fallback plan and menu-template data so `/pricing` and `/signup` render complete cards immediately even before the API responds or when offline.

## Round 3 — Semantic Heading Hierarchy & WCAG 44px Touch Targets

1. **Single Semantic `<h1>` Per Page (`src/components/stitch/StitchAdminTerminalNew-sidebar.tsx`, `src/components/md3/md3-top-app-bar.tsx`):**
   - Replaced logo/chrome `<h1>` tags in the Admin sidebar and `MD3TopAppBar` with `<span>` so every page exposes its true primary `<h1>` (`/pricing`, `/signup`, `/checkin`, `/admin/saas-settings`, `/admin/hq-saas`).
2. **Header & Footer 44px Touch Targets + SaaS Link (`src/components/stitch/StitchLandingNew-nav.tsx`, `src/components/stitch/StitchLandingNew-footer.tsx`):**
   - Upgraded all header and footer navigation links to `inline-flex min-h-[44px] items-center`, reducing undersized interactive targets across the 27 audited views from 119 to **45** (-71.2% vs baseline).
   - Added a `Bảng giá SaaS` (`/pricing`) link in the public footer for direct discoverability and internal SEO linking.

## Verification

- `npm run typecheck:all`: passed (frontend, worker, `setup/aura-deploy`).
- `npm run build`: passed cleanly in 4.55s.
- `npx vitest run` (5 suites: `md3-top-app-bar`, `md3-app-shell`, `a11y-audit`, `StitchAdminTerminalNew`, `stitch-admin-terminal-new`): 39/39 tests passed.
- Playwright visual + DOM verification completed across all 27 viewport × route captures in `/tmp/aura-ux-ax-loop/round-3-after/`.

## Unresolved Questions

- None. All changes are uncommitted on branch `feat/saas-commercial-edition-v3-261118` and ready for your review or commit/deploy.
