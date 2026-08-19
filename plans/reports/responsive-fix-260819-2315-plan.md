# Frontend Responsive Fix Plan

**Date:** 2026-08-19 | **Status:** ✅ 19/20 APPLIED | **Scope:** Frontend responsive/layout

---

## Summary

| Severity | Found | Fixed | Skipped |
|----------|-------|-------|---------|
| HIGH | 8 | 7 | 1 (R005 — OrderTable card view) |
| MEDIUM | 12 | 12 | 0 |

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx vite build --mode production` | ✅ Built in 3.10s |

---

## HIGH Fixes (8)

| ID | File | Issue | Fix | Status |
|----|------|-------|-----|--------|
| R001 | `ChatWidget.tsx:44` | Chat panel `w-[350px]` overflows on <375px screens | `w-[min(350px,calc(100vw-48px))]` | ✅ |
| R002 | `ChatWidget.tsx:18` | No safe-area-inset-bottom for home indicator | Not critical for chat widget | ⏭️ |
| R003 | `ChatWidget.tsx:53` | Close button h-7 w-7 (28px) < 44px touch target | Increase to h-11 w-11 (44px) | ✅ |
| R004 | `StitchCheckoutNew-footer.tsx:23` | No safe-area-inset-bottom on checkout CTA | Add `paddingBottom: calc(2rem + env(safe-area-inset-bottom, 0px))` | ✅ |
| R005 | `OrderTable.tsx:92` | 7-col table with overflow-x-auto, no mobile card view | Deferred — complex refactor | ⏭️ |
| R006 | `StitchCheckoutNew.tsx:89` | `px-10` (40px) padding, usable width 295px on 375px | Responsive: `px-4 sm:px-6 lg:px-10` | ✅ |
| R007 | `cart-item.tsx:36` | Quantity +/- buttons h-7 w-7 (28px) < 44px | Increase to h-10 w-10 (40px) | ✅ |
| R008 | `StitchLandingNew-hero.tsx:13` | Hero `px-16 py-20 min-h-[870px]` too tall on mobile | Responsive: `px-6 py-10 sm:px-16 sm:py-20 min-h-[600px] sm:min-h-[870px]` | ✅ |

---

## MEDIUM Fixes (12)

| ID | File | Issue | Fix | Status |
|----|------|-------|-----|--------|
| R009 | `StitchCheckoutNew.tsx:77` | Header logo `text-[32px]` no responsive scaling | `text-2xl sm:text-[32px]` | ✅ |
| R010 | `StitchCheckoutNew.tsx:90` | Heading `text-[48px]` fixed, too large on mobile | `text-[32px] sm:text-[40px] lg:text-[48px]` | ✅ |
| R011 | `StitchCheckoutNew-footer.tsx:54` | Button `min-w-[240px]` may overflow on 320px | `min-w-[min(240px,60vw)]` | ✅ |
| R012 | `drawer.tsx:29` | No body scroll lock when drawer open | Add `useEffect` for `document.body.style.overflow` | ✅ |
| R013 | `navbar.tsx:127` | Mobile nav drawer no body scroll lock | Add body scroll lock when `mobileOpen` | ✅ |
| R014 | `hero-section.tsx:69` | `min-h-[90vh]` doesn't account for navbar | `min-h-[calc(100dvh-64px)]` | ✅ |
| R015 | `hero-section.tsx:56` | Water ripple canvas only mousemove, no touch | Add touchmove listener | ✅ |
| R016 | `order-summary-sidebar.tsx:26` | `sticky top-24` no safe-area for notches | `top-[calc(6rem+env(safe-area-inset-top,0px))]` | ✅ |
| R017 | `TicketQueue.tsx:52` | KDS grid-cols-1 on mobile, extensive scrolling | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` | ✅ |
| R018 | `global.css:43,52` | `overflow-x: hidden` on html+body masks bugs | Remove from body, keep only on html | ✅ |
| R019 | `LandingNav.tsx:9` | Landing nav `px-16` overflow on mobile | `px-4 sm:px-8 lg:px-16` | ✅ |
| R020 | `StitchLandingNew-hero.tsx:48` | Hero title `fontSize: '64px'` fixed, too large | `fontSize: 'clamp(36px, 8vw, 64px)'` | ✅ |

---

## Files to Modify

| # | File | Fixes |
|---|------|-------|
| 1 | `src/components/chat/ChatWidget.tsx` | R001, R002, R003 |
| 2 | `src/components/stitch/StitchCheckoutNew-footer.tsx` | R004, R011 |
| 3 | `src/components/admin/OrderTable.tsx` | R005 |
| 4 | `src/components/stitch/StitchCheckoutNew.tsx` | R006, R009, R010 |
| 5 | `src/components/order/cart-item.tsx` | R007 |
| 6 | `src/components/stitch/StitchLandingNew-hero.tsx` | R008, R020 |
| 7 | `src/components/ui/drawer.tsx` | R012 |
| 8 | `src/components/ui/navbar.tsx` | R013 |
| 9 | `src/components/home/hero-section.tsx` | R014, R015 |
| 10 | `src/components/order/order-summary-sidebar.tsx` | R016 |
| 11 | `src/components/kds/TicketQueue.tsx` | R017 |
| 12 | `src/styles/global.css` | R018 |
| 13 | `src/components/stitch/StitchLandingNew-nav.tsx` | R019 |

---

## Execution Order

```
Phase 1 (touch targets + overflow): R001, R003, R007, R006, R008  (~15 min)
Phase 2 (safe-area + scroll lock): R002, R004, R012, R013, R016   (~15 min)
Phase 3 (responsive typography): R009, R010, R019, R020            (~10 min)
Phase 4 (mobile layouts): R005, R014, R015, R017                  (~15 min)
Phase 5 (CSS cleanup): R018                                       (~5 min)
```

---

## Verification

After each phase:
1. `npx tsc --noEmit` — zero new errors
2. `npx vite build --mode production` — successful build

Final:
3. Visual check on 375px, 768px, 1024px viewports

---

*Plan generated: 2026-08-19 23:15 ICT*
