# Phase 03: Hook Migration — Order History (Account)

## Overview
- **Goal:** Migrate customer order history in `src/hooks/use-account.ts` to the canonical `GET /api/orders` list endpoint returning `CustomerOrderResponse[]`.
- **Status:** COMPLETED (2026-09-29)
- **Dependency:** Phase 01 (canonical DTOs defined).

## Current State
1. **`src/hooks/use-account.ts:1-99`:**
   - `OrderSummary` interface (L24-31): snake_case fields, `items: string` (raw JSON)
   - Fetches `GET /api/orders/my-orders` (legacy, phone-keyed, no JWT scope enforcement)
   - Returns `ordersData.data` with `items` as JSON string requiring `JSON.parse`
2. **`src/pages/account/index.tsx:1-102`:**
   - Consumes `useAccount()` → `orders`
   - Parses `order.items` with `JSON.parse(order.items)` (L29-32)
   - Maps to `DashOrderItem` with `itemName` from first item's `product_name`
   - Renders `<StitchAccountDashNew profile={dashProfile} loyalty={dashLoyalty} orders={dashOrders} />`

## Tasks
1. **Migrate `src/hooks/use-account.ts`:**
   - Replace `OrderSummary` with `CustomerOrder[]` (from Phase 01 types)
   - Call canonical `GET /api/orders` (list with pagination, auth via customer token, scoped by `resolveCustomerScope`)
   - Remove `JSON.parse(items)` — items arrive as `CustomerOrderItem[]`
   - Pagination: handle `meta.totalPages`, `meta.total` from list response
2. **Update `src/pages/account/index.tsx`:**
   - Update `DashOrderItem` mapping to read `order.items[0]?.name` directly (no JSON parse)
   - Property reads: `order.total` → `order.totalAmount`, `order.created_at` → `order.createdAt`
   - Ensure `StitchAccountDashNew` receives the updated shape (check its props)
3. **Verify no remaining `JSON.parse` on order items** anywhere in `src/`.

## Edge Cases
- Empty order history: canonical endpoint returns `{ orders: [], meta: { page, limit, total: 0, totalPages: 0 } }`
- 401/403 if token invalid — handled by auth middleware
- Pagination: account page may only need first page; implement "load more" if UX requires

## Success Criteria
- Account dashboard shows order history from canonical list endpoint.
- No `JSON.parse` on `order.items` anywhere.
- `npx tsc --noEmit` passes.