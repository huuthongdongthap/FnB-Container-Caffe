# A2: Generic Component Dark Remedy

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1 Critical
**Source:** UI/UX Pro Max Audit #2 (generic components white-on-dark)
**Effort:** 1.5-2 hours
**Dependencies:** A1 (Tailwind `@theme` must use dark tokens first)
**Depended by:** A4 (tests may fail on components with broken backgrounds)

---

## 1. Technical Design

### Problem Statement

Several generic UI components use hardcoded light-mode background colors (`bg-white`, `bg-green-100`, `bg-gray-50`, `bg-red-50`) that render incorrectly on the dark navy (`#0A1A2E`) page background. The design system specifies a glass-on-dark aesthetic, but these components bleed light colors.

Audit-identified failures:

| Component | Current Background | Expected Background |
|-----------|-------------------|-------------------|
| `Button` primary variant | `bg-primary` → `#0d1b2a` (nearly invisible on `#0A1A2E`) | Chrome gradient or `bg-[var(--aura-primary)]/10` |
| `Modal` | `bg-white` | `bg-[var(--aura-bg-elevated)]` |
| `Skeleton` | `bg-muted/30` (muted = light gray from light @theme) | `bg-[var(--aura-bg-high)]/30` |
| `Badge` variants | `bg-green-100`, `bg-amber-100`, `bg-red-100` | `bg-green-500/20`, etc. |
| Page-level error/success boxes | `bg-red-50`, `bg-green-50` | `bg-red-500/10`, `bg-green-500/10` |

**Note:** The audit some stale findings (Drawer, Input, Card were already fixed in prior commits). The current actual state is verified against source files.

### Architecture

The fix applies at the component source level, not via overrides. Each component's Tailwind class reference or inline `var()` is corrected to use dark-theme CSS custom properties.

```
Component layer:
  ┌───────────────┐    ┌──────────────────┐    ┌───────────────┐
  │  Button       │    │  Modal/Badge     │    │  Page-level   │
  │  .tsx         │    │  .tsx            │    │  boxes        │
  └───┬───────────┘    └───┬──────────────┘    └───┬───────────┘
      │                    │                        │
      ▼                    ▼                        ▼
  Use @theme            Use CSS var             Use CSS var
  classes               references              references
  (bg-primary→          (bg-white →             (bg-red-50 →
   bg-accent)            bg-[var(--              bg-red-500/10)
                          aura-bg-elevated)])
      │                    │                        │
      └────────────────────┴────────────────────────┘
                         All resolve to
                   dark-navy compatible colors
```

### Key Design Decisions

1. **CSS variables over Tailwind utilities** for translucent/bg-opacity cases — because Tailwind v4 `bg-red-500/20` is expressed as `bg-red-500/20` (supported) but using `var()` values is more consistent with existing patterns.

2. **Token aliases for semantic backgrounds** — Create focused CSS variables like `--aura-bg-success` and `--aura-bg-error` only if needed. Prefer inline `opacity` modifiers first (YAGNI).

3. **Button primary must be visible** — Change from `bg-primary` (which maps to `#0d1b2a`, nearly same as `#0A1A2E` page bg) to `var(--aura-primary)` background with appropriate opacity, or `bg-accent` (chrome silver).

---

## 2. File List

### Files to Modify

| File | Change | Lines Changed |
|------|--------|---------------|
| `src/components/ui/button.tsx` | Primary variant: `bg-primary` → `bg-accent text-black hover:bg-accent/80 focus-visible:ring-accent`. Secondary: `border-border` ok. | Line 14 |
| `src/components/ui/modal.tsx` | `bg-white` → `bg-[var(--aura-bg-elevated)]`. `backdrop:bg-black/50` can stay (black backdrops are fine on dark). | Line 40 |
| `src/components/ui/skeleton.tsx` | `bg-muted/30` → `bg-[var(--aura-bg-high)]/30` | Line 20 |
| `src/components/ui/badge.tsx` | All variant backgrounds: replace `bg-green-100` with `bg-green-500/15`, `bg-amber-100` with `bg-amber-500/15`, `bg-red-100` with `bg-red-500/15`, `bg-blue-100` with `bg-blue-500/15`. Keep text colors dark (`text-green-800` → `text-green-400`). | Lines 13-17 |
| `src/components/order/checkout-form.tsx` | `bg-white` → `bg-[var(--aura-bg-input)]` on form fields | Lines 162, 186 |
| `src/components/order/delivery-info.tsx` | `bg-white` → `bg-[var(--aura-bg-input)]` | Line 107 |
| `src/pages/admin/Dashboard.tsx` | `bg-red-50` → `bg-red-500/10`, `bg-white/80` → `bg-[var(--aura-bg-surface)]/80` | Lines 100, 228, 241 |
| `src/pages/admin/PromotionsManager.tsx` | `bg-red-50` → `bg-red-500/10`. `bg-white` on inputs → `bg-[var(--aura-bg-input)]`. `bg-green-500` toggle → keep (green is fine). | Lines 357, 422, 431, 449, 453 |
| `src/pages/admin/SubscriptionsManager.tsx` | `bg-red-50` → `bg-red-500/10`. `bg-white` → `bg-[var(--aura-bg-input)]`. `bg-white/40` → `bg-[var(--aura-bg-surface)]/40`. | Lines 162, 365, 397, 611, 679 |
| `src/pages/admin/GenerateQR.tsx` | `bg-red-50` → `bg-red-500/10`. `bg-white` → `bg-[var(--aura-bg-surface)]`. | Lines 45, 113 |
| `src/pages/admin/Customers.tsx` | No bg fix needed (emoticon is A3). | — |
| `src/pages/admin/InvoiceHistory.tsx` | `bg-red-50` → `bg-red-500/10` | Line 124 |
| `src/pages/Checkin.tsx` | `bg-red-50 border-red-200 text-red-700` → `bg-red-500/10 border-red-500/20 text-red-400` | Line 37 |
| `src/pages/TrackOrder.tsx` | `bg-green-500` status dot → keep (green is brand-compatible) | — |
| `src/components/auth/RegisterForm.tsx` | `bg-red-50` → `bg-red-500/10 text-red-400` | Line 50 |
| `src/components/auth/LoginForm.tsx` | `bg-red-50` → `bg-red-500/10 text-red-400` | Line 44 |
| `src/components/kds/TicketQueue.tsx` | `bg-gray-50` → `bg-[var(--aura-bg-surface)]`. `bg-white` → `bg-[var(--aura-bg-elevated)]` | Lines 24, 99, 145 |
| `src/components/kds/OrderTicket.tsx` | `bg-red-50` → `bg-red-500/10`. `bg-white` → `bg-[var(--aura-bg-surface)]` | Lines 31-32 |
| `src/components/order/SplitBillModal.tsx` | `bg-red-500/20` → already correct. No change needed. | — |
| `src/components/home/five-zone-showcase.tsx` | `hover:bg-white/5` → OK (translucent on dark) | Verifying |

### Files to Create

None. All changes are modifications to existing component files.

---

## 3. Database Changes

None.

---

## 4. API Endpoints

None.

---

## 5. Frontend Components

No new components. Changes are color token references in existing components.

---

## 6. Tests

### Unit Tests

| Test | File | What to verify |
|------|------|----------------|
| Button renders with correct bg | `src/components/ui/__tests__/button.test.tsx` | Add assertion: primary variant has `bg-accent` class |
| Badge dark variant colors | `src/components/ui/__tests__/badge.test.tsx` (new) | Verify dark-compatible bg classes |
| Modal renders correct bg | `src/components/ui/__tests__/modal.test.tsx` | Verify no `bg-white` in rendered output |

### Build Verification
```
npm run build    # Must pass
npm test         # All 1184 tests pass
```

### Visual Check
- Navigate to every admin page, verify no white flashes/boxes on dark bg
- Test Button primary variant visibility on dark page

---

## 7. Acceptance Criteria

- [ ] Button primary variant is visible (chrome accent, not invisible dark navy)
- [ ] Modal uses `bg-[var(--aura-bg-elevated)]` instead of `bg-white`
- [ ] Skeleton uses `bg-[var(--aura-bg-high)]/30` instead of `bg-muted/30`
- [ ] Badge variants use dark-compatible colors (`bg-green-500/15` not `bg-green-100`)
- [ ] No `bg-red-50` or `bg-green-50` or `bg-gray-50` remains in any production file
- [ ] No `bg-white` remains on any component that renders on dark page background
- [ ] All admin forms have dark-themed input backgrounds (not white)
- [ ] `npm run build` = 0 errors
- [ ] `npm test` = all 1184 test pass (0 regression)

---

## 8. Rollback Plan

### If a specific component looks wrong
```bash
# Revert individual file
git checkout -- src/components/ui/button.tsx
```

### If build fails from CSS class reference errors
```bash
# Check for invalid Tailwind classes
npx tailwindcss --input src/styles/global.css --output /dev/null 2>&1

# Revert all component changes
git checkout -- src/components/ui/
git checkout -- src/components/order/
git checkout -- src/pages/admin/
```

### Global rollback
```bash
git checkout HEAD~10 -- src/components/ src/pages/
npm run build
npm test
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Button primary fix | 5 min |
| Modal bg fix | 5 min |
| Skeleton bg fix | 5 min |
| Badge variant colors | 10 min |
| Checkout/delivery form inputs | 10 min |
| Admin pages (Dashboard, Promotions, Subscriptions, etc.) | 25 min |
| Auth forms + KDS | 10 min |
| Page-level error boxes (Checkin, auth) | 10 min |
| Build + test verification | 10 min |
| **Total** | **~1.5h** |
