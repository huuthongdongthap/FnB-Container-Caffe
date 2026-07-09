# Phase 2b-3b: Orders Tree (5 files, P0)

## Already Tested
- `create-order.ts` (201L) — `__tests__/tree/orders/create-order.test.ts`
- `helpers.ts` (16L) — `__tests__/tree/orders/helpers.test.ts`

## Files to Test
| Source | Lines | Test File |
|--------|-------|-----------|
| `src/tree/orders/get-order.ts` | 41 | `__tests__/tree/orders/get-order.test.ts` |
| `src/tree/orders/update-order.ts` | 210 | `__tests__/tree/orders/update-order.test.ts` |
| `src/tree/orders/stats.ts` | 85 | `__tests__/tree/orders/stats.test.ts` |
| `src/tree/orders/split-orders.ts` | 150 | `__tests__/tree/orders/split-orders.test.ts` |
| `src/tree/orders/notify-order-status.ts` | 86 | `__tests__/tree/orders/notify-order-status.test.ts` |
| `src/tree/orders/telegram.ts` | 50 | `__tests__/tree/orders/telegram.test.ts` |
| `src/tree/orders/admin-orders.ts` | 79 | `__tests__/tree/orders/admin-orders.test.ts` |

## Test Strategy
- get-order: mock DB lookup, assert order shape
- update-order: state transitions (pending→paid→done), mock DB writes
- stats: aggregation logic, mock DB `all()` with fixture rows
- split-orders: order splitting logic with item redistribution
- notify-order-status: mock HTTP (telegram/zalo), assert message sent
- telegram: mock fetch, assert bot API call shape
- admin-orders: mock DB + auth check

## Acceptance
- ≥1 test per exported function
- State transitions tested for update-order
- `npx vitest run` passes
