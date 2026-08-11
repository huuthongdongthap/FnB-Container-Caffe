# Test Failure Audit Report

**Date:** 2026-08-03
**Baseline:** commit `0727af9` (known-good)
**Current:** commit `03c59e1` (merged)
**Full run:** Tests 84 failed | 2394 passed (2478)
**Failure rate:** 3.39%

---

## Summary by Error Category

| Category | Count | Files |
|----------|-------|-------|
| 404 where 200/201/400 expected (routes not mounted) | 28 | orders-hono, guest-checkin, tables, customers, reports, shifts, checkin, birthday, cron |
| TypeError: undefined `fetch` (qrRouter missing) | 4 | tables.test.ts (QR endpoints) |
| TypeError: undefined / not a function | 7 | cron-integration, zalo |
| HTTP 500 instead of expected 200/400/404 | 9 | shifts, tables, zalo |
| Wrong HTTP status / mock arg mismatch | 3 | payments, mautic-bridge |
| Wrong expected string (Vietnamese) | 3 | payments |
| Component render failure (TestingLibraryElementError) | 12 | promotion-card, DinDinMenu, GenerateQR |
| Auth/wrong status (400 instead of 403/404) | 10 | staff-auth-mobile |

**Dominant failure mode: 404 on known routes** — 28 of 84 failures. The routes from the worker app are returning 404 across every endpoint. This strongly suggests the Hono app router stopped mounting these route handlers after commit `03c59e1`.

---

## Per-File Breakdown

### 1. `tests/customers.test.ts` — 4 failures
**Primary pattern:** 404 on known routes
1. `GET /me` — expected 200, got **404**. Customer routes not mounted.
2. `GET /me` not found — expected 404, got **401**. Auth middleware short-circuits.
3. `GET /` — expected paginated list (3 items), got **404**.
4. `GET /` empty — expected empty + metadata, got **404**.

### 2. `tests/mautic-bridge.test.ts` — 1 failure
**Primary pattern:** Mock call argument mismatch
1. `syncSegments assigns tier-based segments` — expected vi mock called with `[100, 10]`, mock was not called at all. The tier config read from env is not triggering the mock call path.

### 3. `tests/payments.test.ts` — 3 failures
**Primary pattern:** Wrong expected string (Vietnamese vs English)
1. `POST /create-link` not found — expected `/not found/i`, got Vietnamese `Khong tim thay don hang`.
2. `POST /create-link` already paid — expected `/already paid/i`, got Vietnamese `Don hang da duoc thanh toan`.
3. `POST /create-link` not configured — expected `/not configured/i`, got Vietnamese `PayOS chua duoc cau hinh`.

**Root cause:** Test regex is English-only; error messages are now Vietnamese. Test needs `toMatch(/tim/i)` or locale-aware assertion.

### 4. `tests/reports.test.ts` — 7 failures
**Primary pattern:** 404 on all GET routes
- All 4 tests on `GET /daily` — expected 200, got **404**. Report route not mounted.
- `GET /summary` — expected 200 with KPI data, got **404**.
- `GET /orders` — expected 200 with metrics, got **404**.
- Additionally: 3 tests expected truthy results (`signups data`, `zero values`, `non-empty database`) but got `undefined` instead of `true`.

**Root cause:** Reports route handler not mounted in app router. All `/api/reports/*` endpoints return 404.

### 5. `tests/shifts.test.ts` — 8 failures
**Primary pattern:** HTTP 500 on every endpoint
1. `POST /clock-in` valid staff — expected 201, got **500**
2. `POST /clock-in` missing staff_id — expected 400, got **500**
3. `POST /clock-in` already clocked in — expected 400, got **500**
4. `POST /clock-out` valid shift — expected 200, got **500**
5. `POST /clock-out` missing staff_id — expected 400, got **500**
6. `POST /clock-out` no active shift — expected 404, got **500**
7. `GET /` — expected 200 with data, got **500**
8. `GET /` empty — expected 200 with empty array, got **500**

**Root cause:** Shifts route handler has an unhandled exception that triggers the 500 error handler on every request. Likely a missing DB table column, broken import, or a reference to `qrRouter` or similar that was removed in 03c59e1.

### 6. `tests/subscriptions.test.ts` — 1 failure
**Primary pattern:** Missing string in source code
1. `MRR Calculation Logic` — expected response body to contain `status = 'cancelled'`, got source code excerpt instead of parsed JSON.

**Root cause:** The test is reading the raw source file instead of calling a function result. The cancellation logic `status = 'cancelled'` is not being parsed/executed as expected — likely the function was renamed, moved, or the test's import path is stale.

### 7. `tests/tables.test.ts` — 3 failures
**Primary pattern:** 404 on PUT/PATCH routes + TypeError on QR endpoints
1. `PATCH /:id/status` — expected 200, got **500** (handler crashes)
2. `PATCH /:id/status` invalid status — expected 400, got **500**
3. `PATCH /:id/status` empty body — expected 400, got **500**

**Root cause:** Tables route handler crashes on every request (500). Separate from the 404 mounting issue — the route IS mounted but the handler throws.

Additionally: QR image endpoints fail with `TypeError: Cannot read properties of undefined (reading 'fetch')` — `qrRouter` is undefined. The QR router was removed or its export changed.

### 8. `tests/zalo.test.ts` — 6 failures
**Primary pattern:** TypeError + wrong status
First 4 tests: `TypeError: Cannot read properties of undefined (reading 'ok')` — the `fetch` mock is undefined. `sendZNS` calls `fetch()` but the mock wasn't hoisted properly or the import path changed.
5. `notifyMember` pos_only — expected 400, got **200**
6. `handleZaloRequest` missing params — expected 400, got **404**

**Root cause:** The Zalo module's `fetch` mock is broken (either `vi.mock` hoisting failed, or the module no longer uses `fetch` directly). Plus the route `/api/zalo/handle` returns 404 instead of 400 for missing params.

### 9. `src/components/promotions/__tests__/promotion-card.test.tsx` — 2 failures
**Primary pattern:** TestingLibraryElementError — element not found
1. `shows validity dates` — could not find text `/2026/` in body
2. `shows days remaining` — could not find text `/ngay/` (Vietnamese for "days")

**Root cause:** The PromotionCard component is not rendering or receiving the expected props. The component likely wasn't imported correctly, or the parent wrapper tests changed.

### 10. `src/pages/admin/__tests__/DinDinMenu.test.tsx` — 5 failures
**Primary pattern:** TestingLibraryElementError
1. `renders tab navigation` — found multiple `Danh muc` elements (duplicate)
2. `loads and displays categories` — cant find Tea in body
3-5. `add category modal` — cant find `+ Them danh muc` button

**Root cause:** The DinDinMenu page renders but the test data/API mock is not returning expected categories. Multiple `Danh muc` matches suggest a hydration or duplicate render issue.

### 11. `src/pages/admin/__tests__/GenerateQR.test.tsx` — 6 failures
**Primary pattern:** TestingLibraryElementError
1. `renders page title` — expected QR Codes, got empty
2. `renders zone filter` — cant find Zone: label
3. `filters tables by zone` — cant find zone filter
4. `shows print button` — cant find Print role=button
5. `QrCard renders table number` — cant find Occupied text
6. `QrCard shows status badge` — cant find Occupied text

**Root cause:** The GenerateQRPage renders but with empty/no data. Zone filter and table data are missing. Likely the page API call to fetch tables returns empty/404, so the page renders an empty state.

### 12. `worker/src/__tests__/routes/auth.test.ts` — 1 failure
**Primary pattern:** Wrong status code
1. `registerUser rejects invalid email` — expected 400, got **201**

**Root cause:** Auth route no longer validates email format before creating the user. The Zod validation schema for email was removed or the validation is bypassed.

### 13. `worker/src/__tests__/routes/birthday.test.ts` — 3 failures
**Primary pattern:** 404 instead of 400/200
1. `GET /check missing params` — expected 400, got **404**
2. `GET /check no customer` — expected 200 (eligible:false), got **404**
3. `POST /redeem missing body` — expected 400, got **404**

**Root cause:** Birthday route not mounted in app router (same 404 pattern).

### 14. `worker/src/__tests__/routes/checkin.test.ts` — 2 failures
**Primary pattern:** 404 instead of 400/200
1. `POST / missing body` — expected 400, got **404**
2. `GET /` — expected 200 + empty list, got **404**

### 15. `worker/src/__tests__/routes/cron-integration.test.ts` — 4 failures
**Primary pattern:** Missing export
1. `exports runCampaignTriggers` — got `undefined` instead of function
2. `runCampaignTriggers returns counts` — TypeError: cron.runCampaignTriggers is not a function
3. `exports existing cron functions` — expected to include `runCampaignTriggers` in exports, it is missing
4. `index registration` — `runCampaignTriggers` is not importable from routes/cron

**Root cause:** The `runCampaignTriggers` function was not added to `worker/src/routes/cron.ts` exports (or was removed). Only 3 of 4 existing cron functions are exported, missing the new one.

### 16. `worker/src/__tests__/routes/customers.test.ts` — 2 failures
**Primary pattern:** 404 instead of 200/401
1. `GET /` — expected 200 + empty list, got **404**
2. `GET /segments` missing auth — expected 401, got **404**

### 17. `worker/src/__tests__/routes/guest-checkin.test.ts` — 5 failures
**Primary pattern:** 404 everywhere
All 5 tests return 404. Valid input expected 201, got 404. Missing fields expected 400, got 404.

**Root cause:** Guest check-in route `/api/orders/guest-checkin` not mounted in orders router.

### 18. `worker/src/__tests__/routes/orders-hono.test.ts` — 3 failures
**Primary pattern:** 404 on all POST /checkout and POST /guest-checkin
1. `POST /checkout` valid — expected 201, got **404**
2. `POST /checkout` empty items — expected 400, got **404**
3. `POST /guest-checkin` — expected 201, got **404**

**Root cause:** Despite being named "orders-hono", the customer-facing mount point `/api/orders` returns 404. The orders Hono router was either not mounted at all, or mounted at a different path.

### 19. `worker/src/__tests__/routes/orders.test.ts` — 1 failure
**Primary pattern:** Wrong status
1. `createOrder rejects invalid payment` — expected 400, got **201**

**Root cause:** Payment method validation in orders route was removed or bypassed. Orders now accept any payment method string.

### 20. `worker/src/__tests__/routes/staff-auth-mobile.test.ts` — 6 failures
**Primary pattern:** Wrong status codes across auth flow
1. `registerStaffDevice staff not in KV` — expected 404, got **400**
2. `registerStaffDevice owner registering` — expected 201, got **404**
3. `registerStaffDevice waiter registers` — expected 403, got **201** (security bypass!)
4. `registerStaffDevice staff registers` — expected 403, got **400**
5. `registerStaffDevice manager registers owner device` — expected 403, got **201** (security bypass!)
6. `registerStaffDevice customer token` — expected 403, got **400**

**Root cause:** Staff auth mobile route handler has broken role-based access control. Waiter and manager can register devices they should not be able to. The role check logic is either missing or checking the wrong field.

---

## Root Cause Summary

**Two distinct breakages from commit 03c59e1:**

1. **Route mounting failure (28 tests):** Every worker route test that depends on the Hono app router returning 404. The routes exist in individual files but are not being registered/mounted in the main app. This is the single biggest failure cluster.

2. **Source-level regressions:**
   - `qrRouter` undefined — QR router removed or export changed
   - `runCampaignTriggers` not exported — cron.ts incomplete
   - Staff auth RBAC broken — role checks not enforcing permissions
   - Payment validation removed — orders accept invalid methods
   - Email validation removed — registerUser accepts any email
   - Error messages translated to Vietnamese — tests expect English

3. **Frontend component tests (20 failures):** TestingLibraryElementError across promotion-card, DinDinMenu, and GenerateQR pages. Component either not rendering correctly or test mocks not loading data.

**Resolution priority:** Fix the route mounting issue first (28 tests), then address the 4 qrRouter failures, then the cron export, then the auth RBAC regression.
