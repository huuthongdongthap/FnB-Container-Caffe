# Reviewer Report — Phase 2: Delivery/Takeaway/Dine-in Checkout
**Date:** 2026-09-10 · **Reviewer:** inline fallback (code-reviewer subagent died on 503 server capacity, retry also 503 — same fallback pattern as Phase 1 tester)

## Scope Reviewed (git diff vs HEAD, 9 files)

- `worker/src/lib/validators.ts` — superRefine per-type validation + removed `.default('dine_in')`
- `worker/src/tree/orders/create-order.ts` — order_type added to idempotency response; insert-time fallback `|| 'dine_in'` intact (line 107)
- `worker/src/__tests__/lib/validators.test.ts` — 4 new schema tests
- `worker/src/__tests__/routes/orders-snapshot.test.ts` — order_type whitelisted
- `src/pages/checkout.tsx` — payload fix (order_type exact, table_id dine_in-only)
- `src/components/stitch/StitchCheckoutNew.tsx` — canSubmit gate + inline errors
- `src/components/stitch/__tests__/stitch-checkout-new.test.tsx` — 6 new tests
- `src/hooks/stores/__tests__/loyalty-store-helpers.test.ts` — TS2532 fixes
- `src/hooks/stores/order-store-types.ts` — **added during review**: `order_type` declared in `CreateOrderPayload` + `Order` (was missing — payload passed structurally but contract undeclared)

## Checklist

- [x] (a) Every acceptance criterion met — verified per tester report + diff walk
- [x] (b) No business-logic regression at touchpoints — walked legacy QR flow (`order/index.tsx:89-102`): omits order_type → superRefine skips → insert fallback 'dine_in'; table_id only in table mode. FE tests + worker 1551 pass confirm
- [x] (c) Public contracts — order_type is an ADDITIVE contract change (optional field), snapshot whitelist updated intentionally. No signature/schema removals
- [x] (d) Follows existing patterns — superRefine + ctx.addIssue matches Zod 4 idiom; VN messages match codebase convention
- [x] (e) No new lint/type/build errors — FE tsc EXIT 0 after type addition; worker vitest is gate (151/1551 pass)

## Findings During Review

1. **FIXED inline**: `CreateOrderPayload`/`Order` types missing `order_type` field — checkout.tsx sent it but type didn't declare it. Added `'dine_in' | 'takeaway' | 'delivery'` optional to both interfaces. Re-verified: tsc EXIT 0, full FE 357/3249 pass.
2. **Noted, pre-existing (not Phase 2 diff)**: `checkout.tsx:89-91` synthesizes customer_address for takeaway/dine_in ('Nhận tại quầy bar AURA' / 'Bàn N'). Harmless label — worker requires address only for delivery. No action.
3. **Verified design decision**: schema-default removal + insert-time fallback is the correct split. A schema default would make superRefine reject legacy QR orders (missing table_id). Confirmed by dedicated test "omitted order_type skips per-type validation (legacy QR flow)".

## Verdict

**PASS** — all 5 checks green. One type-declaration gap found and fixed during review. No blocking issues.

## Unresolved Questions

None.
