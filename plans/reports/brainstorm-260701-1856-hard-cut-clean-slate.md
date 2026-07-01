# Brainstorm: Hard Cut + Clean Slate — AURA CAFE React SPA Unification

**Date:** 2026-07-01 | **Mode:** --deep --parallel | **Source:** `/brainstorm next plan`

## Scout Findings

- **React SPA:** 27 pages (19 customer + 8 admin), 85 components, 56 test files, Zustand + TanStack Query
- **Static HTML:** 17 root + 9 admin + 3 signage = ~30 files, all ported to React already, kept for legacy `_redirects` only
- **Backend:** 39 TS + 41 JS files in `worker/src/`. Core routes/middleware = TS. JS = third-party clients (ERPNext, Mautic, pretix, Mixpost, etc.)
- **CSS:** homepage-v6.css (4568 lines, 165 !important) — only needed by legacy static HTML. React SPA uses brand-tokens.css + Tailwind v4.
- **Tests:** 646 unit (60 pre-existing failures), 151 E2E (28 pre-existing failures)
- **Existing plan:** `260701-0942-fnb-fullstack-redesign` — 80% done, 7 phases, 65h estimated. Obsolete.

## Problem Statement

React SPA đã hoàn thành 100% page parity với static HTML. Static HTML + legacy CSS/JS là dead weight gây ra:
- Dual codebase maintenance burden
- 212 !important (165 trong homepage-v6.css không còn dùng)
- 28 E2E failures (nhiều do dual-serving conflicts)
- Confusion về "source of truth" giữa React và static HTML

## Evaluated Approaches

### A: Hard Cut + Clean Slate (CHOSEN)
Xoá toàn bộ static HTML + CSS/JS legacy. SPA only. Backend TS finish. Fix tests. Deploy atomic.

**Pros:** Single source of truth, xoá 165 !important instantly, giảm codebase ~30%, E2E tests đơn giản hơn
**Cons:** Rủi ro nếu có external links đến .html URLs (đã có `_redirects` handle)

### B: Conservative — keep dual serving
Giữ static HTML, chỉ fix tests + backend TS.

**Pros:** Rủi ro thấp nhất, giữ nguyên trạng thái hiện tại
**Cons:** Không giải quyết root cause, dual maintenance tiếp tục

### C: Tests only → green CI
Chỉ fix 60 unit + 28 E2E.

**Pros:** CI gate xanh, effort thấp nhất
**Cons:** Không clean up debt, tests có thể break lại khi đụng legacy code

## Final Solution

**5-phase sequential plan:**

| Phase | Name | Effort |
|-------|------|--------|
| 1 | Audit & Inventory | 2-3h |
| 2 | Hard Cut — Remove Legacy | 3-4h |
| 3 | Backend TS Finish | 6-10h |
| 4 | Fix Tests → Green CI | 8-12h |
| 5 | Atomic Deploy + Verify | 2-3h |

**Total:** 21-32h

### Phase 1: Audit & Inventory
- Map every static HTML → React page (verify 100% parity)
- Map every CSS file → usage (which files loaded by React SPA vs static only)
- Map every JS file → usage (which scripts are static-only)
- Map `_redirects` rules → verify no broken links after cut
- Capture baselines (tests, build, bundle size)

### Phase 2: Hard Cut — Remove Legacy
- Delete 17 root static HTML files (keep index.html — Vite entry)
- Delete 9 admin/*.html (keep if needed for direct admin access — verify)
- Delete 3 signage-widgets/*.html
- Delete legacy CSS: homepage-v6.css, menu-v6.css, + page-specific CSS no longer referenced
- Delete legacy JS: static-only scripts
- Update `_redirects` — keep legacy .html → SPA route redirects
- Verify build passes

### Phase 3: Backend TS Finish
- Convert remaining 41 JS files → TypeScript
- Priority: routes > middleware > clients > templates
- Add Zod validation where missing
- Verify worker build passes (`cd worker && npm run build`)

### Phase 4: Fix Tests → Green CI
- Fix 60 unit failures (jsdom ESM compatibility)
- Fix 28 E2E failures:
  - Update page list in test files (remove deleted static pages)
  - Fix FOVT timing for SPA routes
  - Remove emoji content checks for admin pages (decorative emoji is intentional)
  - Fix nav links test for SPA navigation
- Target: 646/646 unit tests pass, 151/151 E2E pass

### Phase 5: Atomic Deploy + Verify
- Single `deploy:full` to Cloudflare Pages
- Verify SHA match
- Walk protected flows: Checkout, Loyalty, Reservation, KDS, POS
- Verify legacy .html URLs redirect correctly
- Archive all completed plans

## Success Metrics

- Build: 0 errors
- Unit tests: 646/646 pass (0 failures)
- E2E: 151/151 pass
- Static HTML deleted: 30 files
- Legacy CSS deleted: homepage-v6.css + menu-v6.css + others
- !important: 212 → <50
- Codebase: ~30% smaller

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| External links break (.html URLs) | `_redirects` handles all legacy URL → SPA route |
| Admin pages need direct access | Admin routes already protected in React SPA via `/admin/*` |
| Third-party scripts reference static pages | Grep all JS for `.html` references before delete |
| Deploy breaks production | Atomic deploy + SHA verify + flow walkthrough |

## Unresolved Questions

None.
