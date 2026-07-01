---
phase: 1
title: 'TDD Gate: Worker Consolidation Tests'
status: in-progress
priority: P1
dependencies: []
effort: 1.5h
---

# Phase 1: TDD Gate — Worker Consolidation Tests

## Overview

Write tests that lock in current worker behavior for the divergences we'll fix in Phase 2. Tests must pass BEFORE any consolidation code changes. This ensures the consolidation doesn't silently break anything.

## Requirements

- Functional: Tests covering contact dispatcher, reviews dispatcher, error handler, audit-log, and stuck-payments endpoint
- Non-functional: Tests use existing mock patterns (createMockDB, createMockKV). No new test infrastructure.

## Architecture

```
Test: contact dispatcher
  → Verify /api/contact/* strips prefix before passing to contactRouter
  → Verify c.executionCtx is passed to router.fetch

Test: reviews dispatcher
  → Verify /api/reviews/* passes c.executionCtx to router.fetch

Test: error handler
  → Verify error responses have consistent shape { success, error, detail }
  → Verify 500 errors don't leak stack traces

Test: audit-log
  → Verify audit-log.ts correctly logs to audit_log table
  → Verify table has expected columns (user_id, action, details, ip, created_at)

Test: GET /api/admin/payments/stuck
  → Returns { stuck, dlq, total } for owner
  → Returns 403 for staff
  → Returns 401 for unauthenticated
  → Returns { stuck: [], dlq: [], total: 0 } when KV unavailable

Test: changePassword
  → Verify unified in routes/auth.ts
  → Verify POST /api/auth/change-password works correctly
```

## Related Code Files

- Create: `worker/src/__tests__/routes/contact-dispatcher.test.ts`
- Create: `worker/src/__tests__/routes/reviews-dispatcher.test.ts`
- Create: `worker/src/__tests__/middleware/error-handler.test.ts`
- Create: `worker/src/__tests__/middleware/audit-log.test.ts`
- Create: `worker/src/__tests__/routes/admin-payments-stuck.test.ts`

## Implementation Steps

1. **Contact dispatcher test** — Mock contactRouter, verify prefix stripping + execCtx passing
2. **Reviews dispatcher test** — Mock reviewsRouter, verify execCtx passing
3. **Error handler test** — Trigger errors, verify response shape
4. **Audit-log test** — Verify DB insert with correct columns
5. **Admin payments/stuck test** — Verify auth + response shape (Phase 4 endpoint, test here)
6. **Run all worker tests** — 87 + new must all pass

## Success Criteria

- [ ] Contact dispatcher test: prefix stripped, execCtx passed
- [ ] Reviews dispatcher test: execCtx passed
- [ ] Error handler test: consistent { success, error, detail } shape
- [ ] Audit-log test: correct table + columns
- [ ] Admin payments/stuck test: owner 200, staff 403, unauth 401
- [ ] All worker tests pass (87 existing + 5+ new)
- [ ] `cd worker && npx vitest run` — 100% pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Contact/reviews router mocking complex | Use existing createMockDB/createMockKV patterns; test only the dispatcher wrappers |
| Error handler shape differs between TS/JS | Test the TS version (will become canonical); document the difference |
