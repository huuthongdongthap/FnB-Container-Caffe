# Red-Team Plan Review: AURA CAFE All 4 Workstreams

**Reviewer:** Contract Verifier
**Date:** 2026-07-05
**Focus:** Interface changes, consumer enumeration, factual claim verification

---

## Finding 1: All 28 routes already have production implementations -- plan builds on a false premise

- **Severity:** Critical
- **Location:** Plan.md (Overview), Phase 1 (all), Phase 2 (all), Phase 4 (all)
- **Flaw:** The plan asserts these pages need Stitch designs and "basic page exists" per screen. In reality, every single customer and admin page is a fully implemented production React component with store wiring, HelmetHead SEO, i18n, error handling, and custom sub-components. The plan proposes to replace working code with Stitch-generated prototypes, then re-do all integration work that already exists.
- **Evidence:**
  - App.tsx line 11: imports `OrderFailurePage` from `@/pages/order-failure` -- 139-line file with store, HelmetHead, error maps (src/pages/order-failure.tsx:1-139)
  - App.tsx line 13: imports `LoyaltyCalculatorPage` from `@/pages/loyalty-calculator` -- 48-line page loading `<LoyaltyCalculator>` component with i18n + HelmetHead (src/pages/loyalty-calculator.tsx:1-48)
  - App.tsx line 18: imports `TrackOrderPage` from `@/pages/TrackOrder` -- full order timeline, StatusBadge, EstimatedTime, search (src/pages/TrackOrder.tsx:1-+)
  - App.tsx line 82: `<Route path="/table-reservation">` -- 310-line page with date picker, zone selection (src/pages/TableReservation.tsx)
  - App.tsx line 88: `<Route path="/subscriptions">` -- 330-line page with plan comparison, subscribe flow, tier badges (src/pages/subscriptions/index.tsx)
  - App.tsx line 101-120: ALL 18 admin routes exist and import from `@/pages/admin/` using React.lazy. Every admin page has HelmetHead, store wiring, UI components.
  - `grep -rn "Stitch" ./src/pages/` exits with 0 results -- none of the existing page components use Stitch components already, confirming these are standalone implementations, not "basic" stubs.
- **Consumers affected (28 consumers total):**
  - 10 customer route components in App.tsx (lines 70-90): OrderFailurePage, PromotionsPage, CheckinPage, Contact, LoyaltyCalculatorPage, TrackOrderPage, TableReservationPage, TVMenuPage, SubscriptionsPage, BrandGuideline
  - 18 admin route components in App.tsx (lines 100-120): Dashboard, Staff, Customers, ManageMenu, PromotionsManager, SubscriptionsManager, SalesReports, BroadcastPage, CampaignsManager, ChatInbox, CheckinApprove, BirthdayConfig, ERPNExtSync, InvoiceHistory, GenerateQR, Metrics, Reservations, AuditLogViewer
- **Suggested fix:** Either (a) acknowledge these pages exist and scope Phase 1+4 as visual refresh only (not component replacement), or (b) explicitly document the migration plan: which old files get deleted, which imports in App.tsx get replaced, and how to validate no route duplication.

---

## Finding 2: Phase 4 "wire store" references 10 stores that do not exist as separate Zustand stores

- **Severity:** High
- **Location:** Phase 4, "Conversion Pipeline" step 5, "Routes to Wire" table
- **Flaw:** The plan assumes 20 Zustand stores across all 28 pages. Of those, 10 do not exist and have never been created: promotions, broadcast, campaign, chat, birthday, erpnext, invoice, subscription, reports, audit. Some pages handle data via React Query (TanStack Query) instead (e.g., PromotionsManager uses `useQuery`/`useMutation`, subscriptions uses `usePlans` hook). The plan's "wire store" step will either fail or create dead store code where React Query already works.
- **Evidence:**
  - `find ./src -name "*store*" -type f | grep -v node_modules | sort` -- 35 store files, NONE named: `use-promotions-store`, `use-broadcast-store`, `use-campaign-store`, `use-chat-store`, `use-birthday-store`, `use-erpnext-store`, `use-invoice-store`, `use-subscription-store`, `use-reports-store`, `use-audit-store`
  - `src/pages/admin/PromotionsManager.tsx:3` imports from `@tanstack/react-query` (useQuery, useMutation), NOT from a Zustand promotions store.
  - `src/pages/subscriptions/index.tsx` imports `usePlans`, `useMyActiveSubscription`, `useSubscribe` from `@/hooks/use-subscriptions` -- these are custom React Query hooks, not Zustand store actions.
- **Consumers affected (10 stored pages in Phase 4 table):** Dashboard, Promotions, Subscriptions, SalesReports, Broadcasts, Campaigns, Chat, Birthday, ERPNext, AuditLogs
- **Suggested fix:** Audit each page's existing data-fetching pattern (Zustand vs React Query vs local state) before deciding whether to wire a store. Many pages already work. Remove the "wire store" step for pages that already have working data access. For pages that DO need new stores, add store creation to Phase 4 scope.

---

## Finding 3: Plan asserts 309 tests and 129+ E2E tests -- actual counts are 1091 and 48 (3x and 3x off)

- **Severity:** High
- **Location:** Plan.md overview ("309 tests"), Phase 5 ("129+ existing E2E tests + 13+ new E2E tests"), Phase 6 quality gates ("309+ unit tests", "129+ existing E2E tests + 13+ new")
- **Flaw:** The test counts cited throughout the plan are inaccurate by large margins. Unit tests are 3x higher than claimed (1,091 vs 309). E2E/Playwright tests are 48 total (across 4 spec files), not 129+. Phase 5 proposes adding 13 E2E specs bringing total to 61, not 142+. Phase 6's reference check "129+ existing E2E tests still passing" does not exist as a test suite that could fail.
- **Evidence:**
  - `npm test` run: "Tests 1091 passed (1091)" -- 106 test files
  - `ls ./tests/e2e/` -- directory does not exist (0 files)
  - `grep -E "(test|it)\(" ./tests/playwright/*.spec.ts` -- 1+15+15+17 = 48 test cases across 4 spec files: debug_errors.spec.ts (1), fnb-audit.spec.ts (15), stitch-routes.spec.ts (15), ui-audit.spec.ts (17)
  - Phase 6 line 24: "npx playwright test -- 129+ existing E2E tests + 13+ new E2E tests passing" -- this gate will never execute because 129 tests do not exist.
- **Suggested fix:** Correct all numerical claims in plan.md, Phase 5, and Phase 6 to match actual test counts. Update Phase 6 quality gate to reference actual baseline (48 existing E2E tests, not 129). Remove E2E test addition for routes that already have coverage.

---

## Finding 4: Phase 4's "add 28 routes" is a replacement, not addition -- plan provides no migration strategy

- **Severity:** Critical
- **Location:** Phase 4, "Conversion Pipeline" step 6, "Routes to Wire" table, "Related Code Files"
- **Flaw:** The plan says "Register route in App.tsx" for 28 new Stitch components. But App.tsx already registers all 28 routes pointing to existing page components (src/pages/{name}.tsx). Adding Stitch component routes alongside existing routes creates duplicates where both route handlers exist. The plan does not specify: which imports to delete from App.tsx header, which Route elements to replace, or which old page .tsx files to remove. Without this, the routes either collide or the old components shadow the new ones.
- **Evidence:**
  - App.tsx line 74: `<Route path="/order-failure" element={<OrderFailurePage />} />` -- imports from `@/pages/order-failure`
  - App.tsx line 118: `<Route path="/admin/reservations" element={<AdminReservationsPage />} />` -- imports from `@/pages/admin/Reservations`
  - Phase 4 line 85: "Modify: src/App.tsx (add 28 routes)" -- but routes are already there
  - All 28 routes enumerated in Phase 4 tables already exist in App.tsx with identical path strings
- **Consumers affected (28 existing route elements in App.tsx):** All 10 customer routes + all 18 admin routes. Each needs either replacement of the `element` prop and import, or deletion of the old Route and addition of the new one. No instruction covers which.
- **Suggested fix:** Replace the route table in Phase 4 with a paired "Old import -> New import" mapping. Add a "Files to delete" section listing old page .tsx files (src/pages/order-failure.tsx, etc.) or a note that they should be retained. Add explicit import swap instructions for App.tsx.

---

## Finding 5: 18 existing Stitch exports overlap with planned 28 new designs -- no reuse assessment

- **Severity:** Medium
- **Location:** Phase 1 (all), Phase 2 (all), Plan.md (Overview)
- **Flaw:** The `stitch-exports/` directory already contains 23 design subdirectories (about, account, admin, admin-login, admin-orders, admin-pos, admin-v2, checkout, events, home, kds, landing, landing-v2, loyalty, menu, menu-v2, mobile, mobile-v2, order-success, referral, reviews, stitch_aura_cafe). The plan asserts 28 pages "still need Stitch designs" without auditing which existing exports can be reused or adapted. Some planned screens like `/subscriptions` may overlap with existing `stitch-exports/account` or `stitch-exports/order-success` content in ways the plan ignores.
- **Evidence:**
  - `ls ./stitch-exports/` shows 23 directories
  - `ls ./src/components/stitch/*New*` shows 23 existing Stitch React components
  - Plan Phase 1+2 enumerate 28 new screens, all with `Stitch{Name}New` naming, none cross-referencing existing exports
  - Phase 1 risk assessment says "Use DESIGN.md + existing Stitch components as reference" — but not as direct reuse
- **Suggested fix:** Add an audit step before Phase 1 that catalogs existing stitch-exports and determines which can be adapted vs which need new generation. Remove from Phase 1+2 any screens already covered by existing exports.

---

## Finding 6: Phase 3 relies on transitive dependency (commander) and missing dependency (enquirer)

- **Severity:** Medium
- **Location:** Phase 3, Step 1 ("Use commander (already in project)"), Step 2 ("enquirer or readline")
- **Flaw:** `commander` is claimed to be "already in project" but it is a nested transitive dependency of terser (commander@2.20.3), not a direct dependency. Using it in a standalone CLI tool (scripts/aura-deploy/) creates a fragile dependency graph that can break on terser updates. `enquirer` is not installed at all. The plan offers "readline" as fallback but Phase 3 step 2 full scope assumes enquirer-level interactive prompts (color, validation, autocomplete).
- **Evidence:**
  - `npm ls commander`: `aura-space-sadec -> terser -> commander@2.20.3` (transitive, nested)
  - `npm ls enquirer`: `(empty)` -- package not installed
  - `grep "commander\|enquirer" ./package.json`: no match -- neither listed as dependency
  - Phase 3 step 2: "Interactive prompts (via enquirer or readline)" -- but readline is insufficient for the described UX (color, validation sequences)
- **Suggested fix:** Either add `commander` and `enquirer` as direct dependencies to the CLI tool's package.json, or commit to Node.js built-in `readline/promises` with manual validation. Update the plan text to remove the erroneous "already in project" claim.

---

## Finding 7: Phase 5 "13+ new routes" and SEO gap claims contradict codebase reality

- **Severity:** Medium
- **Location:** Phase 5, "Overview" ("13+ new routes"), "SEO Metadata" ("Add HelmetHead to any new page missing it")
- **Flaw:** Phase 5 claims there are "new routes" needing E2E tests and HelmetHead SEO. In reality:
  - All 28 customer + admin routes already exist in App.tsx (no "new routes")
  - 9 of 10 customer pages already have HelmetHead (BrandGuideline is the only one missing)
  - All 18 admin pages already have HelmetHead
  - Phase 5 creates 13 E2E spec files, but 6 of them (order-failure, promotions, checkin, table-reservation, track-order, subscriptions) duplicate existing page coverage that could be tested by stitching together existing app flows
- **Evidence:**
  - `grep -l "HelmetHead" ./src/pages/order-failure.tsx ./src/pages/promotions.tsx ./src/pages/Checkin.tsx ./src/pages/Contact.tsx ./src/pages/TrackOrder.tsx ./src/pages/TableReservation.tsx ./src/pages/TVMenu.tsx ./src/pages/subscriptions/index.tsx ./src/pages/loyalty-calculator.tsx` -- 9 of 10 files match (BrandGuideline is the miss)
  - `for f in ./src/pages/admin/*.tsx; do grep -l "HelmetHead" "$f"; done` -- 18 of 18 admin files match
  - Phase 5 line 24-41: customer specs (6) + admin specs (7) = 13 new spec files for pages that already have HelmetHead and working routes
- **Suggested fix:** Remove the "13+ new routes" framing -- all routes are existing. Reduce E2E spec scope to pages that are genuinely incomplete (e.g., BrandGuideline without HelmetHead). Cancel E2E specs for pages that have no complex interactive behavior (e.g., Contact page is largely static).

---

## Finding 8: Phase 5 "Verify web-vitals import" is a completed task passed off as work

- **Severity:** Low
- **Location:** Phase 5, "Web Vitals" subsection ("Verify web-vitals import exists in entry point")
- **Flaw:** web-vitals is already imported and instrumented in the entry point. The "verify" step is a no-op that passes before any work begins. This indicates the plan was composed from a template or old gap analysis without rechecking the current codebase.
- **Evidence:**
  - `head -10 ./src/main.tsx`: line 9 shows `import { onLCP, onCLS, onINP, onTTFB, onFCP } from 'web-vitals'`
  - `src/main.tsx:22-25`: calls onLCP(onCLS(onINP(onTTFB(onFCP(sendToAnalytics) for each metric
- **Consumers affected:** None (noop task). But this pattern compounds with Finding 3 (stale test counts) to erode trust in the plan's empirical claims.
- **Suggested fix:** Remove the "verify web-vitals" step from Phase 5. Audit the rest of Phase 5's scope against actual codebase state to identify other no-op tasks.

---

## Finding 9: BrandGuideline route is the sole HelmetHead gap -- plan over-scopes to all "28 pages"

- **Severity:** Medium
- **Location:** Phase 5, "SEO Metadata" ("Add HelmetHead to any new page missing it")
- **Flaw:** The SEO scope in Phase 5 treats all new pages as needing HelmetHead work. In reality, only BrandGuideline is missing HelmetHead. The component Phase 1 creates for BrandGuideline (`StitchBrandNew`) and its wire-up in Phase 4 are the only part of this scope that adds value. The rest of Phase 5's SEO work is already done.
- **Evidence:**
  - 9 of 10 customer pages in the grep matched HelmetHead
  - BrandGuideline.tsx was the only miss: `grep "HelmetHead" ./src/pages/BrandGuideline.tsx` returned no output
  - 18 of 18 admin pages matched HelmetHead
- **Suggested fix:** Scope Phase 5 SEO to BrandGuideline only. Move the rest of SEO budget to other gaps (structured data, OG images) that aren't already covered.

---

## Summary of Contract Verification

| Claim in Plan | Codebase Reality | Verdict |
|---|---|---|
| 28 pages need Stitch designs | All 28 routes exist with full implementations | FALSE |
| 309 unit tests | 1,091 tests passing | FALSE (off by 3x) |
| 129+ E2E tests | 48 E2E test cases | FALSE (off by 3x) |
| commander is "already in project" | Transitive dep of terser only | FALSE |
| enquirer available | Not installed | FALSE |
| 13+ "new routes" need E2E | All routes are existing | FALSE |
| web-vitals not yet imported | Already imported and instrumented | FALSE |
| 22 stores available for wiring | 10 of 20 referenced stores missing | PARTIALLY FALSE |
| 28 routes need registration in App.tsx | All 28 routes already registered | FALSE (replacement needed) |
