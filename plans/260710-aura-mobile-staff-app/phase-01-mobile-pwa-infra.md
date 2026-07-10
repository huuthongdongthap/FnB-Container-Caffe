# Phase 1: Staff Roles & Mobile Auth

**Duration:** 2h | **Agents:** backend-device, frontend-device

## Context

Staff currently access everything via `/admin/*` routes (desktop-only UI, owner role required). Mobile staff app needs lighter auth (PIN per device) and fine-grained roles.

## Requirements

1. D1 migration adds `role` column to `staff` table: `owner | manager | staff | waiter`
2. New `staff-auth.ts` with:
   - `POST /mobile/login` — PIN-based, returns JWT with role claim
   - `GET /mobile/me` — current staff info + role
   - `POST /mobile/refresh` — token refresh
3. `staff-roles.ts` constants: `ROLES = ['owner','manager','staff','waiter']`, `ROLE_PERMISSIONS` map
4. Middleware: `requireStaff(roles?)` extends existing `requireAuth`

## Files

- `worker/db/migrations/260710_staff_roles.sql`
- `worker/src/routes/staff-auth.ts` (new)
- `worker/src/lib/staff-roles.ts` (new)
- `worker/src/middleware/staff-auth.ts` (new)
- `worker/src/index.ts` (mount at line ~100)

## Dependencies

- Existing `workers/src/routes/auth.ts` patterns (registerStaff, listStaff)
- Existing JWT secret (`JWT_SECRET`)
- Existing `staff` table (check schema)

## Tests

- Valid role assignment + lookup
- staff-auth.ts: login with valid/invalid PIN, token refresh, role claims in JWT
- RBAC: waiter cannot access manager endpoints (negative test)
