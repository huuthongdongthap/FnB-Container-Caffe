---
phase: 1
title: Fix pretix Tests → 770/770 Green
status: pending
priority: P0
effort: 0.5h
dependencies: []
---

# Phase 1: Fix pretix Tests

## Overview

Fix 2 pre-existing test failures in `tests/pretix-bridge.test.ts`. Both fail with `TypeError: Body is unusable: Body has already been read`. Root cause: `mockResolvedValue` reuses the same Response object across fetch calls, so the second `.text()` call on the consumed body throws.

## TDD Contract

1. Tests already exist (RED state). Fix them, verify GREEN.
2. No implementation code changes — test fix only.

## Root Cause

**File:** `tests/pretix-bridge.test.ts`, lines 150-164

```typescript
function mockFetchError(status: number, body: any) {
  mockFetch.mockResolvedValue(new Response(...)); // ONE Response, N calls
}
```

When a test calls `client.listEvents()` twice on the same mock, the second call tries to read the same consumed Response body → `TypeError: Body is unusable`.

## Fix

Change `mockFetchError` and `mockFetchResponse` from `mockResolvedValue` → `mockImplementation`:

**Before:**
```typescript
function mockFetchResponse(data: any, status = 200) {
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

function mockFetchError(status: number, body: any) {
  mockFetch.mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
}
```

**After:**
```typescript
function mockFetchResponse(data: any, status = 200) {
  mockFetch.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
  );
}

function mockFetchError(status: number, body: any) {
  mockFetch.mockImplementation(() =>
    Promise.resolve(new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      { status, headers: { 'Content-Type': 'application/json' } }
    ))
  );
}
```

## Files Changed

- `tests/pretix-bridge.test.ts`: 2 function definitions (lines 150-164)

## Validation

```bash
npx vitest run tests/pretix-bridge.test.ts  # must pass 25/25
npm test                                      # must pass 770/770
```

## Success Criteria

- [ ] `tests/pretix-bridge.test.ts`: 25/25 pass (was 23/25)
- [ ] `npm test`: 770/770 pass, 0 failures
- [ ] No changes to production code
