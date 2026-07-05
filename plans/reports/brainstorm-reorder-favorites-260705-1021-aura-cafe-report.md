# AURA CAFE — Reorder + Favorites

**Date:** 2026-07-05 10:21
**Project:** FnB-Container-Caffe (AURA CAFE)
**Mode:** brainstorm → `/ck:plan`
**Context:** After deploying Phases 1-5 (token migration, CLI, quality, HelmetHead), the focus shifts to customer-facing features that drive repeat orders.

---

## Problem

Returning customers want to re-order their usual items quickly. Current flow requires: browse menu → search items → add to cart. No "reorder from history" or "favorites" exist. Menu sharing is manual (screenshot).

## Design

### Feature A: Reorder from History

**How it works:**
1. Account dashboard shows past orders with a "Reorder" button
2. Clicking "Reorder" → clears current cart → adds all items from that order → navigates to checkout
3. Uses existing `GET /api/orders/my-orders` API and `useCartStore.addItem()`

**Touchpoints:**
- `src/components/stitch/StitchAccountDashNew.tsx` — add "Reorder" button to each order
- `src/hooks/use-account.ts` — parse `OrderSummary.items` string to item array
- `src/hooks/stores/use-cart-store.ts` — already has `addItem()`, `clearCart()`
- `src/pages/account/index.tsx` — may need reorder navigation handler

**No API changes needed.** Items array is already returned in the order summary.

**Effort:** 2h

### Feature B: Favorites

**How it works:**
1. Heart icon on each menu item in menu page
2. Click heart → saves to favorites (localStorage via Zustand)
3. Menu page has "Favorites" filter toggle
4. Account dashboard shows "My Favorites" section

**Touchpoints:**
- Create: `src/hooks/stores/use-favorites-store.ts` — Zustand + localStorage persistence
- Modify: `src/pages/menu.tsx` — add heart icon + favorites filter
- Modify: `src/components/stitch/StitchAccountDashNew.tsx` — add favorites section
- Modify: `src/locales/en.json`, `src/locales/vi.json` — add i18n keys

**No API changes needed.** Favorites are entirely client-side (localStorage).

**Effort:** 2h

## Success Criteria

- [ ] Reorder button appears on past orders in account dashboard
- [ ] Reorder populates cart with all items from that order
- [ ] Reorder navigates to checkout
- [ ] Heart icon toggles on menu items
- [ ] Favorites filter works on menu page
- [ ] Favorites persist across page reloads (localStorage)
- [ ] Favorites section in account dashboard
- [ ] i18n bilingual (en + vi)
- [ ] Build: 0 TS errors
- [ ] Tests: 1,091+ passing

## Risks

- `OrderSummary.items` is typed as `string` — may need JSON.parse
- AccountDashboard is a Stitch-generated component (694 lines) — careful edits
- Favorites store is new — follow existing Zustand store patterns

## Next Steps

Hand off to `/ck:plan` for execution.
