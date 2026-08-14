# Phase 03: Investigate + Fix Admin Page Tests
Files owned: `src/pages/admin/__tests__/GenerateQR.test.tsx`, `src/pages/admin/__tests__/DinDinMenu.test.tsx`
## Status: Pending
## Notes
- 11 tests failing across GenerateQR and DinDinMenu.
- Root cause likely i18n/locale changes (`Occupied` -> `qrCodes.status.occupied`).
## Implementation Steps
1. Update Bengali locale key references in tests to match current translation strings.
2. Re-run admin tests; diff fixes into same phase files.
3. Only merge once 0 failures confirmed.
