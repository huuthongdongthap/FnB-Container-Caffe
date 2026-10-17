# Plan: Fix Mobile Checkout Composite Product ID & PayOS Amount Sync

## Overview
- **Status:** Completed
- **Root Cause:**
  1. Mobile cart (`aura_cart_v3` in `localStorage` or customized drink modal) stores composite line item IDs (`bt001-Size Tiêu Chuẩn (M)_100% đường (chuẩn)_Đá đầy đủ (chuẩn)`).
  2. `worker/src/lib/validators/common.ts` (`orderItemSchema`) only allowed `id` and `product_id`, stripping `productId` and `notes` sent by `src/pages/checkout.tsx`.
  3. `calculateOrderSnapshot` fell back to `rawItem.id` (the composite string), causing D1 lookup to fail with `Product not found: bt001-Size Tiêu Chuẩn (M)_...`.
  4. `src/pages/checkout.tsx` passed client `effectiveTotal` instead of server `order.total` to `retryCreatePaymentLink`, risking PayOS 400 `Tampered amount` when customizer surcharges differ from D1 base price.

## Phases & Checklist
- [x] **Phase 1: Backend Validator & Snapshot Resolution**
  - [x] Update `orderItemSchema` in `worker/src/lib/validators/common.ts` to preserve `productId`, `menuItemId`, and `notes`.
  - [x] Extract base product ID (`split(/[-_]/)[0]`) in `packages/domain/catalog/policies/pricing-resolver.ts` and `packages/domain/order/policies/order-snapshot.ts`.
- [x] **Phase 2: Frontend Cart Migration & Checkout Payload**
  - [x] Sanitize persisted `aura_cart_v3` items in `src/hooks/stores/use-cart-store.ts` using `isReadyToServeItem` and base `productId`.
  - [x] Send both `product_id` and `productId` (`baseProductId`) in `src/pages/checkout.tsx` and use server-authoritative `order.total` for PayOS link creation.
- [x] **Phase 3: Verification & Production Deploy**
  - [x] Run unit tests for cart store, checkout, and server pricing contract (46/46 pass + `typecheck:all` + `vite build`).
  - [x] Deploy Cloudflare Worker and Pages (`auraspace.cafe`) + bump Service Worker cache (`aura-static-v2`) + live smoke test HTTP 201.
