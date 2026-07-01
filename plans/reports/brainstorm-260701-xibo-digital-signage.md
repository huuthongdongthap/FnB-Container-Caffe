# Brainstorm — Xibo Digital Signage for Aura Cafe

**Date:** 2026-07-01
**Topic:** Digital menu boards + promo screens via Xibo CMS
**Chosen:** Xibo CMS (Docker) + Aura signage API + HTML widgets

## Problem

Cafe has TV screens but no dynamic content. Menu changes, promos require manual updates or static slides. Need auto-updating digital signage pulling from existing Aura data.

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

## Deliverables

| Component | Effort |
|-----------|--------|
| Xibo Docker setup guide | 3h |
| `/api/signage/menu` endpoint | 3h |
| `/api/signage/promos` endpoint | 2h |
| Menu Board HTML widget | 4h |
| Promo Screen HTML widget | 4h |
| Tests + docs | 4h |
| **Total** | **20h** |

## Key Decisions

- **Xibo over Anthias:** REST API + widget system + active 2026 releases (v4.4.3)
- **HTML widgets over PHP modules:** Same JS stack, no PHP, simpler
- **Polling over WebSocket:** `setInterval()` 60s refresh — good enough for menu boards
- **Read-only from existing D1:** No new data stores

## Scope

- IN: Xibo Docker, menu board widget, promo screen, signage API
- OUT: RPi hardware, player install on TVs, video content, touch screens

## Touchpoints

- NEW: `worker/src/routes/signage.js`
- NEW: `signage-widgets/` (HTML templates)
- NEW: `docs/xibo-setup-guide.md`
- EXISTING: `menu.js`, `promotions.js` (read-only)

## Success Criteria

- Menu + promo endpoints return TV-optimized data
- Widgets render at 1920x1080, large readable text
- Auto-refresh on content change
- Step-by-step Docker setup guide
- All tests pass, 0 build errors
