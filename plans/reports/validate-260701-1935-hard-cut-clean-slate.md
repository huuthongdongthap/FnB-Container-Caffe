# Validation Report: Hard Cut + Clean Slate

**Plan:** `plans/260701-1935-hard-cut-clean-slate/`
**Validated:** 2026-07-01
**Scope:** plan.md + 5 phase files vs actual codebase state

---

## Summary

**Verdict: BLOCKED** — 3 critical findings must be resolved before Phase 1 can begin. Plan copies Sophia AI Factory infrastructure (deploy:full, /api/version, SHA verification) that does not exist in this FnB-Container-Caffe project. 4 high-severity issues and 6 medium issues also need resolution.

---

## Critical Findings (blocking)

### C1. `npm run deploy:full` does not exist

**Claim:** Phase 5 says `npm run deploy:full` with SHA verification.

**Reality:** `package.json` has `"deploy": "bash deploy-cloudflare.sh"` — no `deploy:full` script exists. The Sophia project has `deploy:full` with SHA verification; FnB does not.

**Impact:** Phase 5 is written for the wrong project. Every step from 5B through 5C (SHA verification) cannot be executed as written.

**Fix:** Rewrite Phase 5 to use `bash deploy-cloudflare.sh` and adapt verification steps to FnB's actual Cloudflare Pages deploy model. Determine if an `/api/version` endpoint should be added (does not currently exist — see C2).

### C2. No `/api/version` endpoint — SHA verification impossible

**Claim:** Phase 5 Step C: `curl -s https://aura.cafe/api/version | jq -r '.shortSha'`

**Reality:** `grep -r 'version\|shortSha\|/api/version' worker/src/` returned zero results. No version endpoint exists in the worker routes (`worker/src/routes/` has no `version.ts` or `version.js`). There is no mechanism to verify that the deployed SHA matches local.

**Impact:** The entire "SHA verification" gate is vapor. You cannot verify what code is live.

**Fix:** Either (a) add a `/api/version` route to the worker that returns `process.env.CF_PAGES_COMMIT_SHA` (Cloudflare Pages injects this), or (b) remove SHA verification from success criteria and rely on manual flow walkthrough only.

### C3. E2E test count: 33, not 151

**Claim:** plan.md says "E2E test failures: 28" and "151/151 pass" as success metric. Phase 1 says "Playwright E2E Desktop Chrome: 2 specs, 151 tests."

**Reality:** 
- `tests/playwright/` contains 3 spec files: `ui-audit.spec.ts` (17 tests), `fnb-audit.spec.ts` (15 tests), `debug_errors.spec.ts` (1 test) = **33 total tests**
- Every E2E test file references `.html` URLs (e.g., `/menu.html`, `/checkout.html`)
- Two playwright configs exist: `playwright.config.ts` (local dev) and `playwright.config.prod.ts` (preview URL)

**Impact:** Phase 4's "fix 28 E2E failures" and the "151/151 pass" success metric are based on fabricated numbers. The actual fix work is smaller (33 tests, all referencing .html URLs) but the plan's test matrix is completely wrong.

**Fix:** Rerun `npx playwright test` against actual deployment, capture real failure count, update all references from "151" to the actual number.

---

## High-Severity Findings

### H1. `@hono/zod-validator` not installed

Phase 3 Step G shows: `import { zValidator } from '@hono/zod-validator'`. Worker `package.json` has `zod` but NOT `@hono/zod-validator`. This package must be installed before Phase 3 can wire Zod validation.

### H2. PWA service worker caches files Phase 2 deletes — no concrete fix

`js/sw.js` hardcodes a `STATIC_ASSETS` array including `/css/styles.css`, `/js/main.js`, `/js/theme.js`, `/js/menu.js`, `/js/cart.js`, `/js/checkout.js`, `/js/i18n.js` — all files Phase 2 deletes. Phase 2 risk table mentions "Update `js/sw.js` cache list or delete SW if SPA handles offline" but provides no implementation steps. The `js/` directory is deleted wholesale in Step D.

**Fix:** Add explicit step to Phase 2: before deleting `js/`, either (a) update PWA cache manifest in the SPA's service worker registration (if one exists in `src/`), or (b) accept that offline PWA support is lost and document it.

### H3. `receipt-template.html` has no SPA route equivalent

Static HTML: `receipt-template.html` exists. SPA routes (verified in `src/App.tsx`): no route for `/receipt-template` or `/receipt`. `grep -ri 'receipt' src/` finds nothing.

**Impact:** Deleting `receipt-template.html` loses this page entirely. The wildcard `/*.html /:splat 301` redirects `/receipt-template.html` to `/receipt-template` which the SPA has no route for — hits `*` catch-all (NotFound page).

**Fix:** Either add an SPA route for receipt viewing, or add explicit `_redirects` rule if receipt is meant to be email-only (the worker template suggests it's email-only). Document the decision.

### H4. `npm run build` includes lint of deleted directory

`package.json`: `"build": "npm run lint && vite build"` and `"lint": "eslint js/ worker/src/ --ext .js"`. After Phase 2 deletes `js/`, `eslint js/` will fail because the directory doesn't exist. After Phase 3 converts JS to TS, `--ext .js` won't catch TypeScript files.

**Fix:** Phase 2 must update the lint script to remove `js/`. Phase 3 must update it to `eslint worker/src/ --ext .ts`.

---

## Medium-Severity Findings

### M1. `_redirects` changes 200 to 301 for short URLs — breaks SPA routing

Plan Phase 2 Step F proposes changing `/admin-dashboard → 301` and `/brand → 301` and `/signup → 301`. Current `_redirects` uses `200` for these (meaning "serve index.html at this path" — SPA client-side routing handles it). Changing to `301` forces a browser redirect to the target path, which: (a) changes the URL the user sees, (b) causes a full page reload instead of client-side navigation.

**Fix:** Keep short URL aliases as `200` (SPA fallback). Only legacy `.html` URLs should use `301`.

### M2. Existing `_redirects` has `/checkout.html` already redirecting — duplication risk

Current `_redirects` already has `/checkout.html → /checkout?payment=pending 301`. The plan's wildcard `/*.html /:splat 301` would redirect `/checkout.html → /checkout` (losing the `?payment=pending` query). The proposed explicit rule keeps it, but the ordering must be correct (explicit before wildcard). The plan shows correct ordering but doesn't note that the existing `_redirects` already handles `.html` routes on a case-by-case basis.

**Fix:** Verify that the explicit `.html` exceptions are listed BEFORE the wildcard in the final `_redirects`. Test that `/checkout.html` preserves `?payment=pending` after deploy.

### M3. Worker `tsconfig.json` `include` only matches `.ts` during transition

`worker/tsconfig.json`: `"include": ["src/**/*.ts"]`. During Phase 3 conversion, as files transition from `.js` to `.ts`, `allowJs: true` is set but `include` only picks up `.ts`. If an intermediate state has mixed `.js` and `.ts`, `tsc --noEmit` won't check the remaining `.js` files.

**Fix:** Temporarily add `"src/**/*.js"` to `include` during Phase 3, or accept that `tsc --noEmit` only validates converted files.

### M4. Admin SPA routes use `/admin/dashboard` but existing `_redirects` has `/dashboard → /admin/dashboard`

This is fine — the existing redirect is correct and the plan preserves it. But note: `receipt-template.html` route SPA gap and `brand-guideline.html` existing redirect (via wildcard: `/brand-guideline.html → /brand-guideline`, but SPA route is `/brand`). The plan's wildcard would send `/brand-guideline.html → /brand-guideline` which React Router would need to handle. The SPA route is at `/brand`, not `/brand-guideline`. Need explicit rule: `/brand-guideline.html /brand 301`.

**Fix:** Add explicit exception before wildcard: `/brand-guideline.html /brand 301`.

### M5. Phase 1 file inventory count doesn't match actual files

Plan claims "Root static HTML: 20" but `grep` finds 20 files. OK.

Plan claims "CSS in `css/`: 32" — `ls css/ | wc -l` = 32. OK.

Plan claims "JS in `js/`: 35" — `ls js/ | wc -l` = 31 entries (some are directories). Plan says 35 files total including subdirectories. OK.

Plan claims "admin CSS: 6" (shared, dashboard, login, orders, erpnext-sync, staff). Actual: 6. OK.

Plan claims 52 static HTML files. Actual: 20 root + 9 admin + 3 signage + 1 signup + 1 public + 11 tools/bazi-mcp + 2 reports + 2 assets/brand = 49. Close enough — but the "20 other locations" in Phase 1 needs to enumerate the bazi-mcp files (11, not "a few").

### M6. Phase 5 "superseded plans" archive includes x100-design-polish

The plan's frontmatter says it supersedes `260701-1655-x100-design-polish`. Phase 5 Step G says to mark it `status: completed` (not cancelled like the others). This is correct — the design polish work was done, just the CSS files are now being deleted. But verify: did the x100 plan actually complete its CSS fixes before this plan deletes all those files?

---

## Completeness Analysis

| Phase | Concrete Success Criteria? | Verifiable? | Gaps |
|-------|---------------------------|-------------|------|
| 1 | Yes — file counts, output audits | Mostly — counts are specific, parity matrix depends on human judgment | Parity "verified" is subjective — "SPA route exists" vs "SPA page has feature parity" are different standards |
| 2 | Yes — file counts deleted, build passes | Yes — `npm run build` exits 0, grep confirms no files remain | Misses PWA update, lint script fix, explicit `_redirects` exceptions for `/brand-guideline.html` and `/receipt-template.html` |
| 3 | Mostly — file counts, build passes, zero `:any` | `tsc --noEmit` and `grep ': any'` are objective | "Zod validation on ALL API route inputs" is massive scope. 25 route files with varying complexity. No inventory of inputs per route. Missing `@hono/zod-validator` dependency |
| 4 | Yes — 0 test failures, Jest removed | `npm test` exits 0, `jest.config.cjs` deleted | Test counts are wrong (33 E2E not 151). Does not update lint/test scripts |
| 5 | Yes — deploy exits 0, flow walkthrough | Most checks are objective | `deploy:full` doesn't exist. SHA verification impossible. Manual flow walkthrough is subjective |

---

## Dependency Graph Audit

```
Phase 1 (Audit) ──► Phase 2 (Delete) ──► Phase 3 (TS) ──► Phase 4 (Tests) ──► Phase 5 (Deploy)
```

**Verdict: Partially correct, with overlaps possible.**

- **Phase 1 → Phase 2 dependency is real.** Must know what to delete.
- **Phase 2 → Phase 3: Can partially overlap.** Phase 3 Layer 0 (types, constants, utils) can begin conversion WHILE Phase 2 deletes HTML/CSS — they touch different directories (`worker/src/` vs root `*.html`/`css/`). Only the final regression gate needs Phase 2 complete. Overlap saves ~2h.
- **Phase 3 → Phase 4: Real dependency.** Tests must run against final TS code.
- **Phase 4 → Phase 5: Real dependency.** Green CI is deploy gate.

---

## Missing Work (Not Phased)

1. **Update `package.json` scripts.** `lint`, `test`, `test:watch`, `test:coverage`, `test:ci` all reference `jest`. After Phase 4, all must reference `vitest`. Half-done in Phase 4 Step F but doesn't mention lint update.

2. **Update `vite.config.ts` build.** No phase checks that Vite build output includes `_redirects` and `_headers` in `dist/`. Cloudflare Pages needs these at root. Verify `vite.config.ts` copies them (or use `public/` directory).

3. **PWA manifest update.** If `manifest.json` exists, check if it references deleted files.

4. **CI/CD config.** No phase addresses CI (GitHub Actions, Cloudflare Pages build config). If CI runs `npm test` (which calls `jest` pre-migration), it breaks mid-plan.

5. **Stakeholder notification.** No phase mentions notifying users/customers about URL changes, though `_redirects` should make it transparent.

6. **Docs update.** `docs/` may reference deleted `.html` page URLs. No phase audits documentation.

---

## Effort Realism

| Phase | Claimed | Assessment | Notes |
|-------|---------|------------|-------|
| 1: Audit | 2-3h | **Reasonable** | Grep/count tasks are automatable |
| 2: Delete | 3-4h | **Reasonable** | Most time spent verifying build doesn't break after each deletion batch |
| 3: TS Migration | 6-10h | **Low (8-14h realistic)** | 41 JS files, 25 route handlers. Writing Zod schemas for 25+ routes with different input shapes is significant. `@hono/zod-validator` must be integrated. Each route has unique validation needs — cannot template |
| 4: Fix Tests | 8-12h | **Low (12-20h realistic)** | 29 test files to convert Jest→Vitest + fix 60 failures. Mechanical conversion is fast, but actual test bugs (Type C: ~5 failures) may hide deeper issues exposed after Jest removal. E2E fixes (33 tests) need individual selector updates |
| 5: Deploy | 2-3h | **N/A until rewritten** | Phase 5 is for wrong project. After rewrite, 2-3h reasonable |

**Total: 21-32h claimed → 27-42h realistic.** On the high end if hidden test bugs surface.

---

## Rollback Analysis

| Phase | Reversible? | Rollback Method | Damage if Partial |
|-------|-------------|-----------------|-------------------|
| 1 | N/A (read-only) | No rollback needed | None |
| 2 | **Yes** — if committed per-batch | `git checkout` individual deleted files. CSS batch committed separately from JS batch from HTML batch | Medium: if build breaks mid-phase and commit was atomic, revert the commit |
| 3 | **Partially** — .js files deleted after .ts verified | Keep .js copies until each file's .ts version passes `tsc --noEmit` + builds. Revert individual files | High: if a critical route silently breaks due to TS type narrowing or Zod rejecting previously-valid inputs |
| 4 | **Yes** — test files only | `git checkout` test files. Keep Jest while Vitest is being validated | Low: tests are additive; original Jest tests still exist until Phase 4 Step F deletes them |
| 5 | **Partially** — Cloudflare Pages atomic deploy | Rollback via `wrangler pages deploy` with previous commit. Old version stays live | Critical: if deploy breaks customer-facing flows. Mitigated by atomic swap |

**Highest risk:** Phase 3 — no "test against real APIs" step for converted clients. Zod validation could reject payloads that previously passed silently (e.g., optional fields that were always present but not guaranteed).

---

## Scope Creep Assessment

| Task | In Plan | Scope Creep? | Why |
|------|---------|-------------|-----|
| Delete static HTML/CSS/JS | Phase 2 | **No** — core goal | |
| JS → TS conversion | Phase 3 | **No** — core goal | |
| Zod validation on ALL routes | Phase 3 Step B+E | **Yes — aggressive** | Converting JS→TS is one scope. Adding runtime input validation to 25 routes simultaneously doubles the risk surface. Recommend: TypeScript types only in Phase 3, Zod validation in a follow-up plan |
| Jest → Vitest migration | Phase 4 | **No** — prerequisite for green CI with TS | |
| Full E2E test fix | Phase 4 | **No** — needed for green CI | |
| Design polish review | Plan superseeds x100 | **Borderline** — deleting CSS fixes `!important` but doesn't ensure visual quality | |

**Recommendation:** Split Phase 3 into two sub-phases: 3a (TS conversion only) and 3b (Zod validation). This de-risks the deploy gate — you can deploy with TS but no Zod, then add Zod in a follow-up.

---

## Unverified Claims

1. **"React SPA already has 100% page parity (27 pages, 85 components, 56 test files)"** — Partially verified. 27 SPA pages confirmed in `src/App.tsx`. `receipt-template.html` has no SPA equivalent. `brand-guideline.html` redirects to `/brand-guideline` but SPA route is `/brand`. Parity is ~95%, not 100%.

2. **"Vitest already works (417/418 pass)"** — Unverified. `npm test` runs Jest, not Vitest. No Vitest run with React component tests was observed. `vitest.config.ts` exists but `package.json` test script still says `jest`.

3. **"homepage-v6.css loaded by 4 static HTML only"** — Verified. `grep -r 'homepage-v6'` found zero references in `src/`. Safe to delete.

4. **"brand-tokens.css never imported by SPA"** — Verified. `grep -r 'brand-tokens' src/` found nothing. CSS variables are presumably in `src/styles/global.css` or Tailwind config.

5. **"Worker bundle size should not increase >10%"** — No baseline captured. Phase 3 Step A says to capture worker build baseline, but the plan's Phase 1 does not capture worker build size.

---

## Questions for Plan Owner

1. Is `receipt-template.html` intentionally email-only (no SPA page needed)? If so, add explicit `_redirects` rule to 404 it or redirect to order lookup.

2. Does this project need SHA verification at deploy time? If yes, who adds the `/api/version` worker route and when?

3. Should Zod validation be split into a follow-up plan to reduce Phase 3 risk?

4. What's the actual E2E failure count? The claim of "28/151" is contradicted by codebase evidence of 33 total tests.

5. Is the PWA offline support critical? If yes, Phase 2 needs explicit PWA SW update steps before deleting `js/`.

6. Should the `_redirects` short URL aliases keep `200` (SPA fallback) instead of changing to `301`?

---

## Recommended Pre-Phase-1 Fixes

1. Rewrite Phase 5 to use `bash deploy-cloudflare.sh` instead of `npm run deploy:full`
2. Decide on SHA verification: add `/api/version` worker route OR remove from plan
3. Run `npx playwright test` now, capture real failure count, update all references
4. Install `@hono/zod-validator` in worker dependencies (or remove from Phase 3 scope)
5. Update Phase 2 to include explicit `_redirects` entries for `brand-guideline.html → /brand` and `receipt-template.html` (TBD)
6. Update Phase 2 to include PWA service worker cache update or removal
7. Update Phase 2/3 to fix `npm run lint` script after directory deletions
