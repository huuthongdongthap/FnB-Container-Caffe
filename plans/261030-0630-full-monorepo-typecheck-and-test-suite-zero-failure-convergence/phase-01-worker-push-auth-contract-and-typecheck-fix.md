# Phase 01: Worker Push Auth Contract & `typecheck:worker` Fix

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-full-monorepo-typecheck-and-test-suite-zero-failure-convergence.md)
- `worker/src/middleware/auth.ts`
- `worker/src/routes/push.ts`
- `worker/src/__tests__/routes/checkin.test.ts`

## Overview
- **Priority:** P0 (Production bug + `npm run typecheck:worker` blocker)
- **Current Status:** Complete
- **Description:** Re-export `authenticateRequest` from `worker/src/middleware/auth.ts`, fix `worker/src/routes/push.ts` to extract `payload.role` (and reject `{ blocked }` CSRF responses) from `authenticateRequest`, and update `worker/src/__tests__/routes/checkin.test.ts` mock and assertions.

## Key Insights
- `worker/src/routes/push.ts:3` imports `authenticateRequest` from `../middleware/auth`, which currently only imports it locally from `../lib/staff-session-auth` (`error TS2459`).
- At runtime, `authenticateRequest(c.req.raw, c.env)` returns `{ payload: JwtPayload; token: string; account: StaffAccount | null } | { blocked: string } | null`, not `{ role: string }`. Reading `authUser.role` directly fails even when a valid staff token is supplied.

## Requirements
- **Functional:**
  - `worker/src/middleware/auth.ts` re-exports `authenticateRequest` from `../lib/staff-session-auth`.
  - `POST /api/push/subscribe` in `worker/src/routes/push.ts` extracts the authenticated role from `session.payload?.role ?? (session as { role?: string }).role` and rejects `'blocked' in session` with `403`.
  - `worker/src/__tests__/routes/checkin.test.ts` mocks `authenticateRequest` in `../../middleware/auth` and tests both authorized staff subscription (`201`) and unauthorized/forbidden rejection (`401`/`403`).
- **Non-Functional:**
  - `npm run typecheck:worker` exits `0` with 0 errors.

## Related Code Files
- Modify: `worker/src/middleware/auth.ts`
- Modify: `worker/src/routes/push.ts`
- Modify: `worker/src/__tests__/routes/checkin.test.ts`

## Implementation Steps
1. In `worker/src/middleware/auth.ts`, re-export `authenticateRequest` from `../lib/staff-session-auth`.
2. In `worker/src/routes/push.ts` (`lines 91-101`), handle the `{ payload, token, account } | { blocked } | null` union returned by `authenticateRequest(c.req.raw, c.env)`.
3. In `worker/src/__tests__/routes/checkin.test.ts`, add `authenticateRequest` to `vi.mock('../../middleware/auth')` and verify `npx vitest run worker/src/__tests__/routes/checkin.test.ts`.

## Todo List
- [ ] Re-export `authenticateRequest` in `worker/src/middleware/auth.ts`
- [ ] Fix `POST /api/push/subscribe` role extraction in `worker/src/routes/push.ts`
- [ ] Update `worker/src/__tests__/routes/checkin.test.ts` and verify `npm run typecheck:worker`

## Success Criteria
- `npm run typecheck:worker` passes with 0 errors.
- `npx vitest run worker/src/__tests__/routes/checkin.test.ts` passes (`10/10+`).
