# Brainstorm Report: OpenAPI Auth Canonical D1 Cutover & `packages/domain` Zero-Warning ESLint Convergence

**Date:** 2026-10-30
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654`
**Predecessor Plan:** `plans/261030-0815-incremental-migration-parity-and-full-monorepo-zero-warning-lint`

---

## 1. Executive Summary & Empirical Findings

Following the completion of 3-way 124-table + column schema parity (`worker/schema.sql` == `db/schema.sql` == `createProductionReplica() + migrations`) and zero-warning ESLint across `worker/src/` and `src/`, a deep static and dynamic scan of the monorepo surfaced two remaining architectural and quality gaps:

### Gap 1: OpenAPI Auth & Staff Canonical D1 Authority & Device Parity
1. **`GET /api/auth/devices` ignores canonical `staff_devices` (`worker/src/routes/openapi-auth-handlers/device-handlers.ts:96-123`)**:
   - In `worker/src/index.ts`, `/api/auth/devices` is served exclusively by `openApiAuthRouter` (`device-handlers.ts`).
   - While `DELETE /api/auth/devices/{id}` (lines 138–152) and `DELETE /api/auth/devices` (lines 177–180) already support revoking staff mobile devices from canonical `staff_devices` (`WHERE staff_id = ?`) and bumping `users.auth_version`, `GET /api/auth/devices` only queries `trusted_devices WHERE user_id = ?`.
   - When `trusted_devices` is absent (as in `staffSessionFixture` / `paymentSqliteDB({ canonicalStaff: true })`) or when a staff user has mobile devices bound in `staff_devices`, `GET /api/auth/devices` returns `[]` instead of listing the staff member's bound `staff_devices`.
2. **`openapi-auth-handlers/staff-handlers.ts` & `auth-handlers.ts` lack canonical staff D1 fallbacks (`staffSessionFixture` compatibility & `staff_login_identities` sync)**:
   - `POST /api/auth/register-staff`, `GET /api/auth/staff`, and `POST /api/auth/bootstrap-owner` in `worker/src/routes/openapi-auth-handlers/staff-handlers.ts` query/insert optional customer columns (`locale`, `loyalty_tier`, `loyalty_points`, `email_verified`, `avatar_url`) and `sessions` without fallback to minimal canonical `users` (`id, name, role, phone, tenant_id, is_active, auth_version, password_hash, created_at, updated_at`) and `staff_login_identities`.
   - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, and `GET /api/auth/session` in `worker/src/routes/openapi-auth-handlers/auth-handlers.ts` query `users` by `email` and `sessions` without falling back to `staff_login_identities` or tolerating absent `sessions` / optional customer columns on minimal canonical staff D1 schemas.
3. **Redundant Legacy Table Queries After Canonical D1 Success**:
   - `worker/src/routes/openapi-staff-handlers/staff-handlers.ts:369-385` (`PATCH /api/staff/:id`): Unconditionally executes `UPDATE staff_users SET ... WHERE id = ?` even when `UPDATE users` already succeeded.
   - `worker/src/routes/tables-mobile.ts:87` (`GET /api/tables`): Runs `SELECT * FROM tables ORDER BY table_number ASC` whenever `cafeTablesTotalRows === 0` even if `cafe_tables` exists (`cafeTablesSucceeded === true`).

### Gap 2: `packages/domain` Excluded from ESLint Config & `npm run lint`
- `eslint.config.js` lines 20–21 already ignore `packages/**/__tests__/**` and `packages/**/*.test.ts`, proving `packages/` was intended to be linted, but line 119 only includes `files: ['worker/src/**/*.ts', 'src/**/*.{ts,tsx}']` and `package.json` `"lint"` only runs `eslint worker/src/ src/`.
- Adding `'packages/**/*.ts'` to `eslint.config.js` and `packages/ --max-warnings=0` to `package.json` expands lint coverage from 1,669 files to 1,859 files (+190 domain TypeScript files) and surfaces `0 errors, 27 warnings` (`@typescript-eslint/no-unused-vars`) across 19 files in `packages/domain/`.

---

## 2. Option Evaluation

| Option | Scope | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Option A (Recommended)** | 1) Canonical D1 cutover for `openapi-auth-handlers` (`device-handlers.ts`, `staff-handlers.ts`, `auth-handlers.ts`), `openapi-staff-handlers/staff-handlers.ts`, and `tables-mobile.ts`<br>2) Enable `'packages/**/*.ts'` in `eslint.config.js` and `package.json` (`--max-warnings=0`) and clean all 27 warnings across 19 files in `packages/domain/`<br>3) Add integration regression tests & sync `source-baseline.json` | Eliminates live `/api/auth/devices` staff device listing gap, ensures 100% canonical D1 compatibility across OpenAPI auth/staff handlers, removes spurious legacy fallback queries, and locks 0 ESLint warnings across all 1,859 files (`worker/src/`, `src/`, `packages/`). | Touches 25 files across `worker/src/` and `packages/domain/`. | **SELECTED** |
| **Option B** | Only clean ESLint warnings in `packages/domain/` | Fast mechanical cleanup | Leaves `GET /api/auth/devices` and `openapi-auth-handlers` canonical D1 gaps unresolved | Rejected |
| **Option C** | Only fix `openapi-auth-handlers` | Fixes route handlers | Leaves 190 `packages/domain/` files unlinted in CI | Rejected |

---

## 3. Unresolved Questions

None — all 19 files in `packages/domain/` and 5 route files in `worker/src/routes/` have been verified with exact line numbers and SQL column schemas.
