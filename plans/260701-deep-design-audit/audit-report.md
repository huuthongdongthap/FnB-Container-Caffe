# AURA CAFÉ — Deep Design Audit Report

**Date:** 2026-07-01 | **Scope:** 33 CSS (18,917 lines) + 20 HTML pages + 28 JS files  
**Method:** 5 parallel agents × 7 dimensions × 427 tool calls  
**Previous audit:** 37 fixes applied 2026-06-30 (tactical pass)  
**This audit:** Systemic architecture, consistency, and quality (strategic pass)

---

## Overall Grade: C− (needs major standardization)

| Dimension | Grade | Critical Issues |
|-----------|-------|----------------|
| CSS Architecture | **D** | 284 !important, 68 undefined vars, 13 competing :root blocks |
| Cross-Page Consistency | **D+** | 5 dead CSS links, font mismatch, 6+ button systems |
| Component Design | **C+** | 20+ button variants, zero form errors, 34px touch targets |
| Performance | **D** | 78+ backdrop-filter, 15+ undebounced listeners, 3 concurrent rAF |
| Accessibility | **D** | 26 pages no `<main>`, no skip-links, `prompt()` for identity |
| **Composite** | **C−** | 9 CSS files grade F, 6 pages grade F |

---

## Top 20 Issues (ranked by severity × prevalence)

### CRITICAL (7)

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| 1 | **68 refs to undefined `--chrome-silver/steel/light`** — variables don't exist, fall back to inherited color | pos.css, checkin-approve.css, staff.css, reservations.css, dashboard.css, homepage-v6.css | Add aliases in brand-tokens.css: `--chrome-silver: var(--aura-chrome-light)` etc. |
| 2 | **5 dead CSS links (404)** — `checkout.html` loads `css/checkout.css` which doesn't exist | checkout.html:15, contact.html:19, kds.html:19, receipt-template.html:12, table-reservation.html:15 | Change `href="css/X.css"` → `href="X.css"` (files at root, not css/) |
| 3 | **homepage-v6.css: 4,566 lines, 165 !important** — monolithic specificity war zone, 24% of all CSS | homepage-v6.css | Split into 5 modules. Remove !important where possible. |
| 4 | **premium-upgrade.css: 71 !important in 313 lines** — specificity bomb, body::after global pollution | premium-upgrade.css | Refactor as component, not override layer. Use cascade properly. |
| 5 | **26 pages missing `<main>` landmark** — screen readers can't skip to content | 16 HTML files (all except index, menu, kds, admin/pos, admin/staff) | Wrap content in `<main id="main-content">` |
| 6 | **`prompt()` for identity capture** — blocks all assistive tech, no keyboard operability | table-reservation.html:378-380 | Replace with semantic form fields |
| 7 | **3 pages call shared-nav.js without `#shared-navbar` placeholder** — nav silently fails to render | events.html, loyalty.html, referral.html | Add `<div id="shared-navbar"></div>` |

### HIGH (8)

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| 8 | **Font mismatch: brand-tokens.css uses Plus Jakarta Sans; brand-guideline says Cormorant Garamond; homepage-v6 hardcodes both** | brand-tokens.css:160-161, homepage-v6.css:2651/2797/3012/3123, brand-guideline.html | Align to one: use `var(--aura-font-display)` everywhere, pick one font |
| 9 | **Zero form error states** on checkout, reservation, auth, track-order — users get no validation feedback | checkout.html, contact.html, table-reservation.html, auth.js | Add `.form-error` class, `aria-describedby`, inline validation messages |
| 10 | **No button loading states** — all buttons lack spinner/disabled during async ops — double-submit risk | All pages with forms | Add `btn.loading` state: show spinner, disable pointer-events |
| 11 | **20+ distinct button variants across project** — `.btn-primary` defined 4× in homepage-v6.css alone, plus page-specific variants | homepage-v6.css, events.css, loyalty.css, referral.css, checkout-styles.css, etc. | Standardize on `aura-btn-silver`/`aura-btn-ghost` from brand-tokens.css |
| 12 | **78+ `backdrop-filter: blur()` occurrences** — heavy GPU cost, some on opaque backgrounds (invisible, pure waste) | homepage-v6.css (23), brand-tokens.css (14), menu-v6.css (12), premium-upgrade.css (4), etc. | Remove blur from opaque backgrounds. Consolidate to `--glass-blur` token. |
| 13 | **15+ scroll/mousemove listeners without debounce/throttle** — `utils.js` exports `debounce()` but nothing imports it | shared-nav.js:412, wow-engine.js:16/42/69, main.js:35, hero-aura.js:52/187, etc. | Import and wrap handlers with `debounce(fn, 16)` |
| 14 | **Duplicate Google Fonts + local woff2** — Plus Jakarta Sans loaded from both CDN and 14 local @font-face files (400-500KB) | index.html:24, brand-tokens.css:21-118 | Remove Google Fonts link (keep local woff2 only) |
| 15 | **Scroll-progress bar animates `width`** — triggers layout recalculation on every scroll frame | brand-tokens.css:943 | Replace with `transform: scaleX()` |

### MEDIUM (5)

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| 16 | **12 animation keyframes duplicated across 2-4 files each** — spin, pulse, shimmer, slideUp, scaleIn, etc. ~150-200 wasted lines | Multiple CSS files | Define once in brand-tokens.css; reference by name only |
| 17 | **5 different toast implementations** — different positions, animations, dismiss behaviors per page | menu-v6.css, cart.js, checkout.js, contact.css, reservations.css, track-order-styles.css, ui-enhancements.css | Standardize to single `.aura-toast` system in brand-tokens.css |
| 18 | **3 different skeleton loading systems** — different shimmer speeds, colors, shapes | ui-enhancements.css, brand-tokens.css, homepage-v6.css | Consolidate to `animate-shimmer` from brand-tokens.css |
| 19 | **Active nav state identical to hover state** — users can't tell which page they're on | homepage-v6.css:1283 | Add distinct active style: heavier weight, chrome underline, or background |
| 20 | **10+ `outline: none` without `:focus-visible` replacement** — keyboard users lose focus indication | checkout-styles.css:99/641, menu-v6.css:126/891, homepage-v6.css:801/2183, track-order-styles.css:62, pos.css:96/439, referral.css:280 | Replace with `outline: 2px solid var(--aura-chrome-mid)` on `:focus-visible` |

---

## File Scorecard

### CSS Files: 6 A | 8 B | 4 C | 5 D | 9 F | 1 N/A

| Grade | Count | Key Files |
|-------|-------|-----------|
| **A** | 6 | loyalty-calculator.css, events.css, referral.css, loyalty.css, kds-m3.css, about-m3.css |
| **B** | 8 | checkout-styles.css, track-order-styles.css, kds-styles.css, brand-guideline.css, about-us.css, about-us-page.css, ui-enhancements.css, public.css |
| **C** | 4 | hero-aura.css, asian-wow.css, menu-v6.css |
| **D** | 5 | pos.css, checkin-approve.css, staff.css, reservations.css, dashboard.css, brand-tokens.css |
| **F** | 9 | homepage-v6.css, premium-upgrade.css, promotions.css, print-receipt.css, success.css, failure.css, failure-page.css, CHU-QUAN-BAO-CAO.css, proposal-deck-v2.css |
| **N/A** | 1 | styles.css (4-line placeholder) |

### HTML Pages: 1 A | 3 B | 6 C | 2 D | 8 F

| Grade | Count | Pages |
|-------|-------|-------|
| **A** | 1 | index.html |
| **B** | 3 | menu.html, brand-guideline.html, loyalty-calculator.html |
| **C** | 6 | about-us.html, checkout.html, contact.html, events.html, loyalty.html, referral.html, table-reservation.html, track-order.html |
| **D** | 2 | failure.html, success.html, promotions.html |
| **F** | 8 | checkin.html, kds.html, receipt-template.html, tv-menu.html, 404.html |

---

## Quantified Metrics

| Metric | Value | Health |
|--------|-------|--------|
| Total CSS | 18,917 lines | 🔴 4× too large for static site |
| `!important` declarations | 284 | 🔴 specificity crisis |
| Files with `:root` override | 13 | 🔴 fragmented tokens |
| Undefined variable refs | 68 | 🔴 silent failures |
| Duplicate keyframe names | 12 | 🟡 bloat |
| Distinct breakpoints | 25 | 🔴 shipped 768/769 gap |
| Backdrop-filter blur() uses | 78 | 🔴 GPU overload |
| Undebounced listeners | 15+ | 🔴 main thread |
| Concurrent rAF loops | 3 | 🟡 cannot coalesce |
| Button variant systems | 6+ | 🔴 brand erosion |
| Toast systems | 5 | 🟡 inconsistent UX |
| Skeleton systems | 3 | 🟡 different per page |
| Dead CSS links (404) | 7 | 🔴 broken pages |
| Unused CSS files | 12 | 🟡 dead weight |
| Pages missing `<main>` | 26 | 🔴 a11y fail |
| Pages missing brand-tokens.css | 3 | 🔴 off-brand |

---

## Implementation Plan

### Quick Wins (< 1 hour, single-line fixes)

1. Define `--chrome-silver/steel/light` in brand-tokens.css → fixes 68 errors instantly
2. Fix 5 dead CSS links → change `href="css/X.css"` to `href="X.css"`
3. Add `#shared-navbar` placeholder to events.html, loyalty.html, referral.html
4. Fix empty `initNavbar('')` → `initNavbar('failure')` / `initNavbar('success')`
5. Add `{ passive: true }` to mousemove listeners
6. Remove `backdrop-filter` from `.snav-header` (0.97 opacity = invisible blur)
7. Replace scroll-progress `width` transition with `transform: scaleX()`
8. Remove Google Fonts link from index.html (local woff2 already loaded)

### Moderate (< 1 day)

9. Split homepage-v6.css into 5 modules (base, hero, sections, wow, responsive)
10. Standardize button system → use only `aura-btn-silver`/`aura-btn-ghost`
11. Consolidate 12 duplicate keyframes into brand-tokens.css
12. Add `<main>` landmark to 26 pages
13. Add `.form-error` + `aria-describedby` to all forms
14. Standardize breakpoints → 480/768/1024/1440 only

### Deep (> 1 day)

15. Refactor premium-upgrade.css → component pattern, remove 71 !important
16. Consolidate 5 toast systems into single `.aura-toast`
17. Merge 3 skeleton systems
18. Full keyboard accessibility pass (focus traps, skip links, Escape handlers)
19. Merge `failure.css` + `failure-page.css` (95% identical)
20. Migrate legacy `--coffee-*` tokens → `--aura-*`

---

## Unresolved Questions

- Does `styles.css` (4-line placeholder) serve any purpose, or can it be deleted?
- Are the 12 unused CSS files (pos.css, hero-aura.css, asian-wow.css, etc.) still needed for future admin pages, or are they dead?
- Should the official brand font be Plus Jakarta Sans (as coded in brand-tokens.css v5.0) or Cormorant Garamond (as documented in brand-guideline.html)?
- Should `--md-sys-*` tokens be promoted to brand-tokens.css, or should M3-dependent files be migrated to `--aura-*`?
