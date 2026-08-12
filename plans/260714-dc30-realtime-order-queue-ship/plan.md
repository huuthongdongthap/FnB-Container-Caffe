---
title: "Realtime Order Queue — Durable Objects + Offline Sync"
status: completed
planDir: "plans/260714-dc30-realtime-order-queue-ship"
createdAt: "2026-07-14"
sprint: "Sprint 1 (Weeks 1–2)"
priority: P1
effort: "2d"
blockedBy: []
blocks: []
mode: --tdd
redTeamStatus: complete
redTeamFindings: 4 critical + 5 warnings addressed in phase files
---

# Realtime Order Queue — DO + Offline Sync

## 1. Context
AURA Cafe (single-location container cafe, Sa Dec) currently uses HTTP polling for order status across customer/KDS/admin views. WiFi is unreliable. Orders can be lost during connectivity gaps. There is no offline queue. There is no WebSocket/Durable Object infrastructure.

An **SSE stream already exists** at `worker/src/routes/order-stream.ts` (mounted as `orderStreamRouter` on `/api/orders` in `index.ts:168`). It uses KV keys `order_event:<orderId>` + D1 polling at 3s intervals. This plan replaces that pattern with DO-based WebSocket fan-out. The SSE route must be retired as part of this plan (see Phase 1, Step 8).

## 2. Goal (TDD-first)
Build a single Durable Object `OrderBroadcaster` that writes-first on `POST /api/orders`, fans out via WebSocket to subscribed clients, and provides a client-side IndexedDB offline queue with Background Sync fallback. All changes test-first; existing tests must remain green.

## 3. Phases
| Phase | File | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 0 | phase-00-regression-snapshot.md | P0 | 2h | **completed** |
| 1 | phase-01-durable-object.md | P1 | 0.75d | **completed** |
| 2 | phase-02-client-offline-hardening.md | P1 | 0.5d | **completed** |
| 3 | phase-03-websocket-e2e.md | P1 | 0.5d | **completed** |
| 4* | phase-04-idempotency.md | P1 | 0.25d | **completed** *(bonus)* |

## 4. Operational Requirements

### 4a. Files to touch / create

| Action | Path | Note |
|--------|------|------|
| Modify | `worker/src/tree/orders/create-order.ts` | Write DO before D1; keep D1 write as fallback (NOT `routes/orders.ts` — that file is a barrel re-export) |
| Modify | `worker/src/index.ts` | Mount WS upgrade on `/api/realtime/:channelId` (NOT `/{broadcastId}` — would shadow `:id` routes) |
| Modify | `worker/src/types/env.ts` | Add `OrderBroadcaster: DurableObjectNamespace` binding type |
| Modify | `worker/src/routes/order-stream.ts` | **Deprecate** — comment out mount in `index.ts:168`, DO replaces it |
| Modify | `worker/wrangler.toml` | Add `durable_objects` binding; **keep** `CORS_ORIGIN = "*"` (real gate is Hono regex in `index.ts:110-116`) |
| Create | `worker/src/do/OrderBroadcaster.ts` | DO state machine with ctx.storage persistence |
| Create | `worker/src/lib/offline-queue.ts` | IndexedDB + Background Sync |
| Create | `worker/src/__tests__/do/OrderBroadcaster.test.ts` | DO unit tests |
| Create | `worker/src/__tests__/routes/orders-websocket.test.ts` | WS integration tests |
| Create | `worker/src/__tests__/regression-response-snapshot.test.ts` | Freeze POST /api/orders response shape |

### 4b. Durable Object State Schema

```
DurableObject: OrderBroadcaster
  State (DurableObjectStorage — JSON-persisted):
    orders: Record<string, OrderState>   // plain object, NOT Map (DO storage serializes to JSON)
    clients: Record<string, {role, orderIds: string[]}>  // WS subscriptions

  OrderState:
    orderId: string
    status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled"
    tableId: string | null
    items: Array<{id, name, qty, price}>
    total: number
    customer_name: string
    customer_phone: string
    payment_method: string
    createdAt: number  // epoch ms
    updatedAt: number

  API:
    .broadcast(event: OrderEvent)        // persist order + fan out to WS clients
    .register(clientId, role, orderIds)   // subscribe client to order updates
    .unregister(clientId)                 // disconnect cleanup
    .getState(sinceSeq): OrderState[]     // diff-sync for reconnect
```

**Key design decisions (from red-team):**
- `orders` uses `Record<string, OrderState>` (plain object) — DO `ctx.storage` serializes to JSON, not `Map`
- Every write to `orders` is ALSO written to `this.ctx.storage` before broadcasting — prevents data loss on eviction
- `broadcastId` = `orderId` (1:1 mapping — each order has its own DO instance via `idFromString(orderId)`)

### 4c. SLA / Latency Requirements

| Metric | Target | Note |
|--------|--------|------|
| WS reconnect time | ≤2 s | After WiFi restore |
| Order write → first fan-out | ≤1 s | Within single DO instance (single-location) |
| Offline queue fill local | ≤5 ms | IndexedDB write; no network await |
| PayOS fallback unchanged | — | Not in scope; existing flow untouched |
| D1 fallback on DO write fail | Always | DO error → direct D1; no order loss |

### 4d. Fallback Plan (if DO unavailable)

1. Catch `RangeError` and `Error` on `.broadcast()` (NOT `DurableObjectUnavailable` — that type does not exist in CF Workers runtime)
2. Fall through to existing D1 path (current behavior preserved)
3. Log to KV `broadcast:fail:{orderId}` with `{error: "DO_RANGE_ERROR", ts: ISO}` — never store raw error messages or order body
4. Client sees HTTP 200 regardless (confirmed-by-D1)
5. **No order loss — guaranteed.**

### 4e. Rollback Strategy

- `POST /api/orders` keeps D1 write after DO write (already-existing path not removed)
- Revert: remove DO init, comment out `.broadcast()` call; D1 path continues
- No migration needed — DO augmentative, not replacement
- Feature flag: `C.realtime_enabled` env var; default `false` to enable gradual rollout

## 5. Blocking Constraints (Non-negotiable)

- Preserve `POST /api/orders` current response shape — existing frontend contracts must not break
- 53+ existing tests must pass after every phase
- Zod validation order unchanged
- No new external dependencies (use only CF-native: DO, KV, D1)
- Firebase not used; Realtime DB not used
- `band` terminology must not appear; use authoritative DOM vocabulary (element, region, component, viewport, surface, not band)
- **SSE stream deprecation is required** — DO + WS replaces it; both running = duplicate UI updates

## 6. Route Prefix Decision

**Chosen:** `/api/realtime/:channelId`

Rationale:
- `/{broadcastId}` would shadow 20+ existing parameterized routes (`/api/orders/:id`, `/api/menu/:id`, `/api/admin/*`, `/mobile/*`)
- Hono matches routes in declaration order — a root-level wildcard intercepts before `/api/orders/:id` gets a chance
- `/api/realtime/` is under the `/api/` prefix, consistent with existing naming
- `channelId` = `orderId` (replaces ambiguous `broadcastId`)

## 7. CORS Decision

**Decision: Keep `CORS_ORIGIN = "*"` in wrangler.toml. Tighten at Hono middleware only.**

Rationale:
- The actual CORS gatekeeper is the `ALLOWED_ORIGIN_PATTERNS` regex in `index.ts:110-116`
- `wrangler.toml` `CORS_ORIGIN` is a fallback used by `cors.ts` helper's default parameter
- Changing wrangler.toml alone does NOT tighten CORS — the plan must NOT touch it
- Allowed origins already correct: `aurasspace.cafe`, `*.pages.dev`, `localhost`, `127.0.0.1`

## 8. Project Metadata

| Field | Value |
|-------|-------|
| Repo | `/Users/macbook/FnB-Container-Caffe` |
| Worker dir | `worker/` |
| Frontend dir | `src/` (sibling) |
| Report | `plans/reports/260714-realtime-order-queue-brainstorm.md` |
| Active plan | `plans/260714-dc30-realtime-order-queue-ship/plan.md` |
| TDD mode | ON — write test → implement → verify per phase |
| Red-team | Complete — 4 critical + 5 warnings addressed |
