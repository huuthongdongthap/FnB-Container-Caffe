# Phase 2b-3: Remaining Routes + Tree Modules (MEDIUM)

**Goal:** Fill remaining gaps in the 35/49 untested routes and 15/19 untested tree modules after 2b-1 and 2b-2.

## Priority order
1. `src/tree/loyalty/` (8 files, 0 tests — cashback logic)
2. `src/tree/subscriptions/` (7 files, 0 tests)
3. `src/tree/pretix/` (3 files — HMAC validation, security-sensitive)
4. `src/tree/zalo/` (3 files)
5. `src/routes/reviews.ts`, `src/routes/menu.ts`, `src/routes/contact.ts` (existing 1-3 tests, expand)
6. Remaining routes: `broadcast.ts`, `chat.ts`, `reminders.ts`, `signage.ts`, `push.ts`, `reservations.ts`, `products.ts`, `promotions.ts`, `checkin.ts`, `birthday.ts`...

## Strategy
- Group smallroutes (≤40 lines) into a single test file where logical: e.g., `combined-routes.test.ts` for trivial stub routes.
- Prioritize routes with DB writes over pure-read routes.
- Skip routes that are pure passthrough to tree modules (tree modules get tested instead).

## Acceptance
- All files in `src/tree/orders/`, `src/tree/auth/`, `src/tree/loyalty/`, `src/tree/subscriptions/` have at least 1 test file.
- All high-value routes (>50 lines, financial or security-sensitive) have ≥1 test.
- Coverage target: >50% of total routes tested (up from 29%).
- `npx vitest run` passes.
