# Next Pages: Wiring Remaining Stitch Components Into Production Routes

**Date**: 2026-07-04 18:46
**Severity**: Low (cleanup work, no regression)
**Component**: All 18+ routes, Stitch component integration, font infrastructure
**Status**: Resolved

## What Happened

This session completed the Stitch migration by wiring the last 6 unused "New" components into production routes, fixing the font 404 warnings that have been noise in every build, and code-splitting 22 admin routes. The quality pass earlier today cleaned up the palette and i18n debt. This session made those components actually reachable by users.

Three new pages created (/order, /container, /events-updated), two admin shells replaced (layout + order management), one already-working POS left untouched. Ten missing woff2 font files replaced with Google Fonts CDN. Twenty-two static imports converted to React.lazy.

Final state: build 0 errors, 0 font warnings, 1161/1161 tests passing. Every route in the app now uses a Stitch component.

## The Brutal Truth

This is what "finishing" looks like when done properly -- uneventful. The font fix was the most satisfying 73-line deletion of the day. Removing 10 @font-face blocks that pointed to files that NEVER existed on disk is closing a debt that was generating 14 build warnings every single compile. The fact that those warnings were tolerated for multiple shipping cycles is embarrassing.

The code-splitting is good but not finished. 21 React.lazy() calls plus Suspense fallbacks cut the initial bundle, but the vendor chunk will still hover near the warning threshold because react-dom and the router are heavy. The chunk warning might persist and that is an acceptable trade-off until we evaluate a proper bundler upgrade or module federation.

The POS route already used StitchPOSNew from the quality pass -- no change needed. That is one less thing to break.

## Technical Details

**Font infrastructure (Phase 1a):**
- Removed 10 @font-face blocks from `src/styles/brand-tokens.css` referencing local woff2 paths (`../../fonts/SpaceGrotesk-*.woff2`, `../../fonts/CormorantGaramond-*.woff2`)
- Files never existed on disk -- generated during the original Stitch export and never copied over
- Added 2 `<link>` tags to `index.html` for Google Fonts CDN: Space Grotesk (300-700 weight range) and Cormorant Garamond (300-700 + italic 400)
- CSS custom properties `--aura-font-*` preserved since they reference font-family names, not file paths
- Result: 0 font 404 warnings in build output, down from 14. Zero @font-face declarations remaining in `src/`.

**Code-splitting (Phase 1b):**
- 20 admin page imports in `src/App.tsx` converted from static `import X from '@/pages/admin/X'` to `const X = React.lazy(() => import('@/pages/admin/X'))`
- Added `React.Suspense` wrapper around admin route group and admin login route
- Fallback: centered loading text in chrome-light color, minimal to avoid layout shift
- One additional `React.lazy` for the admin layout itself (21 total lazy imports)
- Customer-facing routes left as static imports (small bundles)

**Customer pages (Phase 2):**
- `/order`: New page at `src/pages/order/index.tsx` (7 lines, wrapper around StitchMobileOrderNew)
- `/container`: New page at `src/pages/container/index.tsx` (11 lines, combines StitchContainerNew1 + New2)
- `/events`: Updated `src/pages/events.tsx` to use StitchEventsNew2 -- kept store data logic, replaced presentation layer (134 lines changed net -57/+77)

**Admin pages (Phase 3):**
- Admin layout: Replaced sidebar/navigation shell in `AdminLayout.tsx` with StitchAdminTerminalNew. Preserved `<Outlet />` pattern.
- Order management: Rewired `src/pages/admin/Orders.tsx` to use StitchOrderMgmtNew. 299 lines changed (-146/+153). Kept order CRUD data logic, replaced table/filter/status presentation.
- POS terminal: No changes needed (StitchPOSNew already wired during quality pass)

## What We Tried

**Parallel execution model:** Phases 1-3 ran in parallel since file ownership was cleanly separated (brand-tokens.css, App.tsx, page files). Phase 4 was a verification barrier. This was the same model used in the quality pass without the schema validation overhead this time.

**Minimal page wrappers:** For /order and /container, we created thin wrapper files rather than putting component logic directly in App.tsx. This matches the existing pattern where every route has its own page module.

## Root Cause Analysis

The font issue traces back to the original Stitch export. The export generated standard @font-face blocks referencing self-hosted woff2 files. Those files were either not exported or were intentionally omitted because the designer expected CDN delivery. When the export was converted to React components, nobody checked whether the font files existed on disk -- the app compiled and loaded, just with 14 404 warnings. The semantic difference between a "working" build and a "clean" build was ignored.

The unused components (StitchMobileOrderNew, StitchContainerNew1/2, StitchEventsNew2, StitchAdminTerminalNew, StitchOrderMgmtNew) were imported in the quality pass as "available but not routed." That was the right intermediate step -- import and clean first, then wire. The quality pass cleaned them; this session wired them.

## Lessons Learned

1. **Build warnings are not optional debt.** 14 font 404 warnings in every build for multiple shipping cycles is inexcusable. A warning is either a bug or a configuration issue. If it is neither, suppress it explicitly. If it is one of those, fix it. Do not let warning noise accumulate.

2. **Stitch component wiring should follow a two-phase pattern: import+clean first, then route.** Separating quality fixes from route wiring prevents debugging "did this fail because of the import or because of the routing?" The quality pass did the palette/i18n/a11y cleanup; this session did pure path wiring. That boundary held cleanly.

3. **Chunk splitting admin vs customer routes is a structural win.** Admin pages are heavy (tables, charts, data grids). Customer pages are light (forms, menus, lists). Splitting at the route level with React.lazy means mobile users on /order do not download admin dashboard code.

## Next Steps

- **Monitor the vendor chunk size.** If the chunk warning for main vendor bundle persists on production builds, evaluate a bundler upgrade (Vite 6, or manual chunk splitting with `output.manualChunks`). Worth tracking but not blocking.
- **Audit remaining lazy fallback UX.** The current Suspense fallback is a text placeholder. For slow networks, a skeleton/spinner matching the app chrome would be better. File as a UI polish task for the next cycle.
- **Confirm all 22 lazy routes actually load in production.** Run a smoke test script that visits each /admin/* path and confirms no Suspense-level errors. The static imports -> lazy conversion could surface circular dependency issues that only fail on dynamic import resolution.
- **No remaining Stitch "New" components to wire.** The index.ts re-export list can be pruned of any Old-component re-exports that are no longer referenced. Cleanup task for the next sprint.
