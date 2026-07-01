---
phase: 2
title: "Hard Cut — Remove Legacy"
status: pending
priority: P1
dependencies: [1]
effort: 3-4h
---

# Phase 2: Hard Cut — Remove Legacy

## Overview

Delete ~46 static HTML files (excluding signage-widgets), ~48 legacy CSS files, ~35 legacy JS files. Update `_redirects` with wildcard rule. Preserve production digital signage. Verify build passes. React SPA becomes single source of truth.

## TDD Structure

```
Step A: Write _redirects test     → verify redirect rules before touching files
Step B: Backup + delete HTML      → remove static HTML (keep index.html)
Step C: Delete legacy CSS         → remove css/ directory
Step D: Delete legacy JS          → remove js/ directory (keep if shared)
Step E: Update _redirects         → add /*.html /:splat 301 wildcard
Step F: Regression Gate           → build + tests + E2E must not regress
```

## Requirements

- Functional: All legacy .html URLs MUST redirect to SPA routes via 301
- Functional: `index.html` (Vite entry) MUST be preserved
- Functional: `npm run build` MUST pass with 0 errors after deletions
- Functional: React SPA MUST still render all 27 pages
- Non-functional: `!important` count drops from 212 → <50

## Architecture

```
Delete Order (bottom-up, no-dependency-first)
├── 1. CSS files (no code depends on them being present)
├── 2. JS files  (no code imports from js/ except HTML <script> tags)
├── 3. Static HTML files (keep index.html Vite entry)
├── 4. Admin HTML files (SPA serves /admin/* routes)
├── 5. Signage HTML files (KEEP — production digital signage, no SPA equivalent)
├── 6. Other HTML (signup/, public/, tools/bazi-mcp/)
└── 7. Update _redirects + _headers
```

## Related Code Files

- Delete: `*.html` (all except `index.html`) — ~52 files
- Delete: `css/*.css` — 32 files
- Delete: root-level `*.css` (404.css, checkin.css, checkout.css, contact.css, kds.css, promotions.css, receipt-template.css, table-reservation.css) — 8 files
- Delete: `admin/*.css` (shared.css, dashboard.css, login.css, orders.css, erpnext-sync.css, staff.css) — 6 files
- Delete: `signup/signup.css`, `public/offline.css` — 2 files
- Delete: `js/*.js` and subdirectories — 35 files (but UPDATE `js/sw.js` PWA first, see Step D)
- Delete: `public/offline.html` — after PWA audit confirms no active service worker dependency
- Modify: `_redirects` — add `/*.html /:splat 301` wildcard, fix exceptions
- Modify: `_headers` — review CSP for deleted CDN references
- Modify: `package.json` — fix `lint` and `build` scripts
- Clean: `assets/` — delete demo HTML before deploy (or update `deploy-cloudflare.sh`)
- Keep: `index.html` (Vite SPA entry point)
- Keep: `signage-widgets/*.html` (production digital signage — NOT deleted)

## Implementation Steps

### Step A: Tests Before — Redirect Rules
1. Create test file `tests/redirect-rules.test.js`:
   - Parse `_redirects` and verify all legacy .html URLs have matching rules
   - Verify `/*.html /:splat 301` exists before SPA fallback
   - Verify `/* /index.html 200` is LAST line
   - Verify security blocks cover `/docs/*`, `/tests/*`, `/plans/*`, `/worker/*`
2. Run test — must pass BEFORE deletions begin

### Step B: Tests Before — Capture Current Test State
1. Run `npm test 2>&1` and save exact failure count
2. Run `npx playwright test 2>&1` and save exact failure count
3. Run `npm run build` and confirm 0 TypeScript errors
4. These baselines = regression gate for Step F

### Step C: Delete Legacy CSS
1. Delete entire `css/` directory
2. Delete root-level CSS files: `404.css`, `checkin.css`, `checkout.css`, `contact.css`, `kds.css`, `promotions.css`, `receipt-template.css`, `table-reservation.css`
3. Delete `admin/shared.css`, `admin/dashboard.css`, `admin/login.css`, `admin/orders.css`, `admin/erpnext-sync.css`, `admin/staff.css`
4. Delete `signup/signup.css`, `public/offline.css`
5. Run `npm run build` — must pass (React SPA uses Tailwind v4, not these files)

### Step D: Update PWA Service Worker (BEFORE deleting js/)
1. Read `js/sw.js` — it hardcodes `STATIC_ASSETS` array with `/css/styles.css`, `/js/main.js`, `/js/theme.js`, `/js/menu.js`, `/js/cart.js`, `/js/checkout.js`, `/js/i18n.js`
2. Check if React SPA has its own service worker in `src/`:
   - If YES: delete `js/sw.js` — SPA manages its own SW
   - If NO: update `js/sw.js` to remove `STATIC_ASSETS` cache or accept loss of PWA offline support
3. Check `manifest.json` for references to deleted files — update if present
4. Document decision: PWA offline support preserved (SPA SW) or lost

### Step E: Update Build Scripts (BEFORE deleting files)
1. `npm run build` currently runs `npm run lint && vite build`
2. `npm run lint` currently runs `eslint js/ worker/src/ --ext .js`
3. Update lint script to remove `js/`: `"lint": "eslint worker/src/ --ext .js"`
4. This prevents build failure after `js/` directory is deleted

### Step F: Delete Legacy JS
1. Delete entire `js/` directory and subdirectories
2. Run `npm run build` — must pass
3. Grep `src/` for any imports from `js/` — should find none

### Step G: Delete Static HTML
1. Delete all root `*.html` EXCEPT `index.html` (20 files)
2. Delete all `admin/*.html` (9 files)
3. **SKIP `signage-widgets/*.html`** — KEEP (production digital signage, worker API backend, no SPA equivalent)
4. Delete `signup/index.html`, `public/offline.html` (after PWA audit in Phase 1)
5. Delete `tools/bazi-mcp/*.html` (verify not client deliverables first), `reports/*.html`, `assets/brand/**/05_Demos/**/*.html` (demo files)
6. Run `npm run build` — must pass

### Step H: Update `_redirects`
1. Final `_redirects` — FIRST-MATCH ordering is critical (explicit before wildcard before SPA fallback):
   ```
   # ── 1. Explicit .html exceptions (BEFORE wildcard, first-match wins) ──
   /index-legacy.html            /                           301
   /checkout.html                /checkout?payment=pending   301
   /loyalty-calculator.html      /loyalty-calculator         301
   /brand-guideline.html         /brand                      301
   /signup/index.html            /signup                     301

   # ── 2. Pages with NO SPA route equivalent (redirect to nearest page) ──
   /receipt-template.html        /checkout                   301

   # ── 3. BULK wildcard: all remaining .html → clean URL ──
   /*.html                       /:splat                     301

   # ── 4. Short URL aliases (KEEP 200 — SPA client-side routing) ──
   /admin-dashboard              /admin/dashboard            200
   /dashboard                    /admin/dashboard            301
   /dashboard/                   /admin/dashboard            301
   /dashboard/admin              /admin/dashboard            301
   /dashboard/login              /admin/login                301
   /kitchen                      /kds                        301
   /brand                        /brand-guideline            200
   /signup                       /signup                     200

   # ── 5. Security block ──
   /docs/*                       /404                        404
   /tests/*                      /404                        404
   /tools/*                      /404                        404
   /scripts/*                    /404                        404
   /plans/*                      /404                        404
   /designs/*                    /404                        404
   /_archive/*                   /404                        404
   /dist/*                       /404                        404
   /reports/*                    /404                        404
   /worker/*                     /404                        404
   /db/*                         /404                        404

   # ── 6. SPA fallback (MUST be last) ──
   /*                            /index.html                 200
   ```
2. **Key rules:**
   - `/admin-dashboard`, `/brand`, `/signup` stay `200` (SPA rewrite — no full page reload)
   - `/receipt-template.html → /checkout 301` (no SPA receipt page, redirect to checkout)
   - `/brand-guideline.html → /brand 301` (SPA route is `/brand`, not `/brand-guideline`)
   - Explicit `.html` rules BEFORE `/*.html` wildcard (first-match wins)
   - Verify `_redirects` is copied to `dist/` by Vite build (check `vite.config.ts` or `public/` dir)

### Step I: Clean `assets/` and Deploy Script
1. Delete `assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/` (design artifacts, not production)
2. Update `deploy-cloudflare.sh` to copy only needed asset subdirectories (images, fonts, favicon): `cp -r assets/images dist/` instead of `cp -r assets dist/`
3. Verify after build: `find dist -name "*.html"` should return ONLY `dist/index.html`

### Step J: Update `_headers` (if needed)
1. Check if CSP `script-src` / `style-src` references `cdn.jsdelivr.net` — keep if still needed by SPA
2. Keep HSTS, X-Frame-Options, X-Content-Type-Options

### Step K: Regression Gate
1. `npm run build` → 0 TypeScript errors
2. `npm test` → same failure count as Step B (no new failures)
3. `npx playwright test` → same or fewer failures (some E2E test static-only pages may now 404)
4. `git status` → review all deleted files before commit
5. Count `!important` in remaining codebase: `grep -r '!important' src/ --count`

## Test Scenario Matrix

| Test | Before Phase | Expected After |
|------|-------------|----------------|
| `npm run build` | 0 errors | 0 errors |
| `npm test` | 60 failures | 60 failures (no new, no fixed yet) |
| `npx playwright test` | 28 failures | ≤28 failures (static-only page tests may 404) |
| `!important` count | 212 | <50 (homepage-v6.css deleted) |
| Redirect rules test | NEW | All legacy .html → SPA route covered |

## Success Criteria

- [ ] All 49 static HTML files deleted (except `index.html` Vite entry)
- [ ] All 48 legacy CSS files deleted
- [ ] All 35 legacy JS files deleted
- [ ] `_redirects` updated with `/*.html /:splat 301` wildcard
- [ ] `npm run build` passes with 0 errors
- [ ] No new test failures introduced
- [ ] `!important` count drops to <50
- [ ] PWA service worker updated or removed (before deleting `js/`)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Deleted wrong file | Git revert. Commit after each step (CSS → JS → HTML) for granular rollback |
| SPA route missing for a deleted .html page | Audit (Phase 1) verified parity. If gap found, fix SPA route before deleting |
| PWA service worker references deleted files | Update `js/sw.js` cache list or delete SW if SPA handles offline |
| `brand-tokens.css` needed by React SPA | Verify: React SPA uses Tailwind v4, never imported brand-tokens.css. CSS variables are inlined or in global.css |
| External links to .html URLs break | `_redirects` 301 preserves all legacy URLs. Zero user impact |
| Admin pages need direct (non-SPA) access | React SPA serves `/admin/*` routes. Protected by auth in SPA router |
