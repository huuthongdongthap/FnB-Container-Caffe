---
phase: 2
title: "Favorites"
status: pending
priority: P2
dependencies: []
---

# Phase 2: Favorites

## Overview

Heart icon toggle on menu items, favorites filter on menu page, favorites section in account dashboard. Entirely client-side via Zustand + localStorage.

## Architecture

New store: use-favorites-store.ts
- items: Set<string> (item IDs)
- toggle(id), isFavorite(id), all()

Persistence via Zustand localStorage middleware (see cart store pattern).

## Related Code Files

- Create: src/hooks/stores/use-favorites-store.ts
- Modify: src/pages/menu.tsx (heart icon + filter)
- Modify: src/components/stitch/StitchAccountDashNew.tsx (favorites section)
- Modify: src/locales/en.json, src/locales/vi.json

## Implementation Steps

1. Create use-favorites-store.ts with Zustand + localStorage
2. Find menu item render components
3. Add heart icon (Lucide Heart) to each menu item
4. Add Favorites filter toggle above menu grid
5. Add My Favorites section to account dashboard
6. Add i18n keys

## Success Criteria

- [ ] Heart icon on all menu items
- [ ] Toggle heart fills/outlines
- [ ] Favorites persist across page reloads
- [ ] Favorites filter works
- [ ] My Favorites in account dashboard
- [ ] i18n en + vi
- [ ] Build 0 TS errors
- [ ] Tests 1,091+ passing
