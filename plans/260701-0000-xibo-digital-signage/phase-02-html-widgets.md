# Phase 02 — HTML Widgets for Xibo (TDD)

**Status:** complete
**Priority:** High
**TDD:** ✅ Write tests first, then implement

## Overview

Create standalone HTML widgets that Xibo CMS loads in Embedded HTML regions. Each widget fetches from Aura signage API and renders at 1920×1080 with large text, cafe branding, and auto-refresh.

## Widgets

### 1. Menu Board (`signage-widgets/menu-board.html`)
- Fetches `/api/signage/menu` every 60s
- Renders: category headings → product grid with name, price, image
- Dark background (#1a1a2e) with gold accents (#d4a853) — Aura brand
- Font sizes: 48px category, 32px product name, 28px price
- Responsive grid layout for 16:9 landscape

### 2. Promo Screen (`signage-widgets/promo-screen.html`)
- Fetches `/api/signage/promos` every 60s
- Auto-rotating carousel: each promo 8s
- Large promo title, discount percentage, expiry countdown
- Gradient background with Aura branding

### 3. Welcome/Idle Screen (`signage-widgets/welcome-screen.html`)
- Static welcome + logo + wifi password + today's specials
- Fetches `/api/signage/promos` for "today's special" section
- Rotates between welcome, wifi info, loyalty program highlights

## Requirements

### Functional
- Self-contained HTML files (no build step — Xibo loads raw HTML)
- `fetch()` from Aura Worker API (configurable `API_BASE` const at top)
- Auto-refresh via `setInterval()` every 60s
- Graceful error: show last-known data, "Đang tải..." overlay on error
- Vietnamese content with Aura branding

### Non-functional
- Zero external dependencies (no CDN, no npm) — work offline after initial load
- Inline CSS (no external stylesheets — Xibo Embedded HTML limitation)
- Keyboard/mouse inactive (read-only display)
- Testable: extract data-fetching from rendering for unit tests

## Implementation Steps

1. [x] Write TDD tests for widget rendering (jsdom-based, verify DOM structure)
2. [x] Implement `menu-board.html` with fetch + render + auto-refresh
3. [x] Implement `promo-screen.html` with carousel rotation
4. [x] Implement `welcome-screen.html` with multi-section rotation
5. [x] Verify all widget tests pass

## Files

- **NEW:** `signage-widgets/menu-board.html`
- **NEW:** `signage-widgets/promo-screen.html`
- **NEW:** `signage-widgets/welcome-screen.html`
- **NEW:** `tests/signage-widgets.test.js`

## Success Criteria

- [x] Menu board renders categories + products at 1920×1080
- [x] Promo screen rotates every 8s, shows discount + expiry
- [x] Auto-refresh fetches new data every 60s
- [x] Graceful error handling with "Đang tải..." indicator
- [x] Zero external CDN dependencies (offline-capable after load)
- [x] Tests pass, no lint errors
