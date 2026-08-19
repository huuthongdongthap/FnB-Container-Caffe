# UI/UX vs Backend Logic Audit — SOX Report

**Date:** 2026-08-19 | **Scope:** Admin stores + Backend routes | **Status:** ✅ All 7 fixes applied

---

## Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| CRITICAL | 3 | 3 |
| HIGH | 4 | 4 |

---

## Fixes Applied

### CRITICAL (3)

| ID | Issue | Fix |
|----|-------|-----|
| F1 | Audit store reads `body.entries`, backend returns `body.rows` | Changed to `body.rows` |
| F2 | Audit store sends camelCase params, backend expects snake_case | Changed to `actor_id`, `resource_type`, `date_from`, `date_to`, `page_size` |
| F3 | Reservations store calls `/api/admin/reservations` (404) | Changed to `/api/reservations` |

### HIGH (4)

| ID | Issue | Fix |
|----|-------|-----|
| F4 | Reservations approve/reject PATCH endpoints don't exist | Added `PATCH /:id/approve` and `PATCH /:id/reject` routes |
| F5 | Customers store reads `body.customers`, backend returns `body.data` | Changed to `body.data` with `body.pagination?.total` fallback |
| F6 | Customers search param ignored by backend | Added `search` param support with LIKE query on name/phone/email |
| F7 | Orders store sends `payment` param, backend expects `payment_status` | Changed to `payment_status` |

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/stores/admin/use-audit-store.ts` | F1: `body.entries` → `body.rows`, F2: camelCase → snake_case params |
| `src/hooks/stores/admin/use-admin-reservations-store.ts` | F3: `/api/admin/reservations` → `/api/reservations` |
| `src/hooks/stores/admin/use-admin-customers-store.ts` | F5: `body.customers` → `body.data`, `body.totalCount` → `body.pagination?.total` |
| `src/hooks/stores/admin/use-admin-orders-store.ts` | F7: `payment` → `payment_status` |
| `worker/src/index.ts` | F6: Added search param support to `/api/admin/customers` |
| `worker/src/routes/reservations.ts` | F4: Added `PATCH /:id/approve` and `PATCH /:id/reject` routes |

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx vite build --mode production` | ✅ Built in 3.25s |
| Frontend deploy | ✅ `e5b42ec9.fnb-caffe-container.pages.dev` |
| Worker deploy | ✅ `f0ca3f08` |

---

## Stores Verified Clean

| Store | Status |
|-------|--------|
| use-admin-staff-store | ✅ |
| use-admin-shifts-store | ✅ |
| use-metrics-store | ✅ |
| use-performance-store | ✅ |

---

*Report generated: 2026-08-19 22:58 ICT*
