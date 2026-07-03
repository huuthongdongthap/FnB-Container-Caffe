---
phase: 1
title: "P1a: Checkout Component"
status: pending
priority: P1
effort: 45m
---

# Phase 1: StitchCheckout Component

## Overview

Convert `stitch-exports/checkout/design.html` → `src/components/stitch/StitchCheckout.tsx`. Glassmorphism checkout with payment form, order summary, PayOS/COD options, dark inputs.

## Requirements

- Glassmorphism payment card with chrome borders
- Order summary panel (items, prices, total)
- PayOS + COD payment options (bronze accent on PayOS)
- Customer info form with dark inputs
- Floating glass total bar
- Chrome gradient place-order button
- Loading/error/empty states

## Related Code Files

- Source: `stitch-exports/checkout/design.html`
- Create: `src/components/stitch/StitchCheckout.tsx`
- Modify: `src/components/stitch/index.ts`

## Implementation Steps

1. Read source HTML + StitchHeader.tsx for patterns
2. Create StitchCheckout.tsx — extract layout + content
3. Map Tailwind → var(--aura-*) tokens
4. Replace Material Symbols with Lucide icons
5. Loading skeleton + error + empty states
6. Export from index.ts
7. npm run build

## Success Criteria

- [ ] Checkout renders glass card, dark inputs, chrome focus
- [ ] PayOS/COD toggles with bronze accent
- [ ] Order summary shows items + total
- [ ] Place order button chrome gradient
- [ ] Loading/error/empty states
- [ ] npm run build — 0 errors
