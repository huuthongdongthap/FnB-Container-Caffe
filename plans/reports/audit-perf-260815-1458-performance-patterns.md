# Performance Audit Findings — AURA CAFE

**Date:** 2026-08-15
**Scope:** Frontend React performance (bundle, rendering, state, data fetching, images, code splitting)

---

## [HIGH] Public Routes — 15 Eager-Loaded Pages in Main Bundle

- **File:** `src/routes/public-routes.tsx:3-20`
- **Issue:** 15 page components (HomePage, MenuPage, CheckoutPage, OrderSuccessPage, LoyaltyPage, ReferralPage, EventsPage, AccountPage, KDSPage, TVMenuPage, TableCheckinPage, LocaleOrderPage, PricingPage, BrandGuideline, ContainerPage, CustomerDashboard, TenantCreate, OnboardingWizard) are eagerly imported. Only `NotFoundNew` uses `React.lazy()`.
- **Impact:** All these page bundles ship in the initial chunk. User visiting homepage downloads code for KDS, TVMenu, BrandGuideline, SaaS dashboard, etc.
- **Recommendation:** Convert all page imports to `React.lazy()` like admin-routes and stitch-routes already do. Each page should be a separate chunk.

## [HIGH] Duplicate MenuCard Components

- **Files:** `src/components/menu/MenuCard.tsx` (196 lines) and `src/components/menu/menu-card.tsx` (identical structure)
- **Issue:** Two nearly-identical MenuCard components exist. Only `menu-card.tsx` is used in production (`featured-menu.tsx`, `menu-grid.tsx`). `MenuCard.tsx` is dead code (no imports found).
- **Impact:** Both get tree-shaken only if Vite can prove they're unused. If bundler includes both, doubles icon + component code.
- **Recommendation:** Delete `src/components/menu/MenuCard.tsx` (uppercase). Keep `menu-card.tsx` (lowercase).

## [HIGH] useCart Subscribes to Entire Zustand Store

- **File:** `src/hooks/use-cart.ts:14`
- **Issue:** `const store = useCartStore()` subscribes to the entire cart store without a selector. Any cart change (addItem, removeItem, updateQuantity, clearCart, setTableId) re-renders ALL components using `useCart()`.
- **Impact:** Unnecessary re-renders in navbar, cart icon, order page, and any component using the cart. Each mutation triggers re-renders across the app.
- **Recommendation:** Use Zustand selectors: `useCartStore(s => s.items)`, `useCartStore(s => s.addItem)`. Or use `shallow` equality comparison.

## [HIGH] Auth Store — Raw Fetch Instead of apiFetch

- **File:** `src/hooks/stores/use-auth-store.ts:60-100`
- **Issue:** Auth store uses raw `fetch()` for login/register/fetchMe instead of the centralized `apiFetch()` from `@/lib/api-client`. This bypasses error interceptor, token injection, and error reporting.
- **Impact:** Auth errors are not reported to the analytics endpoint. Error interceptor never fires for auth failures. Different error handling pattern than the rest of the app.
- **Recommendation:** Use `apiFetch()` in auth store or extract auth API calls into a dedicated module that uses `apiFetch`.

## [HIGH] Inconsistent API Layer — 13 Files Use Raw fetch()

- **Files:** `use-offline-sync.ts`, `use-push-notifications.ts`, `use-split-bill.ts`, `analytics-store-fetchers.ts`, `use-analytics-store.ts`, `use-audit-store.ts`, `use-refund-store.ts`, `use-admin-customers-store.ts`, `use-admin-dashboard-store.ts`, `use-admin-orders-store.ts`, `use-admin-reservations-store.ts`, `use-admin-shifts-store.ts`, `use-performance-store.ts`, `use-metrics-store.ts`
- **Issue:** These files use raw `fetch()` instead of `apiFetch()`. They don't benefit from the centralized error handling, token injection, and beacon-based error reporting.
- **Impact:** Inconsistent error handling. Auth tokens may not be injected (stores do manual token reads). Error reporting gaps.
- **Recommendation:** Migrate all API calls to use `apiFetch()`. The admin stores in `src/hooks/stores/admin/` are the biggest offenders.

## [MEDIUM] Three.js Loaded via External CDN Script Tag

- **File:** `src/components/stitch/StitchOrderSuccessNew-tracking.tsx:28`
- **Issue:** Three.js is loaded via `<script src="https://ajax.googleapis.com/ajax/libs/threejs/r125/three.min.js">` on component mount. The file also has `import type * as THREE from 'three'` (type-only, no runtime). Three.js r125 is a CDN load that blocks the animation start.
- **Impact:** ~600KB Three.js loaded on order-success page. CDN dependency adds latency. Not lazy-loaded in the traditional sense — it's a runtime script injection.
- **Recommendation:** If Three.js is only used for the ring overlay animation, consider replacing with CSS animations or a lightweight canvas-only approach. If Three.js is needed, import it as a proper module with `React.lazy()`.

## [MEDIUM] No React.memo on Frequently Re-Rendered Components

- **Files:** `src/components/menu/menu-card.tsx`, `src/components/order/order-summary-section.tsx`, `src/components/order/SplitCard.tsx`, `src/components/order/SplitBillModal.tsx`, `src/components/order/payment-method-selector.tsx`
- **Issue:** Zero `React.memo()` usage in the entire codebase (0 matches). MenuCard is rendered in lists (featured-menu, menu-grid) and re-renders on every cart change even when its props haven't changed.
- **Impact:** List items re-render unnecessarily when parent state changes (e.g., adding an item to cart re-renders all visible MenuCards).
- **Recommendation:** Add `React.memo()` to list-rendered components (MenuCard, SplitCard, OrderSummarySection). Use `useCallback` for event handlers passed as props.

## [MEDIUM] Hero Section — Canvas Mousemove Listener Never Cleaned Up

- **File:** `src/components/home/hero-section.tsx:58`
- **Issue:** `canvas.addEventListener('mousemove', (e) => { addRipple(...) })` creates a new anonymous function that is never removed in the cleanup. Only `resize` listener and `cancelAnimationFrame` are cleaned up.
- **Impact:** Memory leak when hero section unmounts and remounts. Anonymous listener can't be removed.
- **Recommendation:** Store the mousemove handler in a ref and remove it in the useEffect cleanup.

## [MEDIUM] Countdown Timer Re-Renders Every Second Globally

- **File:** `src/components/promotions/countdown-timer.tsx:36`
- **Issue:** `setInterval(() => {...}, 1000)` calls `setTimeLeft()` every second, triggering a full re-render. The `onExpire` callback is not memoized — if parent passes a new function reference, the effect re-runs and creates a new interval.
- **Impact:** Minor per-timer, but if multiple countdown timers are on screen, each triggers re-renders every second.
- **Recommendation:** Memoize `onExpire` with `useCallback` in parent. Consider using `requestAnimationFrame` or a single shared timer for multiple countdowns.

## [MEDIUM] 6 Console Statements in Production Code

- **Files:** Various (6 total matches across src/)
- **Issue:** `console.log/warn/error/info/debug` statements found in production code. Vite config has `drop_console: false`.
- **Impact:** Minor — console output in production browsers, potential information leakage.
- **Recommendation:** Set `drop_console: true` in `vite.config.js` terserOptions for production builds. Remove console statements or replace with the app's logger utility.

## [LOW] Zustand Stores — No Selector Optimization

- **Files:** `src/hooks/stores/use-cart-store.ts`, `src/hooks/stores/use-menu-store.ts`, `src/hooks/stores/use-auth-store.ts`, `src/hooks/stores/admin/*.ts`
- **Issue:** Most Zustand stores are consumed without selectors. Components that call `useCartStore()` or `useMenuStore()` get the entire state object, causing re-renders on any state change.
- **Impact:** Moderate — depends on component tree depth and frequency of state changes.
- **Recommendation:** Use Zustand selectors with shallow equality: `const items = useCartStore(s => s.items, shallow)`.

## [LOW] Vite Build — No Code Coverage for Admin Pages

- **File:** `vite.config.js:45-52`
- **Issue:** Manual chunks split react, i18n, ui, and query. But admin pages (20+ lazy routes) and stitch pages (20+ lazy routes) are not grouped. Each admin page becomes its own chunk, which is good for splitting but creates many small requests.
- **Impact:** Many small chunks = more HTTP requests. HTTP/2 mitigates this somewhat.
- **Recommendation:** Consider grouping admin pages into an `admin` chunk and stitch pages into a `stitch` chunk for better cache efficiency.

## [LOW] Scroll Event Listeners — Passive Flag Inconsistency

- **Files:** `src/components/stitch/StitchContainerNew1.tsx:74`, `src/components/stitch/StitchGalleryNew-hooks.ts:28`, `src/components/stitch/StitchPromotionsNew.tsx:63`, `src/components/stitch/use-stitch-landing.ts:30`
- **Issue:** Some scroll listeners use `{ passive: true }` (StitchHeroNew, navbar) but others don't (StitchContainerNew1, StitchGalleryNew, StitchPromotionsNew, use-stitch-landing).
- **Impact:** Non-passive scroll listeners can block the main thread during scroll, causing jank on mobile.
- **Recommendation:** Add `{ passive: true }` to all scroll event listeners that don't call `preventDefault()`.

## [INFO] Good: Code Splitting Is Well-Applied for Admin + Stitch Routes

- **Files:** `src/routes/admin-routes.tsx`, `src/routes/stitch-routes.tsx`, `src/routes/mobile-routes.tsx`
- **Finding:** Admin routes (22 pages), stitch routes (22 pages), and mobile routes (5 pages) all use `React.lazy()`. This is correct. Only public-routes.tsx has the eager import issue.

## [INFO] Good: AuraImage Component Handles WebP/PNG Fallback

- **File:** `src/components/ui/AuraImage.tsx`
- **Finding:** AuraImage correctly uses `<picture>` with WebP source + PNG fallback and `loading="lazy"`. Well-implemented responsive image strategy.

## [INFO] Good: TanStack Query Caching Is Configured

- **File:** `src/App.tsx:19-21`
- **Finding:** Global QueryClient sets `staleTime: 30_000` and `refetchOnWindowFocus: false`. Individual hooks override with appropriate values (KDS: 4s, Reports: 60s, TV Menu: 25s).

---

## Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 0 | — |
| HIGH | 5 | Eager route imports, duplicate MenuCard, Zustand full-store subscription, auth raw fetch, inconsistent API layer |
| MEDIUM | 4 | Three.js CDN load, no React.memo, canvas listener leak, countdown timer |
| LOW | 3 | Zustand selectors, chunk grouping, passive scroll |
| INFO | 3 | Good patterns (code splitting, AuraImage, TanStack Query) |

**Top 3 Actions (highest ROI):**
1. Lazy-load all public routes (fixes HIGH, ~30% initial bundle reduction estimated)
2. Delete duplicate `MenuCard.tsx` and add `React.memo()` to list components
3. Use Zustand selectors in `useCart()` and `useMenuStore()` consumers
