# A5: Accessibility & UX Polish Sprint

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P2 High
**Source:** UI/UX Pro Max Audit #6-10, #12 (accessibility 6/10, UX patterns 4/10)
**Effort:** 3-4 hours
**Dependencies:** None (independent; can run parallel to A1-A4)
**Blocks:** Final re-audit (target score >= 8/10)

---

## 1. Technical Design

### Problem Statement

The UI/UX Pro Max audit identified 10 actionable items at Priority 2 (HIGH) and Priority 3 (MEDIUM) that, while less critical than A1-A3, materially degrade the user experience and accessibility score:

| # | Issue | Impact | Priority |
|---|-------|--------|----------|
| 6 | `/reviews` route missing | Broken nav link → 404 | HIGH |
| 7 | Navbar no active page indicator | Users can't tell current page | HIGH |
| 8 | Touch targets under 44px | Fails WCAG target size (2.5.5) | HIGH |
| 9 | Headline-md 20px vs 24px spec | Visual inconsistency | HIGH |
| 10 | Section spacing inconsistent | Visual rhythm breaks | HIGH |
| 12 | Page transitions missing | Feels abrupt after animations | MEDIUM |
| 13 | Container padding 16px vs 24px | Spec mismatch | MEDIUM |
| 14 | Spring easing on card hover | Premium feel improvement | MEDIUM |
| 15 | CTA press state `active:scale-95` | Missing haptic feedback | MEDIUM |

### Architecture

These are independent, leaf-node fixes. Implementation order should be: (a) accessibility-hardening items first (reviews route, touch targets, lang attr), (b) UX polish items second (navbar indicator, page transitions, spacing).

```
Task ordering:
┌──────────────────────┐
│ 1. <html lang="vi">  │  ← 30s fix, high a11y impact
├──────────────────────┤
│ 2. Add /reviews route│  ← Fixes broken nav link
├──────────────────────┤
│ 3. Navbar active      │  ← UX clarity
├──────────────────────┤
│ 4. Touch targets 44px │  ← WCAG compliance
├──────────────────────┤
│ 5. Padding/spacing    │  ← DESIGN.md alignment
├──────────────────────┤
│ 6. Page transitions   │  ← Animation polish
├──────────────────────┤
│ 7. Spring easing      │  ← Micro-interaction
├──────────────────────┤
│ 8. Press state        │  ← CTA feedback
└──────────────────────┘
```

### Key Design Decisions

1. **No new routing library** — `/reviews` route already exists in `App.tsx`? Verified: it does NOT. Add route pointing to `ReviewsPage`. Do NOT create a new page; `ReviewsPage.tsx` already exists.

2. **Navbar active state via URL** — Use `useLocation()` from `react-router-dom` to get current path, compare against `NAV_ITEMS.to` values. Add `aria-current="page"` to active link.

3. **Touch targets — minimal approach** — Increase padding on icon buttons (`p-3` → `p-4` on small buttons). Do not refactor component layouts. Table `h-7 w-7` → `min-h-11 min-w-11` with centered icon.

4. **Page transitions — CSS only** — Add `@view-transition` CSS rule or simple fade animation via a route wrapper. Keep it lightweight: `opacity 0 → 1` with 200ms duration.

5. **Active:scale-95** — Add `active:scale-[0.97]` to Button component's base classes. This gives haptic-like press feedback.

---

## 2. File List

### Files to Modify

| File | Change |
|------|--------|
| `index.html` | Add `<html lang="vi">` attribute |
| `src/App.tsx` | Add route for `/reviews` → `ReviewsPage` component |
| `src/components/ui/navbar.tsx` | Add `useLocation()` to compare current path with NAV_ITEMS. Highlight active item with chrome underline + `aria-current="page"`. |
| `src/components/ui/button.tsx` | Add `active:scale-[0.97]` to base button classes. Increase minimum touch target: `min-h-11` on sm size. |
| `src/components/ui/navbar.tsx` | Fix touch targets on mobile nav links (add `min-h-11` padding fix) |
| `src/components/menu/menu-card.tsx` | Increase "Add" button size from `h-8` → `min-h-11 min-w-11` |
| `src/components/order/cart-item.tsx` | Increase + / - icon buttons from `h-7 w-7` → `min-h-11 min-w-11` |
| `src/components/home/five-zone-showcase.tsx` | Fix section padding: `py-20` → `py-12` to match DESIGN.md 48px spec |
| `src/components/ui/footer.tsx` | Social icon links: `h-10 w-10` → `min-h-11 min-w-11` |
| `src/pages/home.tsx` | Stats strip: `py-10` → `py-12`. Fix container padding: `px-4` → `px-6` on desktop. |
| `src/pages/admin/Dashboard.tsx` | `p-6` → consistent padding. |
| `global.css` or `src/App.tsx` | Add page transition: fade-in wrapper for route changes. Simple CSS: `@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`. |
| `src/styles/global.css` | Add `@view-transition { navigation: auto; }` for view transitions API. Fix headline-md to 24px (if not already fixed in A1). Add spring easing utility class: `--aura-easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`. |
| `src/components/ui/card.tsx` | Add spring easing on hover: `hover:shadow-[var(--aura-shadow-glow)] hover:scale-[1.02]` with `transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]` |

### Files to Create

None. All changes are modifications.

---

## 3. Database Changes

None.

---

## 4. API Endpoints

None.

---

## 5. Frontend Components

No new production components. Changes are attribute additions and CSS class modifications to existing components.

---

## 6. Tests

### Unit Tests

| Test | File | What to verify |
|------|------|----------------|
| Navbar active state | `src/components/ui/__tests__/navbar.test.tsx` | Active link has `aria-current="page"`, correct styling class |
| Button press state | `src/components/ui/__tests__/button.test.tsx` | Button has `active:scale-[0.97]` class |
| Card spring easing | `src/components/ui/__tests__/card.test.tsx` | Card has spring easing class on hover |
| Reviews route | `src/App.test.tsx` (or equivalent) | `/reviews` renders ReviewsPage |

### E2E Tests

| Spec | What to verify |
|------|---------------|
| `tests/e2e/phase-a-navbar.spec.ts` | Navbar highlights correct page, `/reviews` link works |
| `tests/e2e/phase-a-a11y.spec.ts` | axe-core scan: `html[lang="vi"]` exists, no missing `aria-current`, touch targets |

### Build Verification
```
npm run build    # Must pass
npm test         # All tests pass
```

---

## 7. Acceptance Criteria

### Accessibility
- [ ] `<html lang="vi">` present in source
- [ ] `/reviews` route renders ReviewsPage (not 404)
- [ ] Navbar shows active page indicator with `aria-current="page"`
- [ ] All icon buttons have minimum 44x44px touch targets
- [ ] Button components have focus-visible ring (already done, verify)
- [ ] axe-core scan finds 0 critical/serious violations

### UX Polish
- [ ] Card hover uses spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
- [ ] Buttons have `active:scale-[0.97]` press state
- [ ] Page transitions: fade-in animation on route change (not instant)
- [ ] Section spacing consistent at `py-12` (48px)
- [ ] Desktop container padding = `px-6` (24px) matching DESIGN.md

### Quality Gates
- [ ] `npm run build` = 0 errors
- [ ] `npm test` = all tests pass
- [ ] UI/UX re-audit score >= 8/10

---

## 8. Rollback Plan

### If navbar breaks
```bash
# Revert navbar and related routing changes
git checkout -- src/components/ui/navbar.tsx
```

### If /reviews route conflicts
```bash
# Revert route addition
git checkout -- src/App.tsx
```

### If page transitions cause FOUC
```bash
# Remove transition CSS
git checkout -- src/styles/global.css
```

### Global rollback
```bash
git checkout HEAD~10 -- index.html src/
npm run build
npm test
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| `<html lang="vi">` fix in index.html | 2 min |
| Add /reviews route in App.tsx | 5 min |
| Navbar active page indicator + aria-current | 20 min |
| Touch targets (button, cart, menu-card, social icons) | 20 min |
| Section spacing standardization (py-20 → py-12) | 10 min |
| Container padding (px-4 → px-6 desktop) | 10 min |
| Spring easing on card hover | 5 min |
| Button active:scale-97 press state | 2 min |
| Page transitions (CSS fade) | 10 min |
| Build + test verification | 15 min |
| **Total** | **~2h** |

---

## Appendix: CSS Spring Easing Utility

Add to `global.css`:
```css
:root {
  --aura-easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --aura-easing-spring-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@theme {
  --animate-spring: var(--aura-easing-spring);
}
```

Usage:
```tsx
// Card hover with spring
<div className="transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.02]">

// Button press with spring bounce
<button className="active:scale-[0.97] transition-transform duration-150 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]">
```
