# Phase 13: OpenAPI Auth Password Verification, Auth Tree Hardening & Order/Catalog 500 Sanitization

## Context Links
- [Master Audit Plan](plan.md)
- [Phase 12: Auth OTP/PIN, Shift & Chat Hardening](phase-12-auth-otp-pin-shift-reconciliation-and-chat-hardening.md)
- `worker/src/routes/openapi-auth-handlers/helpers.ts`
- `worker/src/routes/openapi-auth-handlers/device-handlers.ts`
- `worker/src/routes/openapi-auth-handlers/routes.ts`
- `worker/src/tree/auth/bootstrap.ts`
- `worker/src/tree/auth/change-password.ts`
- `worker/src/routes/auth-endpoints.ts`
- `packages/domain/order/`
- `packages/domain/catalog/queries/menu.ts`

---

## Overview
- **Priority:** P1 (High — Broken OpenAPI Password Verification, Logged Reset OTP, Unauthenticated Owner PII Leak, Revoked Token Password Change & 500 SQL Leaks)
- **Current Status:** Complete
- **Brief Description:** Fix broken password hashing/verification in OpenAPI auth helpers (`helpers.ts`) by delegating to PBKDF2 (`lib/jwt.ts`), replace `Math.random()` and scrub plaintext reset OTP from logs in `device-handlers.ts`, allow authenticated `customer` role on self-service OpenAPI auth routes (`routes.ts`), remove unauthenticated `existing_owner` PII leak in `bootstrapOwner`, enforce revoked-token checks in `changePassword`, add `authRateLimit` with KV fault isolation to `/bootstrap-owner`, and scrub raw `(error as Error).message` from HTTP 500 responses across `worker/src/tree/auth/*.ts`, `packages/domain/order/`, and `packages/domain/catalog/queries/menu.ts`.

---

## Key Insights (Verified by Code Inspection)
1. **Broken Password Verification, Logged Reset Code & Customer Lockout in OpenAPI Auth (`worker/src/routes/openapi-auth-handlers/`)**:
   - `helpers.ts:6-22`: `hashPassword` computes `SHA-256(password + 'aura_salt_' + crypto.randomUUID())` and returns only the 64-char hex digest without storing the salt, while `verifyPassword` slices `hash.slice(0, 36)` (digest chars, not the UUID salt) to recompute the hash. As a result, `verifyPassword(password, await hashPassword(password))` **always returns `false`**.
   - `device-handlers.ts:19-28`: Generates password reset codes with `Math.random()` and logs the plaintext `code` via `log.info('password_reset_code_generated', { email: body.email, code })`.
   - `routes.ts:17`: Middleware applies `requireAuth(['owner', 'manager', 'staff'])` to all protected `/api/auth/*` endpoints, blocking authenticated `'customer'` accounts from `/me`, `/logout`, `/session`, `/change-password`, and `/devices`.
2. **Auth Tree Owner PII Leak, Revoked Token Bypass & 500 Leaks (`worker/src/tree/auth/*.ts`, `worker/src/routes/auth-endpoints.ts`)**:
   - `bootstrap.ts:20-25`: Returns `existing_owner: existingOwner` (`{ email, name, created_at }`) on HTTP 409 to unauthenticated callers when an owner already exists.
   - `auth-endpoints.ts:21-40`: `authRateLimit` lacks KV error isolation and is omitted on `POST /bootstrap-owner`.
   - `change-password.ts:27-33`: Does not check `authKV.get(\`revoked:${token}\`)`, allowing a logged-out JWT to change a user's password.
   - All 9 files in `worker/src/tree/auth/` leak raw `${(error as Error).message}` on HTTP 500.
3. **Order & Catalog Domain 500 Leaks (`packages/domain/order/`, `packages/domain/catalog/queries/menu.ts`)**:
   - `admin-orders.ts:77`, `get-order.ts:41`, `stats.ts:83`, `latest-timestamp.ts:15`, `split-orders.ts:148`, `update-order.ts:265`, `create-order.ts:189`, and `menu.ts:77,101` append raw `${(error as Error).message}` to HTTP 500 responses.

---

## Requirements

### Functional Requirements
1. Delegate `hashPassword` and `verifyPassword` in `worker/src/routes/openapi-auth-handlers/helpers.ts` to PBKDF2 (`../../lib/jwt`), use CSPRNG and remove plaintext `code` logging in `device-handlers.ts`, and include `'customer'` in `routes.ts` `requireAuth`.
2. Remove `existing_owner` from `bootstrapOwner` 409 response (`worker/src/tree/auth/bootstrap.ts`), add KV-safe `authRateLimit` to `/bootstrap-owner` (`worker/src/routes/auth-endpoints.ts`), check `revoked:${token}` in `changePassword` (`worker/src/tree/auth/change-password.ts`), and scrub raw 500 error details across all 9 files in `worker/src/tree/auth/`.
3. Scrub raw `${(error as Error).message}` from HTTP 500 responses in `packages/domain/order/queries/*.ts`, `packages/domain/order/commands/*.ts`, and `packages/domain/catalog/queries/menu.ts`.

### Non-Functional Requirements
- Maintain 100% compatibility with existing unit and integration tests.
- Respect strict git state preservation (no `git reset`, `git stash`, `git commit`, `git push`, or live deployment).

---

## Related Code Files
- **Modify:**
  - `worker/src/routes/openapi-auth-handlers/helpers.ts`
  - `worker/src/routes/openapi-auth-handlers/device-handlers.ts`
  - `worker/src/routes/openapi-auth-handlers/routes.ts`
  - `worker/src/routes/auth-endpoints.ts`
  - `worker/src/tree/auth/bootstrap.ts`
  - `worker/src/tree/auth/change-password.ts`
  - `worker/src/tree/auth/current-user.ts`
  - `worker/src/tree/auth/list-staff.ts`
  - `worker/src/tree/auth/login.ts`
  - `worker/src/tree/auth/logout.ts`
  - `worker/src/tree/auth/register-staff.ts`
  - `worker/src/tree/auth/register.ts`
  - `worker/src/tree/auth/reset-password.ts`
  - `packages/domain/order/queries/admin-orders.ts`
  - `packages/domain/order/queries/get-order.ts`
  - `packages/domain/order/queries/stats.ts`
  - `packages/domain/order/queries/latest-timestamp.ts`
  - `packages/domain/order/commands/split-orders.ts`
  - `packages/domain/order/commands/update-order.ts`
  - `packages/domain/order/commands/create-order.ts`
  - `packages/domain/catalog/queries/menu.ts`
  - `tests/auth.test.ts`
  - `worker/src/__tests__/tree/orders/create-order.test.ts`
  - `worker/src/__tests__/routes/menu.test.ts`

---

## Implementation Steps
1. **OpenAPI Auth Hardening (`helpers.ts`, `device-handlers.ts`, `routes.ts`)**:
   - In `helpers.ts`, delegate `hashPassword` and `verifyPassword` to `../../lib/jwt`.
   - In `device-handlers.ts`, generate 6-digit reset OTP via `crypto.getRandomValues` and remove `code` from `log.info`.
   - In `routes.ts`, allow `'customer'` role in `requireAuth(['owner', 'manager', 'staff', 'customer'])`.
2. **Auth Tree & Endpoints Hardening (`worker/src/tree/auth/*.ts`, `auth-endpoints.ts`)**:
   - Remove `existing_owner` from `bootstrap.ts` 409 payload.
   - Check `authKV.get(\`revoked:${token}\`)` in `change-password.ts`.
   - Wrap `authRateLimit` KV access in `try/catch` and attach `authRateLimit` to `/bootstrap-owner` in `auth-endpoints.ts`.
   - Remove `: ${(error as Error).message}` from HTTP 500 responses in all 9 `worker/src/tree/auth/*.ts` handlers.
3. **Order & Catalog 500 Sanitization (`packages/domain/order/`, `packages/domain/catalog/queries/menu.ts`)**:
   - Remove `: ${(error as Error).message}` from HTTP 500 responses in `admin-orders.ts`, `get-order.ts`, `stats.ts`, `latest-timestamp.ts`, `split-orders.ts`, `update-order.ts`, `create-order.ts`, and `menu.ts`.
4. **Regression Tests**:
   - Add regression tests in `tests/auth.test.ts`, `worker/src/__tests__/tree/orders/create-order.test.ts`, and `worker/src/__tests__/routes/menu.test.ts`.

---

## Todo List
- [x] Fix OpenAPI auth password hashing/verification, CSPRNG reset OTP, log redaction, and customer RBAC
- [x] Harden `worker/src/tree/auth/*.ts` and `worker/src/routes/auth-endpoints.ts`
- [x] Scrub raw 500 error messages in `packages/domain/order/` and `packages/domain/catalog/queries/menu.ts`
- [x] Add regression tests in `tests/auth.test.ts`, `create-order.test.ts`, and `menu.test.ts`
- [x] Run `npm run lint`, `npm run typecheck:all`, `npm run verify:gates`, and `npx vitest run`

---

## Success Criteria
- `verifyPassword(password, await hashPassword(password))` in `openapi-auth-handlers/helpers.ts` returns `true` using PBKDF2-SHA256.
- `bootstrapOwner` 409 response does not leak `existing_owner` PII.
- Revoked JWTs are rejected with `401` on `changePassword`.
- Zero raw `(error as Error).message` leaks on HTTP 500 across `worker/src/tree/auth/*.ts`, `packages/domain/order/`, and `packages/domain/catalog/queries/menu.ts`.
