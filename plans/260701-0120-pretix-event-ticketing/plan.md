---
status: complete
date: 2026-07-01
effort: 25h
tdd: true
---

# Plan: pretix Event Ticketing Bridge

**Plan ID:** 260701-0120-pretix-event-ticketing
**Status:** complete
**Effort:** 25h
**TDD:** Tests before implementation per phase

## Overview

Self-hosted pretix (Docker) as event ticketing engine + CF Worker bridge that embeds ticket widget on cafe website, syncs orders to D1 via webhooks, proxies check-in API, and auto-generates social posts for new events.

## Architecture

```
Aura CF Worker                     pretix Docker (VPS:9001)
┌──────────────────────┐           ┌────────────────────────┐
│ /api/pretix/         │──REST──→  │ pretix REST API        │
│   events (list)      │  Token    │  /api/v1/organizers/   │
│   orders (sync)      │           │  /api/v1/.../events/   │
│   checkin (proxy)    │           │  /api/v1/.../orders/   │
│   webhook (receive)  │←──POST─── │  /api/v1/.../checkinlists/│
│                       │  Webhook │                        │
│ Website /workshops    │──embed──→│ pretix Widget (JS)     │──→ Checkout
└──────────────────────┘           └────────────────────────┘
```

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 01 | pretix Docker + API setup | 3h | complete |
| 02 | CF Worker bridge TDD | 8h | complete |
| 03 | Webhook handler + D1 sync | 5h | complete |
| 04 | Widget embed + check-in proxy | 4h | complete |
| 05 | Setup guide + finalize | 5h | complete |

## Dependencies

- pretix Docker on cafe VPS (port 9001, behind nginx reverse proxy)
- PostgreSQL + Redis (bundled in docker-compose)
- pretix REST API token (generated in admin UI)
- Env vars: `PRETIX_API_URL`, `PRETIX_API_TOKEN`, `PRETIX_ORGANIZER`, `PRETIX_WEBHOOK_SECRET`

## Files

### Created
- `worker/src/routes/pretix.js` — bridge routes + webhook handler
- `worker/src/lib/pretix-client.js` — pretix REST API HTTP client
- `tests/pretix-bridge.test.js` — TDD tests
- `docs/pretix-setup-guide.md` — bilingual setup guide

### Modified
- `worker/src/index.js` — register `/api/pretix` routes
- Website `/workshops` page — embed pretix widget (if exists)

## Success Criteria

- [ ] pretix Docker running with API token issued
- [ ] CF Worker lists events and ticket types from pretix
- [ ] Webhook receives order.placed → syncs to D1
- [ ] Check-in API proxies scan requests to pretix
- [ ] pretix widget embedded on /workshops page
- [ ] Setup guide with copy-paste Docker commands (VN+EN)
- [ ] All tests pass, 0 build errors, 0 regressions
