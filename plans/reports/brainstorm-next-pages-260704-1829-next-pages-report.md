# Next Phase: New Pages + Fonts + Chunk Splitting

**Date:** 2026-07-04 18:29
**Project:** FnB-Container-Caffe (AURA CAFE)
**Status after quality pass:** Build 0 errors, 1161/1161 tests

## Context

12 unused Stitch New components remain. Quality pass completed all token/i18n/a11y fixes. Next phase: wire remaining components into production routes + fix infrastructure gaps.

## Tracks

### Track A: Font Files + Perf (infrastructure)
- A1: Add Google Fonts `<link>` tags to `index.html` (Space Grotesk 300-700 + Cormorant Garamond 300-700)
- A2: Update `brand-tokens.css` — remove local woff2 references (files don't exist), rely on CDN
- A3: Code-splitting: lazy-load admin routes with `React.lazy()` + `Suspense` to fix >500KB chunk warning

### Track B: Customer Pages (3 new routes)
| Route | Component | Files to modify/create |
|-------|-----------|----------------------|
| `/order` | StitchMobileOrderNew | Create `src/pages/order/index.tsx`, add route in App.tsx |
| `/container` | StitchContainerNew1/2 | Create `src/pages/container/index.tsx`, add route |
| `/events` (replace) | StitchEventsNew2 | Update `src/pages/events.tsx` import, wire data |

### Track C: Admin Pages (3 new/wired)
| Route | Component | Files |
|-------|-----------|-------|
| Admin layout | StitchAdminTerminalNew | Update `AdminLayout.tsx` sidebar structure |
| `/admin/order-mgmt` | StitchOrderMgmtNew | Create page, add admin route |
| `/admin/pos` | StitchPOSNew | Wire into existing POS page with store data |

### Track D: Verify
- `npm run build` → 0 errors
- `npm test` → 1161/1161

## Success Criteria
- [ ] Google Fonts loaded in production (no 404 font warnings)
- [ ] brand-tokens.css no longer references missing woff2 files
- [ ] JS chunks < 500KB after code-splitting
- [ ] 3 new customer routes render correctly (order, container, events-v2)
- [ ] 3 admin enhancements working (layout, order-mgmt, POS)
- [ ] Build + 1161 tests pass
