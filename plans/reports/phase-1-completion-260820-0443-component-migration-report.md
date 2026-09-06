# Architecture 10X — Phase 1.5 + Phase 1 Quick-Wins Completion

**Date:** 2026-08-20 04:50 ICT | **Status:** Phase 1.5 ✅ + Phase 1 quick-wins ✅

---

## Completed

### Phase 1.5: Shared Component Library Extraction

| File | Type | LOC | Purpose |
|------|------|-----|---------|
| `src/components/ui/glass-card.tsx` | NEW | 47 | 4 variants (default/dim/bright/bronze), glow support |
| `src/components/ui/bottom-nav.tsx` | NEW | 76 | Items[], activeId, safe-area-inset-bottom, 48px min tap |
| `src/components/ui/index.ts` | EDIT | +2 | Export GlassCard + BottomNav |

**BottomNav migrations (6 files):**
- StitchCheckinNew.tsx ✅
- StitchAccountNew.tsx ✅
- StitchGalleryNew.tsx ✅
- StitchLoyaltyCalcNew.tsx ✅
- StitchPromotionsNew.tsx ✅
- StitchTrackOrderNew.tsx ✅

**Deleted orphaned files (6):**
- StitchAccountNew-bottom-nav.tsx (81 LOC)
- StitchCheckinNew-bottom-nav.tsx (36 LOC)
- StitchGalleryNew-bottom-nav.tsx (52 LOC)
- StitchLoyaltyCalcNew-bottom-nav.tsx (28 LOC)
- StitchPromotionsNew-bottom-nav.tsx (56 LOC)
- StitchTrackOrderNew-bottom-nav.tsx (51 LOC)

**Net:** -304 LOC of duplicated bottom nav code → single 76 LOC primitive

### Phase 1: Per-Route ErrorBoundary

Wrapped all 65+ routes across 4 route files with `<ErrorBoundary>`:
- `public-routes.tsx` — 31 routes
- `stitch-routes.tsx` — 21 routes
- `mobile-routes.tsx` — 4 leaf routes (+ 1 layout)
- `admin-routes.tsx` — 27 leaf routes (+ 1 layout)

**Pattern:** `element={guarded(<Page />)}` — each route now isolates crashes to that route.

### Phase 1: Raw Fetch → apiFetch

All stores already use `apiFetch` from `@/lib/api-client`. Zero raw `fetch()` calls remaining. The only `API_BASE` reference is `EventSource` URL construction in `use-order-store.ts` (intentional — SSE doesn't support custom headers).

---

## GlassCard Migration — Complete (2026-08-20)

Shared `GlassCard` primitive wired into all Stitch card containers:
- `stitch-kds-order-card.tsx` — ticket card (`<article>` → `<GlassCard variant="default">`)
- `StitchCheckoutNew-skeleton.tsx` — skeleton blocks (self-closing `<GlassCard />`)
- `StitchOrderSuccessNew-states.tsx` — skeleton + empty-state icon card
- `StitchEventsNew2-header.tsx` — hero panel (`<div>` → `<GlassCard>`)
- `StitchReferralNew2-hero.tsx` — earnings card (`<div>` → `<GlassCard>`)
- `StitchReferralNew2-steps.tsx` — progress tracker (`<div>` → `<GlassCard>`)
- `StitchCheckoutNew-skeleton.tsx` — 3 layout cards

**Intentional boundary — NOT migrated (structural chrome, not card containers):**
- `StitchCheckoutNew.tsx` — fixed top app bar (`<header>`, restored from erroneous GlassCard)
- `StitchOrderMgmtNew-header.tsx` — mobile overlay (`<div>`, restored)
- `loyalty-header.tsx` — fixed top nav (`<header>`, restored)
- `StitchReferralNew2-header.tsx` — fixed top nav (`<header>`)
- `stitch-kds-sidebar.tsx` — navigation `<aside>`
- `StitchOrderMgmtNew-dashboard.tsx` — uses `GLASS_CLASSES` constant (kept as-is, not a card)

**Fixes during verification:**
- Made `children` optional on `GlassCardProps` to support self-closing skeleton blocks
- Fixed 5 unclosed-JSX errors left by parallel migration agents (restored `<header>`/`<div>` where GlassCard was misapplied to structural chrome)
- Removed duplicate `import { GlassCard }` in `StitchReferralNew2-header.tsx`

**Verification:**
- `npx tsc --noEmit` → 0 errors ✅
- `npx vite build --mode production` → built in 3.40s ✅

## Remaining (Requires Dedicated Sessions)

| Task | Effort | Complexity |
|------|--------|------------|
| Worker split (636 LOC → 20 domain modules) | 2d | High — backend architecture refactor |
| API versioning (/api/v1/) | 1d | Medium — route prefix change |
| OrderStateMachine (FSM for order transitions) | 3d | High — new feature with audit trail |
| Store consolidation (21 → 15) | 1d | Medium — merge checkin→loyalty, payment→order |
| Phase 2: table_sessions, cart modifiers, happy hour, kitchen routing | 2w | High — F&B core features |
| Phase 3: POS, split bill, floor plan, KDS | 2w | High — staff operations |
| Phase 4: i18n, skeletons, E2E, performance | 2w | Medium — quality polish |

---

## Verification

- `npx tsc --noEmit` → 0 errors ✅
- `npx vite build --mode production` → 3.61s ✅ (564.89 KB, +0.54 KB delta)

---

*Completed: 2026-08-20 04:50 ICT*
