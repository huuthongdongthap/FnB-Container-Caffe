# TypeScript Audit Cleanup — Completion

**Date**: 2026-08-04
**Severity**: Low
**Component**: Test Suite / TypeScript Compiler
**Status**: Resolved

## What Happened

Phase 1 (`latte-test-fix`) of plan `260804-0001-typescript-audit-cleanup` completed. Fixed 4 failing assertions in `src/__tests__/routes/orders-hono.test.ts`. Root cause: tests were asserting the old response shape after a routing/state refactor changed top-level keys. The router (Hono) returns `{ success, data }` — tests were still expecting the pre-refactor shape. Aligned test expectations to match the router's actual response. No production code touched. All 1444 Vitest tests pass, `tsc --noEmit` clean (0 errors).

## The Brutal Truth

This was a straightforward test-fix, but the fix reveals a deeper problem: the refactor that changed the response shape shipped without updating the corresponding tests. We got lucky that the mismatch was caught by CI. The `{ success, data }` vs `{ success, order, message }` divergence between the router layer and `tree/create-order.ts` is intentional (different code paths), but it's a footgun — any future refactor touching either path will silently break the other's contract.

## Technical Details

- 4 assertions fixed in `src/__tests__/routes/orders-hono.test.ts`
- Router response shape: `{ success: boolean, data: OrderResponse }`
- Tree service shape: `{ success: boolean, order: Order, message?: string }`
- Test count: 1444 passing, 0 failing
- TypeScript: 0 errors (`tsc --noEmit`)
- Lint: clean
- Code review: CONFIRMED (code-reviewer subagent, xhigh effort, 23 tool uses)

## What We Tried

Direct assertion fix — replaced stale expected shape with actual router output shape. No alternative needed; the fix was unambiguous.

## Root Cause Analysis

The routing/state refactor changed the Hono router's response envelope from whatever-it-was-before to `{ success, data }`. The test file was not updated alongside the router change. No one caught it until CI ran. Classic "tests as documentation" failure — the tests drifted from the implementation and nobody noticed because both sides were changed independently.

## Lessons Learned

1. Response envelope shapes must be documented in a shared type — duplicating `{ success, data }` vs `{ success, order, message }` across layers is a refactor landmine.
2. When changing a router's response shape, update the corresponding test in the same commit. Never let them drift.
3. The code-reviewer subagent caught nothing because there was no production code change — the review scope was correct, but the gap was in the original refactor, not this fix.

## Next Steps

1. Define a shared `ApiResponse<T>` type in `seed/types/` and use it consistently across router and tree layers to eliminate shape divergence.
2. Add a contract test that asserts router response shape matches the documented envelope — this will catch future refactor drift automatically.
3. No further phases needed for this plan. Close `260804-0001-typescript-audit-cleanup`.
