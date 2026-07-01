---
status: complete
date: 2026-07-01
effort: 20h
tdd: true
---

# Plan: Mixpost Social Media Bridge

**Plan ID:** 260701-0040-mixpost-social-media-bridge
**Status:** complete
**Effort:** 20h
**TDD:** Tests before implementation per phase

## Overview

Self-hosted Mixpost (Docker) as social media publishing engine + CF Worker bridge that auto-generates posts from Aura D1 data (promos, menu specials). Cafe owner configures Facebook/Instagram in Mixpost UI. Worker pushes content to Mixpost API. Daily cron auto-posts.

## Architecture

```
Aura CF Worker                     Mixpost Docker (VPS:9000)
┌──────────────────────┐           ┌────────────────────────┐
│ /api/mixpost/        │──REST──→  │ Mixpost API            │
│   posts (CRUD)        │  Bearer   │  POST /api/mixpost/    │
│   generate (promo→post)│  token   │    posts               │
│   accounts (list)     │           │    media               │
│                       │           │    accounts            │
│ Cron: auto-post       │──REST──→  │                        │──→ Facebook
│   daily specials      │           │ Mixpost UI (Vue SPA)   │──→ Instagram
└──────────────────────┘           └────────────────────────┘
```

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 01 | Mixpost Docker + API setup | 3h | complete |
| 02 | CF Worker bridge (TDD) | 8h | complete |
| 03 | Auto-scheduling cron | 4h | complete |
| 04 | Setup guide + finalize | 5h | complete |

## Dependencies

- Mixpost Docker on cafe VPS/RPi (user provisioned, guide in Phase 01)
- Mixpost REST API add-on (`inovector/mixpost-api` Composer package)
- Facebook/Instagram accounts configured in Mixpost (cafe owner)
- Env vars: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`

## Files

### Created
- `worker/src/routes/mixpost.js` — bridge routes + cron export
- `worker/src/lib/mixpost-client.js` — Mixpost API HTTP client
- `tests/mixpost-bridge.test.js` — TDD tests
- `docs/mixpost-setup-guide.md` — bilingual setup guide

### Modified
- `worker/src/index.js` — register `/api/mixpost` routes

### Read-only
- `promotions`, `products`, `categories` D1 tables

## Success Criteria

- [x] Mixpost Docker running with API add-on, token issued
- [x] CF Worker creates post in Mixpost from D1 promotion data
- [x] Daily cron pushes today's specials to Mixpost queue
- [x] Auto-generated posts have Aura branding (hashtags, cafe name)
- [x] All tests pass, 0 build errors, 0 regressions
- [x] Bilingual VN+EN setup guide with copy-paste commands
