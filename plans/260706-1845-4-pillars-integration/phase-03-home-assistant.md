# Phase 3: Home Assistant — IoT Automations

## Prerequisites
- Raspberry Pi 5 running Home Assistant OS (or HA Container)
- HA Long-Lived Access Token configured (env `HA_TOKEN`)
- HA WebSocket or REST API accessible from Cloudflare Worker
- Frigate (Phase 4) benefits from HA entity registry

## Requirements

1. Zone-based lighting control (dining area, kitchen, entrance)
2. AC/climate control (set temperature, read current state)
3. Smart lock control (unlock for staff, lock on close)
4. Device state persistence (cache HA states in D1 for fast reads)
5. Automation trigger logging (audit trail of all HA actions)
6. Mock mode: simulate device states without real HA connection

## Files to Create

| Action | File |
|--------|------|
| CREATE | `worker/db/migrations/20260709_01_homeassistant.sql` |
| CREATE | `worker/src/clients/homeassistant-client.ts` |
| CREATE | `worker/src/tree/homeassistant/lighting.ts` |
| CREATE | `worker/src/tree/homeassistant/climate.ts` |
| CREATE | `worker/src/tree/homeassistant/locks.ts` |
| CREATE | `worker/src/tree/homeassistant/state-cache.ts` |
| CREATE | `worker/src/routes/homeassistant/index.ts` |
| CREATE | `worker/src/routes/homeassistant/devices.ts` |
| CREATE | `worker/src/routes/homeassistant/automations.ts` |
| CREATE | `worker/src/__tests__/routes/homeassistant.test.ts` |
| CREATE | `worker/src/__tests__/tree/homeassistant/lighting.test.ts` |

## Files to Modify

| Action | File |
|--------|------|
| MODIFY | `worker/src/index.ts` — register HA routes |
| MODIFY | `worker/src/types/env.ts` — add HA_URL, HA_TOKEN |

## DB Schema

```sql
-- Phase 03: Home Assistant Integration
-- Migration: 20260709_01_homeassistant.sql

-- Device state cache (last known state from HA)
CREATE TABLE IF NOT EXISTS ha_device_states (
    entity_id TEXT PRIMARY KEY,
    friendly_name TEXT,
    domain TEXT NOT NULL, -- 'light' | 'climate' | 'lock' | 'sensor' | 'binary_sensor'
    state TEXT NOT NULL,
    attributes TEXT, -- JSON (brightness, temperature, etc.)
    last_updated TEXT,
    cached_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ha_device_domain ON ha_device_states(domain);

-- Automation action log (audit trail)
CREATE TABLE IF NOT EXISTS ha_automation_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'turn_on' | 'turn_off' | 'set_temperature' | 'unlock' | 'lock'
    old_state TEXT,
    new_state TEXT,
    triggered_by TEXT DEFAULT 'api', -- 'api' | 'automation' | 'schedule'
    user_role TEXT, -- who triggered it
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ha_auto_log_entity ON ha_automation_log(entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ha_auto_log_trigger ON ha_automation_log(triggered_by);
```

## HA Client Pattern

```typescript
// worker/src/clients/homeassistant-client.ts
// HA REST API: GET/POST /api/states/{entity_id}
// HA REST API: POST /api/services/{domain}/{service}
// Auth: Bearer {HA_TOKEN}
// WebSocket: optional for real-time state push

export interface HaClientConfig {
  baseUrl: string;
  token: string;
  isMock?: boolean;
}
```

## HA Entity Conventions

| Domain | Entity Pattern | Actions |
|--------|---------------|---------|
| light | `light.dining_area`, `light.kitchen_main` | turn_on, turn_off, toggle, brightness |
| climate | `climate.main_ac` | set_temperature, set_hvac_mode |
| lock | `lock.front_door`, `lock.staff_entrance` | unlock, lock |
| sensor | `sensor.camera_motion` | read only (Frigate feeds here) |

## Routes

```
GET    /api/ha/state          — all device states (from cache)
GET    /api/ha/state/:id      — single entity state
POST   /api/ha/light/:id/on   — turn on light (with brightness)
POST   /api/ha/light/:id/off  — turn off light
POST   /api/ha/climate/:id    — set temperature + mode
POST   /api/ha/lock/:id/unlock — unlock (owner/staff only)
POST   /api/ha/lock/:id/lock   — lock
GET    /api/ha/automations    — recent automation log
```

## Tests (TDD First!)

```typescript
// homeassistant.test.ts
// test 1: GET /state → 200 with cached states
// test 2: POST /light/:id/on → 200, HA API called, state updated
// test 3: POST /lock/:id/unlock → requireAuth(['owner', 'staff'])
// test 4: mock mode (no HA credentials) → 200 + { mock: true }
// test 5: missing entity_id → 400 via Zod validation

// lighting.test.ts
// test 1: turn_on with brightness → correct HA service call
// test 2: turn_on without brightness → default 255
// test 3: batch turn_on → multiple entities in one call
```

## Implementation Steps

1. Write all 5 tests (FAIL)
2. Create migration
3. Implement `homeassistant-client.ts` (same pattern as `erpnext-client.ts`)
4. Implement `lighting.ts`, `climate.ts`, `locks.ts` — domain handlers
5. Implement `state-cache.ts` — periodic state refresh from HA → D1
6. Create route files
7. Register routes in `index.ts`
8. Run tests → all PASS
