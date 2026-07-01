# Phase 02 — TV Menu Display Page (5h)

**Status:** pending
**Priority:** High
**TDD:** ✅ Tests first — write tests before HTML implementation

## Overview

Build standalone full-screen TV menu display page. Fetches from existing GET /api/menu, auto-refreshes, optimized for 1920x1080 TV.

## TDD Strategy

Write tests FIRST, verify they FAIL (page doesn't exist yet), then implement, verify PASS.

### Test File: `tests/tv-menu-page.test.js`

Test cases (write before implementation):
1. Page loads and renders menu container
2. Fetches from correct API endpoint (/api/menu?available=true&limit=50)
3. Renders items grouped by category
4. Displays item name, price in VND format
5. Auto-refresh interval set to 60s
6. Handles empty menu gracefully
7. Handles API error gracefully (retry after 30s)
8. Handles large menu (>50 items) — only shows available
9. Full-screen CSS applies (100vw, 100vh, no scrollbars)
10. Happy hour banner visible between 14:00-16:00

### Test Approach

Use jsdom for DOM testing. Mock fetch() for API calls. Test structure:

```javascript
describe('TV Menu Page', () => {
  beforeEach(() => {
    document.body.innerHTML = /* load tv-menu.html */;
  });

  it('renders menu items grouped by category', ...);
  it('formats price in VND', ...);
  it('auto-refreshes every 60s', ...);
  // etc.
});
```

## Implementation

### New File: `tv-menu.html`

- Standalone HTML — no framework, no build step
- Inline CSS (single file, no external deps except fonts)
- Vanilla JavaScript
- Design tokens from Bazi v5.1

### Design Spec

```
┌──────────────────────────────────────────────────────┐
│  AURA CAFE — THỰC ĐƠN HÔM NAY                        │
│  ═══════════════════════════════════════════          │
│                                                      │
│  CÀ PHÊ                        │  TRÀ / SMOOTHIE      │
│  ─────                         │  ─────               │
│  Cà Phê Sữa Đá      35.000đ   │  Trà Đào          45K│
│  Cà Phê Đen         25.000đ   │  Trà Vải           45K│
│  Bạc Xỉu            35.000đ   │  Smoothie Xoài    55K │
│  ...                           │  ...                 │
│                                                      │
│  BÁNH NGỌT                     │  HAPPY HOUR 🕐        │
│  ─────                         │  Giảm 20% đồ uống    │
│  Tiramisu           55.000đ    │  14:00 - 16:00       │
│  ...                           │                      │
│                                                      │
│  🕐 Cập nhật: 14:05  |  QR → Đặt món                  │
└──────────────────────────────────────────────────────┘
```

### Design Tokens (Bazi v5.1)

- Background: #0f172a (Navy)
- Text: #e2e8f0
- Gold accent: #c9a96e
- Surface: #1e293b
- Border: #334155
- Fonts: Cormorant Garamond (headings), Space Grotesk (body/prices), JetBrains Mono (timestamps)
- Grid: 2-3 columns depending on category count
- Category header: gold underline, uppercase VN

### API Usage

```javascript
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787/api'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';

async function loadMenu() {
  const res = await fetch(`${API_BASE}/menu?available=true&limit=50`);
  const data = await res.json();
  if (data.success) renderMenu(data.items);
}
```

### Auto-refresh

- Reload menu every 60 seconds
- Show "Cập nhật lúc HH:MM" at bottom
- Fade transition when content changes
- If fetch fails: keep showing old data, show "⚠ Không thể cập nhật" after 3 failures

### Responsive

- Primary target: 1920x1080 (TV landscape)
- Font sizes: large enough to read from 3m distance
  - Category headers: 48px
  - Item names: 28px
  - Prices: 32px
- Fallback: works on 1366x768 (smaller TV)

## Success Criteria

- [ ] 10 tests written BEFORE implementation (verify they FAIL)
- [ ] All 10 tests pass after implementation
- [ ] TV page renders on 1920x1080 without scrollbars
- [ ] Auto-refresh works (verify with timer mock)
- [ ] Happy hour banner shows 14:00-16:00
- [ ] Price formatted in VND (e.g., 35.000đ)
- [ ] Build passes, no new errors
- [ ] Existing 904 tests still pass

## Touchpoints

- **NEW:** `tv-menu.html` (standalone, no backend)
- **READS:** GET /api/menu (existing, no changes)
- **NO changes to:** worker/, js/, css/, admin/
- **Test file:** `tests/tv-menu-page.test.js` (new)

## Risk

- Menu API must return `available=true` items — already supported
- TV browser compatibility: tested on Chrome/Firefox only
- If no device available to connect to TV, can test on regular monitor
