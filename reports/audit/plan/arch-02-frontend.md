# Arch Audit 02 — Frontend (React 18 / Vite / TS)

**Goal:** check lại toàn bộ kiến trúc (--auto --parallel) | **Date:** 2026-09-07 | **Mode:** in-session (subagent 403 fallback)
**Scope:** src/ (1,013 non-test TS/TSX, 75k LOC), routes/, locales/, lib/, build config. Tests: 341 files / 3,115 passing (43.5s). tsc --noEmit: CLEAN.

## Executive Summary

Well-modularized FE: file sizes remarkably disciplined (largest page = checkout.tsx at 218 lines — 200-line rule respected project-wide); route-level React.lazy on all 4 route modules (public 31/31 lazy, admin 28, stitch 22, mobile 5); single ApiClient with error interceptor; i18n complete (vi/en ~2.2k lines each). Tests green. Risks: 18 scattered raw fetch() bypassing ApiClient, stale "luxury" copy remnants (rustic rebrand per prior plan), 61 `<img>` without dims (CLS), zero prefers-reduced-motion coverage.

## Findings

| ID | Sev | file:line | Issue | Fix |
|---|---|---|---|---|
| F1 | P1 | `src/lib/api-client.ts` vs 18 scattered `fetch(` calls (12 files: checkout.tsx:127, TableCheckin.tsx, use-push-notifications.ts×3, mobile-login, register, saas/receipt-download, cancel-dialog, admin/×3, [locale]/pricing, staff/notification-settings×2) | Bypasses unified auth/error handling — API base changes, 401 handling, and error telemetry inconsistent | Wrap all in ApiClient methods (add fetchPassthrough for binary/streams) |
| F2 | P1 | `index.html` (no preload on Google Fonts CSS) + `global.css` font tokens | Render-blocking external font chain (fonts.googleapis.com CSS → N font files); FOUT risk on 3G | `rel="preload" as="style"` + `media="print" onload` swap, or self-host woff2 |
| F3 | P1 | 61 `<img>` w/o width/height across stitch pages (gallery-new:119, our-story×3, luxury-cafe-1×3, subscriptions-new:127, loyalty-rewards, digital-menu-2, GenerateQR-qr-card, loyalty-header:71) | CLS on image-heavy pages (Core Web Vitals) | Add width/height attrs (ui-ux-pro-max `image-dimension` rule) |
| F4 | P2 | `src/pages/stitch/luxury-cafe-1/`, `luxury-landing` route refs, `LuxuryTax` strings | Prior audit (00-summary.md rustic plan) found 46 stitch files w/ `EB Garamond` inline serif + luxury copy — rebrand incomplete | Execute remaining rustic-pass Wave 1 (per reports/audit/plan/00-summary.md) |
| F5 | P2 | `stitch-exports/`, `src/pages/stitch/`, `src/pages/stitch-screen-gallery/`, root `check-routes.mjs`, `tmp_*.py`, `fix_*.py`, `debug_brace.py`, `test-phase0*.sh`, `CEO-HANDOVER.md.bak`, `.tmp_fix_redirects.py`, root `ui-css-audit*.tmp.mjs` | Repo root carries 10+ one-off fix/debug scripts + backup files — dead weight in repo | Move to scripts/archive/ or delete; tmp audit scripts from prior session removable |
| F6 | P2 | `src/pages/order-failure.tsx` (184 lines) vs `src/pages/stitch/order-failure/index.tsx` (196) + `order-success` pattern | Duplicate page pairs (new stitch page vs legacy page) — which one routes? verify router then delete legacy | Consolidate to stitch variant |
| F7 | P2 | Zero `prefers-reduced-motion` handling in src/ (grep: 0 hits) while app has animations | Accessibility rule `reduced-motion` (ui-ux-pro-max priority-1) violated | Add media query in global.css disabling transitions |
| F8 | P2 | `loading="lazy"` count = 0 on `<img>` (grep) — every image eager-loads | Below-fold bandwidth waste on menu/gallery pages | Add loading="lazy" to below-fold imgs |
| F9 | P3 | 837 inline `style={{}}` usages (pages+components) | Spot-checked: dynamic calc styles (justify offsets, widths) — legit, but count high; some are static values extractable to classes | Extract static ones to utility classes; keep dynamic |
| F10 | P3 | `src/pages/[locale]/` only contains pricing.tsx (1 file) while app i18n is manual (locales vi/en JSON via i18n.ts) | Half-migrated locale-routing: [locale] dir suggests URL-based locale not implemented app-wide | Decide: URL locale routing OR remove [locale] dir; keep single-locale + toggle |
| F11 | P3 | Root `test-results/`, `coverage/`, `failed-suites.json`, `all-results.json` (183KB), `test-output.log` (37KB) committed? (untracked/partially ignored) | Build/test artifacts at repo root noise | Verify .gitignore covers; delete stale |
| F12 | P3 | `_dist_backup/`, `~/` dir at root | Stray backup dirs in repo root | Delete/archive |

## Architecture Strengths (verified)

- **Modularization exemplary**: 1,013 files averaging ~74 lines; zero file >220 lines. Multi-file page pattern (ReviewsPage split into -pagination, -utils, -write-review-form) is textbook.
- **Code splitting complete**: all 4 route groups use React.lazy per page; no eager page imports.
- **Single API client** w/ interceptor + typed ApiClientError.
- **i18n parity**: en.json 2,186 / vi.json 2,177 lines — near-1:1 key parity.
- **Tests green + tsc clean** at root.

## Top 5 Architectural Risks

1. **F1 API bypass** — 18 raw fetches = inconsistent auth/error path (bug-prone on token refresh).
2. **F3+F8 image perf** — CLS + eager loading on menu/gallery (customer-facing core).
3. **F4 rebrand incomplete** — rustic plan partially executed (luxury remnants live).
4. **F6 duplicate pages** — order-failure/success dual implementations risk divergence.
5. **F5 repo hygiene** — root-level debris impairs navigation/CI cache.

## Unresolved Questions — RESOLVED inline

- ~~order-failure variant~~: router uses `stitch/order-failure` (public-routes.tsx:30,48); legacy `src/pages/order-failure.tsx` imported NOWHERE → dead code, safe delete (F6 confirmed).
- ~~[locale] dead?~~: `/${loc}/order` routed for vi+en (public-routes.tsx:69) but `[locale]/pricing.tsx` lazy-imported (line 22) — check: only order route exists in flatMap; PricingPage import UNROUTED → dead import (F10 confirmed + pricing.tsx likely dead).
- stitch-exports/ vs src/pages/stitch/ duplication policy (stitch export pipeline output committed?) — still open.

## Resolved Routing Facts

- `/order-failure` → stitch variant. Legacy 184-line file = orphan.
- `PricingPage` imported once, rendered ZERO times (grep `element.*PricingPage` = 0 hits) → orphan import; `[locale]/pricing.tsx` unreachable via router.
