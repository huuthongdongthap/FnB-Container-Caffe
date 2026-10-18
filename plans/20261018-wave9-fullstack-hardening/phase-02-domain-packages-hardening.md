# Phase 02: Domain Packages Resilient Queries & Policies

## Overview
- Priority: High
- Current status: Pending
- Description: Ensure all domain packages gracefully handle dual schema conventions between canonical migrations and legacy table structures across payments, shifts, tables, inventory, catalog, and CRM.

## Requirements
- D1 queries must execute primary SQL statements first to satisfy test spies, then fall back to legacy aliases in catch blocks.
- Shifts domain must support both `shifts` and `staff_shifts` tables.
- Tables domain must support both `cafe_tables` and `tables` tables.
- Inventory deduction must query `order_items` and fall back to JSON column `orders.items`.
- Inventory purchase order queries must support both `purchase_order_id` and `po_id` column names.
- CRM customer queries must support both `tier` and `loyalty_tier`.

## Related Code Files
- `packages/domain/payment/commands/payos-create-link.ts`
- `packages/domain/shift/commands/shifts.ts`
- `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- `packages/domain/table/commands/tables.ts`
- `packages/domain/table/commands/qr-scan.ts`
- `packages/domain/inventory/src/routes/order-deduction.ts`
- `packages/domain/inventory/src/routes/inventory-crud.ts`
- `packages/domain/staff/commands/staff-auth.ts`
- `packages/domain/catalog/commands/categories.ts`
- `packages/domain/crm/commands/customer-360.ts`

## Implementation Steps
1. Add resilient fallbacks for `is_cod` and `cod_paid_at` in `payos-create-link.ts`.
2. Wrap shift queries in `shifts.ts` and `cash-reconciliation-policy.ts` to inspect `staff_shifts` on fallback.
3. Support table alias fallback in `tables.ts` and `qr-scan.ts`.
4. Ensure recipe deduction queries `order_items` with fallback to `orders.items` in `order-deduction.ts`.
5. Support `purchase_order_id` / `po_id` dual bindings in `inventory-crud.ts`.
6. Harmonize role checks and category deletion logic.

## Success Criteria
- Zero D1 SQL errors when either canonical or legacy schema is active.
- Exact unit test matches preserved for spy assertions.
- 100% test pass on domain package test suites.
