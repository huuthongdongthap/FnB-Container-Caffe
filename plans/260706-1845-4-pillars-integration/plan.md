---
name: 260706-1845-4-pillars-integration
title: 4 Pillars Integration — TastyIgniter + HA + Frigate + ERPNext Phase 08
status: pending
date: 2026-07-06
depends_on: [260706-0230-g5-erpnext-wiring, Digital Gap Closure]
---

# 4 Pillars Integration — Implementation Plan

## Mục tiêu

Close the functional gaps for 4 remaining pillars: ERPNext Phase 08 (customer/vendor/expense), TastyIgniter (POS menu & order bridge), Home Assistant (IoT automations), Frigate (NVR camera integration). OpenWISP deferred — needs physical container site (W5+).

## Tracks

| # | Pillar | Symbol | Effort | Parallel Track |
|---|--------|--------|--------|----------------|
| 1 | ERPNext Phase 08 | 🔴 Blocker: credentials | 15h | Track A |
| 2 | TastyIgniter | 🔴 Zero code | 35h | Track A |
| 3 | Home Assistant | 🟡 Partial stubs | 15h | Track B |
| 4 | Frigate (NVR) | 🔴 Zero code | 20h | Track B |
| — | OpenWISP | 🔴 Zero code | 30h | **Deferred: W5+** |

## Parallel Execution

```
Track A (Software/Cloud):
├─ Phase 1: ERPNext Phase 08 — customer/vendor/expense sync (15h)
└─ Phase 2: TastyIgniter — menu + order bridge (35h)

Track B (Hardware/Edge — Raspberry Pi 5):
├─ Phase 3: Home Assistant — zone lighting, AC, smart locks (15h)
└─ Phase 4: Frigate — NVR → HA camera integration (20h)

Deferred: OpenWISP — captive portal + zone network mgmt (needs on-site router/AP)
```

## Key Decisions

- **ERPNext Phase 08:** extends existing `erpnext-sync.ts` sub-router + `tree/erpnext/sync.js` background helper. Customer/vendor/expense sync with dedup by phone/email/tax_id. Retry queue with exponential backoff.
- **TastyIgniter:** standalone bridge uses existing ERPNext customer/product DB when available; falls back to local-only mode.
- **HA:** existing `mautic/` parallel structure → new `worker/src/tree/homeassistant/` + `worker/src/routes/homeassistant/`. Polling-based (POST to HA WebSocket or REST).
- **Frigate:** NVR integration feeds events into HA automations. Camera streams proxied via Cloudflare Worker → HA → Frigate.
- **OpenWISP:** separate infra plan deferred. Needs OpenWISP Controller + ESP32/OpenWrt routers at physical site.

## Touchpoints

### ERPNext
- `worker/src/routes/erpnext/` — existing CRM routes (customers/leads)
- `worker/src/routes/erpnext-sync.ts` — inventory sync (extend with customer/vendor/expense)
- `worker/src/tree/erpnext/sync.js` — background sync helpers
- `worker/src/clients/erpnext-client.ts` — existing REST client (extend with `isMock` support)
- `worker/db/migrations/` — new migration for sync queue tables

### Home Assistant / Frigate
- New: `worker/src/routes/homeassistant/` — Hono sub-router
- New: `worker/src/tree/homeassistant/` — business logic (lighting, climate, locks)
- New D1 tables: `ha_device_states`, `ha_automation_log`, `frigate_events`
- New env bindings: `HA_URL`, `HA_TOKEN`, `FRIGATE_URL`

### TastyIgniter
- New: `worker/src/routes/tastyigniter/` — Hono sub-router (menu + order bridge)
- New: `worker/src/tree/tastyigniter/` — business logic
- New D1 tables: `ti_menu_cache`, `ti_order_bridge`
- New env bindings: `TI_BASE_URL`, `TI_API_KEY`

## Non-Negotiable Constraints

- All API inputs validated with Zod `.parse()` or `.safeParse()`
- DB via `env.AURA_DB.prepare(sql).bind(...).first()/.all()/.run()` — never `await` the DB itself
- Internal imports use `.js` extension (ESM requirement for CF Workers)
- No `console.log` in production code — use `createLogger()` from `./middleware/logger`
- No `:any` types in production code
- Mock mode (no real credentials) must return 200 with `mock: true` flag — never throw 500
- TDD first: tests written before implementation, must fail-then-pass
- Fire-and-forget for all sync calls: `c.executionCtx.waitUntil(promise)` — never block the response path
