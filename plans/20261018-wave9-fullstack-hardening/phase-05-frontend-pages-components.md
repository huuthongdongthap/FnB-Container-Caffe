# Phase 05: Frontend Pages, Admin Tabs & UI Component Logic

## Overview
- Priority: High
- Current status: Pending
- Description: Fix data formatting crashes, station keyword matching, error feedback in mobile operations, inventory adjustment math, shift duration calculations, role retention, and KDS ticket advancement.

## Requirements
- Formatters in `format.ts` must gracefully handle `null`, `undefined`, and `NaN` without throwing `RangeError` or `TypeError`.
- Kitchen display station keyword for Americano must not have leading whitespace.
- Table management in mobile staff view must surface action errors to users.
- Inventory supplier tab must display valid purchase order amounts and reflect active/inactive statuses.
- Inventory movement modal must reset state on ingredient switch and calculate proper delta on stock adjustments.
- Shift duration calculation must support 24h "HH:MM" timestamps and calculate elapsed time for active shifts.
- Mobile device registration must preserve the dedicated kitchen role.
- KDS ticket queue must provide completion handlers across all active status columns.
- System Hub must recognize `aura_auth_token` in local storage.

## Related Code Files
- `src/lib/format.ts`
- `src/pages/mobile/kitchen-display.tsx`
- `src/pages/mobile/table-manager.tsx`
- `src/pages/admin/Inventory-suppliers-tab.tsx`
- `src/pages/admin/Inventory-movement-modal.tsx`
- `src/pages/admin/ManageMenu.tsx`
- `src/pages/admin/staff-utils.ts`
- `src/pages/admin/staff-shifts-tab.tsx`
- `src/pages/admin/Devices-hooks.ts`
- `src/pages/admin/Orders.tsx`
- `src/pages/SystemHub.tsx`
- `src/components/kds/TicketQueue.tsx`

## Implementation Steps
1. Add defensive fallback checks in `format.ts` for currency, date, and points.
2. Fix `'americano'` keyword in `kitchen-display.tsx`.
3. Add error notification state in `table-manager.tsx`.
4. Fix field resolution in `Inventory-suppliers-tab.tsx` and dynamic badge classes.
5. In `Inventory-movement-modal.tsx`, add reset effect and calculate relative adjustment delta.
6. Support "HH:MM" parsing in `staff-utils.ts` and compute active shift hours in `staff-shifts-tab.tsx`.
7. Preserve `kitchen` role in `Devices-hooks.ts`.
8. Wire `onComplete` in `TicketQueue.tsx` for preparing tickets.
9. Support `aura_auth_token` in `SystemHub.tsx`.

## Success Criteria
- Zero `RangeError: Invalid time value` or `"NaN ₫"` occurrences in rendering.
- Accurate inventory stock adjustments.
- Complete KDS Kanban ticket interaction across all columns.
