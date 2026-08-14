# Sprint 5 Finish: 4 Remaining Admin Component Tests

## Summary
Fixed and finalized 4 test files for admin components. All 26 tests pass (4 files, 0 failures).

## Files Modified

### `src/components/stitch/__tests__/stitch-order-mgmt-new.test.tsx`
- **7 tests pass**: loading, error, stat cards, search, filter tabs, customer name, retry button
- Fixed: duplicate text assertions (`getAllByText` for duplicated "12", "orderMgmt.pending")
- Fixed: refresh button only renders in error state; test now provides `error` prop and matches `terminal.retry` aria-label

### `src/components/stitch/__tests__/stitch-kds-new.test.tsx`
- **7 tests pass**: loading skeleton, error message, station label, station name, status badges, overdue badge, complete button
- Fixed: "STATION 01" appears twice (sidebar + header) — use `getAllByText`
- Fixed: status badge text matches `kds.preparing` (i18n key pattern) in both filter link and badge span — use `getAllByLabelText`

### `src/components/stitch/__tests__/stitch-admin-terminal-new.test.tsx`
- **6 tests pass**: brand subtitle, admin name, sidebar nav (Vietnamese labels), children, main area, search input
- Fixed: "Dashboard" text broken by icon SVG; switched to Vietnamese labels (`Đơn hàng`, `POS`, `Thực đơn`) that render as plain text in `item.label`
- Fixed: brand name "Aura Cafe" rendered via `t('hero.title')` which returns i18n key; switched to "Admin Terminal" subtitle assertion

### `src/components/stitch/__tests__/stitch-account-dash-new.test.tsx`
- **6 tests pass**: profile name, tier badge, loyalty points, order history, custom profile, favorites placeholder
- Fixed: default name is "Julian Vane" (not "Alex Morgan")
- Fixed: default loyalty points are 1250 (renders as "1,250", not "2,450")
- Fixed: "Gold" appears in both badge and tier member label — use `getAllByText`
- Fixed: favorites section shows empty placeholder with i18n key `stitch.accountDashboard.myFavoritesEmpty`
- Fixed: custom profile "Silver" appears twice — use `getAllByText`

## Root Cause of All Failures
All 26 initial failures were caused by **test assertions not matching actual component rendering**:
1. Mocked `useTranslation` returns i18n keys as-is (e.g., `nav.orders` instead of Vietnamese text)
2. Components render text in multiple DOM locations (duplicate text nodes)
3. Default prop values differ from what tests assumed
4. Conditional rendering (e.g., refresh button only in error state) not accounted for

## Test Command
```bash
npx vitest run src/components/stitch/__tests__/stitch-order-mgmt-new.test.tsx \
  src/components/stitch/__tests__/stitch-kds-new.test.tsx \
  src/components/stitch/__tests__/stitch-admin-terminal-new.test.tsx \
  src/components/stitch/__tests__/stitch-account-dash-new.test.tsx
```

## Unresolved Questions
- None. All tests pass cleanly.
