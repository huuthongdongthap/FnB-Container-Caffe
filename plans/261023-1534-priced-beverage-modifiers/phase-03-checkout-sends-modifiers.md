# Phase 3 — Checkout Sends Structured Modifiers

**Status:** ⏳ Ready
**Depends on:** Phase 2
**Blocks:** Phase 4

---

## Context

`src/pages/checkout.tsx:108-121` builds the order payload. The item currently
sends `id`, `product_id`, `productId`, `name`, `price`, `quantity`, and `notes`
— and pushes the modifiers into `notes` as prose:

```js
notes: [
  i.notes,
  Array.isArray(i.modifiers) && i.modifiers.length > 0
    ? `Tùy chọn: ${i.modifiers.join(', ')}`
    : '',
].filter(Boolean).join(' | '),
```

So the kitchen receives "Tùy chọn: Size Lớn, Kem cheese" as free text and the
server charges nothing for it. This is the single line that costs the surcharge.

The receiving end is already built: `order-snapshot.ts:64-72` forwards
`modifiers` straight into the resolver, `:80-82` writes back `unitPriceCents` and
`validatedModifiers`. Nothing server-side changes in this phase.

## Requirements

- Payload sends `modifiers: [{ id, name }]` per item
- `notes` carries **only** the customer's actual note — no option echo
- `price` in the payload stays what it is today: `fallbackPrice` only
  (`order-snapshot.ts:66`). The server overrides it whenever the DB row exists
  (`pricing-resolver.ts:148-150`), which is the correct authority — do not
  "fix" the client to compute the total
- Client-side subtotal must be computed the same way, or the customer sees a
  different total than the server charges

## Implementation steps

1. `checkout.tsx:108-121` — item mapping becomes:

```js
modifiers: Array.isArray(i.modifiers) && i.modifiers.length > 0
  ? i.modifiers.map((m) => ({ id: m.id, name: m.name }))
  : undefined,
notes: i.notes || undefined,
```

2. **Client subtotal** — find the line-total computation and add the seeded
   `price_delta` from the same source the cart used, so displayed and charged
   totals agree. The old UI had this wrong (showed 34.000₫, charged 29.000₫);
   matching the server here is the point of the whole change.

3. **Verify the server rejects a bad id deterministically** rather than silently
   discarding: `order-snapshot.ts:74-78` maps `resolved.rejection` to a
   rejection, which is the HTTP 400 path. A malformed modifier must fail loudly,
   not drop.

4. Check the request validator for this route accepts a `modifiers` array —
   if the schema currently forbids unknown keys, a well-formed payload would be
   stripped before it reaches the command.

## Success criteria

- DevTools/network capture shows `modifiers` present in the POST body
- `notes` no longer contains "Tùy chọn:"
- `order_items.subtotal` (D1) = menu price + seeded delta × quantity
- `order_items.modifiers` (JSON column) holds the structured array —
  `create-order.ts:89-91` already stringifies it
- A deliberately invalid modifier id → 400 with a clear message, not a silent 201
  at base price
- Order history shows the modifier with its adjustment
  (`customer-order-payload.ts:66-70` already reads `{ name, priceAdjustment }`)

## Risks

| Risk | Mitigation |
|---|---|
| Route validator drops unknown keys | Checked in step 4; add to schema if missing |
| Client/server total divergence | Step 2; covered by phase 4 |
| Notes regression — losing real customer notes | Step 1 keeps `i.notes` intact; test a note-only order |

## Next steps

Phase 4 — end-to-end verification against a local D1.
