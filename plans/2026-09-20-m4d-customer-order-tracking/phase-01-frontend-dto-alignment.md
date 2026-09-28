# Phase 01: Frontend DTO Alignment

## Overview
- **Goal:** Align frontend order type definitions with the canonical `formatCustomerOrder()` / `formatCustomerOrderItem()` projections.
- **Status:** PENDING
- **Dependency:** None (pure type/mapper definitions).

## Context
Source of truth: `worker/src/schemas/orders.ts` — `CustomerOrderItemSchema` (L138-149) and
`CustomerOrderResponseSchema` (L156-171), plus `worker/src/routes/openapi-orders-handlers/helpers.ts`
(`formatCustomerOrder`). Exported types: `CustomerOrderItem`, `CustomerOrderResponse` (L195-196).

Fields the canonical projection returns (verified `worker/src/schemas/orders.ts:138-171`):

```ts
export interface CustomerOrderItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  modifiers?: Array<{ name: string; priceAdjustment: number }>;
  notes?: string | null;
  status: OrderStatus;
}

export interface CustomerOrderResponse {
  id: string;                 // uuid
  orderNumber: string;
  table?: { id: string; name: string } | null;
  items: CustomerOrderItem[];
  channel: OrderChannel;      // default 'dine_in'
  subtotal: number;
  discountAmount: number;     // default 0
  taxAmount: number;          // default 0
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  createdAt: string;          // ISO datetime
  updatedAt: string;          // ISO datetime
}
```

**Deliberately absent from the projection:** `customer_id`, `customer_name`, `customer_phone`,
`customer_address`, `payment_method`, `shipping_fee`, `points_earned`, `cashback_earned`,
`source`, `locationId`, `tableId`, `payments`, and all staff/procurement columns.

The frontend currently uses `Order` in `src/hooks/stores/order-store-types.ts:8-26` with snake_case
fields (`total`, `payment_status`, `customer_name`, `customer_phone`, `created_at`) and an
`OrderItem` with `id`/`price` (L1-6). These do not exist in the canonical DTO.

### Open question resolved by inspection (flag before Phase 02)
`useOrderStore.createOrder()` posts to `/api/orders` and reads `body.data` directly
(`src/hooks/stores/use-order-store.ts:24-26`). Both the legacy `POST /api/orders` (mounted
`worker/src/index.ts:227`) and the canonical OpenAPI `POST /api/orders` (mounted via
`worker/src/lib/openapi.ts` → `worker/src/index.ts:377`) exist. The canonical write contract is
intent-only (`OrderCreateSchema`: `menuItemId`, `quantity`, `modifiers`, `notes`, `channel`) and
rejects client-supplied prices; the current `CreateOrderPayload` (`order-store-types.ts:28-43`)
sends `items[].price`, `total`, `customer_name`, `payment_method` — legacy shape only.
**Phase 02 must decide: migrate the write path to intent-only, or scope M4-D to reads only.**
Reads-only is the lower-risk cut and keeps M4-B/M4-C contracts untouched; the write path is a
separate milestone.

## Tasks
1. **Define canonical types in `src/hooks/stores/order-store-types.ts`:**
   - Add `CustomerOrderItem`, `CustomerOrder` interfaces mirroring the worker projection exactly.
   - Do not invent fields the projection cannot supply.
2. **View-model mapper (only if a component genuinely needs a derived display value):**
   - Add `toCustomerOrderViewModel()` in a `src/hooks/stores/order-store-mappers.ts`
     (separate file — `order-store-utils.ts` is 26 lines and already has one concern).
   - Keep derivation display-only (currency formatting, status label, relative time).
   - Do NOT recompute money from line items — `totalAmount` is server-authoritative.
3. **Update `OrderState` (`order-store-types.ts:45-61`):**
   - `currentOrder: CustomerOrder | null`
   - `orderHistory: CustomerOrder[]`
   - Keep `createOrder` payload typing unchanged in this phase (write path deferred).

## Risks
- Components reading `order.customer_name` (e.g. `src/pages/account/index.tsx`) will lose that field —
  it is not in the customer projection. Profile data must come from the existing account hook instead.
- `points_earned` / `cashback_earned` are also absent; `OrderSuccess` surfaces showing them must be
  rewired or dropped in Phase 02.

## Success Criteria
- `npx tsc --noEmit` reports 0 errors after the type changes and consumer updates land together.
- No component reads a field absent from `CustomerOrderResponseSchema`.
