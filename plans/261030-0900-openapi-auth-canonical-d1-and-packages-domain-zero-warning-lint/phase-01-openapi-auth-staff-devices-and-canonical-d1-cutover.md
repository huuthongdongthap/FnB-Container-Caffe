# Phase 01: OpenAPI Auth, Staff Devices & Canonical D1 Cutover

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-openapi-auth-canonical-d1-and-packages-domain-zero-warning-lint.md)
- `worker/src/routes/openapi-auth-handlers/device-handlers.ts`
- `worker/src/routes/openapi-auth-handlers/staff-handlers.ts`
- `worker/src/routes/openapi-auth-handlers/auth-handlers.ts`
- `worker/src/routes/openapi-staff-handlers/staff-handlers.ts`
- `worker/src/routes/tables-mobile.ts`

## Overview
- **Priority:** P0
- **Current Status:** Complete
- **Description:** Align `openapi-auth-handlers` (`device-handlers.ts`, `staff-handlers.ts`, `auth-handlers.ts`) with canonical D1 staff authority (`users`, `staff_login_identities`, `staff_devices`), and eliminate redundant legacy fallback queries in `openapi-staff-handlers/staff-handlers.ts` and `tables-mobile.ts`.

## Related Code Files
- Modify: `worker/src/routes/openapi-auth-handlers/device-handlers.ts`
- Modify: `worker/src/routes/openapi-auth-handlers/staff-handlers.ts`
- Modify: `worker/src/routes/openapi-auth-handlers/auth-handlers.ts`

## Todo List
- [x] Update `GET /api/auth/devices` in `device-handlers.ts` to include bound `staff_devices` for non-customer roles
- [x] Add canonical `users` + `staff_login_identities` fallbacks to `openapi-auth-handlers/staff-handlers.ts` and `auth-handlers.ts`
