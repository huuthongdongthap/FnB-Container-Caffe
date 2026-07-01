# Code Review: Design Audit Fixes (5 Agents, ~60 Files)

**Date:** 2026-07-01
**Reviewer:** code-reviewer agent
**Scope:** Post-agent design audit fixes across HTML, CSS, JS
**Status:** BLOCKED — 2 CRITICAL issues must be resolved before merge

---

## Critical Issues (Must Fix)

### C1. `premium-upgrade.css` — 85 Selectors Are Dead Code (`.premium-active` Never Set)

**Files:** `css/premium-upgrade.css`, 6 HTML pages that load it
**Severity:** BLOCKING

The class `.premium-active` is used in 85 selectors throughout premium-upgrade.css to scope premium visual effects (navbar glassmorphism, card gloss sweeps, caustic animations). **This class is never set by any HTML or JavaScript file.** It does not appear in any `class="..."` attribute, `classList.add()`, or `setAttribute('class', ...)` across the entire codebase.

**Evidence:**
```bash
grep -rn 'premium-active\|premiumActive' *.html js/ -- exclude=*.css
# No output — the class does not exist anywhere outside premium-upgrade.css
```

**Impact:**
- 85 CSS rules are dead code — premium navbar styles, glass cards, gloss sweeps, caustics never render
- Only the top 13 lines of premium-upgrade.css (unscoped `body` and `h1-h3` rules) actually apply globally
- 6 pages load this 319-line CSS file with zero visual effect from the scoped rules: checkout.html, about-us.html, failure.html, success.html, track-order.html, table-reservation.html

**Root cause:** Either (a) Agent 5 assumed `.premium-active` was applied by some JavaScript that doesn't exist, or (b) the class was meant to be added by a Page Action/theme toggle that was never implemented.

**Fix:** One of:
1. Add JS that sets `document.documentElement.classList.add('premium-active')` on relevant pages, OR
2. Remove the `.premium-active` prefix from selectors if the styles should always apply, OR
3. Remove premium-upgrade.css links from pages where these styles aren't needed

---

### C2. Missing CSS Files Break 404 and Checkin Pages

**Files:** `404.html`, `checkin.html`
**Severity:** BLOCKING

**404.html:**
- References `css/404.css` (lines 8, 14 — loaded twice) — **file does not exist**
- No `<main>` landmark, no semantic structure
- `brand-tokens.css` was added by Agent 3 (correct) but the missing 404.css was not addressed

**checkin.html:**
- References `css/checkin.css` (line 9) — **file does not exist**
- `brand-tokens.css` was correctly added (line 10)
- `<main id="main-content">` was correctly added (line 12)

**Impact:** Both pages load with broken CSS. The 404 page in particular has zero styling beyond brand tokens (no layout, no colors). The checkin page has no form/layout styling.

**Note:** These are pre-existing issues (the CSS file references existed before the audit agents), but since this review explicitly covers these files, they must be flagged.

**Fix:**
1. Create `css/404.css` with basic 404 page styling, OR remove the dead link from 404.html
2. Create `css/checkin.css` with checkin form styling, OR remove the dead link from checkin.html
3. Remove the duplicate `css/404.css` load on line 14 of 404.html
4. Add `<main id="main-content">` to 404.html

---

## High Priority (Should Fix)

### H1. menu.html — Skip-to-content Link Targets Missing `#main-content`

**File:** `menu.html`
**Severity:** HIGH

`menu.html` loads `shared-nav.js` via `initNavbar('menu')`, which injects a skip-to-content link:
```html
<a href="#main-content" class="skip-link">Bỏ qua đến nội dung chính</a>
```
But `menu.html` uses `<main class="main">` (line 47) — no `id="main-content"`. The skip link is a dead anchor.

**Fix:** Change `<main class="main">` to `<main id="main-content" class="main">`.

---

### H2. main.js Scroll Listener Missing `{ passive: true }`

**File:** `js/main.js`, line 46
**Severity:** HIGH

Agent 4 added debounce to the scroll handler but missed the passive flag:
```javascript
window.addEventListener('scroll', debouncedScroll);  // ← missing { passive: true }
```

Compare with other files that were correctly updated (e.g., `premium-ui.js` line 14, `shared-nav.js` line 434). Without `{ passive: true }`, the browser cannot optimize scroll performance because it must wait to check if the handler calls `preventDefault()`.

**Fix:** `window.addEventListener('scroll', debouncedScroll, { passive: true });`

---

### H3. Remaining `--coffee-*` Token References Use Undefined CSS Variables

**Files:** `js/shared-nav.js` (9 refs), `js/script.js` (1 ref), `about-us.html` (1 inline), `css/about-m3.css` (1 ref)
**Severity:** HIGH

Agent 5 migrated `--coffee-*` → `--aura-*` in 7 CSS files, but these locations were missed:

| File | Variable | Fallback |
|------|----------|----------|
| `js/shared-nav.js:130` | `--coffee-accent` | `#C9D6DF` |
| `js/shared-nav.js:133` | `--coffee-accent` | `#C9D6DF` |
| `js/shared-nav.js:134` | `--coffee-accent` | `#C9D6DF` |
| `js/shared-nav.js:137` | `--coffee-primary` | `var(--aura-chrome-dark, #3A6B80)` |
| `js/shared-nav.js:148` | `--coffee-dark` | `var(--aura-noir-steel, #334155)` |
| `js/shared-nav.js:223` | `--coffee-accent` | `#C9D6DF` |
| `js/shared-nav.js:227` | `--coffee-primary` | `var(--aura-chrome-dark, #3A6B80)` |
| `js/shared-nav.js:234` | `--coffee-dark` | `var(--aura-noir-steel, #334155)` |
| `js/shared-nav.js:304` | `--coffee-accent` | `#C9D6DF` |
| `js/shared-nav.js:317` | `--coffee-accent` | `#C9D6DF` |
| `js/script.js:115` | `--coffee-espresso` | none |
| `about-us.html:116` | `--coffee-accent` | none (inline style) |
| `css/about-m3.css:38` | `--coffee-primary`, `--coffee-dark` | none |

**Impact:** Visual behavior is preserved (hardcoded fallbacks are specified), but:
- CSS variable theming is broken for these elements (dark/light mode won't swap colors as expected)
- `js/script.js:115` — if `type === 'info'`, attempts `var(--coffee-espresso)` with no fallback → resolves to `inherit`, not `#fff`
- Creates DRY violation and future maintenance confusion

**Fix:** Replace all remaining `--coffee-*` with the corresponding `--aura-*` tokens.

---

### H4. `about-us.css` Is Dead Code

**File:** `css/about-us.css` (5186 bytes)
**Severity:** HIGH

Agent 5 migrated tokens in `about-us.css` (7 replacements), but this file is **not loaded by any HTML page**. The page `about-us.html` loads `css/about-us-page.css` instead (which was also correctly migrated by Agent 5). Both files had identical content before the migration (the diff shows the same changes in both).

**Impact:** Wasted bytes, confusion for future maintainers, risk of divergence.

**Fix:** Delete `css/about-us.css` since all styles exist in `about-us-page.css` which is the canonical file. Update any remaining references (none found).

---

### H5. `font-family` Stack Change May Cause Visual Shift in Fallback Scenarios

**File:** `css/homepage-v6.css` (12 selectors)
**Severity:** MEDIUM-HIGH

Agent 2 replaced `'Cormorant Garamond', var(--aura-font-display)` with `var(--aura-font-display)` across 12 selectors. Since Cormorant Garamond is no longer loaded (Google Fonts link removed from index.html, no @font-face in brand-tokens.css), this is functionally correct. However:

1. If any system has Cormorant Garamond installed locally, the old code would use it; the new code uses Plus Jakarta Sans (via the variable) — a different typeface.
2. `'Space Grotesk'` → `var(--aura-font-body)` similarly shifts the body font in the same scenario.

**Verdict:** Not a bug, but worth noting that the visual identity intentionally shifts from Cormorant/SpacedGrotesk to Plus Jakarta Sans as the primary typeface. This should be a conscious design decision, not a side effect.

---

## Low Priority (Nice to Fix)

### L1. 404.html Lacks `<main>` Wrapper and `<h1>` is Not `sr-only`

Agent 3 added `<main id="main-content">` to 16 other pages but skipped 404.html. Since 404.html has no shared-nav (no `#shared-navbar` div), the skip-to-content link won't apply. But for consistency and accessibility, it should still have a `<main>` landmark.

### L2. `initNavbar('failure')` and `initNavbar('success')` Are No-ops

Agent 3 changed `initNavbar('')` → `initNavbar('failure')` in failure.html and `initNavbar('success')` in success.html. These keys do not exist in the `NAV_LINKS` array, so no link gets an active highlight — identical behavior to `''`. The change is semantically correct but non-functional.

### L3. `window.pageYOffset` Is Deprecated

**File:** `js/main.js` line 37
Use `window.scrollY` instead of the deprecated `window.pageYOffset`.

### L4. `about-m3.css` Has Unmigrated `--coffee-*` Token

**File:** `css/about-m3.css` line 38
Single reference to `var(--coffee-primary)` and `var(--coffee-dark)` without fallbacks.

---

## Verified Claims (Passed)

| Agent | Claim | Status |
|-------|-------|--------|
| 1 | `--chrome-silver`, `--chrome-steel`, `--chrome-light` defined | PASS — 18 refs in brand-tokens.css |
| 1 | Consolidated keyframes: fnb-spin, fnb-pulse, fnb-slide-up, fnb-scale-in | PASS — all defined at lines 636-639 |
| 1 | `.aura-btn-loading` utility class added | PASS — line 808 with `::after` spinner |
| 1 | Scroll-progress: `width:0%` → `transform: scaleX(0)` | PASS — CSS line 972, JS line 24 consistent |
| 1 | `-webkit-overflow-scrolling: touch` removed from checkin-approve.css | PASS |
| 2 | Duplicate @keyframes removed from homepage-v6.css | PASS — 0 remaining duplicates |
| 2 | `backdrop-filter: blur()` removed from `.mobile-drawer` (97% opaque) | PASS — removed, comment at line 2517 |
| 2 | Hardcoded fonts → `var(--aura-font-*)` | PASS — 12 replacements |
| 2 | `.nav-link.active` split to separate rule | PASS |
| 2 | `:focus-visible` rule + `:focus:not(:focus-visible)` | PASS |
| 2 | `transition: left` → `transition: transform` + `left` → `translateX` | PASS — 3 pairs verified consistent |
| 2 | Skeleton → canonical `fnb-shimmer` | PASS |
| 3 | Dead CSS links fixed (5 links) | PASS — verified all href paths resolve to existing files |
| 3 | `<div id="shared-navbar">` added to events, loyalty, referral | PASS |
| 3 | `<main id="main-content">` on 16 pages | PARTIAL — 16 pages confirmed, menu.html missing it |
| 3 | `brand-tokens.css` added to 404, checkin, receipt-template | PASS |
| 3 | Google Fonts removed from index.html, tv-menu.html | PASS |
| 3 | `prompt()` replaced in table-reservation.html | PASS — identity form modal present |
| 3 | `<fieldset>` + `<legend>` in checkout.html | PASS — 6 refs found |
| 3 | `role="radio"` + `aria-checked` in checkout.html | PASS — 4 refs found |
| 3 | `aria-required="true"` to 7 fields | PASS — 3+3+1 across checkout, contact, checkin |
| 3 | `<h1 class="sr-only">` added to kds.html | PASS — line 39 |
| 4 | `{ passive: true }` added to 8 listeners | PARTIAL — main.js line 46 missed |
| 4 | Debounce on 9 scroll/resize handlers | PARTIAL — main.js has debounce but no passive |
| 4 | `role="contentinfo"` on footer | PASS — line 391 |
| 4 | Skip-to-content link injection | PASS — line 356, targets `#main-content` |
| 4 | Hamburger `aria-label` dynamic update | PASS — line 458 |
| 5 | Premium-upgrade.css: 0 `!important` | PASS — 0 found |
| 5 | Failure-page.css merged into failure.css | PASS — deprecated stub, HTML updated |
| 5 | Print-receipt.css: `--coffee-*` → `--aura-*` | PASS — 0 remaining coffee tokens |
| 5 | About-us-page.css: token migration | PASS — 0 coffee tokens, correct aura mapping |
| 5 | Promotions, success, public: token → aura | PASS — 0 coffee tokens |
| 5 | Checkout-styles: `:focus-visible`, `.form-error` | PASS |
| 5 | Duplicate @keyframes removed from asian-wow, ui-enhancements | PASS — 0 remaining |

---

## Edge Cases Discovered During Scout

1. **`.premium-active` never set** — 6 pages load CSS with 85 dead selectors (C1)
2. **menu.html skip-link target mismatch** — `#main-content` doesn't exist on page (H1)
3. **`about-us.css` dead code** — migrated but unused (H4)
4. **Remaining `--coffee-*` in JS templates** — 12 references in JS-embedded CSS (H3)
5. **Duplicate CSS load in 404.html** — `css/404.css` loaded twice (C2)
6. **`js/script.js:115`** — `--coffee-espresso` has no fallback; resolves to `inherit` not `#fff`

---

## Summary Metrics

- **Files reviewed:** 52 (HTML: 18, CSS: 25, JS: 9)
- **Critical issues:** 2 (blocking)
- **High priority:** 5
- **Low priority:** 4
- **Verified claims passed:** 34/36 (94%)
- **Dead code detected:** `about-us.css` (5186 bytes), `premium-upgrade.css` scoped rules (85 selectors)

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix `.premium-active` — either add JS to set the class, or remove the scope prefix
2. **[CRITICAL]** Create `css/404.css` and `css/checkin.css` or remove dead links; fix 404.html structure
3. **[HIGH]** Add `id="main-content"` to `<main>` in menu.html
4. **[HIGH]** Add `{ passive: true }` to main.js line 46 scroll listener
5. **[HIGH]** Migrate remaining `--coffee-*` references in shared-nav.js, script.js, about-us.html, about-m3.css
6. **[HIGH]** Delete `css/about-us.css` or reconcile with `about-us-page.css`
7. **[LOW]** Add `<main id="main-content">` to 404.html
8. **[LOW]** Replace `window.pageYOffset` with `window.scrollY` in main.js
9. **[LOW]** Migrate `--coffee-*` token in about-m3.css
