# Phase 2b-3a: Subscriptions Tree (7 files, P0)

## Files to Test
| Source | Lines | Test File |
|--------|-------|-----------|
| `src/tree/subscriptions/helpers.ts` | 14 | `__tests__/tree/subscriptions/helpers.test.ts` |
| `src/tree/subscriptions/middleware.ts` | 34 | `__tests__/tree/subscriptions/middleware.test.ts` |
| `src/tree/subscriptions/types.ts` | 72 | `__tests__/tree/subscriptions/types.test.ts` |
| `src/tree/subscriptions/mrr-calculator.ts` | 45 | `__tests__/tree/subscriptions/mrr-calculator.test.ts` |
| `src/tree/subscriptions/plan-handlers.ts` | 94 | `__tests__/tree/subscriptions/plan-handlers.test.ts` |
| `src/tree/subscriptions/invoice-handlers.ts` | 85 | `__tests__/tree/subscriptions/invoice-handlers.test.ts` |
| `src/tree/subscriptions/sub-handlers.ts` | 344 | `__tests__/tree/subscriptions/sub-handlers.test.ts` |

## Test Strategy
- helpers/middleware/types/mrr-calculator: pure functions, inline inputs, assert outputs
- plan-handlers/invoice-handlers: mock DB via D1 closure, mock ERPNext client if imported
- sub-handlers: mock DB + HTTP (payment provider calls), state transitions (pending→active→cancelled)

## Acceptance
- ≥1 test per exported function
- Happy path + ≥1 error path per file
- `npx vitest run` passes, ≥847 tests
