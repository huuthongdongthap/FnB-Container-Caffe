---
title: "AURA CAFE — Reorder + Favorites"
date: 2026-07-05
type: feature
---

# AURA CAFE: Reorder + Favorites

**Commit:** `5140e3f` on `main`

## Summary

Two customer-facing features designed to reduce friction for returning customers, implemented in parallel.

### Reorder from History
- "Reorder" button on each past order in account dashboard
- One-tap: clears cart → adds all items with correct quantities → navigates to checkout
- Confirmation dialog if existing cart has items (prevents silent data loss)
- Parses `OrderSummary.items` JSON string for item names, prices, quantities

### Favorites
- New `use-favorites-store.ts` (Zustand + localStorage)
- Heart icon toggle on each menu item (filled/outline)
- "Favorites" filter toggle on menu page (`aria-pressed`)
- "My Favorites" section in account dashboard

### Stats
- 270 insertions, 12 deletions, 6 files
- 1 new store file, 4 modified component/page files, 2 locale files
- Build: 0 TS errors
- Tests: 1,091/1,091
