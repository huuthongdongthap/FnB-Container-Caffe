# Assumption Destroyer: Plan Review Report

**Plan:** FnB Full-Stack Redesign (260701-0942)
**Reviewer:** code-reviewer (red-team mode)
**Date:** 2026-07-01
**Scope Audit:** Verified against `/Users/macbook/FnB-Container-Caffe/` codebase

---

## Finding 1: Plan misrepresents Hono as "not yet adopted" — it is already live in production worker

- **Severity:** High
- **Location:** Phase 6 (all sections), plan.md Overview paragraph
- **Flaw:** The plan repeatedly claims the backend is "34 vanilla JS route files" needing a "Hono + TypeScript refactor." The actual worker `index.js` already imports `{ Hono } from 'hono'` (v4.12.12), uses Hono's `.route()`, `.use()`, and `.get()/.post()` patterns, and has a pre-existing `orders-hono.js` file alongside `orders.js` — evidence of an in-progress migration already underway.
- **Failure scenario:** Phase 6 executes assuming greenfield Hono adoption. Engineer discovers Hono is already deeply integrated (33 route files are imported into the Hono app). The "migration" becomes a confusing dual-layer refactor: TypeScript-ify the existing Hono app while preserving API contracts, while some routes (erpnext*, odoo*, mixpost, pretix, mautic, cal.com, signage, zalo) remain read-only vanilla JS in the same app. The resulting hybrid codebase has half-TS Hono routes importing from half-JS vanilla routes through a shared index.js — a far more complex task than the plan describes.
- **Evidence:**
  - Plan phase-06: "Refactor the Cloudflare Worker from 34 vanilla JS route files into a typed Hono application" (line 14)
  - Plan plan.md: "worker/src/routes/erpnext*", "worker/src/routes/odoo*" as read-only boundaries (lines 66)
  - Actual codebase `worker/src/index.js` line 5: `import { Hono } from 'hono';` — Hono is the existing framework
  - Actual codebase `worker/src/routes/orders-hono.js` — partial Hono migration already exists
  - Actual codebase `worker/package.json`: `"hono": "^4.12.12"` in dependencies (not devDependencies — it's production)
- **Suggested fix:** Rewrite Phase 6 scope: "TypeScript-ify existing Hono worker, consolidate dual route files (e.g., merge orders.js + orders-hono.js), add Zod validation to existing Hono routes." Acknowledge the existing architecture. The read-only route files will need to be called from within the Hono app — the plan must define a clear interop contract (e.g., Hono routes delegate to vanilla JS route functions, or the read-only routes get thin Hono wrappers).

---

## Finding 2: Vite already exists with sophisticated multi-page build — plan assumes greenfield scaffold

- **Severity:** High
- **Location:** Phase 1, section "1.2 Scaffold React + Vite Project"
- **Flaw:** Phase 1 says "`npm create vite@latest . -- --template react-ts`" — a greenfield Vite scaffold command. But `vite.config.js` already exists with a non-trivial multi-page HTML build: auto-detection of root HTML files, subdirectory HTML entries (dashboard, admin, signup), explicit exclusion list, Terser minification, and a custom `copy-redirects` plugin for `_redirects`. Running `npm create vite` would overwrite this config. Rebuilding from scratch risks losing the existing build pipeline behavior (multi-page entry, excluded files, SPA redirects) that Cloudflare Pages depends on.
- **Failure scenario:** Engineer runs `npm create vite`, wipes the existing config. Later Phase 7 attempts to deploy to Cloudflare Pages. The multi-page HTML build is replaced by a React SPA with React Router, but the `_redirects` handling, excluded files (receipt-template, loyalty-calculator without deps), and subdirectory entries are gone. Deployment breaks because Cloudflare Pages needs the SPA redirect rules that were in the old config's custom plugin.
- **Evidence:**
  - Plan phase-01 line 66: "`npm create vite@latest . -- --template react-ts` in project root"
  - Actual codebase `vite.config.js` lines 1-82: existing multi-page HTML build with `EXCLUDED_HTML` set, `readdirSync` auto-detection, `copy-redirects` plugin
  - Actual codebase `package.json`: `"vite": "^8.0.3"` in devDependencies, `"dev": "vite"`, `"build": "npm run lint && vite build"` scripts
- **Suggested fix:** Phase 1 must specify: "Modify existing `vite.config.js` (do not create new) — add React plugin (`@vitejs/plugin-react`), replace HTML entry detection with React Router SPA entry, preserve `copy-redirects` plugin and `_redirects` handling." Alternatively, create a clean `vite.config.ts` but explicitly list every behavior ported from the old config.

---

## Finding 3: Plan claims "20 CSS files" — codebase has 32 CSS files

- **Severity:** Medium
- **Location:** plan.md Overview paragraph, brainstorm source document
- **Flaw:** The plan states the project has "20 CSS files" plus "20 static HTML pages." An actual file count reveals 32 CSS files under `css/`. This is a 60% undercount. The implication: the plan underestimates the CSS deduplication and token extraction effort in Phase 1, where all CSS must be audited for shared patterns to build the design system tokens.
- **Failure scenario:** Phase 1's token extraction step (1.1) processes only the 20 expected CSS files. The remaining 12 files contain styles that produce design drift — colors, spacing, or typography that diverge from the Navy+Warm system. These inconsistencies surface in Phase 7 as visual audit failures requiring rework of already-"completed" pages.
- **Evidence:**
  - Plan plan.md line 21: "20 static HTML pages (3.7K–39K lines each) + 20 CSS files"
  - Brainstorm report `brainstorm-260701-0942-fnb-visual-redesign.md` line 30: "20+ page-specific CSS files"
  - Actual codebase: `ls /Users/macbook/FnB-Container-Caffe/css/ | wc -l` returns 32
  - Example CSS files not mentioned in plan: `pos.css`, `print-receipt.css`, `proposal-deck-v2.css`, `public.css`, `ui-enhancements.css`, `premium-upgrade.css`, `CHU-QUAN-BAO-CAO.css`, `about-m3.css`, `hero-aura.css`
- **Suggested fix:** Update the plan to state 32 CSS files. Add a Phase 1 substep: "Audit all 32 CSS files for shared patterns; extract common tokens; identify file-specific overrides that need per-page design system page files."

---

## Finding 4: Admin directory has 15 files, not empty — Phase 4 scope underestimated

- **Severity:** Medium
- **Location:** Phase 4, Pages table (admin row)
- **Flaw:** The Phase 4 page table lists "Admin Dashboard | admin/ directory | — | src/pages/admin/" with a dash for line count, implying the admin directory is trivial or empty. In reality, `admin/` contains 15 files: 9 HTML pages (dashboard, orders, customers, login, staff, pos, reservations, checkin-approve, erpnext-sync) and 6 CSS files. These are functional admin/operations pages currently served as a separate multi-page app within the Vite build (Vite config includes `admin/` as a subdirectory entry). The plan allocates only 6 components (StatsCard, OrderTable, CustomerTable, RevenueChart, SyncStatus, DateRangePicker) to cover 9 pages with their own distinct layouts and functionality.
- **Failure scenario:** Phase 4 developer discovers admin/ has 9 distinct HTML pages after already committing to the 6-component list. They either cram disparate functionality into too few components (breaking separation of concerns) or scope-creep to add 5-8 more components mid-phase, blowing the 16h estimate.
- **Evidence:**
  - Plan phase-04 line 25: "Admin Dashboard | admin/ directory | — | src/pages/admin/"
  - Actual codebase: `ls /Users/macbook/FnB-Container-Caffe/admin/` shows 15 files: checkin-approve.html, customers.html, dashboard.css, dashboard.html, erpnext-sync.css, erpnext-sync.html, login.css, login.html, orders.css, orders.html, pos.html, reservations.html, shared.css, staff.css, staff.html
  - Actual codebase `vite.config.js` lines 26-35: admin/ included as a subdirectory multi-page build entry
- **Suggested fix:** Audit admin/ directory and list all 9 pages in the Phase 4 table with actual line counts. Add missing components: PosInterface, LoginPage, StaffManager, ErpnextSyncPanel, ReservationManager. Adjust effort estimate upward (likely 20-24h).

---

## Finding 5: "Lines" column displays byte counts, not line counts — migrates data fabricated

- **Severity:** Medium
- **Location:** All phase page tables (Phase 2-5 "Lines" column)
- **Flaw:** The plan's page tables list line counts: index.html at "37,221", loyalty-calculator.html at "38,815", brand-guideline.html at "27,888", success.html at "25,993". These are BYTE COUNTS, not line counts. Actual line counts: index.html = 626 lines, loyalty-calculator.html = 739 lines, brand-guideline.html = 601 lines, success.html = 497 lines. The largest HTML file has 739 lines, not 38,815. This means the plan's risk assessment for "37K-line index.html has hidden logic" (Phase 2) is operating on fabricated data. The real files are 1-2 orders of magnitude smaller.
- **Failure scenario:** Phase 2 developer budgets 20h primarily because they believe index.html is 37K lines of complex logic. Upon opening the file, they discover 626 lines — mostly HTML markup with some inline scripts. The 20h effort was calibrated to a 60x-larger file. The developer either (a) finishes in 4h and the plan drifts, or (b) the complexity of the inline scripts is actually higher than the line count suggests and real effort is still 20h — but the plan made the wrong argument for why.
- **Evidence:**
  - Plan phase-02 line 20: "Home | index.html | 37,221"
  - Plan phase-02 Risk: "37K-line index.html has hidden logic"
  - Actual: `wc -l index.html` returns 626; `wc -c index.html` returns 37221
  - Same pattern: loyalty-calculator.html (739 lines, 38,815 bytes), brand-guideline.html (601 lines, 27,888 bytes)
- **Suggested fix:** Replace "Lines" column with "Size" (KB) or use actual line counts. Reassess risk: the files are smaller but may have dense inline scripts — a different kind of complexity than "37K lines of HTML."

---

## Finding 6: Plan claims "576 existing tests" — codebase has 1,019 test/describe/it blocks, and ERPNext plan claims 904

- **Severity:** Medium
- **Location:** plan.md Acceptance Criteria #5, Phase 6 "Integration Verification"
- **Flaw:** The plan states "all existing 576 test behaviors preserved" as an acceptance criterion and Phase 6 says "Run existing 576 test suite against new worker." But the actual test directory has 29 test files containing 1,019 describe/it/test blocks. The ERPNext migration plan running concurrently claims "904 pass, 0 fail, 18 skipped." These numbers are irreconcilable — either the 576 number is stale, the ERPNext 904 is inflated, or different counting methodologies are used. The plan cannot preserve "576 tests" if it doesn't know how many tests actually exist.
- **Failure scenario:** Phase 6 runs the "576 test suite" and gets, say, 850 passing and 50 failing (because the actual suite has grown). The engineer sees 50 failures and assumes the refactor broke tests, spending days debugging, when those 50 were new tests added by the ERPNext plan that expect the old vanilla JS response format. The false baseline causes wasted troubleshooting.
- **Evidence:**
  - Plan plan.md line 84: "Tests: >= 80% coverage, all existing 576 test behaviors preserved"
  - Plan phase-06 line 130: "All existing 576 tests pass against refactored worker"
  - Actual: `grep -r "describe\| it(\| test(" tests/*.test.js | wc -l` returns 1,019
  - ERPNext plan `260630-1948-erpnext-migration/plan.md` metadata: "tests: 904 pass, 0 fail, 18 skipped"
  - Test directory has 29 .test.js files (plus a playwright/ subdirectory)
- **Suggested fix:** Run `npm test` before starting, record the actual passing/failing/skipped count. Use that as the baseline. Acknowledge the ERPNext plan may add tests concurrently. Coordinate with ERPNext plan owner to freeze the test baseline or agree on a canonical test count.

---

## Finding 7: Parallel Phase 2-5 execution will cause merge conflicts on shared directories

- **Severity:** High
- **Location:** plan.md "Parallel execution" note (line 49)
- **Flaw:** The plan states "Phases 2, 3, 4, 5, 6 can run concurrently after Phase 1 completes." These phases all write to shared directories: `src/pages/`, `src/components/`, `src/hooks/`, `src/lib/`. They also register routes in the same React Router config and create TanStack Query hooks that may collide on API endpoint names. The plan has no merge strategy, no file allocation map, and no coordinator to resolve conflicts.
- **Failure scenario:** Phase 2 creates `src/pages/Menu.tsx` and `src/hooks/useMenu.ts`. Phase 3 creates `src/hooks/useMenu.ts` for the loyalty menu (now a naming collision). Phase 5 creates `src/components/shared/LocationMap.tsx`. Phase 2 also creates `src/components/home/LocationMap.tsx` (duplicate component). Without a shared component registry, agents duplicate work and produce merge conflicts that take hours to untangle.
- **Evidence:**
  - Plan plan.md line 49: "Phases 2, 3, 4, 5, 6 can run concurrently after Phase 1 completes"
  - Phase 2 creates `src/pages/Menu.tsx`, `src/hooks/useMenu.ts`, `src/components/home/LocationMap.tsx`
  - Phase 4 creates `src/hooks/useTVMenu.ts` — not a collision, but `src/pages/TVMenu.tsx` co-exists with Phase 2's `Menu.tsx` — confusing naming
  - Phase 5 creates `src/components/contact/LocationMap.tsx` — duplicate with Phase 2's `src/components/home/LocationMap.tsx`
  - No file allocation registry exists in the plan
- **Suggested fix:** Create a shared file allocation registry before parallel execution begins. Define canonical component names and locations. Allocate Types:
  - `useMenu.ts` → Phase 2 owns; Phase 4 uses `useTVMenu.ts` (already distinct)
  - `LocationMap.tsx` → Extract to `src/components/shared/LocationMap.tsx` during Phase 1; all phases import from shared
  - `Breadcrumbs.tsx` → Already in Phase 5 as shared; Phase 1 should build it
  Document this in a `file-ownership-registry.md` under the plan directory.

---

## Finding 8: receipt-template.html exists but has no migration path in any phase

- **Severity:** Medium
- **Location:** Scope gap — no phase covers this file
- **Flaw:** The plan claims "All 20 pages rebuilt as React components" (acceptance criteria #1). But the HTML file list has 20 files, and `receipt-template.html` is one of them — it is NOT listed in any phase table. Currently, `receipt-template.html` is excluded from the Vite build (`EXCLUDED_HTML` set in vite.config.js). The plan never addresses whether this page should be migrated to React or remain excluded. It is an orphan.
- **Failure scenario:** After migration, `receipt-template.html` is still a static file excluded from the React build. If the print receipt feature (Phase 2, OrderSuccess page) tries to render a receipt, it either (a) links to the old static file which may break when old HTML is archived in Phase 7, or (b) the React replacement works but the old template is left as dead code.
- **Evidence:**
  - Plan acceptance criteria #1: "All 20 pages rebuilt as React components"
  - Actual `ls *.html | wc -l` returns 20
  - `receipt-template.html` matches no phase table entry
  - Actual `vite.config.js` line 17: `'receipt-template.html'` in `EXCLUDED_HTML`
- **Suggested fix:** Either (a) add `receipt-template.html` to Phase 2 as a `Receipt` component (used by OrderSuccess page), or (b) explicitly document it as out-of-scope with a reason. Update acceptance criteria #1 to "19 customer-facing pages" if excluded.

---

## Finding 9: Plan references "Stitch" as design mockup generator with unverified capability

- **Severity:** Medium
- **Location:** Phase 2, section "2.5 Stitch Design Integration"
- **Flaw:** The plan pipeline is described as "Stitch -> frontend-design -> ui-styling -> cook per page." Phase 2.5 says "For each page: generate Stitch mockup from design system + page description." The plan assumes Stitch (`@google/stitch-sdk`, listed in devDependencies) can accept a design system + natural language page description and produce a React component mockup. This is a non-trivial capability assumption. The Stitch SDK may only produce static HTML/CSS, or may not integrate with React, or may require different input format than "page description."
- **Failure scenario:** Phase 2 engineer attempts to run Stitch with "page description" input. Stitch SDK doesn't accept natural language — it requires structured design tokens or Figma exports. Engineer spends 4+ hours discovering Stitch's actual input format, then abandons it for manual mockup creation. The 20h effort estimate (which bakes in Stitch automation) is now 30-40% light.
- **Evidence:**
  - Plan phase-02 line 94-97: "For each page: generate Stitch mockup from design system + page description"
  - Plan plan.md line 34: "Pipeline | Stitch -> frontend-design -> ui-styling -> cook per page"
  - Actual `package.json` devDependencies: `"@google/stitch-sdk": "^0.3.5"` — beta version, Google design-to-code SDK
  - No Stitch configuration, API key, or usage documentation found in codebase
- **Suggested fix:** Either (a) verify Stitch SDK capability before plan execution (test it against one page and document the input format), or (b) remove Stitch from the pipeline and budget manual mockup creation time. "Page description -> mockup" is a product feature Stitch may not have in v0.3.5.

---

## Finding 10: Phase 6 creates a permanent split codebase — half Hono/TypeScript, half vanilla JS

- **Severity:** Critical
- **Location:** Phase 6, "Files NOT Touched" section
- **Flaw:** Phase 6 lists 9 route files as read-only (erpnext*, odoo*, mixpost, pretix, mautic, cal-booking-webhook, signage, zalo). These files remain vanilla JS while the rest of the worker becomes TypeScript + Hono. But `index.js` (the Hono app entry) must import all these route handlers. After Phase 6, the app is a Frankenstein: a TypeScript Hono app importing vanilla JS modules, with no shared type system, no shared Zod validators, and no unified error handling. The read-only routes use different patterns (some export functions, some export Hono routers). This violates the DRY principle at the architectural level — two routing paradigms co-existing indefinitely because the "other plans own those files."
- **Failure scenario:** A bug in `worker/src/routes/zalo.js` (vanilla JS, read-only) causes a crash that the new TypeScript error handler can't catch because the vanilla JS module throws an untyped error. The global error handler in `app.ts` catches it as `unknown`, logs a cryptic message, and returns 500. Meanwhile, the loyalty route (TypeScript) handles the same error gracefully with a typed `AppError`. The inconsistency makes debugging harder and creates a two-tier reliability system: TypeScript routes are robust, vanilla JS routes are "someone else's problem."
- **Evidence:**
  - Plan phase-06 lines 63-76: "Files NOT Touched (Other Plans Own)" — lists 9 vanilla JS files
  - Plan phase-06 architecture shows `routes/*.ts` with Zod validators, but read-only files have no Zod, no TypeScript, no Hono middleware
  - Actual: `worker/src/routes/zalo.js` exists as standalone JS; `worker/src/routes/erpnext*.js` are owned by in-progress ERPNext plan
  - All 33 route files are imported in `worker/src/index.js` — the entry point is shared
- **Suggested fix:** Do not accept a permanently split codebase. Options:
  (a) Phase 6 creates thin TypeScript wrappers for read-only routes (e.g., `routes/erpnext.ts` imports `erpnext-legacy.js` and wraps with Zod + error handling). This is ~2h extra work.
  (b) Coordinate with ERPNext/Odoo/Mixpost/etc plan owners to add a "TypeScript-ify" task to their plans before Phase 6 completes.
  (c) Accept the split but add a `legacy-routes/` directory with an adapter pattern that normalizes error handling and response shapes. Document this as technical debt.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | Hono already in production — Phase 6 "migration" is actually a TypeScript refactor of existing Hono app | High |
| 2 | Vite already exists with production build config — Phase 1 `npm create vite` would nuke it | High |
| 3 | 32 CSS files, not 20 — 60% undercount | Medium |
| 4 | admin/ has 15 files, Phase 4 assumes near-empty directory | Medium |
| 5 | "Lines" column is actually byte counts — fabricated data used for risk assessment | Medium |
| 6 | "576 tests" claim doesn't match codebase (1,019) or ERPNext plan (904) | Medium |
| 7 | Parallel execution on shared directories has no merge strategy | High |
| 8 | receipt-template.html has no migration path — orphaned page | Medium |
| 9 | Stitch SDK capability for "description -> mockup" is unverified | Medium |
| 10 | Phase 6 creates permanent TypeScript/vanilla JS split with no shared error handling | Critical |

## Unresolved Questions

1. What is the canonical test count? The plan says 576, the ERPNext plan says 904, and the codebase grep suggests ~1,019. Run `npm test` and record the actual count before any migration work begins.

2. Does Stitch SDK v0.3.5 actually accept "page description" as input and produce a React component? Verify with a single page test before committing the pipeline to all 20 pages.

3. Who is the coordinator for parallel Phase 2-5 execution? The plan has no named role or merge strategy. File allocation must be resolved before parallelism begins.

4. Will the existing Vite `_redirects` file work with React Router's `BrowserRouter` on Cloudflare Pages? The current `_redirects` handles multi-page HTML; a SPA needs different rules (`/* /index.html 200`). Phase 7 must address this — is it confirmed?

5. Should `receipt-template.html` be migrated to React or explicitly excluded? The plan doesn't decide.
