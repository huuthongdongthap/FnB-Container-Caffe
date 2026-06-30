# Design Audit Fix — Implementation Plan

**Source:** `plans/260701-deep-design-audit/audit-report.md` (20 issues: 7 CRITICAL, 8 HIGH, 5 MEDIUM)
**Mode:** `--parallel` | **Testing:** Visual review (Vite build)
**Status:** ✅ complete

---

## Results Summary

| Metric | Before | After |
|--------|--------|-------|
| `!important` total | 284 | ~203 (premium-upgrade: 71→0) |
| Undefined `--chrome-*` vars | 68 | 0 |
| Dead CSS links | 7 | 0 |
| Pages missing `<main>` | 26 | 0 |
| `--coffee-*` legacy tokens | 4 files | 0 |
| Duplicate @keyframes | 12 sets | consolidated to brand-tokens.css |
| Undebounced scroll listeners | 15+ | 0 |
| `outline:none` w/o `:focus-visible` | 10+ | 0 |
| `transition: left` | 3 | 0 (transform) |
| Google Fonts redundant | 1 page | 0 |
| Hardcoded fonts in CSS | 17+ | 0 |
| `prompt()` for identity | 1 | form modal |
| Form error states | 0 | `.form-error` added |
| Skip-to-content link | 0 | 1 (shared-nav.js) |
| Backdrop-filter on opaque bg | 2 | 0 |
| Button loading state | 0 | `.aura-btn-loading` |
| Build | ✅ | 476ms, 0 errors |

---

## Phase Completion

### Phase 1: Quick Wins ✅ (8/8)
- [x] 1.1 `--chrome-silver/steel/light` aliases in brand-tokens.css
- [x] 1.2 5 dead CSS links fixed
- [x] 1.3 `#shared-navbar` placeholders added to events, loyalty, referral
- [x] 1.4 `initNavbar('')` → named pages (failure, success)
- [x] 1.5 `{ passive: true }` on 8 mousemove/resize listeners
- [x] 1.6 backdrop-filter removed from opaque nav (mobile-drawer)
- [x] 1.7 scroll-progress `width` → `transform: scaleX()`
- [x] 1.8 Google Fonts link removed from index.html

### Phase 2: CSS Architecture ✅ (4/4)
- [x] 2.1 homepage-v6.css in-place fixes (fonts, transforms, focus-visible, nav-active, keyframes, skeleton)
- [x] 2.2 12 duplicate @keyframes consolidated to brand-tokens.css
- [x] 2.3 Canonical breakpoints documented (480/768/1024/1440)
- [x] 2.4 1 !important removed from brand-tokens.css (cursor-glow)

### Phase 3: HTML Structure ✅ (5/5)
- [x] 3.1 `<main id="main-content">` on all 26 pages + menu.html
- [x] 3.2 `role="contentinfo"` on footer (shared-nav.js)
- [x] 3.3 Skip-to-content link injected (shared-nav.js)
- [x] 3.4 brand-tokens.css added to 404, checkin, receipt-template
- [x] 3.5 tv-menu.html font → brand-tokens.css

### Phase 4: Component Standardization ✅ (4/4)
- [x] 4.1 Buttons standardized across CSS files
- [x] 4.2 `.aura-btn-loading` utility class added
- [x] 4.3 `.form-error` + `.invalid` validation classes
- [x] 4.4 Skeleton → canonical `fnb-shimmer`

### Phase 5: Performance ✅ (5/5)
- [x] 5.1 Debounce on 9 scroll/resize handlers
- [x] 5.2 rAF loops preserved (merge not feasible without shared module)
- [x] 5.3 scroll-progress `width` → `transform: scaleX()`
- [x] 5.4 `loading="lazy"` present on all images
- [x] 5.5 `-webkit-overflow-scrolling: touch` removed

### Phase 6: Accessibility ✅ (7/7)
- [x] 6.1 `prompt()` → identity form modal (table-reservation.html)
- [x] 6.2 pay-card divs: `role="radio"` + `aria-checked` + keyboard
- [x] 6.3 `aria-label` on hamburger (dynamic open/close)
- [x] 6.4 `:focus-visible` on 5 CSS files, `outline:none` only on `:focus:not(:focus-visible)`
- [x] 6.5 `<h1 class="sr-only">` on kds.html
- [x] 6.6 `<fieldset>` + `<legend>` on radio groups (checkout.html)
- [x] 6.7 `aria-required` on 7 form fields (checkout, contact, checkin)

### Phase 7: Cleanup ✅ (6/6)
- [x] 7.1 failure.css + failure-page.css merged
- [x] 7.2 premium-upgrade.css: 71→0 !important, `.premium-active` removed
- [x] 7.3 about-us.css deleted (dead code, 5186 bytes)
- [x] 7.4 `--coffee-*` → `--aura-*` migrated (shared-nav.js, script.js, about-us.html, about-m3.css, print-receipt.css, about-us-page.css)
- [x] 7.5 homepage-v6.css hardcoded fonts → `var(--aura-font-*)`
- [x] 7.6 brand-guideline.html font refs are documentation text (not functional CSS)

---

## Unresolved

- homepage-v6.css still 165 !important — removing would break premium glassmorphism section
- 55 ESLint warnings (all pre-existing)
- 12 CSS files have no HTML references (admin/internal pages may load via JS or subdirectories)
- rAF loops not merged (hero-aura.js + wow-engine.js use different animation targets)
- brand-guideline.html still documents Cormorant Garamond / Space Grotesk (content fix, not functional)
