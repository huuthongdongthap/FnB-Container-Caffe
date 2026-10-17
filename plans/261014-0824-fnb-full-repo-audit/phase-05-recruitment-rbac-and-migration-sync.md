# Phase 05: Recruitment RBAC Hardening, Error Sanitization & Canonical Migration Sync

## Context Links
- Master Plan: [plan.md](plan.md)
- Recruitment Route: [worker/src/routes/recruitment.ts](../../worker/src/routes/recruitment.ts)
- Recruitment Route Tests: [worker/src/__tests__/routes/recruitment.test.ts](../../worker/src/__tests__/routes/recruitment.test.ts)
- Canonical Migrations Index: [worker/db/migrations/README.md](../../worker/db/migrations/README.md)

---

## Overview
- **Priority:** P1 High
- **Current Status:** Complete
- **Description:** Remediate three verified issues in the uncommitted recruitment module: (1) enforce `owner`/`manager` RBAC guard on `DELETE /api/recruitment/applications/:id`, (2) sanitize HTTP 500 error responses to prevent raw SQLite exception leakage, and (3) register the `recruitment_applications` DDL + `.down.sql` rollback in canonical `worker/db/migrations/`.

---

## Key Insights
1. **Privilege Escalation Prevention (P1):** `worker/src/routes/recruitment.ts:7` specifies `DELETE /api/recruitment/applications/:id` is restricted to `owner` and `manager`. However, the router middleware at line 190 allowed `staff` across all `/applications/*` methods without a narrower guard on `DELETE`.
2. **Error Sanitization (P2):** Catch blocks in `submitApplication`, `listApplications`, `updateApplicationStatus`, and `deleteApplication` interpolated `(error as Error).message` directly into HTTP 500 responses, exposing internal database schema/engine details to unauthenticated callers.
3. **Migration Topology Alignment (P1):** `deploy-cloudflare.sh` and `npm run lint:migrations` target `worker/db/migrations/`. Placing `20261014_11_recruitment_applications.sql` only in `db/migrations/` leaves the canonical migration pipeline unaware of the table.

---

## Implementation Steps
1. Update `worker/src/routes/recruitment.ts`:
   - Add `requireAuth(['owner', 'manager'])` middleware specifically to `recruitmentRouter.delete('/applications/:id', ...)`.
   - Replace raw `${(error as Error).message}` interpolation in HTTP 500 responses with generic user-safe messages while preserving `log.error` diagnostics.
2. Add canonical forward migration `worker/db/migrations/20261014_01_recruitment_applications.sql` and reversible `worker/db/migrations/20261014_01_recruitment_applications.down.sql` (preserving existing `db/migrations/20261014_11_recruitment_applications.sql`).
3. Expand `worker/src/__tests__/routes/recruitment.test.ts` with regression tests for RBAC (`staff` 403 vs `manager` 200 on `DELETE`) and HTTP 500 SQL error sanitization.

---

## Todo List
- [x] Enforce `requireAuth(['owner', 'manager'])` on `DELETE /applications/:id` in `worker/src/routes/recruitment.ts`
- [x] Scrub raw exception messages from HTTP 500 responses in `worker/src/routes/recruitment.ts`
- [x] Add `worker/db/migrations/20261014_01_recruitment_applications.sql` and `.down.sql`
- [x] Add regression tests in `worker/src/__tests__/routes/recruitment.test.ts`
- [x] Verify with `npm run verify:gates`, `npm run typecheck:all`, and `vitest`
