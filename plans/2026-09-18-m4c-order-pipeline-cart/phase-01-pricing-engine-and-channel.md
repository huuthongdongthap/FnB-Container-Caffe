# Phase 01: Pricing Engine & Channel Pricing Resolution (Gap Y-03)

## Overview
- **Goal:** Formalize channel pricing (`dine_in`, `takeaway`, `delivery`) in `@aura/domain-catalog/policies/pricing.ts` while preserving canonical `priceCents`.
- **Status:** READY FOR IMPLEMENTATION
- **Dependency:** Reuses M4-B `menu_items.price` as base price.

## Requirements
1. **Deterministic Channel Resolution:**
   - Client sends channel intent (`order_type`: `dine_in` | `takeaway` | `delivery`).
   - Server resolves `unitPriceCents`:
     `effectivePrice = baseCatalogPrice + channelDelta - happyHourDiscount`
   - Default channel delta = 0 for standard channels, allowing extensible channel rate multipliers without database schema changes.
2. **Modifier Price Aggregation:**
   - Modifiers add explicit `price_delta` integer cents to the unit price.
3. **Zero Client Price Input:**
   - Reject any incoming client-specified `price`, `total`, `unitPriceCents`, or `discount`.

## Implementation Tasks
- [ ] Export `resolveItemPrice` in `packages/domain/catalog/policies/pricing.ts`.
- [ ] Support channel modifiers and happy hour window matching.
- [ ] Add unit tests in `packages/domain/catalog/__tests__/pricing.test.ts` verifying channel pricing invariants.
