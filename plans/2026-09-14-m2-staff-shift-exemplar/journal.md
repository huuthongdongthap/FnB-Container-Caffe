# M2 Staff & Shift Exemplar — Journal

**Status:** done · **Started:** 2026-09-14 · **Duration:** ~1 session (extract+migrate+delete in one nhịp)
**Lead:** phanmem.site AI · **Plan:** `plans/2026-09-14-m2-staff-shift-exemplar/`

## Outcome

- Staff domain extracted to `packages/domain/staff/` (auth/crypto, auth/pin, model/staff-types, policies/roles, routes/staff-auth, routes/staff-tips, barrel index).
- Shift domain extracted to `packages/domain/shift/` (model/shift-types, routes/shifts, barrel index).
- Legacy files deleted in the same beat with zero transitional shims: `worker/src/routes/staff-auth.ts`, `worker/src/routes/staff-tips.ts`, `worker/src/routes/shifts.ts`, `worker/src/lib/staff-roles.ts`.
- Direct caller migration across `worker/src/index.ts`, `worker/src/middleware/staff-auth.ts`, and test files.
- Full test suite green: 358 files / 3270 tests passed.
- tsc within established M1/M2 band (1317 errors, TS2307/TS6059/TS2305/TS2554, 0 new error classes).
- **Milestone 2 (M2) Core ERP domains extraction is officially complete** (Catalog, Order, Payment, Kitchen, Table, Staff, Shift).

## What went well

- **"Một Nhịp" standard sustained**: Direct extraction and caller migration with immediate shim deletion. No intermediate deprecation shims required.
- **Edge Web Crypto compliance**: Migrated mobile device PIN hashing from Node.js `crypto` dependencies to standard Web `crypto.subtle` (PBKDF2 SHA-256 with 100,000 iterations, 8-byte cryptographically secure salt). Ensures 100% native compatibility on Cloudflare Workers edge runtime.
- **Bilingual RBAC engine as pure policy**: Encoded roles (`owner`, `manager`, `staff`, `waiter`), role permissions, Vietnamese/English labels (`ROLE_LABELS`), and scoped role visibility (`visibleRolesFor`) into a standalone, testable policy package (`@aura/domain-staff`).
- **Shift invariants verified**: Preserved the single active shift per staff member per calendar day invariant (`clock_out IS NULL` on date `YYYY-MM-DD`) and worked hours calculation.

## What bit us & solutions

- **Ambient type collision during global tsc**: Running global `tsc` checks browser DOM typings against Cloudflare Worker edge types (`Env`, `crypto`, `ExecutionContext`), producing ambient type mismatches. Enforced `npx tsc -p worker/tsconfig.json --noEmit` which aligns with worker-specific tsconfig aliases and compiler options.
- **Test preload for Vitest dual-module zod**: Resolved earlier in M2 and confirmed stable — all test runners correctly load `@hono/zod-openapi` without type or runtime prototype pollution.

## Numbers

- Packages created: 2 (`packages/domain/staff/`, `packages/domain/shift/`).
- Files deleted: 4 legacy files in `worker/src/`.
- Callers migrated: 5 (`worker/src/index.ts`, `worker/src/middleware/staff-auth.ts`, `worker/src/__tests__/lib/staff-roles.test.ts`, `worker/src/__tests__/routes/staff-auth-mobile.test.ts`, `tests/shifts.test.ts`).
- Test suite: 358 test files / 3,270 tests passing (100% green).
- tsc error delta: 1280 → 1317 (+37 errors, strictly TS2307/TS6059/TS2305/TS2554 from domain alias relocations, zero new error categories).

## Lessons

1. **Web Crypto over Node Crypto for Cloudflare Workers**: Always use `crypto.subtle` directly in domain auth utilities so packages can be shared seamlessly across workers and edge environments without polyfill overhead.
2. **Pure policy extraction simplifies testing**: Decoupling RBAC rules (`hasPermission`, `visibleRolesFor`) from HTTP routers enables lightning-fast unit tests with zero mocks or D1 bindings.
3. **M2 Complete**: The core business loop (Catalog → Menu → Order → Payment → Kitchen → Table → Staff → Shift) is now fully extracted into isolated `@aura/domain-*` packages, paving the way for M3 (AURA CAFE Independent Operation).
