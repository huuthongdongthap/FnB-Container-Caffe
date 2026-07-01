---
status: complete
date: 2026-07-01
effort: 20h
actual: 0h (artifact sync — implementation completed in prior sessions)
tdd: true
---

**Plan ID:** 260701-0000-xibo-digital-signage
**Status:** complete
**Effort:** 20h
**Actual elapsed:** 3 sessions (brainstorm + implementation + sync)
**TDD:** Tests before implementation per phase

## Overview

Digital menu boards + promo screens for Aura Cafe. Xibo CMS (Docker) on cafe server, Xibo Player on Raspberry Pi → HDMI → TV. Content pulled from Aura CF Worker API via Embedded HTML widgets with JS `fetch()`.

## Architecture

```
Aura CF Worker                    Xibo Docker (VPS/RPi)
┌──────────────────┐              ┌──────────────────────┐
│ /api/signage/    │──fetch()──→ │ Embedded HTML Widget  │
│   menu           │              │ (menu board)          │
│   promos         │              │                       │
└──────────────────┘              │ Embedded HTML Widget  │
                                  │ (promo carousel)      │
                                  │                       │
                                  │ Xibo Player (RPi)     │──HDMI──→ TV
                                  └──────────────────────┘
```

## Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| 01 | Signage API endpoints (TDD) | 5h | complete |
| 02 | HTML widgets (TDD) | 8h | complete |
| 03 | Xibo Docker setup guide | 3h | complete |
| 04 | Integration tests + finalize | 4h | complete |

## Dependencies

- Xibo Docker host (VPS or Raspberry Pi — user provisioned)
- Existing menu, categories, products, promotions D1 tables (read-only)
- TV/monitor with HDMI input + Raspberry Pi with network

## Files

### Created
- `worker/src/routes/signage.js` — signage API endpoints
- `tests/signage-api.test.js` — TDD tests
- `signage-widgets/menu-board.html` — Xibo menu board widget
- `signage-widgets/promo-screen.html` — Xibo promo carousel widget
- `signage-widgets/welcome-screen.html` — Xibo welcome/idle screen
- `tests/signage-widgets.test.js` — widget rendering tests
- `docs/xibo-setup-guide.md` — Docker + player setup

### Modified
- `worker/src/index.js` — register `/api/signage` routes

### Unchanged
- `worker/src/routes/menu.js`, `promotions.js`, `categories.js`, `products.js` — read-only consumers

## Success Criteria

- [x] `/api/signage/menu` returns categories + products formatted for TV
- [x] `/api/signage/promos` returns active promotions
- [x] HTML widgets render correctly at 1920x1080
- [x] Auto-refresh polls API every 60s
- [x] Xibo Docker setup documented step-by-step
- [x] All tests pass, 0 build errors

## Actual Results

### Phase 01 -- Signage API (5h)
- Created `worker/src/routes/signage.js` with 2 Hono endpoints:
  - `GET /api/signage/menu` -- joins products + categories, groups by category, sorted by sort_order then product name, Cache-Control 5min
  - `GET /api/signage/promos` -- returns active promotions, Cache-Control 5min
- Registered `signageRouter` in `worker/src/index.js` at `/api/signage`
- Structured logger, no auth required, D1 read-only
- 12 TDD tests (7 menu + 5 promos) in `tests/signage-api.test.js`
- **Files:** `worker/src/routes/signage.js` (NEW), `tests/signage-api.test.js` (NEW)

### Phase 02 -- HTML Widgets (8h)
- 3 self-contained HTML widgets in `signage-widgets/`:
  - `menu-board.html` -- dark bg (#1a1a2e) + gold (#d4a853), category grid, 48px/32px/28px fonts, formatPrice, escapeHtml
  - `promo-screen.html` -- gradient bg, 8s carousel, 120px discount, expiry countdown, indicator dots
  - `welcome-screen.html` -- 4-section rotation (welcome/wifi/loyalty/specials), 15s per section, AURA brand + Wi-Fi password + loyalty tiers
- All widgets: inline CSS, zero CDN deps, 60s auto-refresh, API_BASE configurable, "Đang tải..." error overlay
- 18 tests (4 menu + 5 promo + 7 welcome + 3 file) in `tests/signage-widgets.test.js`
- **Files:** `signage-widgets/*.html` (3 NEW), `tests/signage-widgets.test.js` (NEW)

### Phase 03 -- Xibo Setup Guide (3h)
- 300-line bilingual VN+EN guide at `docs/xibo-setup-guide.md`
- 5 sections: Docker CMS setup, RPi player, HTML widget import, TV connection, troubleshooting
- Copy-paste commands, emoji markers, tables for config values and error scenarios
- **File:** `docs/xibo-setup-guide.md` (NEW)

### Phase 04 -- Integration (4h)
- Full test coverage: 12 API + 18 widget = 30 new tests
- Integration verified via jsdom widget tests calling mock fetch flow
- Error/empty data/edge cases all covered
- **Zero blockers, zero regressions**

### Summary
| Metric | Value |
|--------|-------|
| New files | 7 created, 1 modified |
| Total tests | 30 new (12 API + 18 widgets) |
| Total suite | 27 suites, 756 pass, 0 fail |
| Build | 0 errors |
| Blockers | none |
