# Phase 02 — Multi-Supplier Purchasing & Recipe Auto-Deduct (BOM)

**Status:** pending · **Depends:** phase 01 · **Milestone:** M3

## Overview

Establish multi-supplier purchasing policy and recipe-level Bill of Materials (BOM) auto-deduction:
- **Supplier Architecture**: Viva Star as primary supplier (coffee beans, branded packaging, core syrups) + local secondary suppliers (fresh milk, ice, fruits, bakery).
- **Purchase Orders (PO)**: Intake flows creating incoming inventory transactions (`type = 'in'`).
- **Recipe / BOM Deduction Engine**: Map menu items/modifiers to raw ingredient consumption (e.g. 1 Cafe Sua Da = 25g Viva Star Espresso blend + 30ml condensed milk + 1 cup/lid).
- **Auto-Deduct Hook**: Trigger deduction upon order transition to `confirmed` or `completed` via `@aura/domain-order` lifecycle events.

## Related Code Files

### Files to create/modify:
- `packages/domain/inventory/src/policies/supplier-policy.ts` (Supplier registry, category assignments)
- `packages/domain/inventory/src/policies/bom-policy.ts` (Recipe mapping and component calculations)
- `packages/domain/inventory/src/routes/purchasing.ts` (PO creation and stock intake)
- `packages/domain/order/src/` (Connect order status updates to recipe auto-deduction)

## Implementation Steps

1. Define supplier schema & policy models (Viva Star primary supplier contract, local secondary vendors).
2. Implement recipe BOM mapping schema allowing menu items to specify ingredient quantities.
3. Wire recipe deduction calculations into `@aura/domain-inventory/order-deduction`.
4. Add PO intake endpoint to record stock replenishment.
5. Add unit tests verifying BOM deduction calculation and multi-item stock depletion.

## Success Criteria

- [ ] Recipe BOM auto-deduction calculates correct ingredient depletion.
- [ ] Supplier policy explicitly identifies Viva Star as primary supplier for coffee/branded items.
- [ ] Stock replenishment via PO intake updates `current_stock` and inserts `inventory_transactions`.
