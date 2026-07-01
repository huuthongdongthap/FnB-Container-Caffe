---
phase: 2
title: "HTML Accessibility & UX"
status: pending
priority: P1
dependencies: [1]
effort: "2-3h"
---

# Phase 2: HTML Accessibility & UX

## Overview

Fix verified HTML/UX issues: `<main>` landmarks (13 pages, not 26),
`prompt()` replacement in loyalty.js:646, form error states, button loading
states, active nav state.

**Note:** 2 original issues removed after red-team verification — `#shared-navbar`
already present on all pages, `prompt()` already replaced in table-reservation.html.
New issue added: prompt() in `js/loyalty.js:646` for cashback redemption.

## TDD Structure

1. **Capture baseline**: Run E2E audit → record actual failures (not assumed 6 nav failures). Run axe-core on sample pages.
2. **Write accessibility tests**: Add axe-core check for `<main>` presence, no prompt() calls.
3. **Implement fixes**: Per-page HTML edits + JS fix for loyalty.js
4. **Verify**: Re-run E2E + axe-core. No regression.

## Requirements

- Functional: All public-facing pages have `<main>` landmark. Forms show validation errors. Buttons show loading states. No `prompt()` calls in production.
- Non-functional: React SPA `<main>` handled in React components (not static shell). Skip-link available.

## Issues to Fix

### #5: 13 pages missing `<main>` landmark (not 26)
Verified with grep: 13 pages lack `<main>`:
- `404.html`
- `signup/index.html`
- `admin/checkin-approve.html`, `admin/customers.html`, `admin/dashboard.html`, `admin/login.html`, `admin/orders.html`, `admin/reservations.html`, `admin/erpnex-sync.html`
- `signage-widgets/menu-board.html`, `signage-widgets/promo-screen.html`, `signage-widgets/welcome-screen.html`

**React SPA (`index.html`):** Do NOT add static `<main>` here. Audit React components in `src/` for `<main>` landmark. If missing, add to `App.tsx` or page components.

Add `<main id="main-content">` to remaining 13 static pages. Pattern:
```html
<body>
  <div id="shared-navbar"></div>
  <main id="main-content">
    <!-- existing page content -->
  </main>
  <div id="shared-footer"></div>
</body>
```

### #6 (UPDATED): prompt() in loyalty.js:646 + table-reservation.html verification
- `js/loyalty.js:646`: `window.prompt()` for cashback redemption amount input. Replace with modal dialog or inline form.
- `table-reservation.html`: Already has identity modal (verified — line 400 comment "Show identity modal instead of prompt()"). Verify it works correctly.

### #9: Zero form error states
Add to all form pages (checkout.html, contact.html, table-reservation.html, auth.js):
```css
.form-error {
  color: var(--color-destructive, #DC2626);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
```
```html
<input aria-describedby="name-error" aria-invalid="false" />
<span id="name-error" class="form-error" role="alert" hidden>...</span>
```

### #10: No button loading states
Add `.btn.loading` state to standard button system (from Phase 1 #11):
```css
.aura-btn.loading {
  pointer-events: none;
  opacity: 0.7;
  position: relative;
}
.aura-btn.loading::after {
  content: '';
  /* spinner */
}
```
Update form submit handlers to set `.loading` class during async ops.

### #19: Active nav state = hover state
Add distinct active nav style:
```css
.nav-link.active,
.nav-link[aria-current="page"] {
  color: var(--aura-chrome-bright);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
}
```

## Architecture

```
HTML Page Structure (after fixes):
  <html lang="vi">
    <head><!-- fixed CSS links, single font source --></head>
    <body>
      <div id="shared-navbar"></div>     ← shares nav component
      <main id="main-content">           ← present on ALL public pages
        <!-- page content -->
      </main>
      <div id="shared-footer"></div>
    </body>
  </html>
```

## Related Code Files

- **Modify HTML**: 13 files (see Issue #5 list)
- **Modify JS**: `js/loyalty.js:646` (prompt → modal)
- **Modify HTML**: checkout.html, contact.html, table-reservation.html (form errors)
- **Modify JS**: auth.js (form error states)
- **Audit React**: `src/App.tsx`, `src/pages/*.tsx` (main landmark in SPA)
- **Modify CSS**: homepage-v6.css (active nav style, from Phase 1)

## Implementation Steps

1. **Test capture**: Run `npm test` → 60 pre-existing failures baseline. Run E2E → record actual pass/fail count.
2. **Fix #5**: Add `<main>` to 13 pages. Audit React SPA for `<main>` in components.
3. **Fix #6**: Replace `prompt()` in loyalty.js:646 with modal. Verify table-reservation modal works.
4. **Fix #9**: Add form error class + aria attributes to all forms
5. **Fix #10**: Add button loading state CSS + JS handlers
6. **Fix #19**: Add active nav style (Phase 1 CSS + JS state tracking)
7. **Verify**: axe-core passes. E2E rerun. No NEW test failures.

## Success Criteria

- [ ] All 13 pages have `<main id="main-content">` landmark
- [ ] React SPA has `<main>` in component tree (not static shell)
- [ ] No `prompt()` calls in production code (grep -r 'prompt(' js/ *.html)
- [ ] All forms have `.form-error` + `aria-describedby` validation
- [ ] All form submit buttons have `.loading` state
- [ ] Active nav visibly distinct from hover
- [ ] No NEW `npm test` failures beyond 60 baseline
- [ ] `npm run build` passes (0 errors)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Adding `<main>` wrapper breaks CSS | Use `main` as semantic only; don't add layout-affecting styles |
| Form error changes affect order submission | Test checkout flow end-to-end after changes |
| loyalty.js prompt removal breaks cashback flow | Rewrite with modal matching existing patterns |
