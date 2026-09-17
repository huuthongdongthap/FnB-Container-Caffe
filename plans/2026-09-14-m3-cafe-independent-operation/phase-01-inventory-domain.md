# Phase 01 — Inventory Domain Extraction (`@aura/domain-inventory`)

**Status:** pending · **Depends:** none · **Milestone:** M3

## Overview

Extract existing inventory management modules (`worker/src/routes/inventory/*`) into `packages/domain/inventory/`:
- `worker/src/routes/inventory/crud.ts` (CRUD endpoints for inventory items)
- `worker/src/routes/inventory/transactions.ts` (Stock adjustments, intake, loss records)
- `worker/src/routes/inventory/snapshots.ts` (Periodic stock snapshot auditing)
- `worker/src/routes/inventory/order-deduction.ts` (`deductInventoryForOrder`, `restoreInventoryForOrder`)
- `worker/src/routes/inventory/index.ts` (Sub-router mounting CRUD, transactions, snapshots)

## Related Code Files

### Files to create:
- `packages/domain/inventory/package.json`
- `packages/domain/inventory/src/index.ts`
- `packages/domain/inventory/src/model/inventory-types.ts`
- `packages/domain/inventory/src/policies/deduction-policy.ts`
- `packages/domain/inventory/src/routes/inventory-crud.ts`
- `packages/domain/inventory/src/routes/inventory-transactions.ts`
- `packages/domain/inventory/src/routes/inventory-snapshots.ts`
- `packages/domain/inventory/src/routes/order-deduction.ts`
- `packages/domain/inventory/src/routes/index.ts`

### Files to modify (Callers):
- `worker/src/index.ts` (Import `inventoryRouter` from `@aura/domain-inventory`)
- `worker/src/routes/orders-mobile.ts` (Or wherever `deductInventoryForOrder` / `restoreInventoryForOrder` are called)
- Test files referencing `worker/src/routes/inventory/*`

### Files to delete (Legacy):
- `worker/src/routes/inventory/crud.ts`
- `worker/src/routes/inventory/transactions.ts`
- `worker/src/routes/inventory/snapshots.ts`
- `worker/src/routes/inventory/order-deduction.ts`
- `worker/src/routes/inventory/index.ts`

## Implementation Steps

1. Create `packages/domain/inventory/` scaffold with `package.json` and TypeScript configuration.
2. Extract models and types (`InventoryItem`, `InventoryTransaction`, `InventorySnapshot`, deduction payload).
3. Extract deduction policy and functions (`deductInventoryForOrder`, `restoreInventoryForOrder`).
4. Extract routes (`inventory-crud`, `inventory-transactions`, `inventory-snapshots`, `inventoryRouter`).
5. Update all callers in `worker/src/` to import from `@aura/domain-inventory`.
6. Delete legacy files in `worker/src/routes/inventory/`.
7. Verify with targeted tests: `npx vitest run tests/inventory.test.ts`.

## Success Criteria

- [ ] All inventory endpoints (`/api/inventory/*`) functional via `@aura/domain-inventory`.
- [ ] Direct deduction / restoration functions exported cleanly for order lifecycle integration.
- [ ] No shims; legacy `worker/src/routes/inventory/*` files deleted.
- [ ] Unit and integration tests pass green.
