# Admin UI vs Backend API Mismatch Audit

**Date:** 2026-08-19  
**Scope:** 8 admin stores (`src/hooks/stores/admin/`) vs backend routes (`worker/src/routes/` + `worker/src/index.ts`)  
**Method:** Cross-reference every endpoint, query param, and response key.

---

## Findings (7 total, sorted by severity)

### F1 — CRITICAL: Audit store reads `body.entries`, backend returns `body.rows`
- **Frontend:** `use-audit-store.ts:76` — `entries: body.entries || []`
- **Backend:** `admin-audit-logs.ts:101-107` — `{ rows: [...], total, page, pageSize, totalPages }`
- **Impact:** Audit log list always renders empty. Data exists in DB but the key mismatch means zero rows display. The `body.total` fallback on line 77 also silently falls to 0.
- **Fix:** Change `body.entries` to `body.rows` and `body.total` remains correct.

### F2 — CRITICAL: Audit store sends camelCase query params, backend expects snake_case
- **Frontend:** `use-audit-store.ts:68-72` — sends `actorId`, `resourceType`, `dateFrom`, `dateTo`, `pageSize`
- **Backend:** `admin-audit-logs.ts:54-60` — reads `actor_id`, `resource_type`, `date_from`, `date_to`, `page_size`
- **Impact:** All filter parameters (except `action` and `page`) are silently ignored by the backend. Users can type filters in the UI but nothing actually filters. Only pagination `page` works because both sides use `page`.
- **Fix:** Frontend must send snake_case param names: `actor_id`, `resource_type`, `date_from`, `date_to`, `page_size`.

### F3 — CRITICAL: Reservations store calls `/api/admin/reservations` — route does not exist
- **Frontend:** `use-admin-reservations-store.ts:35` — `apiFetch('/api/admin/reservations')`
- **Backend:** `index.ts:271` — `app.route('/api/reservations', reservationsRouter)` (no `/admin` prefix)
- **Impact:** Every call returns 404. Admin reservations page is completely broken. No data loads, approve/reject buttons fail.
- **Fix:** Either mount reservations under `/api/admin/reservations` in backend, or change the frontend store to call `/api/reservations`.

### F4 — HIGH: Reservations approve/reject endpoints don't exist in backend
- **Frontend:** `use-admin-reservations-store.ts:49,62` — PATCH `/api/admin/reservations/{id}/approve` and `/{id}/reject`
- **Backend:** `reservations.ts` only has GET `/`, POST `/`, GET `/availability`, DELETE `/:id`. No approve/reject PATCH routes.
- **Impact:** Even if F3 is fixed, approve/reject buttons return 404. The backend only supports DELETE (cancel).
- **Fix:** Add PATCH `/:id/approve` and `/:id/reject` routes in `reservations.ts`, or rewire the frontend to use existing endpoints.

### F5 — HIGH: Customers store reads `body.customers`, backend returns `body.data`
- **Frontend:** `use-admin-customers-store.ts:28` — `customers: body.customers || []`
- **Backend:** `index.ts:201` — `{ success: true, data: results, pagination: { page, limit, total } }`
- **Impact:** Customer list always renders empty. Also `body.totalCount` does not exist; backend returns `body.pagination.total`.
- **Fix:** Change `body.customers` to `body.data` and `body.totalCount` to `body.pagination?.total`.

### F6 — HIGH: Customers store sends `search` param, backend ignores it
- **Frontend:** `use-admin-customers-store.ts:24` — `params.set('search', search)`
- **Backend:** `index.ts:192-201` — Only reads `page` and `limit`. No search support in SQL query.
- **Impact:** Customer search is non-functional. UI shows a search box but it does nothing.
- **Fix:** Add `search` param support to the backend SQL (search by name/phone/email), or remove the search UI.

### F7 — HIGH: Orders store sends `payment` param, backend expects `payment_status`
- **Frontend:** `use-admin-orders-store.ts:32` — `params.set('payment', filters.payment)`
- **Backend:** `admin-orders.ts:15` — `url.searchParams.get('payment_status')`
- **Impact:** Payment status filter is silently ignored. Users can filter by payment status in UI but it has no effect.
- **Fix:** Change frontend param name from `payment` to `payment_status`.

---

## Stores That Match Correctly

| Store | Status |
|-------|--------|
| `use-admin-staff-store` | OK — `/api/auth/staff` and `/api/auth/register-staff` both exist in backend with correct auth |
| `use-admin-shifts-store` | OK — all 4 endpoints (`/api/shifts/today`, `/api/shifts`, `/api/shifts/clock-in`, `/api/shifts/clock-out`) match backend with correct response shapes |
| `use-metrics-store` | OK — `/api/admin/metrics` with `range` and `filter` params match backend |
| `use-performance-store` | OK — uses `/api/admin/metrics` with web-vital filters, backend supports the `filter` query param |

---

## Summary

- **7 mismatches found** across 4 stores (audit, reservations, customers, orders)
- **3 are CRITICAL** (data literally cannot display): audit key mismatch, audit param mismatch, reservations wrong URL
- **4 are HIGH** (features silently broken): reservations missing endpoints, customers key mismatch, customers search non-functional, orders payment filter wrong param
- **4 stores are correct**: staff, shifts, metrics, performance

Unresolved questions:
- Was `/api/admin/reservations` intentionally omitted from the backend, or is it a missing mount?
- Should the backend add search support for customers, or is the UI search box premature?
