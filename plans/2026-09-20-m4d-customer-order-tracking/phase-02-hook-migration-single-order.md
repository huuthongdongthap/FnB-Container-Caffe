# Phase 02: Hook Migration — Single Order (TrackOrder / OrderSuccess)

## Overview
- **Goal:** Migrate single-order fetch and polling in `useOrderStore` and `useOrder` to the canonical `GET /api/orders/:id` endpoint returning `CustomerOrderResponse`.
- **Status:** PENDING
- **Dependency:** Phase 01 (canonical DTOs defined).

## Current State
1. **`src/hooks/stores/use-order-store.ts:31-40` (`fetchOrder`):**
   - Calls `apiFetch<any>('/api/orders/' + id)`
   - Stuffs raw response into `currentOrder`
   - Polling calls `fetchOrder(id)` every 5s (`POLL_INTERVAL`)
2. **`src/hooks/stores/order-store-utils.ts:11-26` (`mapSseEventToOrder`):**
   - Maps SSE event data to `Order` interface with snake_case fallbacks
3. **`src/hooks/use-order.ts:44-51`:**
   - TanStack Query hook calling `apiFetch<OrderResponse>('/api/orders/' + orderId)`
   - Typed with legacy `Order` interface (`src/hooks/use-order.ts:15-32`)
4. **Consumers:**
   - `src/pages/TrackOrder.tsx` (reads `order.status`, `order.items`, `order.total`)
   - `src/pages/order-success.tsx` (reads `currentOrder`)
   - `src/pages/stitch/track-order/index.tsx` (reads `order`)
   - `src/components/tracking/track-order-status-card.tsx`
   - `src/components/tracking/track-order-types.ts`

## Tasks
1. **Migrate `src/hooks/stores/use-order-store.ts`:**
   - Update `fetchOrder(id)` to expect `{ success: true, data: CustomerOrderResponse }`
   - Store typed `CustomerOrder` in `currentOrder`
   - Handle 404 (not found / foreign order via `resolveCustomerScope`) cleanly with user-facing message
2. **Update `src/hooks/stores/order-store-utils.ts`:**
   - Update `mapSseEventToOrder` to output `CustomerOrder` (camelCase fields: `totalAmount`, `orderNumber`, `paymentStatus`, `createdAt`)
3. **Migrate `src/hooks/use-order.ts`:**
   - Replace internal legacy `Order` / `OrderItem` interfaces with `CustomerOrderResponse` / `CustomerOrderItem`
   - Query function calls canonical `GET /api/orders/:id`
4. **Update Consumers to camelCase properties:**
   - `src/pages/TrackOrder.tsx`:
     - Update property reads: `order.total` → `order.totalAmount`, `order.payment_status` → `order.paymentStatus`, `order.created_at` → `order.createdAt`
     - Status step checks remain compatible (`statusSteps` uses standard status slugs: `confirmed`, `preparing`, `ready`, `delivering`, `delivered`)
   - `src/pages/order-success.tsx`:
     - Update property reads to canonical DTO
   - `src/components/tracking/*`:
     - Update any components expecting snake_case fields

## Success Criteria
- TrackOrder renders status timeline, order number, line items, and totals from canonical DTO.
- Polling and SSE update `currentOrder` seamlessly.
- IDOR 404 response handled gracefully with error card.
- `npx tsc --noEmit` passes with 0 errors.
