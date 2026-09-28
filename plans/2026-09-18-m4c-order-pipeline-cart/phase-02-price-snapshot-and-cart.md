# Phase 02: Order Price Snapshot & Immutable Line Items

## Overview
- **Goal:** Enforce server-authoritative price snapshotting on order creation.
- **Status:** READY FOR IMPLEMENTATION
- **Dependency:** Phase 01 Pricing Engine.

## Requirements
1. **Server-Evaluated Line Items:**
   - Order creation reads `menu_items` and modifier tables directly from D1.
   - For each requested line:
     - Verify item exists and `available === 1` (reject unavailable items).
     - Snapshot `unitPriceCents`, `name`, `quantity`, `modifiers`, and `subtotalCents = unitPriceCents * quantity + modifierTotal`.
2. **Order Aggregate Calculation:**
   - `subtotal = sum(item.subtotalCents)`
   - `shipping_fee = calculated by delivery policy (0 for dine-in/takeaway)`
   - `discount = calculated by verified coupon/happy-hour policy`
   - `total = subtotal + shipping_fee - discount + service_fee + tip_amount`
3. **Immutable Price Snapshot:**
   - Snapshot stored in `orders.items` JSON column.
   - Subsequent changes in `menu_items.price` never alter historical order lines or totals.

## Implementation Tasks
- [ ] Implement `calculateOrderSnapshot` helper in `@aura/domain-order`.
- [ ] Wire `createOrder` command to use authoritative snapshot rather than trusting payload numbers.
- [ ] Add snapshot tests in `tests/m4c-order-price-snapshot.test.ts`.
