# Bug Sprint Report — Reservation System Sync
**Date**: 2026-05-05 | **Duration**: ~15 min | **Credits**: 8

## Root Causes Found & Fixed

### Bug 1: `_deploy/` files stale — fixes never deployed (CRITICAL)
- **File**: `_deploy/admin/reservations.html`, `_deploy/table-reservation.html`
- **Root cause**: Previous sprint fixes were in source but not in `_deploy/` (May 3 vs May 5). Admin lacked auth guard, 401 handling, auto-refresh. Table-reservation lacked phone validation, error handling.
- **Fix**: Synced `_deploy/` with source fixes — added auth guard, 401 handling, auto-refresh to admin; phone validation + error handling to table-reservation.

### Bug 2: `loadTables()` dead code — API data silently discarded
- **File**: `table-reservation.html:329-368`
- **Root cause**: `loadTables()` wrote to dead `ZONES[zone].tables[]` arrays that no rendering path reads. `fetchAvailability()` already correctly populates `allTables` with proper zone mapping.
- **Fix**: Removed `loadTables()`, `ZONES`, `STATUS_MAP` dead code. Init now calls `fetchAvailability()` directly.

### Bug 3: MOCK_TABLES zone mismatch breaks offline fallback
- **File**: `table-reservation.html:305-327` + `_deploy/table-reservation.html`
- **Root cause**: MOCK_TABLES had `zone:'rooftop'/'cafe'/'courtyard'` (UI names) but `renderTables()` filters by `TAB_TO_DB[state.zone]` = 'VIP'/'Indoor'/'Outdoor' (DB names). When API fails, fallback mock data matched 0 tables → empty floor plan.
- **Fix**: Changed MOCK_TABLES zone values to DB names ('VIP'/'Indoor'/'Outdoor') matching the renderTables filter.

### Bug 4: Lint — missing curly braces
- **File**: `worker/src/routes/reservations.js:167`
- **Fix**: Added curly braces to `if (!kv)` block.

## Files Changed
| File | Change |
|------|--------|
| `table-reservation.html` | Removed dead `loadTables()`/`ZONES`/`STATUS_MAP`. Fixed MOCK_TABLES zone names. Init → `fetchAvailability()` |
| `admin/reservations.html` | No source change needed (already had fixes) |
| `_deploy/admin/reservations.html` | Added auth guard, 401 handling, auto-refresh, cancel error handling |
| `_deploy/table-reservation.html` | Added phone validation, error handling. Removed dead code. Fixed MOCK_TABLES zones |
| `worker/src/routes/reservations.js:167` | Added curly braces lint fix |

## Lint & Test Status
- Lint: 0 errors, 92 warnings (all pre-existing)
- Tests: Pre-existing failure (cart-manager.js missing module — unrelated)

## Verification Checklist
- [x] `_deploy/` files now match source fixes (auth guard, auto-refresh, phone validation)
- [x] MOCK_TABLES zone names match `renderTables()` filter (VIP/Indoor/Outdoor)
- [x] Dead `loadTables()` code removed — init path simplified
- [x] `dist/` rebuilt with all fixes
- [x] Lint passes (0 errors)
