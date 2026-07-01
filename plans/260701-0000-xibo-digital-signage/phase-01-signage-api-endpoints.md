# Phase 01 — Signage API Endpoints (TDD)

**Status:** complete
**Priority:** High
**TDD:** ✅ Write tests first, then implement

## Overview

Create `/api/signage/menu` and `/api/signage/promos` endpoints optimized for TV display. Read from existing D1 tables (menu_items, categories, promotions). Return large-format data with minimal nesting for easy widget consumption.

## Requirements

### Functional
- `GET /api/signage/menu` — categories with products, prices, images (sorted by category order, then product order)
- `GET /api/signage/promos` — active promotions with descriptions, discount info, expiry
- Response format: flat JSON optimized for widget rendering (no pagination, all items)
- Vietnamese content (bilingual where customer-facing)
- CORS enabled (same allowlist as existing routes)

### Non-functional
- Read-only — never modifies D1
- Cache-friendly: return `Cache-Control: public, max-age=300` (5 min)
- No auth required (public endpoint for local network widgets)
- Structured logger (no console.log)
- Graceful empty responses (empty arrays, no 404)

## Implementation Steps

1. [x] Write TDD tests for `/api/signage/menu` (expected shape, categories sorted, images included)
2. [x] Write TDD tests for `/api/signage/promos` (active only, discount info, expiry dates)
3. [x] Implement `worker/src/routes/signage.js` with Hono router
4. [x] Register `signageRouter` in `worker/src/index.js`
5. [x] Verify all tests pass, build clean

## Files

- **NEW:** `worker/src/routes/signage.js`
- **NEW:** `tests/signage-api.test.js`
- **MODIFY:** `worker/src/index.js`

## Success Criteria

- [x] `/api/signage/menu` returns `{ categories: [{ name, products: [{ name, price, image }] }] }`
- [x] `/api/signage/promos` returns `{ promos: [{ title, description, discount, expires }] }`
- [x] Cache-Control header set to 5-min public
- [x] No auth required
- [x] Tests pass, 0 build errors

## Dependencies

- Existing menu_items, categories, promotions tables in D1
- Hono router pattern (matches existing route files)
