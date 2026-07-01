---
phase: 5
title: "File Hygiene: Split Large Files + Fix Naming"
status: pending
priority: P2
dependencies: []
effort: 3h
---

# Phase 5: File Hygiene — Split Large Files + Fix Naming

## Overview

Split the 5 worst oversized files into focused sub-components. Fix 2 naming inconsistencies: rename stuck-payments-card.tsx to PascalCase, move use-cart-store.ts to hooks/stores/.

## Requirements

- Functional: Each split file ≤200 lines. Extracted components are independently testable. Naming follows conventions.
- Non-functional: All existing tests pass. No visual regressions.

## Architecture

### Split Plan

| File | Lines | Split Into |
|------|-------|------------|
| `pages/admin/CheckinApprove.tsx` | 315 | Extract `CheckinFilterBar.tsx` (filters + search) + `CheckinTableRow.tsx` (row component) |
| `components/loyalty/loyalty-calculator.tsx` | 290 | Extract `TierProjection.tsx` (tier progress visual) + `ReferralCalculator.tsx` (referral math) |
| `pages/TableReservation.tsx` | 287 | Extract `TimeSlotPicker.tsx` (time slot grid) + `TableMap.tsx` (table selection) |
| `pages/order-success.tsx` | 278 | Extract `StatusProgressBar.tsx` (already has STATUS_STEPS inline) + `NextSteps.tsx` |
| `pages/checkout.tsx` | 277 | Extract `OrderSummarySidebar.tsx` (cart items + totals, already a separate section) |

### Naming Fixes

| Current | Fixed | Reason |
|---------|-------|--------|
| `components/admin/stuck-payments-card.tsx` | `components/admin/StuckPaymentsCard.tsx` | All other admin components use PascalCase |
| `hooks/use-cart-store.ts` | `hooks/stores/use-cart-store.ts` | All other Zustand stores live in hooks/stores/ |

## Related Code Files

- Modify: `src/pages/admin/CheckinApprove.tsx` — extract sub-components
- Create: `src/components/admin/CheckinFilterBar.tsx`
- Create: `src/components/admin/CheckinTableRow.tsx`
- Modify: `src/components/loyalty/loyalty-calculator.tsx` — extract sub-components
- Create: `src/components/loyalty/TierProjection.tsx`
- Create: `src/components/loyalty/ReferralCalculator.tsx`
- Modify: `src/pages/TableReservation.tsx` — extract sub-components
- Create: `src/components/reservation/TimeSlotPicker.tsx`
- Create: `src/components/reservation/TableMap.tsx`
- Modify: `src/pages/order-success.tsx` — extract sub-components
- Create: `src/components/order/StatusProgressBar.tsx`
- Create: `src/components/order/NextSteps.tsx`
- Modify: `src/pages/checkout.tsx` — extract sidebar
- Create: `src/components/order/OrderSummarySidebar.tsx`
- Rename: `src/components/admin/stuck-payments-card.tsx` → `StuckPaymentsCard.tsx`
- Move: `src/hooks/use-cart-store.ts` → `src/hooks/stores/use-cart-store.ts`
- Modify: All files importing from `@/hooks/use-cart-store` — update to `@/hooks/stores/use-cart-store`

## Implementation Steps

1. **CheckinApprove split** — Extract filter bar (search, date range, status filter) + table row component
2. **loyalty-calculator split** — Extract tier projection visualization + referral calculator section
3. **TableReservation split** — Extract time slot picker + table map visualization
4. **order-success split** — Extract StatusProgressBar (status steps with progress indicator) + NextSteps component
5. **checkout split** — Extract OrderSummarySidebar (cart items list + totals calculation)
6. **Rename stuck-payments-card → StuckPaymentsCard** — Update Dashboard.tsx import
7. **Move use-cart-store to hooks/stores/** — Update all imports (checkout.tsx, menu.tsx, use-cart.ts, test files)
8. **Run all tests** — 423 frontend tests pass
9. **Build** — `npm run build` 0 errors

## Success Criteria

- [ ] All 5 split files ≤200 lines each
- [ ] 10 new component files created, each focused and ≤150 lines
- [ ] `StuckPaymentsCard.tsx` follows PascalCase convention
- [ ] `use-cart-store.ts` lives in `hooks/stores/` (all imports updated)
- [ ] 0 broken imports
- [ ] All 423 frontend tests pass
- [ ] `npm run build` — 0 errors
- [ ] Manual smoke: checkout, order-success, reservations, loyalty calculator all render correctly

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| File split breaks component state/props | Extract pure presentation components first. Keep state management in parent. |
| Moving use-cart-store breaks 15+ imports | Use grep to find ALL imports before moving. Update each. Build catches misses. |
| Renaming stuck-payments-card on case-insensitive FS (macOS) | Use `git mv` to preserve history. macOS APFS is case-insensitive — rename in two steps: temp name → final name. |
| Visual regression in split components | Manual smoke test on each page after split. Compare screenshot if available. |
