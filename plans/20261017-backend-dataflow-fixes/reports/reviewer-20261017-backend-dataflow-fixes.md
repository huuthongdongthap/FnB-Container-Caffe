# Code Review Report — Backend & Frontend Data-Flow Fixes (Phase 1–5)

**Date**: 2026-10-17
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Verdict**: PASS (0 TypeScript errors, 22/22 targeted test suites, 219/219 tests passed)

## Verified Findings & Resolutions

1. **Admin RBAC Least-Privilege (`worker/src/routes/features-router.ts:71-78`)**:
   - Scoped `['kitchen', 'barista', 'chef']` strictly to `/api/admin/orders` and `/api/admin/orders/*` while keeping all other `/api/admin/*` routes restricted to `['owner', 'manager', 'staff', 'admin']`.
2. **Admin Status Allowlist (`worker/src/routes/features-router.ts:89-92`)**:
   - Validated `status` against canonical order statuses (`pending`, `confirmed`, `preparing`, `ready`, `served`, `delivering`, `delivered`, `completed`, `cancelled`) and updated both `latest_order_ts` and `orders:latest_updated_at` in `AUTH_KV`.
3. **Shift Cash Reconciliation Input Validation (`packages/domain/shift/src/routes/reconciliation.ts:34-42`)**:
   - Added validation for `opening_float` (`typeof === 'number'`, `Number.isFinite`, `>= 0`) and `denominations` (`Array.isArray`), returning HTTP `400` on malformed requests while preserving HTTP `500` on D1 failures (`cash-reconciliation.test.ts:259`).
4. **Mobile Staff `/mobile/me` D1 Fallback (`worker/src/tree/auth/current-user.ts:31-64`)**:
   - Added D1 `SELECT id, email, name, phone, role FROM users WHERE id = ?` lookup when `!userStr && !payload.email && payload.id`, without writing duplicate `user:${id}` keys to `AUTH_KV` (preserving `auth.test.ts:249`).
5. **Admin Orders Table Mapping (`src/pages/admin/Orders.tsx:54-66`)**:
   - Mapped `table` from `table ?? table_id ?? table_number` in `mapAdminOrder` while preserving the `normalizeAdminOrder` contract in `use-admin-orders-store.test.ts:41`.

## Unresolved Questions
- None.
