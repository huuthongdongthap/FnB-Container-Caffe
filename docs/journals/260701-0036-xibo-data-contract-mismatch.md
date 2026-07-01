# Xibo Digital Signage: Data Contract Mismatch Caught by Code Review

**Date**: 2026-07-01 00:45
**Severity**: Critical
**Component**: Xibo digital signage pillar
**Status**: Resolved

## What Happened

Code review of the Xibo signage pillar (30 tests, 3 widgets, 2 API endpoints) found 2 CRITICAL data contract mismatches. Widgets were calling the API but parsing the wrong response shape.

## The Brutal Truth

Three widgets shipped with fetchAndRender() implementations that assumed the API wrapper format was the data format. Nobody caught it because the tests mocked the wrong shape too -- they were testing against what the widget expected, not what the API actually returned. Circular self-verification.

## Technical Details

- **C1-C3**: All 3 widgets expected `{ categories }` / `{ promos }` in response. API returns `{ success, data }` wrapper. Fixed fetchAndRender() in menu-board, promo-screen, welcome-screen to unwrap `response.data`.
- **C2**: Promo-screen expected `{ title, discount_percent, valid_until, description }`. API returns `{ code, percent, expires_at }`. Changed widget to consume API field names directly rather than adding an adapter layer (YAGNI).
- **H3**: Signage API was leaking `e.message` in error responses. Sanitized to generic messages.
- **M1**: Added `// CHANGE-ME: set API_BASE` comments to all 3 widgets.
- **L1/L3**: Removed unused SQL alias in signage route. Changed `var` to `const/let` in welcome-screen.

## Root Cause

The three widgets and their tests were built in isolation from the API they consumed. The API was implemented first, widgets second, but tests were written against widget expectations, not the actual API contract. No contract-first approach was used -- no OpenAPI spec, no shared types.

## Lessons Learned

1. Widgets and their API consumer tests must use the same fixtures. If tests mock `{ success, data }` but consume `{ promos }`, they prove nothing.
2. Code review caught this before merge. The review step in the workflow paid for itself immediately.
3. Once committed (fdde581, main), 756/756 tests pass, 0 build errors.
