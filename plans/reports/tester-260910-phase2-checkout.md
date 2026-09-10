# Tester Report — Phase 2: Delivery/Takeaway/Dine-in Checkout
**Date:** 2026-09-10 · **Tester:** inline fallback (tester subagent died on model-routing 400 — `pmv-fast` unresolvable, same as Phase 1)

## Test Runs (all run from repo root)

| Suite | Command | Result |
|-------|---------|--------|
| FE full | `npx vitest run` | ✅ **357 files / 3249 tests pass** (44.17s) |
| Worker full | `cd worker && npx vitest run` | ✅ **151 files / 1551 tests pass** (3.68s) |
| FE typecheck | `npx tsc --noEmit` | ✅ **EXIT 0** |
| Worker tsc | n/a | ⚠️ unavailable — no typescript dep in worker/package.json; global tsc too old for `moduleResolution: "bundler"`. **Vitest is the worker gate** (pre-existing env constraint, not a code error) |

## New/Changed Tests Verified

- `worker/src/__tests__/lib/validators.test.ts` — 4 new schema tests (delivery address 400, dine_in table 400, omitted order_type skips validation, takeaway requires neither) — pass within 151-file suite
- `worker/src/__tests__/routes/orders-snapshot.test.ts` — order_type added to response whitelist (caught by extra-keys assertion, fixed) — pass
- `src/components/stitch/__tests__/stitch-checkout-new.test.tsx` — 6 new validation tests (empty-phone alert, invalid-format inline error + clear on valid, delivery address error + clear, dine_in table error + clear, takeaway needs neither, valid submit carries orderType) — **11/11 pass**

## Acceptance Criteria Checklist

- [x] Delivery: address required, "Miễn phí giao hàng" (summary panel renders Miễn phí when deliveryFee === 0) — verified `StitchCheckoutNew-order-summary.tsx:76-81`
- [x] Takeaway: no address/table required; pickup-point info box instead — verified tests
- [x] Dine-in: tableNumber required — verified test + worker schema
- [x] VN phone `^0\d{9}$` inline error — verified tests (invalid shows error, valid clears)
- [x] Worker rejects delivery w/o address (400), dine_in w/o table_id (400) — verified worker schema tests
- [x] Legacy QR flow (omitted order_type) NOT broken — verified: omitted order_type skips per-type validation; insert-time fallback `dine_in` intact (`create-order.ts:107`)
- [x] Full suites pass, tsc clean

## Anomalies / Notes

- One snapshot test failure during dev (extra `order_type` key) — expected contract addition, whitelist updated. Not a regression.
- `checkout.tsx` payload previously mislabeled order_type (`|| 'delivery'`) and leaked table_id into non-dine_in payloads — fixed this phase, covered by submit-carry test.

## Verdict

**PASS** — Phase 2 acceptance criteria fully met. No failures outstanding.

## Unresolved Questions

None.
