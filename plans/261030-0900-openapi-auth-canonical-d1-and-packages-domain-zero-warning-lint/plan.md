# Plan: OpenAPI Auth Canonical D1 Cutover & `packages/domain` Zero-Warning ESLint Convergence

**Plan ID:** `261030-0900-openapi-auth-canonical-d1-and-packages-domain-zero-warning-lint`
**Created:** 2026-10-30
**Brainstorm Report:** [brainstorm-261030-openapi-auth-canonical-d1-and-packages-domain-zero-warning-lint.md](../reports/brainstorm-261030-openapi-auth-canonical-d1-and-packages-domain-zero-warning-lint.md)
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654`

## Overview

Converge FnB-Container-Caffe on full canonical D1 compatibility across OpenAPI Auth/Staff/Tables routes and zero-warning ESLint enforcement across all 1,859 TypeScript/TSX/JS files in `worker/src/`, `src/`, and `packages/`:
1. Update `worker/src/routes/openapi-auth-handlers/` (`device-handlers.ts`, `staff-handlers.ts`, `auth-handlers.ts`) so `GET /api/auth/devices` lists canonical `staff_devices` for staff accounts, and `register-staff`, `staff`, `bootstrap-owner`, `login`, `logout`, `me`, and `session` support canonical staff D1 authority (`users` + `staff_login_identities`) alongside full customer schemas; guard redundant legacy table queries in `openapi-staff-handlers/staff-handlers.ts` (`PATCH /api/staff/:id`) and `tables-mobile.ts` (`GET /api/tables`).
2. Add `'packages/**/*.ts'` to `eslint.config.js`, update `package.json` `"lint"` to `eslint worker/src/ src/ packages/ --max-warnings=0`, and clean all 27 `@typescript-eslint/no-unused-vars` warnings across 19 files in `packages/domain/`.
3. Add regression tests in `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`, run full monorepo verification, and synchronize `reports/audit/plan/261029-1703-all-identities/evidence/source-baseline.json`.

## Phases

| Phase | Name | Status | File |
|---|---|---|---|
| 01 | OpenAPI Auth, Staff Devices & Canonical D1 Cutover | Complete | [phase-01-openapi-auth-staff-devices-and-canonical-d1-cutover.md](./phase-01-openapi-auth-staff-devices-and-canonical-d1-cutover.md) |
| 02 | `packages/domain` Zero-Warning ESLint Convergence | Complete | [phase-02-packages-domain-zero-warning-eslint-convergence.md](./phase-02-packages-domain-zero-warning-eslint-convergence.md) |
| 03 | Regression Tests, Full Verification & Baseline Lock | Complete | [phase-03-regression-tests-and-full-monorepo-verification.md](./phase-03-regression-tests-and-full-monorepo-verification.md) |

## Key Dependencies
- Phases 01 and 02 touch disjoint file sets (`worker/src/routes/**` vs `packages/domain/**` + `eslint.config.js` + `package.json`).
- Phase 03 verifies both phases across the full test suite and locks `source-baseline.json`.
