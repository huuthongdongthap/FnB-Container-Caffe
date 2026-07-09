# Phase 3: Consistency Audit

## Requirements
Verify project-wide conventions:
1. All `fetch()` calls in `src/` have `AbortSignal.timeout(ms)`
2. All Zod schemas use `.safeParse()` on external input
3. All webhook routes fail-closed (return error if secret missing)
4. No `:any` types in production src/ code

## Steps
1. `grep -rn "fetch(" src/ | grep -v "AbortSignal.timeout"` → fix gaps
2. `grep -rn "\.parse(" src/routes src/tree src/forest src/land | grep -v "safeParse"` → convert to safeParse
3. Verify cal-booking-webhook, pretix, erpnext webhook patterns
4. `grep -rn ": any" src/` outside test files → fix

## Acceptance
Report of findings + fixes applied (if any)
