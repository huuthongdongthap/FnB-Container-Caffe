# Phase 2 — Delivery/Takeaway/Dine-in Checkout Completion

**Wave:** A · **Priority:** P0 · **Status:** 🟢 Code Complete (verification in progress) · **Depends:** Phase 1

## Requirements

From commit f013aea + Phase 1 unlocks: order-type selector exists (delivery/takeaway/dine_in), tableNumber for dine-in, address for delivery. Complete checkout by adding:

1. **Delivery fee logic** — FREE delivery (user decision 2026-09-10); shipping_fee stays 0, display "Miễn phí giao hàng" in summary for delivery type
2. **Per-order-type validation** — address required for delivery, tableNumber required for dine_in, neither for takeaway
3. **VN phone validation** — regex `^0[0-9]{9}$` with format hint on checkout form
4. **Worker shipping_fee** — accept `shipping_fee` from FE, use in order total (currently hardcoded 0)
5. **FE summary update** — deliveryFee from worker config/calculation, not hardcoded 0

## BE Touchpoints (contract only)

- `POST /api/orders` payload: validate `order_type` enum, require `customer_address` for delivery, `table_id` for dine_in (shipping_fee stays 0)
- Worker response: `shipping_fee: 0` in order creation response
- `GET /api/delivery/zones` — DEFERRED (free delivery for now)

## Related Code Files

- `src/pages/checkout.tsx` — payload build, validation, deliveryFee summary
- `src/components/stitch/StitchCheckoutNew.tsx` — conditional fields, phone validation UI
- `src/components/stitch/StitchCheckoutNew-types.ts` — type extensions
- `worker/src/lib/validators.ts` — order create schema (already has order_type enum)
- `worker/src/tree/orders/create-order.ts` — shipping_fee consumption, per-type validation
- `src/hooks/use-cart.ts` — cart summary with dynamic deliveryFee

## Implementation Steps

1. Add VN phone regex validation to checkout form (FE) — show inline error on blur/submit
2. Add conditional required validation: address for delivery, tableNumber for dine_in
3. FE summary: deliveryFee 0 with "Miễn phí giao hàng" label for delivery; takeaway/dine_in hide fee row
4. Worker `create-order.ts` + validators: per-type required-field validation (address for delivery, table_id for dine_in)
5. Tests: phone validation, per-type required fields, free-delivery summary, worker schema

## Acceptance Criteria

- [x] Delivery order: address required, shipping_fee 0 displayed as "Miễn phí giao hàng" — `StitchCheckoutNew.tsx:286` (address-error), `StitchCheckoutNew-order-summary.tsx:76-81` renders "Miễn phí" when deliveryFee === 0
- [x] Takeaway order: no address/table required, fee row hidden — conditional sections `StitchCheckoutNew.tsx:278-315`; pickup-point info box instead of fields
- [x] Dine-in order: tableNumber required, fee row hidden — `StitchCheckoutNew.tsx:294-308` (table-error)
- [x] VN phone format `0XXXXXXXXX` validated with inline error (10 digits starting with 0) — `StitchCheckoutNew.tsx:103` regex `^0\d{9}$`, testid `phone-error`
- [x] Worker rejects delivery order without address, dine_in without table_id (400) — `validators.ts` superRefine, `create-order.ts` returns 400 with path-prefixed VN message; covered by 4 schema tests (148+ pass)
- [x] Tests pass (357 files / 3249 tests FE, 151 files / 1551 tests worker, tsc EXIT 0)

## Implementation Notes (2026-09-10)

- **order_type no longer defaults in schema** — removed `.default('dine_in')`: with superRefine, a defaulted dine_in would require table_id and break legacy QR flows (`src/pages/order/index.tsx`, `TableOrder-hooks.ts`) that omit order_type. Fallback stays at insert time (`create-order.ts:107` `data.order_type || 'dine_in'`).
- **checkout.tsx payload fix** — `order_type: formData.orderType` exact (was `|| 'delivery'` mislabeling takeaway/dine_in as delivery); `table_id` sent only for dine_in.
- **Idempotency response** now includes `order_type` (snapshot whitelist updated).
- **Worker tsc unavailable** (no typescript dep in worker/package.json; global tsc too old for `moduleResolution: "bundler"`) — vitest is the worker gate.

## Risks

- Worker per-type validation must not break existing dine_in default flow (worker defaults order_type to 'dine_in')
- Existing customers (QR table flow) may not send address — only validate when order_type is explicitly 'delivery'