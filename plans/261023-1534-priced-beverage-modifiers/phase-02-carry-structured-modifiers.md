# Phase 2 — Carry Structured Modifiers Through the Cart

**Status:** ⏳ Ready — design contingent on phase 1
**Depends on:** Phase 1 (needs the seeded choice ids)
**Blocks:** Phase 3

---

## Context

Modifiers currently travel as **plain strings** end to end:

- `use-cart-store.ts:18` — `modifiers?: string[]`
- `DrinkCustomizerModal.tsx:19` — emits `modifierList: string[]` (Vietnamese
  display labels like `'100% đường (chuẩn)'`)
- `checkout.tsx:111-119` — flattens them into a `notes` string

The server (`modifier-validation.ts:36-48`, `parseModifierInput`) accepts either
a string **or** an object carrying `id`/`choiceId`/`modifierId`. With a string it
can only match on **name**; with an id it matches the row and reads the canonical
`price_delta`. Only the id route is safe — the name route depends on display text
that changed with the recent i18n work and changes again on any copy edit.

So the cart must carry `{ id, name }`, where `name` is kept purely so the UI and
KDS can render without a lookup.

## The trap in this phase

`use-cart-store.ts:44-60` — `extractBaseProductId` strips a synthetic suffix off
the cart id, built from the modifier **strings**:

```js
const modSuffix = `-${modifiers.join('_')}`;
if (rawId.endsWith(modSuffix)) return rawId.slice(0, -modSuffix.length);
```

and `:120` hardcodes the ready-to-serve check against that base id
(`yo004`, `yg004`, `bt001`, `jc004`, `od002`).

`menu.tsx:114-118` builds the suffix from the same strings:

```js
const modKey = modifiers.length > 0 ? `-${modifiers.join('_')}` : '';
id: `${item.id}${modKey}${noteKey}`,
```

**Change `modifiers` to objects and `join('_')` no longer reproduces the suffix.**
The strip silently fails: a ready-to-serve item stops being recognized, or a
suffixed id reaches the resolver and misses the DB row. Both are silent — no
throw, just a wrong product id.

This is why phase 2 is not a mechanical type change.

## Options

| Option | Approach | Assessment |
|---|---|---|
| 1 | Keep the id-encoded suffix, derive it from a new `key` field on each modifier | Keeps de-dup behaviour but leaves two encodings to keep in sync |
| 2 | **Stop encoding modifiers in the id**; de-dup on a structured signature instead | Simplest — one source of truth |
| 3 | Cart stores a `modifierIds: string[]` alongside the existing `modifiers` strings | Least churn, but two parallel arrays drift |

**Recommend Option 2.** The suffix exists only to make two otherwise-identical
lines distinct in the cart. A structured signature (`baseId + sorted ids + notes`)
does the same job without encoding data in an id that something downstream has to
re-strip. It also removes `extractBaseProductId` entirely, and with it the class
of bug described above.

## Implementation steps

1. **Cart item type** (`use-cart-store.ts`): replace `modifiers?: string[]` with

```ts
/** Choice id from the seeded catalog; `name` is display-only for UI and KDS. */
modifiers?: Array<{ id: string; name: string }>;
```

2. **De-dup key**: drop `extractBaseProductId` (`:44-60`). Build the line identity
   from `productId` + sorted modifier ids + normalized notes. Ready-to-serve
   detection (`:67`, `:120`) reads `productId` directly — it no longer needs the
   strip at all, which is a simplification, not just a change.
3. **Migration of persisted carts** (`:110-132`): the localStorage migration
   reads old-format strings. Coerce `['Lớn']` → `[{ id: '', name: 'Lớn' }]`, or
   drop modifiers on legacy rows — dropping is safer than guessing ids, and the
   affected carts are stale by definition.
4. **Modal** (`DrinkCustomizerModal.tsx:89-93`): emit `{ id, name }`. The rule
   layer (`menu-option-rules.ts`) currently exports label arrays only, so it must
   also export the seeded id per option. Add ids in the same arrays:

```ts
{ id: 'sweetness-100', label: '100% đường (chuẩn)' }
```

This touches the group sections and `DrinkOptionGroup` props (label → option
object).

5. **Ready-to-serve check**: `isReadyToServeItem` stays keyed on
   `id`/`category`/`name` — unchanged, since the bypass decision happens before
   options exist.

## Success criteria

- `tsc --noEmit` clean
- Cart stores `{ id, name }`; no `join('_')` anywhere
- Two lines differing only by modifier choice are still **separate** cart rows
- Same base item + same modifier + same note collapses to one row
- Ready-to-serve items still bypass (`yo004`, `yg004`, `bt001`, `jc004`, `od002`)
- Existing cart tests pass; new tests in `src/lib/__tests__/` for the de-dup key

## Risks

| Risk | Mitigation |
|---|---|
| Regression in cart de-dup | Unit tests for the key function — same/different inputs each way |
| Breaking live carts in localStorage | Coerce-or-drop migration; never throw during rehydrate |
| `DrinkOptionGroup` props churn | Contained — one component, one call site |

## Next steps

Phase 3 — send the array in the checkout payload.
