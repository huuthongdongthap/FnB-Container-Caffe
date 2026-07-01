# Red Team Failure Mode Analysis: Plan Review Report

**Plan:** FnB Full-Stack Redesign (260701-0942)
**Reviewer:** code-reviewer (Failure Mode Analyst / Flow Tracer)
**Date:** 2026-07-01
**Perspective:** Murphy's Law — race conditions, data loss, cascading failures, recovery gaps, deployment risks, rollback holes. Hostile to scope creep disguised as migration.
**Prior reviews read:** Scope-and-complexity-critic, Assumption-destroyer (findings NOT re-reported here)

---

## Finding 1: PayOS return URL hardcoded to `checkout.html` — revenue path will return 404 after React migration

- **Severity:** Critical
- **Location:** Phase 2 (Checkout migration) + Phase 6 (payment route is read-write), coordination gap between frontend and backend
- **Flaw:** The worker's payment route (`worker/src/routes/payment.js:86-87`) constructs PayOS redirect URLs with hardcoded `.html` paths:
  ```js
  const returnUrl = `${baseUrl}/checkout.html?payment=pending&order_id=${order_id}`;
  const cancelUrl = `${baseUrl}/checkout.html?cancelled=true&order_id=${order_id}`;
  ```
  After Phase 2 migrates checkout to React, `checkout.html` is replaced by a React Router route (e.g., `/checkout`). PayOS will redirect paying customers to a URL that no longer exists: `https://auraspace.cafe/checkout.html?payment=pending&order_id=ORD_xxx` returns 404. The plan's file ownership table (plan.md:65) assigns `worker/` to Phase 6 and `src/pages/` to Phase 2-5 — neither phase acknowledges this cross-layer URL contract.

- **Failure scenario:**
  1. Phase 2 completes checkout React migration. `checkout.html` is removed. New route is `/checkout`.
  2. Phase 6 has NOT yet been executed (it runs in parallel, Phase 6 depends only on Phase 1).
  3. A customer places an order and selects PayOS. Worker returns PayOS redirect URL pointing to `checkout.html?payment=pending&order_id=...`.
  4. Customer's browser follows the redirect → 404 page.
  5. PayOS payment succeeds but customer cannot see order confirmation. Order is paid but appears lost to the customer.
  6. Customer disputes charge. Revenue loss + support burden.

- **Evidence:**
  - `worker/src/routes/payment.js:86-87` — hardcoded `.html` paths in production payment flow
  - `worker/src/routes/payment.js:84-85` — `FE_BASE_URL` env var determines base, but path suffix is hardcoded
  - plan.md:62-66 file ownership table — Phase 2 owns `src/pages/`, Phase 6 owns `worker/`, no coordination item for return URLs
  - Phase 6 file "NOT touched" list includes `payment.js` as read-write (it IS being refactored), but the plan doesn't mention updating return URLs

- **Suggested fix:** 
  1. Add explicit coordination item in plan.md: "Phase 2 MUST implement `/checkout.html` as a redirect to the React `/checkout` route, OR Phase 6 MUST update return URLs to use new React routes (e.g., `/checkout?payment=pending`)."
  2. The return URL path should be an environment variable (`FE_CHECKOUT_PATH`) so it can be changed independently of the worker deploy.
  3. Add a CI contract test: `GET /checkout.html?payment=pending&order_id=test` must return 200 after every deploy.

---

## Finding 2: Plan promises 4 payment methods (COD/MoMo/VNPay/PayOS) — only PayOS and COD have backend implementation

- **Severity:** Critical
- **Location:** Phase 2, section "2.2 Cart + Checkout", architecture diagram lists `PaymentMethodSelector.tsx` with all 4 methods
- **Flaw:** The plan's Phase 2 architecture shows a payment method selector with COD/MoMo/VNPay/PayOS. The test plan includes `payment-method-selector.test.tsx` with "renders COD/MoMo/VNPay/PayOS, keyboard navigation, aria-checked". But the actual backend:
  - `worker/src/routes/payment.js` — ONLY implements PayOS (creates payment links via PayOS API)
  - `worker/src/routes/orders.js:158-160` — COD is handled as a direct order creation (no payment gateway)
  - MoMo and VNPay exist ONLY as label strings (`{ cod: 'COD', payos: 'PayOS', momo: 'MoMo', vnpay: 'VNPay' }`) in email templates — zero integration code
  - `worker/src/routes/webhooks.js` — ONLY handles PayOS IPN webhooks

- **Failure scenario:**
  1. Developer builds `PaymentMethodSelector.tsx` with MoMo and VNPay options per plan spec.
  2. User selects "MoMo" at checkout. Frontend POSTs `payment_method: 'momo'` to `/api/orders`.
  3. The orders route accepts this (no enum validation) and inserts the order with `payment_method = 'momo'`.
  4. Order is stuck in "pending" state forever — no MoMo webhook exists to mark it paid.
  5. Kitchen never sees the order. Customer never gets charged but also never gets food. Both sides lose.

- **Evidence:**
  - `worker/src/routes/payment.js` — entire file is PayOS-only
  - `worker/src/routes/webhooks.js` — PayOS IPN only, no MoMo/VNPay webhook routes
  - `worker/src/routes/orders.js:182` — payment method labels exist but no implementation
  - Plan phase-02 lines 42, 61 — `PaymentMethodSelector` with COD/MoMo/VNPay/PayOS
  - Plan phase-02 line 115 — Risk: "PayOS/MoMo/VNPay integration breaks" — implies they exist

- **Suggested fix:**
  1. If MoMo/VNPay are NOT implemented, remove them from Phase 2 UI and tests. Add them to "Out of Scope" section.
  2. If they ARE planned, add explicit implementation tasks in Phase 6 for MoMo and VNPay webhook receivers.
  3. Add Zod enum validation on `payment_method` field in the orders route so unrecognized methods return 400, not silently accepted.

---

## Finding 3: No migration coexistence strategy — HTML and React pages collide on identical URL paths during parallel execution

- **Severity:** Critical
- **Location:** plan.md "Parallel execution" note ("Phases 2-5 can run concurrently"), Phase 1 risk table
- **Flaw:** The plan states Phases 2-5 execute in parallel after Phase 1. Each phase builds React pages that replace existing HTML files at identical URL paths: `index.html` → `/`, `menu.html` → `/menu`, etc. Cloudflare Pages serves files by path. During parallel execution, there's no documented mechanism for:
  - Serving partially-migrated pages (e.g., React Home + static Menu)
  - Routing between old and new pages during transition
  - Preventing broken navigation (React page links to `/menu` but `menu.html` was already deleted by a different parallel phase)

  The Phase 1 risk table says "Work in `src/` subdirectory; old files untouched until migration complete" — but this only prevents file collisions during development, not URL conflicts during deployment.

- **Failure scenario:**
  1. Phase 1 completes. Phase 2 (Revenue Path) and Phase 3 (Loyalty) start in parallel.
  2. Phase 2 finishes first. Developer deploys. Vite React build produces `/` and `/checkout` routes. Developer removes `index.html`, `checkout.html`, `menu.html`, `success.html`, `failure.html` — the 5 Phase 2 pages.
  3. Phase 3 is still in progress. A customer visits `/loyalty` — the old `loyalty.html` no longer exists (it was not explicitly preserved during the Phase 2 deploy — the deploy replaced the entire `dist/` directory).
  4. Customer gets 404 on the loyalty page until Phase 3 finishes (16h later). Revenue impact: customers cannot see their loyalty status to make purchase decisions.
  5. Alternatively: Developer tries to keep old HTML files alongside React build. But Vite build replaces `dist/`. The old files must be manually copied, and navigation links between old and new pages break because they point to `.html` paths no longer generated by Vite.

- **Evidence:**
  - plan.md:49 — "Phases 2, 3, 4, 5, 6 can run concurrently after Phase 1 completes"
  - phase-01 line 111 — "Work in `src/` subdirectory; old files untouched until migration complete"
  - `vite.config.js` — existing build produces `dist/` with all HTML files. React SPA build produces `dist/index.html` + JS bundles. These are incompatible output structures.
  - Zero phases mention deployment sequencing or blue-green strategy

- **Suggested fix:**
  1. Add Phase 7 substep: "Blue-green deploy: deploy React SPA to a preview environment first, verify all pages, then cut over."
  2. Or: Make Phase 7 the ONLY deployment phase. All earlier phases build but don't deploy individually. Phase 7 deploys the complete migrated site atomically.
  3. Explicitly document: "No individual phase deploys to production. All phases complete → single deploy."
  4. Add `_redirects` rule during transition: `/*.html → /:splat` for graceful URL migration.

---

## Finding 4: Happy hour discount (14:00-16:00, 20% off drinks) is claimed but does not exist anywhere in the codebase

- **Severity:** High
- **Location:** Phase 2, section "2.2 Cart + Checkout" — "Happy hour discount logic (14:00-16:00, 20% off drinks)", Phase 2 TDD test #8 — happy hour discount in `use-cart.test.ts`, Phase 2 component `HappyHourBanner.tsx`
- **Flaw:** The plan treats happy hour discount as an existing feature to be migrated. Grepping the entire codebase for "happy" returns zero results in business logic files. The cron route (`worker/src/routes/cron.js`) has no happy hour activation. The cart JS (`js/cart.js`) has no time-based discount. The discount system in `js/checkout/cart-summary.js` is a generic coupon code system (`discount.percent`, `discount.amount`, `discount.code`), not a time-based happy hour. This feature does not exist — it is scope creep disguised as migration.

- **Failure scenario:**
  1. Developer builds HappyHourBanner with countdown timer and `useCart` hook with `happyHourDiscount` calculation.
  2. Backend has no corresponding endpoint or discount logic. The cart sends `discount_code` or expects a server-side 20% reduction at 14:00-16:00.
  3. Two possible outcomes:
     a. Frontend applies discount → order total sent to API is 20% less than expected → payment mismatch (PayOS amount vs DB amount triggers the amount mismatch handler in webhooks.js, flagging the order as "stuck").
     b. Frontend doesn't apply discount → HappyHourBanner shows "20% off!" but checkout total doesn't reflect it → customer trust erosion, potential consumer protection complaint in Vietnam.
  4. Either way: new feature introduced during migration, untested, with cascading failure modes.

- **Evidence:**
  - `grep -rni "happy" /Users/macbook/FnB-Container-Caffe/worker/src/` → zero results
  - `grep -rni "happy" /Users/macbook/FnB-Container-Caffe/js/` → zero results
  - `grep -rni "14:00\|16:00\|20%" /Users/macbook/FnB-Container-Caffe/` → zero results in business logic
  - Plan phase-02 line 79 — "Happy hour discount logic (14:00-16:00, 20% off drinks)"
  - Plan phase-02 line 64 — test #8: "happy hour discount" in use-cart.test.ts
  - `worker/src/routes/webhooks.js:110-118` — amount mismatch handler logs to KV as "stuck" — would trigger if frontend applies non-existent discount

- **Suggested fix:**
  1. Remove happy hour from Phase 2 as a migration item. If it's a desired new feature, add it to plan.md scope as "New: happy hour discount (requires backend implementation in Phase 6)."
  2. Add backend implementation task to Phase 6: cron-triggered discount activation, `/api/discounts/active` endpoint, order total validation with server-side discount calculation.
  3. Remove TDD test #8 from Phase 2 (it tests behavior that doesn't exist).

---

## Finding 5: Zustand cart localStorage persistence will collide with existing vanilla JS cart — order data loss during transition

- **Severity:** High
- **Location:** Phase 2, section "2.2 Cart + Checkout" — "Zustand cart store with persistence (localStorage)"
- **Flaw:** The existing vanilla JS cart (`js/cart.js`, 422 lines) persists to `localStorage` under keys `aura_cart` and `aura_session_id`. The cart is a class-based singleton with methods like `addToCart()`, `removeFromCart()`, and custom serialization format (`JSON.stringify(this.cart)`). The plan's Phase 2 introduces a Zustand store with its own persistence middleware, serializing to Zustand's format (likely under a different key). The plan provides zero coordination between old and new cart systems:
  1. What happens to a customer who added items to cart on the old HTML menu page, then navigates to the newly migrated React checkout page?
  2. What happens if the old JS and new React both run on the same page during a partial migration?
  3. How is the cart state migrated from the old format to the new Zustand format?

- **Failure scenario:**
  1. Customer browses the static `menu.html` (not yet migrated in parallel execution) and adds 3 items to cart. Cart saved to `localStorage['aura_cart']` in old format.
  2. Customer clicks "Checkout" → navigates to newly migrated React `/checkout` page.
  3. Zustand cart store initializes from its own `localStorage` key (or from empty state) — doesn't read `localStorage['aura_cart']`.
  4. Checkout page shows empty cart. Customer's selected items are invisible.
  5. Customer abandons checkout. Revenue lost.
  6. Alternatively: If Zustand happens to use the same `localStorage['aura_cart']` key, the serialization format mismatch causes a parse error, Zustand falls back to empty cart, same result.

- **Evidence:**
  - `js/cart.js:57` — `localStorage.getItem('aura_cart')`
  - `js/cart.js:163` — `localStorage.setItem('aura_cart', JSON.stringify(this.cart))`
  - `js/cart.js:15` — `localStorage.getItem('aura_session_id')`
  - Plan phase-02 line 47 — `useCart.ts # Zustand cart store`
  - Plan phase-02 line 118 — Risk table: "Cart state desync on refresh" with mitigation "Zustand persist middleware + rehydrate from API on mount" — mitigation addresses page refresh, NOT cross-system migration
  - No phase mentions a cart data migration script or dual-read fallback

- **Suggested fix:**
  1. Add a cart migration layer: Zustand store reads `localStorage['aura_cart']` on first mount, attempts to parse old format. If successful, hydrates Zustand store in new format, then writes to new key.
  2. Use a different localStorage key for Zustand (`aura_cart_v3`) to avoid silent corruption.
  3. Add integration test: "old cart format in localStorage → React cart shows items correctly."
  4. Consider server-side cart (D1 `carts` table) to eliminate localStorage dependency entirely — then both old and new frontends read from the same source.

---

## Finding 6: Zero rollback strategy across 7 phases — 120-hour plan with no documented recovery paths

- **Severity:** Critical
- **Location:** Entire plan. No phase, including Phase 7 (Polish), documents a rollback mechanism.
- **Flaw:** The plan's acceptance criteria #9 says "Old static site archived but available" — implying rollback is only possible AFTER full completion (Phase 7). If Phase 2's deployment breaks the revenue path (see Finding 1), there's no documented mechanism to:
  1. Revert Cloudflare Pages to the previous deployment (static HTML site)
  2. Revert the worker if Phase 6 introduces a regression
  3. Detect a broken deploy automatically (no health check / smoke test task)
  4. Restore the previous `vite.config.js` if the React build pipeline fails
  5. Recover from a partial migration where some pages are React and some are static

  The plan assumes linear, error-free execution across 120 estimated hours. No phase has a "rollback steps" section.

- **Failure scenario:**
  1. Phase 6 completes worker TypeScript refactor. Deploy to Cloudflare via `wrangler deploy`.
  2. Worker deploys successfully (no build errors). But the new typed order creation route has a Zod schema mismatch with the old frontend's JSON body format.
  3. 100% of order creation requests fail with 400 "validation error." Revenue drops to zero.
  4. Team needs to roll back the worker to the previous version. `wrangler rollback` exists but:
     a. The old worker version's bindings may have changed.
     b. D1 schema migration (if any) may be incompatible with old worker code.
     c. No documented procedure for coordinated frontend+backend rollback.
  5. Mean time to recovery: 2-4 hours of panic-driven debugging instead of 5 minutes of documented rollback.

- **Evidence:**
  - Zero grep matches for "rollback", "revert", "recovery", "backout" across all 8 plan documents
  - plan.md:84 — "Old static site archived but available" (only at Phase 7, post-completion)
  - Phase 6 line 134 — "Worker deploys to Cloudflare with `wrangler deploy`" — no rollback command mentioned
  - `worker/wrangler.toml` — no versioning strategy, no `compatibility_date` pinning mentioned

- **Suggested fix:**
  1. Add to plan.md: "Rollback strategy: Cloudflare Pages supports instant rollback via dashboard or `wrangler pages deployment rollback`. Worker supports `wrangler rollback`. Both are documented in `docs/deployment-guide.md`."
  2. Add Phase 7 substep: "Deploy health check — automated smoke test hits critical endpoints (GET /api/menu, POST /api/orders test, GET /) after every deploy. If any fail, auto-rollback."
  3. Each phase should include: "Before deploy: verify `wrangler pages deployment list` to know the previous deployment ID for rollback."
  4. Worker refactor (Phase 6) must specify: "Deploy to a staging worker first (`wrangler deploy --env staging`), run contract tests, then promote to production."

---

## Finding 7: KDS sound notification uses Web Audio API with AudioContext — plan's "sound notification" requirement is underspecified

- **Severity:** Medium
- **Location:** Phase 4, section "4.2 KDS" — "Sound notification for new orders (Web Audio API)"
- **Flaw:** The plan mentions Web Audio API sound notification as an implementation step. The existing KDS (`js/kds-app.js:40-78`) has a sophisticated implementation:
  - `AudioContext` initialized on first user click (browser autoplay policy workaround)
  - Sound toggle with `soundEnabled` setting (line 78)
  - Different sounds for new order vs order completion (lines 239, 308)
  - The `AudioContext` can be suspended by the browser and needs resume handling
  - iOS Safari has specific AudioContext quirks

  The plan treats this as a simple "Sound notification for new orders (Web Audio API)" one-liner. In practice, Web Audio API in a React component requires careful `useEffect` cleanup (AudioContext must be closed on unmount or it leaks memory), handling of `AudioContext.resume()` after browser suspension, and `prefers-reduced-motion` media query check (which the plan's Phase 7 accessibility audit requires).

- **Failure scenario:**
  1. Developer builds KDS React component with `new AudioContext()` in a `useEffect`.
  2. Component unmounts during React Strict Mode double-render (development mode). AudioContext is created, destroyed, created again.
  3. In production on iOS Safari, AudioContext is suspended by default (browser policy). Developer doesn't call `audioContext.resume()` on user interaction.
  4. KDS displays new orders correctly but sound never plays. Staff don't hear new orders. Orders sit unprocessed.
  5. After several hours, multiple AudioContext instances accumulate (not properly closed) → memory leak → KDS tab crashes. Kitchen loses visibility of all pending orders.

- **Evidence:**
  - `js/kds-app.js:40-50` — AudioContext initialization with click workaround
  - `js/kds-app.js:48` — `document.addEventListener('click', initAudioContext, { once: true })`
  - Phase 4 line 88 — "Sound notification for new orders (Web Audio API)" (one line, no detail)
  - Phase 7 line 55 — "prefers-reduced-motion respected (disable animations)" — no mention of disabling sound

- **Suggested fix:**
  1. Add a custom hook `useNotificationSound` with AudioContext lifecycle management.
  2. Add TDD test: "AudioContext is created on user gesture, suspended when tab is backgrounded, resumed on interaction."
  3. Add `prefers-reduced-motion` check to disable sound (Phase 7 accessibility requirement).
  4. Document: "KDS sound notification must work on iOS Safari 15+ with autoplay restrictions."

---

## Finding 8: Plan accepts ERPNext, Odoo, Mixpost, pretix, Mautic, Cal.com, Signage, Zalo route files as read-only — but their shared dependencies will be refactored

- **Severity:** High
- **Location:** Phase 6, "Files NOT Touched" section and plan.md file ownership boundaries
- **Flaw:** Phase 6 declares 12 route files as read-only (ERPNext, Odoo, Mixpost, pretix, Mautic, Cal.com, Signage, Zalo). However, these routes import shared dependencies that Phase 6 IS refactoring:
  - `createLogger` from `../utils/logger.js` → Phase 6 restructures to `lib/logger.ts`
  - `jsonResponse`, `errorResponse` from `../middleware/cors.js` → Phase 6 moves to `middleware/cors.ts`
  - `requireAuth` from `../middleware/admin-auth.js` → Phase 6 refactors to `middleware/auth.ts`
  - `c.env.AURA_DB`, `c.env.AUTH_KV` — Phase 6 types these as `Bindings` in `types/env.ts`

  The read-only routes import from shared `.js` modules. When Phase 6 converts those modules to `.ts`, the read-only `.js` routes either:
  a. Cannot import `.ts` modules (worker runtime is JS), or
  b. Must be updated with new import paths, violating the "read-only" constraint.

- **Failure scenario:**
  1. Phase 6 converts `utils/logger.js` to `lib/logger.ts` with Zod-typed log context.
  2. Read-only route `worker/src/routes/mixpost.js` imports `import { createLogger } from '../utils/logger.js'`.
  3. Worker bundler resolves `../utils/logger.js` → file no longer exists or is now `.ts`.
  4. Build fails with "Cannot find module '../utils/logger.js'".
  5. Developer must either: (a) update the read-only file's import path (violating the boundary), or (b) create a JS compatibility shim that re-exports the TS module.
  6. The "read-only" boundary was fiction — every shared dependency change forces cascading edits to read-only files.

- **Evidence:**
  - Phase 6 lines 63-77 — 12 files in "NOT Touched" list
  - Phase 6 lines 24-28 — middleware/auth.ts, error-handler.ts replaces cors.js patterns
  - Phase 6 lines 42-44 — `lib/` restructured: `db.ts`, `kv.ts`, `jwt.ts`, `validators.ts` replacing `utils/` and `lib/`
  - plan.md:62-66 — "Phase 6 owns worker/ (refactor only), must NOT touch erpnext*, odoo*"
  - `worker/src/routes/mixpost.js` imports from `../utils/logger.js` and `../middleware/cors.js`
  - `worker/src/routes/pretix.js` imports from `../utils/logger.js` and `../middleware/cors.js`
  - These dependencies WILL be moved/renamed by Phase 6

- **Suggested fix:**
  1. Acknowledge the false boundary: "Read-only route files must have their imports updated to match Phase 6's new module structure. Content of these files (business logic) remains unchanged."
  2. Or: Keep original `.js` utility files as re-export shims that delegate to new `.ts` modules. `utils/logger.js` → `export { createLogger } from '../lib/logger.ts'`.
  3. Add Phase 6 substep: "Verify all 12 read-only routes can import from refactored shared modules after restructuring. If not, create compatibility re-exports."

---

## Summary

| # | Finding | Severity | Phase |
|---|---------|----------|-------|
| 1 | PayOS return URL hardcoded to checkout.html → 404 after React migration | Critical | 2 + 6 |
| 2 | MoMo/VNPay payment methods in UI have zero backend implementation | Critical | 2 |
| 3 | No deployment coexistence strategy during parallel phases | Critical | Plan |
| 4 | Happy hour discount claimed as existing feature but doesn't exist in codebase | High | 2 |
| 5 | Zustand cart localStorage key collision with existing vanilla JS cart | High | 2 |
| 6 | Zero rollback strategy across entire 7-phase plan | Critical | All |
| 7 | KDS Web Audio API requirement underspecified — memory leak + iOS Safari risk | Medium | 4 |
| 8 | Read-only route files depend on shared modules being refactored — boundary is fictional | High | 6 |

**Critical findings: 4** — all block safe execution without plan revision.
**High findings: 3** — significant risk of production failure during execution.
**Medium findings: 1** — notable concern with straightforward mitigation.

None of these 8 findings were identified by prior reviewers (scope-critic and assumption-destroyer reports). They focus on runtime execution failure modes that the plan's structural analysis did not surface.
