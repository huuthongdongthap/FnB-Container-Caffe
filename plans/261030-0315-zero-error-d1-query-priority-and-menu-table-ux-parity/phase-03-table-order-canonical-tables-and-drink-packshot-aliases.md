# Phase 03: `TableOrder.tsx` Canonical `01–12` Tables & Drink Packshot Aliases

## Context Links
- Brainstorm Report: `plans/reports/brainstorm-261030-zero-error-d1-query-priority-and-menu-table-ux-parity.md`
- Table Order Page: `src/pages/TableOrder.tsx`
- Drink Image Resolver: `src/lib/menu-drink-images.ts`

## Overview
- **Priority**: P1 (Prevent `404` on `/order` & `/pos/tables` table selection and unify drink packshots)
- **Current Status**: Complete
- **Description**: Align `ZONES_FOR_TABLES` in `src/pages/TableOrder.tsx:140-146` with the 12 canonical D1 tables (`01`–`12`), wire `resolveMenuDrinkImage` for `AURA_VI_ORDER_ITEMS` in `src/pages/TableOrder.tsx`, and normalize `ID_ALIASES` (`yo001`..`yo004` -> `yg001`..`yg004`) inside `resolveMenuDrinkPackshots` in `src/lib/menu-drink-images.ts`.

## Key Insights
- D1 `cafe_tables` and `table_qr_codes` have 12 tables (`01`–`12`), and `resolveOrderCreationTable` returns `404` for tables `13`–`20`.
- Mapping `ZONES_FOR_TABLES` across the 12 canonical tables (`01–04`, `05–08`, `09–10`, `11–12`) ensures every table button on `/order` and `/pos/tables` succeeds on guest check-in and order creation.

## Requirements
- **Functional**:
  - Update `ZONES_FOR_TABLES` in `src/pages/TableOrder.tsx:140-146` to only expose canonical tables `01`–`12`.
  - Apply `resolveMenuDrinkImage(item.id, item.imageSrc)` to `AURA_VI_ORDER_ITEMS` in `src/pages/TableOrder.tsx`.
  - Normalize `const canonicalId = ID_ALIASES[id] ?? id` in `resolveMenuDrinkPackshots` (`src/lib/menu-drink-images.ts:100-104`).

## Related Code Files
- Modify: `src/pages/TableOrder.tsx`
- Modify: `src/lib/menu-drink-images.ts`

## Todo List
- [x] Normalize `ID_ALIASES` in `resolveMenuDrinkPackshots` (`src/lib/menu-drink-images.ts`)
- [x] Align `ZONES_FOR_TABLES` (`01–12`) and `AURA_VI_ORDER_ITEMS` packshots in `src/pages/TableOrder.tsx`

## Success Criteria
- Every selectable table in `TableOrder.tsx` (`01`–`12`) resolves in `cafe_tables` (`0` 404 errors on `/api/orders/guest-checkin`).
- `resolveMenuDrinkPackshots('yo001')` returns the `yg001` multi-angle packshot array.
