# Phase 03 — Auto-Scheduling Cron

**Status:** complete
**Priority:** Medium
**TDD:** ✅ Write tests first, then implement cron logic

## Overview

CF Worker cron triggers that auto-generate and push social posts to Mixpost. Two schedules: (1) Daily specials at 07:00, (2) New promotion announcement on activation. Cron logic exported as async functions, testable in isolation.

## Cron Jobs

### `autoPostDailySpecials(env)`
- Runs daily at 07:00 (cafe opens)
- Queries D1: top 3-5 available products (random or featured)
- Generates post content via `specialsToPostContent()`
- Pushes to Mixpost API → scheduled for immediate publish
- Skipped if no products available

### `autoPostNewPromotions(env)`
- Runs daily at 08:00
- Queries D1: promotions activated in last 24h (check `created_at` or `starts_at`)
- Generates post per promotion via `promoToPostContent()`
- Pushes each to Mixpost API
- Skipped if no new promotions

### `autoPostWeeklyHighlights(env)`
- Runs Monday at 09:00
- Queries D1: top 3 products by order count (last 7 days)
- Generates "Best sellers tuần này" post
- Pushes to Mixpost API

## Cron Registration

In `worker/src/index.js`:
```js
import { autoPostDailySpecials, autoPostNewPromotions, autoPostWeeklyHighlights } from './routes/mixpost.js';

// In scheduled handler:
if (cron === '*/5 * * * *') { /* existing stuff */ }
// New cron triggers handled via cron.js pattern
```

Following existing cron pattern (mautic-bridge.js): exported async functions triggered from cron handler.

## Requirements

### Functional
- 3 cron functions: daily specials (07:00), new promos (08:00), weekly highlights (Mon 09:00)
- Each function: query D1 → generate content → push to Mixpost
- Idempotent: running twice doesn't duplicate posts (check `social_posts` D1 table for sent status, or rely on Mixpost duplicate detection)
- Log each auto-post result (success/fail/post ID)

### Non-functional
- Cron functions testable independently (pass mock env + mock fetch)
- Skip if `MIXPOST_API_URL` not configured (graceful no-op)
- Logging: structured logger with `{ cron: 'mixpost-daily' }` context

## Implementation Steps

1. [ ] Write TDD tests for all 3 cron functions (mock D1, mock Mixpost API)
2. [ ] Implement `autoPostDailySpecials(env)` in `worker/src/routes/mixpost.js`
3. [ ] Implement `autoPostNewPromotions(env)` 
4. [ ] Implement `autoPostWeeklyHighlights(env)`
5. [ ] Register cron triggers (if CRON_SECRET env used, else document manual curl trigger)
6. [ ] Test: verify content templates, verify push to Mixpost, verify idempotency
7. [ ] Verify all tests pass, 0 build errors

## Files

- **MODIFIED:** `worker/src/routes/mixpost.js` (+80 lines for cron exports)
- **MODIFIED:** `tests/mixpost-bridge.test.js` (+100 lines for cron tests)

## Success Criteria

- [ ] Daily specials cron generates branded post from D1 products
- [ ] New promotions cron detects recently activated promos
- [ ] Weekly highlights cron aggregates top sellers
- [ ] All cron functions are no-ops when Mixpost not configured
- [ ] Idempotency: no duplicate posts on re-run
- [ ] All tests pass, 0 build errors
