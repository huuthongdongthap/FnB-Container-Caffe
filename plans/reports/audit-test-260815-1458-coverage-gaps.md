# Test Coverage Audit Findings

**Date:** 2026-08-15
**Scope:** Full AURA CAFE codebase (`src/`)
**Total Source Files:** 1,033
**Total Test Files:** 147
**Overall Coverage:** 14.2%

---

## Coverage Summary Table

| Directory | Source Files | Tested | Coverage |
|-----------|-------------|--------|----------|
| `src/pages/` | 415 | 20 | **4.8%** |
| `src/components/` | 524 | 100 (66 stitch) | **19.1%** (non-stitch: 34/264 = 12.9%) |
| `src/hooks/` | 65 | 19 | **29.2%** |
| `src/stores/` | 1 (src/stores/) | 1 | 100% |
| `src/hooks/stores/` | 16 | 9 | **56.3%** |
| `src/hooks/stores/admin/` | 10 | 6 | **60.0%** |
| `src/routes/` | 4 | 0 | **0%** |
| `src/lib/` | 8 | 3 | **37.5%** |
| `src/config/` | 3 | 0 | **0%** |
| `src/theme/` | 2 | 0 | **0%** |

---

## Test Quality Analysis

### Positives
- **Stitch tests (66)** are high quality: test loading/error/empty states, callback props, user interactions (click handlers)
- **Auth store test** (`use-auth-store.test.ts`): 14 tests covering login/register/logout/fetchMe, error states (401, network failure), localStorage persistence, corrupted data
- **Checkout form test**: validates required fields, payment method switching, form submission, phone validation, loading state, disabled controls
- **Test utilities** well-structured: `test-utils.tsx` provides `renderWithProviders`, `renderHook`, `createTestAuthState` helpers
- **Test setup** (`test-setup.ts`): i18n initialized, HTMLDialogElement/EventSource polyfills

### Quality Concerns

#### [MEDIUM] Admin Dashboard test heavily mocked
- File: `src/pages/admin/__tests__/Dashboard.test.tsx`
- Issue: 18 `vi.mock()` calls mocking nearly every child component (StatsCard, OrderTable, CustomerTable, RevenueChart, etc). Tests verify mock rendering, not real component behavior.
- Recommendation: Use integration tests with real child components and mock only data-fetching hooks/stores.

#### [MEDIUM] Integration tests mock all external dependencies
- Files: `src/__tests__/Devices.test.tsx`, `ChatInbox.test.tsx`, `TableManagement.test.tsx`, `order-flow-integration.test.tsx`
- Issue: 8-9 mocks each. These "integration" tests are closer to unit tests since all children are replaced.
- Recommendation: Test with real components + mocked API layer only.

---

## Critical Findings

### [CRITICAL] Pages directory has 4.8% test coverage
- **Files:** 415 source files, only 20 tested
- **Impact:** Entire pages (AboutUs, Checkin, Contact, KDS, TVMenu, TrackOrder, home, menu, events, loyalty, promotions, referral, reviews, order-success, order-failure) have zero tests
- **Recommendation:** Prioritize top-30 traffic pages (home, menu, checkout, order-success)

### [CRITICAL] Routes directory has 0% test coverage
- Files: `src/routes/admin-routes.tsx`, `mobile-routes.tsx`, `public-routes.tsx`, `stitch-routes.tsx`
- Issue: No tests verify route configuration, protected route guards, or redirect logic
- Recommendation: Add route configuration tests (correct paths, auth guards, 404 fallback)

### [HIGH] 27 of 39 custom hooks untested (69.2% gap)
- **Key untested hooks:**
  - `use-order.ts`, `use-menu.ts`, `use-checkin.ts` — core business logic
  - `use-events.ts`, `use-promotions.ts`, `use-reviews.ts` — feature hooks
  - `use-chat.ts`, `use-push-notifications.ts`, `use-pwa-install.ts` — platform hooks
  - `use-offline-sync.ts`, `use-online-status.ts` — offline-first features
  - `use-split-bill.ts` + `split-bill-helpers.ts` — complex business logic
  - `use-reports.ts`, `use-analytics.ts`, `use-analytics-data.ts` — analytics
- Recommendation: Prioritize hooks with business logic over UI hooks

### [HIGH] 7 of 16 Zustand stores untested
- **Key untested stores:**
  - `use-cart-store.ts` — critical for ordering flow
  - `use-order-store.ts` — order lifecycle state
  - `use-menu-store.ts` — menu data/cache
  - `use-favorites-store.ts` — user preferences
- **Note:** There are tests at `src/hooks/stores/__tests__/` for these stores, but they may be stale/incomplete
- Recommendation: Verify existing store tests cover CRUD operations and edge cases

### [HIGH] All Stitch components (260 source files) only 66 tested (25.4%)
- Issue: 194 Stitch sub-components untested (sub-components like `-hero`, `-footer`, `-form`, `-card` variants)
- Recommendation: Test Stitch components that contain business logic or user interactions; skip pure layout/visual sub-components

### [HIGH] Admin page sub-files (139 untested)
- Issue: Admin pages are modularized into sub-files (e.g., `Dashboard-hooks.ts`, `Dashboard-sections.tsx`, `Devices-table.tsx`) — only 16 parent pages tested, sub-modules untested
- Recommendation: Add tests for sub-modules containing business logic (hooks, utils, constants)

### [MEDIUM] Account pages (6 files) — 0% coverage
- Files: `index.tsx`, `account-empty.tsx`, `account-error.tsx`, `account-loading.tsx`, `account-not-logged-in.tsx`
- Issue: User account page with empty/error/loading states untested
- Recommendation: Test state transitions (not logged in -> logged in, error -> retry, empty -> data)

### [MEDIUM] Mobile pages (17 files) — 0% coverage
- Files: `kitchen-display.tsx`, `mobile-layout.tsx`, `mobile-login.tsx`, `waiter-orders.tsx`, `table-manager.tsx`, `offline-queue.tsx`
- Issue: Staff-facing mobile views completely untested
- Recommendation: Prioritize kitchen display and waiter orders (core staff workflow)

### [MEDIUM] SaaS pages (8 files) — 0% coverage
- Files: `dashboard/index.tsx`, `dashboard/cancel-dialog.tsx`, `dashboard/invoice-table-card.tsx`, `onboard/tenant-create.tsx`
- Issue: Subscription management pages untested
- Recommendation: Test critical flows: cancel subscription, tenant creation

### [MEDIUM] Config directory — 0% coverage
- Files: `brand-theme.ts`, `brand-types.ts`, `index.ts`
- Issue: Brand configuration (likely static) — low priority
- Recommendation: Add smoke test for config exports

### [LOW] Shared components missing tests
- **ErrorBoundary** (`src/components/shared/ErrorBoundary.tsx`) — no test for error boundary rendering
- **SocialShare** (`src/components/shared/SocialShare.tsx`) — no test
- Recommendation: ErrorBoundary is critical for crash resilience — add test

### [LOW] UI components gap
- 6 untested: `AuraImage.tsx`, `badge.tsx`, `drawer.tsx`, `footer.tsx`, `skeleton.tsx`, `switch.tsx`
- Issue: Shared UI primitives missing test coverage
- Recommendation: Add snapshot or behavioral tests for `badge`, `switch`, `skeleton`

### [INFO] Components without any __tests__ directory
- `src/components/events/` — 0 tests
- `src/components/payments/` — 0 tests (RefundModal complex component)
- `src/components/pwa/` — 0 tests (7 files, PWA features)
- `src/components/push/` — 0 tests
- `src/components/reviews/` — 0 tests
- `src/components/saas/` — 0 tests
- `src/components/seo/` — 0 tests
- `src/components/shared/` — 2 tests (breadcrumbs, seo-head), but ErrorBoundary untested
- `src/components/staff/` — 0 tests
- `src/components/tv-menu/` — 0 tests

---

## Untested Pages — Full List

### Non-admin pages (42 untested)
`AboutUs`, `BrandGuideline`, `Checkin`, `Contact`, `KDS`, `ReviewsPage` (+ sub-files), `TVMenu`, `TableCheckin`, `TableOrder` (+ sub-files), `TableReservation` (+ sub-files), `TrackOrder`, `[locale]/order`, `[locale]/pricing`, `checkout`, `events`, `home`, `kds-toolbar`, `loyalty` (+ sub-files), `materials-section`, `menu`, `order-failure`, `order-success`, `promotions`, `referral`, `brand-guideline-colors`, `brand-voice-section`, `type-scale-table`

### Account pages (6 untested)
`index`, `account-constants`, `account-empty`, `account-error`, `account-loading`, `account-not-logged-in`

### Mobile pages (17 untested)
`kitchen-display` (+ sub-files), `mobile-layout` (+ sub-files), `mobile-login`, `offline-queue`, `table-manager`, `waiter-orders` (+ sub-files)

### SaaS pages (8 untested)
`dashboard/*` (6 files), `onboard/*` (2 files)

### Stitch pages (187 untested)
All stitch page files — low priority (Stitch is design prototyping layer)

---

## Priority Recommendations

1. **P0 (Critical):** Add route tests for auth guards and redirects
2. **P0 (Critical):** Test top-5 pages: home, menu, checkout, order-success, order-failure
3. **P1 (High):** Add tests for `use-cart-store`, `use-order-store`, `use-menu-store`
4. **P1 (High):** Test core hooks: `use-order`, `use-menu`, `use-split-bill`, `use-checkin`
5. **P1 (High):** Test ErrorBoundary component
6. **P2 (Medium):** Add tests for mobile staff views (kitchen display, waiter orders)
7. **P2 (Medium):** Test account page state transitions
8. **P3 (Low):** Fill Stitch sub-component gaps (business logic only)
9. **P3 (Low):** Test shared UI primitives (badge, switch, skeleton)

---

## Unresolved Questions

1. Is the Stitch layer intended for production or just design prototyping? If prototyping, 25% Stitch coverage may be acceptable.
2. Are the existing store tests in `src/hooks/stores/__tests__/` comprehensive or do they need expansion? They exist but were not deep-audited.
3. Is the SaaS module (`src/pages/saas/`) actively used or planned for future release?
4. Should `src/config/` files be considered testable (they are mostly static exports)?
