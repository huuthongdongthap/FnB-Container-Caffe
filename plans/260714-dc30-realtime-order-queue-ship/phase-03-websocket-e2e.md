---
phase: 3
title: "WebSocket E2E + Full Verification"
status: pending
priority: P1
effort: "0.5d"
dependencies: [1, 2]
---

# Phase 3: WebSocket E2E + Full Verification

## Overview
End-to-end verification of the real-time pipeline: diff-sync reconnect, full regression gate. Cal.com HMAC verification moved here as Phase 3.5 (separate concern, testable independently).

**TDD order:** Write failing tests → implement → verify green.

## Requirements
- Functional: Simulate WiFi drop → submit order offline → reconnect → verify delivery via diff-sync
- Non-functional: WS reconnect ≤2s, no duplicate orders, full test suite green

## Architecture
```
E2E flow:
  1. Client connects WS to /api/realtime/{orderId} → DO.fetch() → DO.register(clientId, "customer", [orderId])
  2. Client sends order via POST /api/orders → DO.broadcast() → WS fan-out
  3. WiFi drops → client disconnects → DO.unregister(clientId)
  4. WiFi restores → client reconnects → DO.register() → DO.getState(lastSeq) → diff-sync missed events
  5. New order placed → DO broadcasts → all WS subscribers see update
```

## Related Code Files
- Create: `worker/src/__tests__/routes/orders-websocket.test.ts`
- Modify: `worker/src/__tests__/do/OrderBroadcaster.test.ts` — verify coverage completeness
- Modify: `worker/src/routes/cal-booking-webhook.ts` — HMAC verification (Phase 3.5)

## Implementation Steps (TDD-first)

### Step 1: Write WS integration test (scaffolding first)
Create `orders-websocket.test.ts`. **Important:** CF Workers DO WebSocket cannot be tested with pure Hono `app.fetch()` — it requires the CF Workers runtime or miniflare with DO support.

**Option A (preferred — unit-level):** Test the DO class directly with mocked `fetch()` handler:
```typescript
// Test pattern: instantiate OrderBroadcaster, call broadcast(), then simulate
// WS message delivery by calling the fetch handler with a mock Upgrade request
const stub = {
  fetch: async (req: Request) => {
    const ws = new WebSocket(req.url);
    return new Response(null, { status: 101, webSocket: ws });
  }
} as unknown as DurableObjectStub;
```

**Option B (integration-level with miniflare):** If project has miniflare configured, add a CI-only test that spins up a full Worker with DO bindings. Mark with `// @skip-ci` if infrastructure not available.

For now, implement **Option A** — test the DO's `fetch()` handler by:
1. Creating `OrderBroadcaster` instance with mock state
2. Calling `instance.fetch(mockUpgradeRequest, env)` — returns 101 with WebSocket pair
3. Writing to the WebSocket from test code
4. Asserting the DO processes `{type: 'register'}` and `{type: 'broadcast'}` messages correctly

### Step 2: Write WiFi drop simulation test
Test flow:
1. Create DO instance
2. Simulate WS connect → register client
3. Simulate disconnect → unregister
4. Simulate new order broadcast to DO
5. Simulate reconnect → client calls `getState(lastSeq)` → receives missed order
6. Assert: client receives exactly the missed order, no duplicates, correct sequence

### Step 3: Write idempotency test (Production bug prevention)
The known production bug (from brainstorm): WiFi drop → Background Sync fires order → sync succeeds → sync fires again → duplicate order.
1. Test: POST order with idempotency key `abc-123`
2. Test: POST same order with same idempotency key `abc-123`
3. Assert: only ONE order in D1, response says "already exists"

### Step 4: Phase 3.5 — Cal.com HMAC verification
In `worker/src/routes/cal-booking-webhook.ts`:
1. Write test: POST with valid HMAC-SHA256 header → 200; POST without header → 401; POST with wrong key → 401
2. Implement: `crypto.subtle.verify()` with constant-time comparison using `CAL_WEBHOOK_HMAC_SECRET` from env
3. **Key storage:** New env var `CAL_WEBHOOK_HMAC_SECRET` — set via `wrangler secret put CAL_WEBHOOK_HMAC_SECRET`
4. Note: The file has two handlers (`handleCalBookingWebhook` non-Hono + `calBookingWebhookRouter` Hono). Apply HMAC to the Hono router path (line 481 in index.ts) — the canonical webhook entry point.

### Step 5: Run full regression gate
```
npx vitest run worker/src/__tests__/do/         # DO tests
npx vitest run worker/src/__tests__/lib/        # offline-queue tests  
npx vitest run worker/src/__tests__/routes/     # route tests
npm test                                         # full suite
npm run build                                    # 0 TS errors
```

Target: all green.

## Success Criteria
- [ ] WS test: DO fetch() handler processes Upgrade → returns 101
- [ ] WS test: register/unregister/broadcast via WS messages
- [ ] WiFi drop E2E: offline → enqueue → reconnect → diff-sync → order delivered
- [ ] Idempotency test: duplicate POST with same key → no duplicate order
- [ ] Cal.com HMAC: valid sig → 200, missing sig → 401, wrong key → 401 (Phase 3.5)
- [ ] Full test suite: ALL GREEN (53+ existing + new tests)
- [ ] `npm run build` exit 0
- [ ] Phase 0 snapshot test still passes

## Risk Assessment
- **Vitest WS mock limitations** — Option A (unit-level DO fetch test) avoids needing a real WS; Hono's `c.req.raw` passes through correctly
- **Flaky WS tests** — add retry logic + generous timeouts for async DO operations
- **HMAC key rotation** — document plan for Cal.com secret rotation; no grace window in Phase 1
- **Cal.com dual-handler divergence** — the non-Hono `handleCalBookingWebhook` writes to `bookings` table; the Hono router writes `metadata` + `confirmed` status. HMAC applied only to the Hono router (canonical path). Document the divergence for Phase 4 cleanup.
