# Red-Team Review: Hard Cut + Clean Slate

**Reviewed by:** code-reviewer agent (adversarial)  
**Date:** 2026-07-01  
**Plan:** `plans/260701-1935-hard-cut-clean-slate/`  
**Source report:** `plans/reports/brainstorm-260701-1856-hard-cut-clean-slate.md`

---

## Evidence Collected

- Read plan.md + all 5 phase files
- Verified file counts against `find` on actual filesystem
- Checked `src/App.tsx` route table against static HTML inventory
- Inspected `_redirects`, `_headers`, `jest.config.cjs`, `vitest.config.ts`
- Inspected `deploy-cloudflare.sh`, `vite.config.ts`, `package.json`
- Ran `npm run build` (passes) and `npm test` (60 failures confirmed)
- Traced `signage-widgets/` dependencies and worker API routes
- Verified test runner: `package.json` says `"test": "jest"` — NOT `vitest`

---

## Critical Findings

### C1. Signage Widgets Deletion = Production Outage

**Files:** `phase-01-audit-inventory.md` (line 97), `phase-02-hard-cut-remove-legacy.md` (line 93)

**What the plan says:**
> "Delete all `signage-widgets/*.html` (3 files)" — Phase 2, Step E3.  
> Classified as part of the 52 static HTML files to delete under the assumption that React SPA has 100% parity.

**What's wrong:**

The plan treats `signage-widgets/` as legacy static pages like any other. They are not. Verifiable facts:

1. **No React SPA equivalent exists.** `src/pages/` has no signage, signage-widget, menu-board, promo-screen, or welcome-screen component. `src/App.tsx` has no route for any of these.

2. **They have a dedicated worker API backend.** `worker/src/routes/signage.js` serves live product data and promotions via `/api/signage/menu` and `/api/signage/promos` — with CORS handling in `worker/src/index.ts`.

3. **They are production digital signage screens** designed for 1920x1080 displays (Xibo players), NOT informational brochure pages. They poll the worker API for real-time menu/promo data.

4. **They are tested.** `tests/signage-widgets.test.js` (325 lines) validates rendering, category headings, product items, and API endpoint references. `tests/signage-api.test.js` tests both `/api/signage/menu` and `/api/signage/promos` endpoints.

5. **Their deletion is ordered BEFORE the audit step that supposedly verifies parity** (Phase 1, Step C). The audit in Phase 1 would flag these as "no SPA equivalent" — but Phase 2's static file list already assumes they're safe to delete.

**Consequence:** Deleting `signage-widgets/menu-board.html`, `promo-screen.html`, and `welcome-screen.html` breaks the entire digital signage system. Xibo players pointed at these URLs will 404. If the `_redirects` wildcard catches them, they'll redirect to the React SPA which has NO signage display.

**Fix:**
- Phase 1 audit MUST flag these 3 files as "SPA route missing — DO NOT DELETE."
- Either (a) build React SPA equivalents before deleting, or (b) remove them from the delete list in Phase 2 Step E3 and add a new task to migrate them to React components in a follow-up phase.
- Update Phase 2 Step E3 to exclude `signage-widgets/*` from deletion.

---

### C2. Deploy Command Does Not Exist — Plan Copies Wrong Project's Doctrine

**Files:** `phase-05-atomic-deploy-verify.md` (lines 19, 41, 92-94), `plan.md` (line 84)

**What the plan says:**
> "`npm run deploy:full` — must exit 0" (Phase 5, Step B2, repeated throughout)  
> "Deploy to Cloudflare Pages" / "Deploy Worker to Cloudflare Workers"

**What's wrong:**

The plan uses the Sophia AI Factory deploy doctrine (`npm run deploy:full`). This project is **not** Sophia. Verifiable:

```json
// package.json
"scripts": {
    "deploy": "bash deploy-cloudflare.sh",
    ...
}
```

There is no `deploy:full` script. Running it will fail with `Missing script: "deploy:full"`. The actual deploy command is `npm run deploy` or `bash deploy-cloudflare.sh`.

Additionally, the plan's Phase 5 references `CLAUDE.md` (Sophia) deploy flow including `/api/version` SHA verification — the FnB project has no `/api/version` endpoint (the worker doesn't expose one in the route files inspected).

**Consequence:** Phase 5 is inoperable as written. All the SHA verification commands, the "wait for Cloudflare Pages deploy" steps, and the exact `curl` commands may not apply.

**Fix:**
- Rewrite Phase 5 to use the actual deploy script: `npm run deploy` or `bash deploy-cloudflare.sh`
- Verify whether `/api/version` exists in the worker. If not, use Cloudflare's own deploy verification (Wrangler CLI status check, or check a known endpoint)
- Test the actual deploy command end-to-end in a preview environment BEFORE the atomic production deploy step
- The deploy script builds SPA first then deploys worker — any build failure in either will leave partial state

---

### C3. Page Parity Claim ("100%") Is False — At Least 6 Gaps Found

**Files:** `plan.md` (line 27), `phase-01-audit-inventory.md` (line 14, Step C)

**What the plan says:**
> "React SPA already has 100% page parity (27 pages, 85 components, 56 test files)"  
> "Verify 100% React SPA ↔ static HTML page parity"

**What's wrong:**

Cross-referencing `src/App.tsx` routes against the 20 root static HTML files + 9 admin pages reveals these gaps:

| Static HTML | SPA Route | Status |
|---|---|---|
| `about-us.html` | `/about` | URL MISMATCH — SPA uses `/about`, not `/about-us`. Wildcard redirect would handle this. |
| `brand-guideline.html` | `/brand` | URL MISMATCH — SPA uses `/brand`, not `/brand-guideline`. BUT: Footer has `<Link to="/brand-guideline">` which is a **broken SPA link** (404 in SPA). |
| `receipt-template.html` | NONE | MISSING ENTIRELY — No route, no page component. |
| `success.html` | `/order-success` | URL MISMATCH |
| `failure.html` | `/order-failure` | URL MISMATCH |
| `signage-widgets/*.html` | NONE | MISSING — See C1 above. |
| `signup/index.html` | NONE | No `/signup` route in `src/App.tsx`. `_redirects` has `/signup /signup 200`. |
| `public/offline.html` | NONE | PWA offline page, not SPA equivalent. |
| `tv-menu.html` | `/tv-menu` | EXISTS but verify the TV Menu SPA page has the same full-screen 1920x1080 layout |
| `kds.html` | `/kds` | EXISTS — and worker API routes exist. SPA page exists. |

6 pages have NO SPA equivalent. 3 have URL mismatches that depend on `_redirects` wildcard to bridge.

**Additionally, a pre-existing bug:** `src/components/ui/footer.tsx` line 13 has `<Link to="/brand-guideline">` but the SPA route is `/brand`. This link is already broken in the live React SPA before any deletions happen.

**Fix:**
- Phase 1 audit MUST produce a factual parity matrix, not assume 100% parity.
- Add `receipt-template` as a React SPA route before deleting the HTML.
- Fix the Footer link: `/brand-guideline` → `/brand`.
- Add SPA routes for `/signup` and `/about-us` (or rely on `_redirects` wildcard — but document this as an explicit dependency).
- The `_redirects` wildcard `/*.html /:splat 301` will save some but NOT `signage-widgets/` (not `.html`-suffixed), NOT `signup/index.html` (which resolves to `/index` not `/signup`).

---

## High Findings

### H1. Test Runner Architecture Misrepresented — 417/418 Number Is for Vitest-Only, Not All Tests

**Files:** `plan.md` (Table in line 41), `phase-04-fix-tests-green-ci.md` (lines 14, 107)

**What the plan says:**
> "Vitest already works (417/418 pass)"  
> "Fix 60 unit test failures (Jest→Vitest migration)"  
> "Test runners: 2 (Vitest + Jest) → 1 (Vitest only)"

**What's wrong:**

The plan implies there are two parallel test runners and the Jest one needs folding into Vitest. The actual setup:

1. `package.json` has `"test": "jest"` — npm test runs JEST, not Vitest. Running `vitest run` separately would only run `src/**/*.test.{ts,tsx}` (58 test files per vitest.config.ts), giving 417/418 pass.

2. `vitest.config.ts` includes ONLY `src/**/*.test.{ts,tsx}` — it does NOT include `tests/**/*.test.js`. The 29 Jest test files are completely invisible to Vitest.

3. The 60 Jest failures are ALL caused by Jest's inability to parse ES module `export` syntax in `worker/src/middleware/logger.ts`. Every test that imports from `worker/src/utils/logger.js` (which re-exports from `middleware/logger.ts`) cascades into failure.

4. Moving these 29 files to Vitest WON'T automatically fix the 60 failures. The `vi.mock()` in `vitest-setup.ts` can mock the logger BEFORE the import chain resolves — this IS the right fix. BUT the plan understates the risk: `vi.mock()` hoisting depends on exact module path matching. If any test imports `logger.js` vs `logger.ts` vs re-exports from another intermediate file, the mock won't match and the cascade will continue.

5. After Phase 3 converts `.js` to `.ts`, all import paths change — the `vi.mock()` paths in the setup file must be updated atomically with each conversion.

**Fix:**
- Phase 4 should NOT assume "move to Vitest = fixes 45 of 60 failures." Test each batch incrementally.
- Add a sweep step: after ALL conversions, grep for any remaining `require()` or `jest.fn()` in test files.
- Verify the mock path chain: `logger.ts` → re-exported by `utils/logger.js` → consumed by `lib/email.js` → tested by `tests/email.test.js`. The `vi.mock` must target the actual import path, not the physical file.
- Accept that Phase 4 effort (8-12h) may be significantly under-estimated if mock chains don't resolve cleanly.

---

### H2. `public/offline.html` Deletion — No PWA Impact Assessment

**Files:** `phase-02-hard-cut-remove-legacy.md` (lines 57, 94), `phase-01-audit-inventory.md` (line 125)

**What the plan says:**
> "Delete `public/offline.html` — if service worker no longer needs it"  
> "Check service worker config before deleting"

**What's wrong:**

The plan delegates the decision to "check service worker config" but provides no mechanism or checklist item for this check. `public/offline.html` is a PWA offline fallback page. If there's an active service worker caching this as the offline shell, deleting it creates a broken offline experience. The plan's risk assessment mentions this but doesn't turn it into a concrete verification step:

1. `tests/pwa-features.test.js` exists in `tests/` — it likely tests offline behavior.
2. `public/offline.html` references `../css/offline.css` — but Phase 2 deletes `css/` first. Even if `offline.html` is kept, its CSS is deleted, making the offline page unstyled.

**Fix:**
- Add explicit PWA audit step to Phase 1: check for registered service worker, cache strategy, and whether `offline.html` is the cached shell.
- If service worker is active, either (a) keep `offline.html` + its CSS, or (b) update service worker to use SPA offline fallback before deleting.
- Run `tests/pwa-features.test.js` before and after deletion as the pwa-specific regression gate.

---

### H3. `cp -r assets dist/` Copies Demo HTML to Production

**Files:** `deploy-cloudflare.sh` (line 16), `phase-02-hard-cut-remove-legacy.md` (Step E5)

**What the plan says:**
> "Delete `assets/brand/**/*.html` (demo/report files)" — Phase 2, Step E5

**What's wrong:**

The deploy script runs `cp -r assets dist/` after Vite build. This copies the ENTIRE `assets/` directory to production, including:

- `assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/hero-ripple-demo.html`
- `assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/OPERATIONS_2026/index.html`

These are design demos and brand asset files — not production pages. But if ANY static HTML from `assets/` links to deleted CSS/JS files, those demo pages will 404 on production CSS/JS references.

Additionally, the deploy script copies `assets/` AFTER Vite build but BEFORE deploying to Cloudflare Pages. So even after Phase 2 deletes HTML from the repo, the `dist/` could still end up with asset HTML files if `assets/` isn't cleaned.

**Fix:**
- Clean `assets/` of HTML/demo files before deploy, OR change the deploy script to copy only specific asset subdirectories (images, fonts, etc.)
- Add a verification step: `find dist -name "*.html"` should return only `dist/index.html` after build.
- Consider deleting `assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/` entirely since these are design artifacts, not production assets.

---

### H4. `_redirects` Wildcard `/*.html /:splat 301` Has Two Edge-Case Failures

**Files:** `phase-02-hard-cut-remove-legacy.md` (lines 97-132)

**What the plan says:**
> "Add `/*.html /:splat 301` wildcard" to cover all legacy .html URLs

**What's wrong:**

The wildcard is a good strategy but has two known failures:

1. **`signup/index.html`** — The wildcard `/*.html` would catch this as `/signup/index` (redirecting to `/signup/index`), NOT `/signup`. The existing explicit rule `/signup /signup 200` only handles the clean URL. A user/bookmark with `/signup/index.html` gets redirected to a non-existent SPA route.

2. **`checkout.html` redirects to `/checkout?payment=pending`** — The plan's proposed `_redirects` keeps this as an explicit exception (line 101), which is correct. But the plan doesn't verify whether the SPA `/checkout` route properly handles `?payment=pending` query parameter. If it doesn't, this redirect is silently broken.

3. **Admin `.html` URLs** like `/admin/login.html` — The wildcard redirects to `/admin/login` which IS a valid SPA route. But `_redirects` on Cloudflare Pages processes rules top-to-bottom, first match wins. The SPA fallback `/* /index.html 200` is last. The wildcard `/*.html /:splat 301` at line 105 is BEFORE the security blocks at line 117. So `/docs/secret.html` would 301 to `/docs/secret` before hitting the security block — but then the SPA fallback would serve it as `/index.html 200`. This is a minor bypass but worth noting.

**Fix:**
- Add explicit redirect: `/signup/index.html /signup 301`
- Verify SPA `/checkout` handles `?payment=pending` before relying on the redirect
- Consider reordering: security blocks first, then `.html` wildcard, then short URLs, then SPA fallback last
- Add Phase 5 redirect verification for edge cases: multi-segment paths, query params, admin sub-paths

---

### H5. Phase 3 Effort (6-10h for 41 JS→TS Conversions) Is Highly Optimistic

**Files:** `phase-03-backend-typescript-migration.md` (line 7)

**What the plan says:**
> "Effort: 6-10h" for converting 41 JS files to TypeScript + Zod validation on all routes

**What's wrong:**

The plan proposes converting 41 files AND adding Zod validation to all API routes in 6-10 hours. That is 9-15 minutes per file, including:
- Rename `.js` → `.ts`
- Replace `require()` with `import`
- Replace `module.exports` with `export`
- Add TypeScript types to all function signatures
- Run `tsc --noEmit` after each file
- Delete original `.js`
- Update all consumers
- Handle circular dependency issues

The third-party clients (erpnext-client, mautic-client, pretix-client, mixpost-client, cal-com-client, xibo-client) are the hardest part — they make actual HTTP calls to external APIs. Adding types requires understanding each API's response shape. The plan says "Test each client against real API if credentials available, otherwise type-only" — type-only conversion of API clients without runtime testing is fragile.

The Zod schema creation (Step B) alone — for every route in `worker/src/routes/` (32 route files) — requires understanding the shape of every endpoint. At 5-10 minutes per route schema, that's 2.5-5 hours just for schemas.

**Fix:**
- Re-estimate: 12-18h for TS conversion (not 6-10h)
- Split Phase 3 into two sub-phases: (3a) TS conversion without Zod, (3b) Zod validation wiring
- Convert the 6 third-party clients LAST and flag them as highest-risk
- For clients that can't be tested against real APIs, at minimum create a response type from API docs or existing mock data in test files

---

## Medium Findings

### M1. `_redirects` Already Exists — Plan Proposes Replacing It Without Diff

**Files:** `phase-02-hard-cut-remove-legacy.md` (lines 97-132)

The current `_redirects` already has explicit `.html` redirects for `index-legacy`, `checkout`, `loyalty-calculator`, `kds`. The plan proposes replacing all of these with a wildcard. This is correct in intent, but:

- The existing rules were presumably tested and working. Replacing them with a wildcard changes the redirect chain behavior.
- The plan does not propose diffing the old `_redirects` against the new one to verify no regression.
- The `_redirects` file has a SPA fallback `/* /index.html 200` at the bottom. The plan's new version keeps this. However, there are intermediate directories like `signage-widgets/` that aren't covered by any rule — they'd fall through to SPA and return 200 (with React 404 page), not a 404 status code.

**Fix:** Produce a diff of old vs new `_redirects` during Phase 2. Verify redirect behavior for every static HTML URL in the parity matrix from Phase 1.

---

### M2. Phase 5 "Zero Downtime" Claim Is Unverified

**Files:** `phase-05-atomic-deploy-verify.md` (line 36)

> "Non-functional: Zero downtime during deploy (Cloudflare Pages atomic swap)"

Cloudflare Pages does support atomic deployments, BUT the deploy script runs TWO separate deploys: Pages (`wrangler pages deploy`) and Worker (`wrangler deploy`). These are not atomic with each other. If the Worker deploy adds new routes (Phase 3) that the old SPA doesn't call yet, or if the new SPA calls Worker routes that the old Worker doesn't have yet, there's a version skew window.

The deploy script's order is: build SPA → deploy Pages → deploy Worker. If the Pages deploy succeeds but Worker deploy fails, the site is live with new SPA code calling old Worker endpoints.

**Fix:** Document the version skew risk. Consider deploying Worker first (backward-compatible with old SPA), THEN Pages. Add explicit rollback instructions: which commit to checkout and which `wrangler` command to run.

---

### M3. `brand-tokens.css` Shared Between Static and Something Else?

**Files:** `phase-01-audit-inventory.md` (line 124), `phase-02-hard-cut-remove-legacy.md` (line 174)

The plan says:
> "React SPA uses Tailwind v4, never imported brand-tokens.css"

But the risk assessment in Phase 1 also says `brand-tokens.css is referenced by static HTML; check if SPA bundles equivalent`. The plan never follows up with _how_ to check this. Grep confirms: `brand-tokens.css` is referenced by all 20 root static HTML files (they all include it via `<link>`). But since all those HTML files are being deleted, the only question is: does anything else reference it? A quick grep of `src/` for `brand-tokens` finds nothing — confirming the plan's claim. However, the E2E tests (`tests/playwright/ui-audit.spec.ts` line 178) explicitly check for `link[href*="brand-tokens.css"]` — this check WILL fail after deletion because the SPA bundles CSS via Vite, not via `<link>` tags.

**Fix:** This is correctly handled in Phase 4's E2E fix section. But add a Phase 1 verification: `grep -r 'brand-tokens' src/ tests/` and confirm zero results before declaring it safe.

---

### M4. 14 `tools/bazi-mcp/*.html` Files — Client Deliverables or Tooling Artifacts?

**Files:** `phase-02-hard-cut-remove-legacy.md` (line 94), `phase-01-audit-inventory.md` (line 97)

The plan lists `tools/bazi-mcp/*.html` as "demo/report files" to delete. 14 HTML files exist:

- `deploy_cf/index.html` — CF deployment page
- `deploy_cf/brand-guidelines.html` — branded page
- 12 `report-*.html` files for specific named individuals (e.g., `report-nguyen-huu-con-*.html`)

These appear to be feng shui/bazi report deliverables for clients. If these reports were ever shared with clients via URLs, deleting them breaks those links.

**Fix:** Before deleting, verify: (a) are these in `_redirects`? (b) are they served in production? (c) are they linked from any active system? If they're client deliverables, move them to an archive or document that the client has received their copy.

---

### M5. Phase 4 Ignores `debug_errors.spec.ts` in E2E Fixes

**Files:** `phase-04-fix-tests-green-ci.md` (Step E)

The plan lists fixing `ui-audit.spec.ts` and `fnb-audit.spec.ts` but a third E2E spec file exists: `tests/playwright/debug_errors.spec.ts`. This file also references `.html` URLs:
```
{ name: 'menu', url: '/menu.html' },
{ name: 'checkout', url: '/checkout.html' },
{ name: 'loyalty', url: '/loyalty.html' },
{ name: 'reservation', url: '/table-reservation.html' },
{ name: 'contact', url: '/contact.html' },
{ name: 'about', url: '/about-us.html' },
```

The plan's Step E only mentions updating PAGES arrays in "both spec files" — missing this third one.

**Fix:** Include `debug_errors.spec.ts` in the E2E fix step.

---

### M6. `_headers` CSP References `cdn.jsdelivr.net` — Plan Doesn't Address It

**Files:** `phase-02-hard-cut-remove-legacy.md` (Step G), `_headers`

The plan's Step G says "Remove any `font-src` rules for Google Fonts." The actual `_headers` CSP uses `https://cdn.jsdelivr.net` for `script-src` and `style-src`, not Google Fonts. The plan is fixing a problem that doesn't exist while ignoring the actual CDN dependency.

**Fix:** Update Step G to reflect the actual CSP content. If jsdelivr is still needed, keep it. If not, remove it and test.

---

## Low Findings

### L1. Plan Says 646 Tests — But That's Jest-Only; Vitest Has Different Count

**Files:** `plan.md` (line 41, 84)

"`npm test` → 646/646 pass" — but `npm test` runs Jest (which has 646 tests across 29 files). Vitest runs 418 tests across 58 files. The success metric should specify which test runner and total count for each.

---

### L2. Phase 5 References Sophia Project Conventions

**Files:** `phase-05-atomic-deploy-verify.md` (line 77)

> "Deploy: `apps/sophia-ai-factory/` (if this IS Sophia) or project root for FnB"

This hedging suggests the plan template was copied from a Sophia plan. Remove the Sophia references — this is the FnB project.

---

### L3. "homepage-v6.css: 4568 lines" Mentioned But Never Located in Filesystem

**Files:** `phase-01-audit-inventory.md` (line 98)

The file inventory lists `homepage-v6 (4568 lines)` under `css/`. However, this CSS file is not found in the root `css/` directory (which may not even exist as a separate directory — the `css/` files found are `admin/*.css` and root-level `*.css` files). Verify this file exists before using it as a metric for `!important` count reduction.

---

### L4. Effort Totals Don't Add Up Cleanly

**Files:** `plan.md` (line 15)

`effort: 21-32h` — summing the individual phases: 2-3 + 3-4 + 6-10 + 8-12 + 2-3 = 21-32h. This is correct in sum, but Phase 3 (6-10h) is unrealistically low (see H5). Realistic total: 27-42h.

---

### L5. `index-legacy.html` Has No Explicit Redirect Rule in Proposed `_redirects`

**Files:** `phase-02-hard-cut-remove-legacy.md` (lines 98-132)

The current `_redirects` has `/index-legacy.html / 301`. The proposed new `_redirects` removes this explicit rule and relies on the wildcard `/*.html /:splat 301`. This would redirect `/index-legacy.html` → `/index-legacy` (SPA route). But there's no SPA route at `/index-legacy` — the SPA only has `/` as the home route. The wildcard redirects to a 404.

**Fix:** Keep the explicit exception: `/index-legacy.html / 301`

---

## Cross-Cutting Issues

### CC1. The Plan Assumes `npm test` = Vitest — It Doesn't

This misunderstanding pervades the entire plan. `package.json` has `"test": "jest"`. The plan consistently talks about "Jest→Vitest migration" but `npm test` won't run Vitest until Phase 4 Step F2 changes the script. This means:
- Phase 1's "capture baseline tests" via `npm test` captures JEST results, not Vitest results
- Phase 2's regression gate uses `npm test` which runs Jest
- Phase 3's regression gate uses `npm test` which runs Jest
- Phase 4 is where the switch actually happens

The plan should explicitly version the test scripts: keep `test:jest` for current Jest runs, add `test:vitest` for Vitest, and only change `test` to `vitest run` at the end of Phase 4 when all tests pass.

---

### CC2. No Rollback Repository State Documented

The plan says "Git revert" as mitigation for wrong deletions. This is insufficient. For a hard-cut deletion of 135+ files across multiple commits, an accidental deletion mid-phase requires knowing which commit to revert to. The plan should document:
- Recommended commit boundaries (one commit per step within each phase)
- A "last known good" commit hash captured at the start of each phase
- Specific `git revert` commands for each phase boundary

---

### CC3. No Stripe/PayOS Payment Flow Verification in Phase 5

**Files:** `phase-05-atomic-deploy-verify.md` (Step D)

The protected flow walkthrough covers Checkout, Loyalty, Reservation, KDS, POS — but does not include payment gateway verification (PayOS in Vietnam). The `_headers` CSP includes `https://api-merchant.payos.vn` in `connect-src`. If payment processing breaks, it's a revenue outage. Add payment flow verification to Phase 5 protected flows.

---

## Summary of Actionable Recommendations

| Priority | Action | Phase |
|---|---|---|
| **BLOCKER** | Do NOT delete `signage-widgets/*.html` — no SPA equivalent exists | Phase 1, 2 |
| **BLOCKER** | Replace all `npm run deploy:full` with `npm run deploy` or `bash deploy-cloudflare.sh` | Phase 5 |
| **BLOCKER** | Produce factual page parity matrix — 6 pages missing SPA routes | Phase 1 |
| **HIGH** | Fix Footer link: `/brand-guideline` → `/brand` | Phase 1 |
| **HIGH** | Add PWA audit to Phase 1 before deleting `public/offline.html` | Phase 1 |
| **HIGH** | Clean `assets/` of demo HTML before deploy | Phase 2 |
| **HIGH** | Re-estimate Phase 3: 12-18h (not 6-10h) | Phase 3 |
| **HIGH** | Split Phase 3 into TS conversion + Zod validation sub-phases | Phase 3 |
| **HIGH** | Add `signup/index.html → /signup` explicit redirect | Phase 2 |
| **MEDIUM** | Add `debug_errors.spec.ts` to E2E fix plan | Phase 4 |
| **MEDIUM** | Document version-skew risk between Pages and Worker deploys | Phase 5 |
| **MEDIUM** | Keep explicit `/index-legacy.html / 301` rule | Phase 2 |
| **MEDIUM** | Verify `tools/bazi-mcp/` files are not client deliverables before deletion | Phase 2 |
| **LOW** | Remove Sophia project references from Phase 5 | Phase 5 |
| **LOW** | Use separate `test:jest` and `test:vitest` scripts during transition | Phase 4 |
| **LOW** | Add PayOS payment verification to Phase 5 walkthrough | Phase 5 |

---

## Unresolved Questions

1. Does the React SPA `/checkout` route handle the `?payment=pending` query parameter that the `_redirects` rule passes?
2. Does the worker expose a `/api/version` endpoint for SHA verification? (Not found in route file listing)
3. Are the 14 `tools/bazi-mcp/*.html` files currently served in production, and if so, at what URLs?
4. Is the PWA service worker (`tests/pwa-features.test.js` exists) actively registered, and what is its offline cache strategy?
5. Do the 6 third-party client integrations (ERPNext, Mautic, Pretix, Mixpost, Cal.com, Xibo) have active credentials to test against after TS conversion?
6. What Cloudflare Pages project name is used? The deploy script uses `fnb-caffe-container` — confirm this is the production project.
7. Are there any external bookmarks, QR codes, or printed materials pointing to `.html` URLs that need URL updating beyond 301 redirects?
