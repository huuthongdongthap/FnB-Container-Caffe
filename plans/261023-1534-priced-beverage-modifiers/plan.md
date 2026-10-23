# Priced Beverage Modifiers (Size / Add-ons)

**Status:** Blocked on commercial decisions
**Source:** Brainstorm `--deep` 2026-10-23
**Scope:** 3 steps, ~4h code + business decisions

---

## Outcome

Customer picks Size L or a topping in the drink modal, the cart carries the
choice, checkout sends it as a structured modifier, and the server charges the
correct price — the amount the customer saw. Price shown = price charged.

## Non-goals

- No display-only options (user decision: removed, stays removed)
- No server-side pricing changes — already complete
- No happy-hour / channel-delta changes
- No cart-store rewrite

## Contract fields

| Field | Value |
|---|---|
| Outcome | Priced modifiers reach the kitchen as priced lines |
| Constraints | Server stays price-authoritative; no regression on the 26 pre-existing failures |
| Non-goals | Not touching server pricing, not a UI redesign |
| Acceptance | Order line subtotal = menu price + seeded modifier delta |

---

## The scope is smaller than assumed — verified

The original plan said 3 work items including "make pricing-resolver apply
modifiers". **That is already done.** Evidence:

- `packages/domain/catalog/policies/pricing-resolver.ts:153-210` validates
  modifiers against `modifier_choices`, returns `modifierDelta`, and applies it
  via `resolveItemPrice` → `unitPriceCents`.
- `packages/domain/catalog/policies/modifier-validation.ts:1-13` states the
  contract: client `price_delta` never trusted, unknown id → deterministic
  rejection, modifier must belong to the product.
- `order-snapshot.ts:64-83` already forwards `modifiers` into the resolver and
  writes back `unitPriceCents` + `validatedModifiers`.

So the real gap is only the **front half** of the chain.

## Actual remaining gaps

| # | Gap | Evidence | Size |
|---|---|---|---|
| A | `modifier_groups` / `modifier_choices` / `product_modifier_groups` have **zero rows** — migration creates the tables with 0 INSERTs, no seed script exists | `worker/db/migrations/20261007_02_catalog_modifiers_contract.sql`, `scripts/` (100+ files, none seeding) | ~2h + commercial decision |
| B | `checkout.tsx:108-121` flattens modifiers into a `notes` string; never sends a `modifiers` array | read directly | ~1h |
| C | Cart carries modifiers as **plain strings**; the resolver needs a choice **id** | `use-cart-store.ts:18` `modifiers?: string[]`; `DrinkCustomizerModal.tsx:19` | ~1h |

## Discovery that changes the design (verified 2026-10-23)

**The synthetic cart id and the resolver's DB lookup collide.**

`menu.tsx:114-118` builds the cart line id as `` `${item.id}${modKey}${noteKey}` ``
where `modKey` is `` `-${modifiers.join('_')}` ``. So an item with size "Lớn" and
note "ít đá" gets id `tc001-Lớn_ít đá`.

That suffixed id is a **display/de-dup key only**. `checkout.tsx:108` correctly
sends `product_id: i.productId` (the clean base id), which is what the resolver
looks up — so the resolver path is safe today.

But `use-cart-store.ts:44-60` (`extractBaseProductId`) exists specifically to
strip that suffix again, and `:120` hardcodes a ready-to-serve check against the
**base** id. It strips using the *modifier strings it is handed*:

```
const modSuffix = `-${modifiers.join('_')}`;
if (rawId.endsWith(modSuffix)) return rawId.slice(0, -modSuffix.length)
```

If step C changes `modifiers` from `['Lớn']` to `[{id:'size-l',...}]`, the
`join('_')` string no longer matches the suffix built from the old strings, and
this strip silently stops working — wrong product id reaches the server, or the
ready-to-serve bypass breaks.

**Consequence:** C cannot be done as a simple type change. Either the suffix
logic is replaced with a structured key, or ids stop encoding modifiers at all.

## Phases

| Phase | File | Status |
|---|---|---|
| 1 | `phase-01-seed-modifier-catalog.md` | Blocked — needs commercial decision |
| 2 | `phase-02-carry-structured-modifiers.md` | Ready (design contingent on phase 1) |
| 3 | `phase-03-checkout-sends-modifiers.md` | Ready |
| 4 | `phase-04-verify-end-to-end.md` | Ready |

## Open commercial questions (blocking)

1. Which items get size — all craft drinks, or specific ones?
2. Is size a **surcharge** (+5.000₫ over base) or a **re-priced tier** (each size its own price)?
3. Topping prices: the old UI showed +5.000đ / +8.000đ — keep those numbers?
4. Can a size group combine with a topping group? `modifier-validation.ts`
   rejects multiple choices in one group, so single-select per group is a hard rule.

## Risks

| Risk | Mitigation |
|---|---|
| Unknown modifier id → HTTP 400, **entire order rejected** | Case C of `verification/size-pricing-results.md` proved this. Integration test before any UI work |
| `extractBaseProductId` strip breaks on the type change | Covered explicitly in phase 2 |
| Pre-existing 26 test failures get attributed to this work | Baseline recorded: 7 files / 26 tests, auth-related, unrelated |
