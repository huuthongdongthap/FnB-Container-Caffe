# Phase 01 Report — ERPNext REST API Client TDD

**Status:** Completed  
**Plan:** `plans/260630-1948-erpnext-migration/`
**Phase file:** `phase-01-erpnext-client-tdd.md`

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `tests/erpnext-client.test.js` | 621 | 45 tests covering all CRUD, auth, error, retry, search, doctype operations |
| `worker/src/clients/erpnext-client.js` | 284 | ErpnextClient class + factory, 3 error classes, full REST wrapper |

## Files Modified

None (new files only). Existing Odoo files untouched.

## Test Results

| Suite | Status |
|-------|--------|
| `tests/erpnext-client.test.js` | 45/45 passed |
| Full suite (28 suites) | 904/904 passed, 18 skipped (all existing) |
| Regression | None detected |

### Test Coverage (45 tests)

- **Constructor & Factory (6):** valid config, trailing slash strip, missing env vars (URL, API key, secret), all env vars present
- **Authentication (3):** Authorization header format, Content-Type for POST, getAuthHeader
- **CRUD (8):** POST create, GET read, PUT update, DELETE delete, list with fields, list with filters (JSON string), list with pagination, list with no params
- **searchModified (5):** .0 timestamp suffix appended, not duplicated when already present, default fields, custom fields, default limit 100
- **Error Handling (9):** exc_type response, exc_type + status check, exc field (alt format), 401, 403, network error, malformed JSON, timeout, empty response body
- **Retry Logic (6):** 429 retry succeeds, 5xx retry succeeds, max retries exhausted, network retry succeeds, 400 not retried, 401 not retried
- **Error Classes (4):** ErpnextError (status+excType), ErpnextError default excType, NetworkError (cause), MalformedResponseError (body)
- **Specific Doctypes (3):** createInvoice, getProductAvailability (item+bin), missing item handling

## Lint Results

- `worker/src/clients/erpnext-client.js` — 0 lint errors
- `tests/erpnext-client.test.js` — false-positive `no-undef` for jest globals (pre-existing in all test files, missing `jest: true` in ESLint env)

## Implementation Details

### ErpnextClient (`worker/src/clients/erpnext-client.js`)

- **Auth:** `Authorization: token {api_key}:{api_secret}` header on every request
- **CRUD:** `POST/GET/PUT/DELETE /api/resource/{doctype}` with `encodeURIComponent` for doctype/name
- **List:** `GET /api/resource/{doctype}?fields=...&filters=...&limit_page_length=...&limit_start=...`
- **searchModified:** Appends `.0` to timestamp (required by ERPNext), default fields `[name, modified]`, limit 100
- **Retry:** Exponential backoff (base 1s, max 8s, jitter 25%) on 429/5xx/network errors, max 3 attempts
- **Timeout:** 10s AbortController timeout
- **Error parsing:** Handles `exc_type` + `_server_messages` (JSON parsed), `exc` (traceback string), or HTTP status
- **Factory:** `createErpnextClient(env)` returns null when any of `ERPNEXT_URL`, `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET` is missing

### Error Classes

| Class | Properties |
|-------|------------|
| `ErpnextError` | message, status (default 500), excType (default '') |
| `NetworkError` | message, cause (default null) |
| `MalformedResponseError` | message, body (default null) |

## Success Criteria Checklist

- [x] `tests/erpnext-client.test.js` — 45/45 pass
- [x] `tests/odoo-client.test.js` — still pass (Odoo files untouched)
- [x] `npm test` — 904/904 pass, no regression
- [x] Implementation file — 0 lint errors

## Next Phase

Phase 02: Refactor routes (odoo*.js -> erpnext*.js) depends on this client being available. All required exports are in place.
