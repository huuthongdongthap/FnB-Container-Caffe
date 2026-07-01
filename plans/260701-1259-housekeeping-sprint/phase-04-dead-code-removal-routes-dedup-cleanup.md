---
phase: 4
title: "Dead Code Removal: Routes + Dedup + Cleanup"
status: pending
priority: P2
dependencies: []
effort: 2h
---

# Phase 4: Dead Code Removal — Routes + Dedup + Cleanup

## Overview

Add App.tsx routes for 4 unreachable pages + 404 catch-all. Delete 2 dead files (use-track-order.ts, file-allocation-registry.ts). Deduplicate 7 type exports across hook/store pairs. No behavioral changes — pure cleanup.

## Requirements

- Functional: AboutUs, Contact, BrandGuideline, NotFound pages accessible via routes. 404 catch-all works. Dead files removed. Types single-sourced.
- Non-functional: 0 new TypeScript errors. No regressions in existing tests.

## Architecture

### Route additions in App.tsx
```
/about       → AboutUs page (existing component, never routed)
/contact     → Contact page (existing component, never routed)
/brand       → BrandGuideline page (existing component, never routed)
*            → NotFound page (catch-all 404)
```

### Dead file removal
```
DELETE: src/hooks/use-track-order.ts  (replaced by useOrderStore)
DELETE: src/lib/file-allocation-registry.ts  (build artifact, never imported)
```

### Type deduplication (single source of truth)
```
MenuItem          → define in hooks/stores/use-menu-store.ts, re-export for use-menu.ts
Order             → define in hooks/stores/use-order-store.ts, re-export for use-order.ts
ContactFormData   → define in hooks/stores/use-contact-store.ts, re-export for use-contact.ts
TimeSlot          → define in hooks/stores/use-reservation-store.ts, re-export
TableInfo         → define in hooks/stores/use-reservation-store.ts, re-export
ReservationPayload → define in hooks/stores/use-reservation-store.ts, re-export
REFERRAL_CASHBACK_VND → define in hooks/use-referral.ts (already only used here)
```

## Related Code Files

- Modify: `src/App.tsx` — add 5 routes
- Delete: `src/hooks/use-track-order.ts`
- Delete: `src/lib/file-allocation-registry.ts`
- Modify: `src/hooks/use-menu.ts` — import MenuItem from store
- Modify: `src/hooks/stores/use-menu-store.ts` — ensure MenuItem exported
- Modify: `src/hooks/use-order.ts` — import Order from store
- Modify: `src/hooks/stores/use-order-store.ts` — ensure Order exported
- Modify: `src/hooks/use-contact.ts` — import ContactFormData from store
- Modify: `src/hooks/stores/use-contact-store.ts` — ensure ContactFormData exported
- Modify: `src/hooks/use-reservations.ts` — import types from store
- Modify: `src/hooks/stores/use-reservation-store.ts` — ensure types exported
- Modify: `src/hooks/use-referral.ts` — remove duplicate REFERRAL_CASHBACK_VND from store
- Modify: `src/hooks/stores/use-referral-store.ts` — import from use-referral.ts

## Implementation Steps

1. **Add routes to App.tsx** — 4 page routes + catch-all 404
2. **Verify routes work** — `npm run dev`, navigate to each, confirm page renders
3. **Delete use-track-order.ts** — verify no remaining imports (`grep -r "use-track-order" src/`)
4. **Delete file-allocation-registry.ts** — verify no remaining imports
5. **Deduplicate types** — 7 pairs, store is single source. Update hook imports.
6. **Run tests** — all 423 frontend tests pass
7. **Build** — `npm run build` 0 errors

## Success Criteria

- [ ] `/about`, `/contact`, `/brand` render their pages
- [ ] Unknown paths render NotFound (404 catch-all)
- [ ] `use-track-order.ts` deleted, 0 remaining imports
- [ ] `file-allocation-registry.ts` deleted, 0 remaining imports
- [ ] 7 type exports deduplicated (single source, no circular imports)
- [ ] All 423 frontend tests pass
- [ ] `npm run build` — 0 errors

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Route additions conflict with existing routes | Check App.tsx for path collisions before adding. /about, /contact, /brand are unused paths. |
| Type dedup creates circular imports | Store → hook direction is one-way. Store exports type, hook imports it. No circular risk. |
| use-track-order.ts still referenced by tests | Check test files. If test file exists, delete it too or redirect to order-store tests. |
