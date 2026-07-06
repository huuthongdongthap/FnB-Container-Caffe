# Phase 4: Frigate — NVR Camera Integration via HA

## Prerequisites
- Phase 3 (Home Assistant) complete — Frigate events feed HA entities
- Frigate instance running with RTSP/WebRTC cameras configured
- Frigate MQTT broker accessible (for event subscriptions)
- Cameras connected to Raspberry Pi 5 (or network-accessible)

## Requirements

1. Frigate event ingestion (person detection, motion, camera status)
2. Camera snapshot retrieval (via Frigate REST API → proxy through Worker)
3. HA entity integration — Frigate sensors → HA entities (via HA REST API)
4. Zone-based camera mapping (which camera covers which zone: entrance, kitchen, parking)
5. Event webhook endpoint (Frigate calls Worker on detection)
6. Mock mode: simulate Frigate events without real cameras

## Files to Create

| Action | File |
|--------|------|
| CREATE | `worker/db/migrations/20260710_01_frigate.sql` |
| CREATE | `worker/src/clients/frigate-client.ts` |
| CREATE | `worker/src/tree/frigate/events.ts` |
| CREATE | `worker/src/tree/frigate/snapshots.ts` |
| CREATE | `worker/src/tree/frigate/ha-bridge.ts` |
| CREATE | `worker/src/routes/frigate/events.ts` |
| CREATE | `worker/src/routes/frigate/snapapshots.ts` |
| CREATE | `worker/src/routes/frigate/webhook.ts` |
| CREATE | `worker/src/__tests__/routes/frigate.test.ts` |
| CREATE | `worker/src/__tests__/tree/frigate/events.test.ts` |

## Files to Modify

| Action | File |
|--------|------|
| MODIFY | `worker/src/index.ts` — register Frigate routes |
| MODIFY | `worker/src/types/env.ts` — add `FRIGATE_URL`, `FRIGATE_MQTT_URL` |
| REUSE | `worker/src/tree/homeassistant/state-cache.ts` — update HA sensor states |

## DB Schema

```sql
-- Phase 04: Frigate NVR Integration
-- Migration: 20260710_01_frigate.sql

-- Camera configuration
CREATE TABLE IF NOT EXISTS frigate_cameras (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    frigate_camera_name TEXT NOT NULL,
    zone TEXT, -- 'entrance' | 'kitchen' | 'parking' | 'dining'
    rtsp_url TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Detection events (person, motion, etc.)
CREATE TABLE IF NOT EXISTS frigate_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    frigate_event_id TEXT NOT NULL UNIQUE,
    camera_id TEXT NOT NULL REFERENCES frigate_cameras(id),
    event_type TEXT NOT NULL, -- 'person' | 'motion' | 'car' | 'dog' | 'cat'
    label TEXT NOT NULL,
    confidence REAL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    thumbnail_url TEXT,
    snapshot_url TEXT,
    clip_url TEXT,
    zone TEXT,
    processed INTEGER DEFAULT 0, -- 0 = raw, 1 = sent to HA
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_frigate_events_camera ON frigate_events(camera_id, start_time);
CREATE INDEX IF NOT EXISTS idx_frigate_events_type ON frigate_events(event_type, start_time);
CREATE INDEX IF NOT EXISTS idx_frigate_events_processed ON frigate_events(processed);

-- HA entity mapping (Frigate sensors → HA entities)
CREATE TABLE IF NOT EXISTS frigate_ha_mapping (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    camera_id TEXT NOT NULL REFERENCES frigate_cameras(id),
    frigate_id TEXT NOT NULL,
    ha_entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'binary_sensor' | 'sensor' | 'camera'
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(frigate_id, ha_entity_id)
);
```

## Frigate Client Pattern

```typescript
// worker/src/clients/frigate-client.ts
// Frigate REST API v0.x:
// GET /api/events/{event_id} — event details
// GET /api/events/{event_id}/thumbnail.jpg — event thumbnail
// GET /api/events/{event_id}/snapshot.jpg — event snapshot
// GET /api/cameras/{name} — camera config
// Auth: None (or basic auth if configured)
```

## Routes

```
POST   /api/frigate/webhook/events  — Frigate calls this on detection (HA proxy)
GET    /api/frigate/events          — list recent detection events
GET    /api/frigate/events/:id      — single event detail
GET    /api/frigate/cameras         — list configured cameras
POST   /api/frigate/snapshot/:id    — get snapshot URL (proxied)
POST   /api/frigate/ha/sync         — push Frigate state to HA entities
```

## HA Entity Creation Flow

```
Frigate detects person
  → POST /api/frigate/webhook/events (Frigate → Worker)
  → Insert frigate_events (raw event)
  → POST /api/states (Worker → HA) — create/update sensor entity
  → Update frigate_events.processed = 1
  → HA automations can now trigger on the sensor
```

## Tests (TDD First!)

```typescript
// frigate.test.ts
// test 1: webhook receives event → insert frigate_events, 200
// test 2: list events → sorted by start_time DESC, paginated
// test 3: snapshot proxy → returns redirect or image bytes
// test 4: HA sync → creates HA sensor entities via HA client
// test 5: mock mode → 200 + { mock: true }

// events.test.ts
// test 1: person detection → event_type 'person', processed = 0
// test 2: duplicate webhook (same event_id) → 409 conflict
// test 3: snapshots → correct URL format from Frigate API
```

## Implementation Steps

1. Write all 5 tests (FAIL)
2. Create migration
3. Implement `frigate-client.ts` — REST client for Frigate API
4. Implement `events.ts` — webhook handler + event listing
5. Implement `snapshots.ts` — snapshot URL generation/proxy
6. Implement `ha-bridge.ts` — push Frigate events as HA entities
7. Create route files
8. Register routes in `index.ts`
9. Run tests → all PASS
