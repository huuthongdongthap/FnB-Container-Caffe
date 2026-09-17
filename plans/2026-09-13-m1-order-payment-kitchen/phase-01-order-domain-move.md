---
phase: 01
priority: high
status: proposed
---

# Phase 01 — Move Order domain to packages/domain/order

## Context links

- Plan: `plan.md` (this directory)
- Source: `worker/src/tree/orders/` (13 files, ~1250 LOC)
- Exemplar: `packages/domain/customer/` (batch-4 pattern)
- Shim target: `worker/src/tree/orders/index.ts` (new file)

## Overview

Move all 13 `tree/orders/*` files into `packages/domain/order/` reorganized
into the domain contract (model / commands / queries / policies / schemas /
events / tests). Old `tree/orders/` path stays live via re-export shim per
file. Routes keep importing from `../tree/orders/*` until M2.

## Target structure

```
packages/domain/order/
├── model/
│   ├── order-status.ts        ← order-state-machine.ts (OrderStatus, ORDER_TRANSITIONS, canTransition, isTerminal, isFinal)
│   └── helpers.ts             ← helpers.ts (generateId, parseJSON)
├── commands/
│   ├── create-order.ts       ← create-order.ts
│   ├── update-order.ts       ← update-order.ts
│   └── split-orders.ts       ← split-orders.ts
├── queries/
│   ├── get-order.ts          ← get-order.ts
│   ├── admin-orders.ts       ← admin-orders.ts
│   ├── stats.ts              ← stats.ts
│   ├── shared-listing.ts     ← shared-listing.ts
│   └── latest-timestamp.ts   ← latest-timestamp.ts
├── policies/
│   └── loyalty-trigger.ts    ← loyalty-trigger.ts
├── notifications/            # (kept flat — not in spec §9 contract, minimal-disruption compromise)
│   ├── notify-order-status.ts
│   └── telegram.ts
├── index.ts
├── package.json              # @aura/domain-order
�h── tsconfig.json
```

## Related code files

- MOVE (13): every file in `worker/src/tree/orders/` → `packages/domain/order/`
- CREATE: `packages/domain/order/{index.ts,package.json,tsconfig.json}`
- CREATE: `worker/src/tree/orders/index.ts` (re-export shim)
- CREATE: per-file shims in `worker/src/tree/orders/` for each old filename
  (old imports like `../tree/orders/order-state-machine` must keep resolving)
- MODIFY: root `tsconfig.json` + `worker/tsconfig.json` + `vite.config.ts` +
  `vitest.config.ts` — add `@aura/domain-order` alias
- MODIFY: `package.json` (root) — add workspace alias if needed per customer pattern

## Implementation steps

1. Verify current order tests pass: `npx vitest run worker/src/__tests__/routes/orders.test.ts` (baseline).
2. Copy 13 files → `packages/domain/order/` with new structure (copy not move — shims will re-export).
3. Fix internal imports inside domain package (relative paths change; `../../lib/validators` etc. become `worker/src/lib/...` → must verify these resolve — domain files import `middleware/cors`, `lib/validators`, `lib/metrics-collector`, `routes/inventory/order-deduction`, `tree/erpnext/sync`).
4. Create `package.json` (`@aura/domain-order`, main `./index.ts`) + `tsconfig.json` mirroring customer.
5. Create `worker/src/tree/orders/index.ts` + per-file shims re-exporting from `@aura/domain-order`.
6. Wire `@aura/domain-order` path alias in root/worker tsconfig + vite + vitest.
7. Run order tests + full suite.

## Todo list

- [ ] Baseline order tests green
- [ ] Copy 13 files into domain structure
- [ ] Fix internal imports (worker cross-deps: validators, middleware, erpnext, inventory)
- [ ] package.json + tsconfig
- [ ] Shims (index + per-file)
- [ ] Path alias wiring
- [ ] Tests green (order + full suite)

## Success criteria

- `worker/src/routes/orders.ts` imports unchanged (still `../tree/orders/*`) and works.
- Order tests + full suite green.
- `git diff` shows new package + shims only; no logic deleted.

## Risk assessment

Medium-low. Code-move only, no logic edit. Main hazard: import paths into worker internals (middleware, validators, erpnext sync, inventory deduction) — domain package must import them via alias or relative path that resolves under both worker tsc + vitest. Batch-4 customer solved this — replicate its tsconfig/vite/vitest settings.

## Next steps

- Phase 02: run tests, verify shims.
