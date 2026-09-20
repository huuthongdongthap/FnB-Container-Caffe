# /cook Execution Summary

## Invocation
```
/cook next
```

## Resolved Next Step
M4-C Discovery complete → Phase plan written → Implementation ready.

## Context Loaded
- `.ai/state/current.md` — M4-B GREEN, 371 files / 3,395 tests
- `.ai/state/progress.md` — 5 M4-B phases complete, audit #01–#18 GREEN (only #15 YELLOW: legacy lint)
- `.ai/state/decisions.md` — D-01 → D-07 recorded
- `docs/Claude Code CLI — Project Handoff & M4-C Execution Spec.md` — 853 lines, 22 sections
- `plans/2026-09-18-m4b-final-audit-verdict/` — M4-B verdict artifacts

## Source Inspection (Read-Only)
| File | Finding |
|------|---------|
| `packages/domain/catalog/policies/pricing.ts` | Only `happyHourDiscountFor()` exists — 34 LOC, no channel resolution |
| `packages/domain/catalog/model/catalog-types.ts` | `Product` has single `price`, no channel columns |
| `packages/domain/order/model/order-state-machine.ts` | 8 statuses, `canTransition()` complete, terminal guards OK |
| `packages/domain/order/commands/create-order.ts` | **Reads `data.total` from client payload** — price tampering surface |
| `packages/domain/crm/commands/place-order.ts` | Server-evaluates `unitPriceCents` from `menu_items` ✅ (canonical pattern) |
| `worker/src/lib/validators.ts` | `order_type` enum + per-type field validation present |
| `worker/schema.sql` | `menu_items.price` single column; `orders` has `subtotal`, `shipping_fee`, `discount`, `service_fee`, `tip_amount`, `location_id` |
| `worker/db/migrations/*` | No `channel_price` / `price_list` tables exist |

## Y-03 Channel Pricing — Root Cause
- No `channel_prices` table; happy hour applies uniformly; modifiers channel-agnostic.
- **Resolution:** Extend `pricing.ts` with pure `resolveItemPrice()` + channel delta config map. **No D1 migration required.**

## Artifacts Created
```
plans/2026-09-18-m4c-order-pipeline-cart/
├── plan.md
├── phase-01-pricing-engine-and-channel.md
├── phase-02-price-snapshot-and-cart.md
├── phase-03-order-state-machine-guards.md
├── phase-04-customer-security-and-api-contract.md
├── phase-05-acceptance-tests-and-state.md
└── m4c-discovery-report.md
reports/core/cook/SUMMARY.md
```

## Critical Finding (Blocking for M4-C Phase 02)
`packages/domain/order/commands/create-order.ts:99` inserts `parseInt(String(data.total))` directly from the request payload. The client currently controls the stored order total. M4-C Phase 02 MUST replace this with server-evaluated pricing before any customer-facing order endpoint is exposed.

## Next Task
Execute Phase 01: `resolveItemPrice()` in `packages/domain/catalog/policies/pricing.ts` + `pricing.test.ts`.
