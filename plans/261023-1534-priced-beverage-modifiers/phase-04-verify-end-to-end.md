# Phase 4 — Verify End-to-End

**Status:** ⏳ Ready
**Depends on:** Phases 1–3
**Effort:** ~1h

---

## Context

The earlier verification (`verification/size-pricing-results.md`) proved the bug
with three POSTs against a local Miniflare + D1 harness and read back
`order_items.subtotal`. Same method here — the acceptance criterion is a stored
row, not a UI screenshot.

**Harness:** `reports/dev/review/local-runtime.mjs` (Miniflare + D1 + KV).
Fixture `review-coffee` @ 20000 was seeded into both `menu_items` and `products`;
reuse that pattern so the resolver's `products`-then-`menu_items` lookup
(`pricing-resolver.ts:69-100`) behaves as it does in production.

## Why this phase is not optional

A modifier id that is wrong in any way — typo, not linked to the product,
inactive group — causes `order-snapshot.ts:74-78` to reject and the endpoint
returns **HTTP 400 for the whole order**. The failure is loud, which is good, but
it means a mistake here breaks ordering entirely, not just pricing. Verification
before shipping is the only safe order.

## Test matrix

Seed the fixture with a linked size group before running.

| Case | Setup | Send | Expect |
|---|---|---|---|
| 1 | valid id, delta +5000 | `modifiers:[{id:'choice-size-l'}]`, price 25000 | **201**, subtotal **25000** |
| 2 | same, price sent 20000 | valid id | **201**, subtotal **25000** — client price ignored, delta applied |
| 3 | unknown id | `modifiers:['nope']` | **400** `Modifier choice not found` |
| 4 | id valid but not linked to item | seed choice, omit link | **400** — must reject, not silently charge base |
| 5 | two choices, same single-select group | `modifiers:['size-l','size-m']` | **400** `duplicate_modifier` |
| 6 | inactive choice (`is_available=0`) | | **400** `modifier_unavailable` |
| 7 | no modifiers | plain item | **201** at base price — no regression |
| 8 | modifier + real customer note | both sent | **201**, `notes` holds only the note, no "Tùy chọn:" |

Cases 3–6 are the important ones: they prove the rejection is *deterministic*
rather than a fallback to base price, which is exactly the silent bug that
shipped the first time.

## Implementation steps

1. Copy `verify-size-pricing.mjs` from the earlier plan dir as the starting
   point — same harness, same read-back pattern.
2. Seed the modifier rows into the local D1 before the POSTs.
3. Run each case; record actual `HTTP` and actual `order_items.subtotal` in a
   results table in `plans/261023-1534-priced-beverage-modifiers/verification/`.
4. Assert case 1 and 2 are 201 with the delta applied — if either stores the base
   price, stop and report; that is the original bug.

## Success criteria

- Cases 1, 2, 7, 8 → **201** with correct subtotals
- Cases 3, 4, 5, 6 → **400** with the specific rejection code
- `order_items.modifiers` JSON contains the structured objects
- Full suite: **7 failed files / 26 failed tests, identical to baseline**
  (those are pre-existing auth failures, unrelated). Any *new* failure is a
  regression — investigate before shipping.

## Risks

| Risk | Mitigation |
|---|---|
| Seed drift between plan and harness | Script the seed; do not hand-insert |
| Local D1 state from earlier runs | Fresh DB per run |

## Completion

Once this passes, the backlog entry in `docs/05_TASKS/menu.md` ("Priced product
variants") can be marked implemented and the changelog updated.
