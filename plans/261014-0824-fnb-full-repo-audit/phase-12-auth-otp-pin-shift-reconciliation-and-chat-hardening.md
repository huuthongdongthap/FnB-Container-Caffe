# Phase 12: Auth OTP/PIN Brute-Force Lockout, Shift Reconciliation RBAC & Chat/Domain 500 Sanitization

## Context Links
- [Master Audit Plan](plan.md)
- [Phase 11: Home Assistant, Mobile & Pretix Hardening](phase-11-homeassistant-mobile-pretix-and-integration-hardening.md)
- `worker/src/routes/auth-register.ts`
- `worker/src/routes/auth-verify.ts`
- `packages/domain/staff/commands/staff-auth.ts`
- `packages/domain/shift/src/routes/reconciliation.ts`
- `packages/domain/shift/commands/shifts.ts`
- `worker/src/routes/chat.ts`

---

## Overview
- **Priority:** P1 (High — OTP & Staff PIN Brute-Force Lockout, Unauthenticated Shift Reconciliation, Email HTML Injection & 500 Leaks)
- **Current Status:** Complete
- **Brief Description:** Enforce `AUTH_KV` brute-force attempt lockouts on 6-digit email verification OTPs (`auth-verify.ts`) and 4–6 digit staff mobile PINs (`staff-auth.ts`), HTML-escape user-supplied names in verification emails (`auth-register.ts`), enforce `owner`/`manager`/`staff` RBAC on shift cash reconciliation routes (`reconciliation.ts`, `shifts.ts`), add IP + phone rate limiting with KV fault isolation on chat messages (`chat.ts`), and scrub raw `(err as Error).message` from HTTP 500 responses across all modified handlers.

---

## Key Insights (Verified by Code Inspection)
1. **Email Verification OTP Brute-Force, HTML Injection & 500 Leaks (`worker/src/routes/auth-register.ts:59,81`, `worker/src/routes/auth-verify.ts:32,65`)**:
   - `auth-register.ts:59` interpolates user-supplied `name` unescaped into the verification email HTML (`<p>Chào ${name || 'bạn'},</p>`), enabling HTML/phishing injection.
   - `auth-verify.ts:32` checks `record.code !== code` for a 6-digit OTP without tracking failed attempts per email in `AUTH_KV` or invalidating the code after repeated failures.
   - Both handlers return raw `(error as Error).message` on HTTP 500.
2. **Staff Mobile PIN Brute-Force & 500 Leaks (`packages/domain/staff/commands/staff-auth.ts:100-104, 129, 154, 195, 229, 266`)**:
   - `staffMobileLogin` (`POST /api/mobile/login`) verifies a 4–6 digit PIN against `device.pin_hash` with zero attempt throttling or lockout per `device_token` in `AUTH_KV`.
   - All five handlers (`staffMobileLogin`, `staffTokenRefresh`, `registerStaffDevice`, `revokeStaffDevice`, `listStaffDevices`) leak raw `(err as Error).message` on HTTP 500.
3. **Shift Reconciliation Unauthenticated GET, Missing Role Check & Shift 500 Leak (`packages/domain/shift/src/routes/reconciliation.ts:18-62`, `packages/domain/shift/commands/shifts.ts:15-118`)**:
   - `GET /api/shifts/:id/reconciliation` has no authentication or role check at all, and `POST /api/shifts/:id/reconcile` only checks `if (!user)` without verifying role (`['owner', 'manager', 'staff']`).
   - `shifts.ts:44` leaks `detail: e?.message || String(e)` on HTTP 500, omits `'manager'` from `requireAuth(['owner', 'staff'])`, and lacks `try/catch` in `/clock-out`, `/today`, and `/`.
4. **Chat Rate-Limit Phone-Rotation Bypass, KV Fault Crash & Raw 500 Leaks (`worker/src/routes/chat.ts:29-128`)**:
   - `sendMessage` only rate-limits by JSON body `phone` (`msg:${phone}`) without IP-based throttling, crashes if `AUTH_KV` is missing/throws, omits `'manager'` from `requireAuth` on `/conversations` and `/messages/:phone`, and leaks raw `(error as Error).message` on HTTP 500.

---

## Requirements

### Functional Requirements
1. Escape HTML characters in `name` in `worker/src/routes/auth-register.ts`, enforce a 5-attempt brute-force lockout per email in `worker/src/routes/auth-verify.ts` (deleting the OTP record on the 5th failed attempt and returning `429`), and scrub raw 500 error details in both files.
2. Enforce a 5-attempt failed PIN lockout (`pin_lockout:${device_token}`, 300s TTL in `AUTH_KV`, returning `429`) in `staffMobileLogin` (`packages/domain/staff/commands/staff-auth.ts`), and scrub raw 500 error messages across all 5 handlers in `staff-auth.ts`.
3. Enforce `owner`/`manager`/`staff` RBAC on `POST /api/shifts/:id/reconcile` and `GET /api/shifts/:id/reconciliation` in `packages/domain/shift/src/routes/reconciliation.ts`, include `'manager'` in `shiftsRouter` `requireAuth` (`packages/domain/shift/commands/shifts.ts`), and sanitize HTTP 500 responses in both files.
4. Add IP + phone rate limiting with KV error isolation in `worker/src/routes/chat.ts`, include `'manager'` in `requireAuth(['owner', 'manager', 'staff'])`, and sanitize HTTP 500 responses.

### Non-Functional Requirements
- Maintain 100% compatibility with existing unit and integration tests (`auth.test.ts`, `staff-auth-mobile.test.ts`, `shifts.test.ts`, `cash-reconciliation.test.ts`, `chat.test.ts`).
- Respect strict git state preservation (no `git reset`, `git stash`, `git commit`, `git push`, or live deployment).

---

## Related Code Files
- **Modify:**
  - `worker/src/routes/auth-register.ts`
  - `worker/src/routes/auth-verify.ts`
  - `packages/domain/staff/commands/staff-auth.ts`
  - `packages/domain/shift/src/routes/reconciliation.ts`
  - `packages/domain/shift/commands/shifts.ts`
  - `worker/src/routes/chat.ts`
  - `worker/src/__tests__/routes/auth.test.ts`
  - `worker/src/__tests__/routes/staff-auth-mobile.test.ts`
  - `worker/src/__tests__/shifts/cash-reconciliation.test.ts`
  - `worker/src/__tests__/routes/chat.test.ts`

---

## Implementation Steps
1. **Auth Registration & Email Verification Hardening (`auth-register.ts`, `auth-verify.ts`)**:
   - Add `escapeHtml()` helper in `auth-register.ts` and sanitize `name` before interpolating into email HTML; replace raw `(error as Error).message` on 500 with `'Đăng ký thất bại'`.
   - In `auth-verify.ts`, track failed attempts in `authKV` under `verify_attempts:${email}` (TTL 600s). When attempts reach 5, delete the verification code in D1 and return `429`; clear counter on valid verification; replace raw `(error as Error).message` on 500 with `'Xác thực thất bại'`.
2. **Staff Mobile Auth PIN Lockout & 500 Sanitization (`packages/domain/staff/commands/staff-auth.ts`)**:
   - In `staffMobileLogin`, check `c.env.AUTH_KV.get(\`pin_lockout:${device_token}\`)`; if `>= 5`, return `429`. On PIN mismatch, increment `pin_lockout:${device_token}` with 300s TTL (returning `429` if attempts reach 5). On success, delete `pin_lockout:${device_token}`.
   - Replace raw `(err as Error).message` in 500 responses across all 5 functions in `staff-auth.ts`.
3. **Shift Reconciliation & Shifts Router Hardening (`reconciliation.ts`, `shifts.ts`)**:
   - In `reconciliation.ts`, validate `user` (`401` if absent, `403` if `!['owner', 'manager', 'staff'].includes(user.role)`) on both `POST /api/shifts/:id/reconcile` and `GET /api/shifts/:id/reconciliation`, and wrap both handlers in `try/catch` with sanitized 500 messages.
   - In `shifts.ts`, update `requireAuth(['owner', 'manager', 'staff'])` on all 4 routes, remove `detail` leak on `/clock-in` 500, and wrap `/clock-out`, `/today`, and `/` in `try/catch`.
4. **Chat Router Hardening (`worker/src/routes/chat.ts`)**:
   - Guard `checkRateLimit` with `try/catch` and null-safe `env?.AUTH_KV`.
   - Rate-limit `sendMessage` by client IP (`ip:${clientIp}`, 20/min) in addition to `msg:${phone}` (10/min).
   - Add `'manager'` to `requireAuth(['owner', 'manager', 'staff'])` on `/conversations` and `/messages/:phone`, and sanitize 500 responses.
5. **Regression Tests**:
   - Add tests in `auth.test.ts`, `staff-auth-mobile.test.ts`, `cash-reconciliation.test.ts`, and `chat.test.ts`.

---

## Todo List
- [x] Harden `worker/src/routes/auth-register.ts`, `worker/src/routes/auth-verify.ts`, and `worker/src/tree/auth/email-verification.ts`
- [x] Harden `packages/domain/staff/commands/staff-auth.ts` with PIN brute-force lockout and 500 sanitization
- [x] Harden `packages/domain/shift/src/routes/reconciliation.ts` and `packages/domain/shift/commands/shifts.ts`
- [x] Harden `worker/src/routes/chat.ts` rate limiting, RBAC, and 500 sanitization
- [x] Add regression tests in `auth.test.ts`, `staff-auth-mobile.test.ts`, `cash-reconciliation.test.ts`, and `chat.test.ts`
- [x] Run `npm run lint`, `npm run typecheck:all`, `npm run verify:gates`, and `npx vitest run` (436 test files, 3,955 tests passed)

---

## Success Criteria
- HTML characters in `name` during `registerWithVerification` are escaped in outgoing verification emails.
- 5 failed OTP attempts in `verifyEmail` invalidate the verification code and return `429`.
- 5 failed PIN attempts in `staffMobileLogin` lock out the device token in `AUTH_KV` and return `429`.
- Unauthenticated or `customer`-role calls to `POST /api/shifts/:id/reconcile` and `GET /api/shifts/:id/reconciliation` return `401`/`403`.
- Zero raw `(err as Error).message` leaks on HTTP 500 across `auth-register.ts`, `auth-verify.ts`, `staff-auth.ts`, `reconciliation.ts`, `shifts.ts`, and `chat.ts`.
