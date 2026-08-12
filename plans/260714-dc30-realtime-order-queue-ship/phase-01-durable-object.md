---
phase: 1
title: "OrderBroadcaster Durable Object"
status: pending
priority: P1
effort: "0.75d"
dependencies: [0]
---

# Phase 1: OrderBroadcaster Durable Object

## Overview
Implement the core Durable Object `OrderBroadcaster` that becomes the single source of truth for order state, with WebSocket fan-out capability. Modify `POST /api/orders` to write to DO first (with D1 fallback). Retire the SSE stream.

**TDD order:** Write tests → write types → implement → verify (NOT code-first).

## Requirements
- Functional: DO accepts order writes, tracks state (persisted to ctx.storage), supports WS client registration
- Non-functional: ≤1s fan-out latency, zero order loss on DO unavailability, zero order loss on DO eviction

## Architecture
```
Client → POST /api/orders → Worker → DO.put(broadcastId) → DO.broadcast() → WS clients
                              ↓ DO error (RangeError)           ↓ on error
                           KV log + D1 insert               rethrow handled upstream
```

**Key difference from brainstorm:** DO is the event broadcaster, NOT the primary data store. D1 remains the source of truth for durable data. DO holds in-memory state + ctx.storage backup for real-time fan-out only.

## Related Code Files
- Create: `worker/src/do/OrderBroadcaster.ts`
- Create: `worker/src/__tests__/do/OrderBroadcaster.test.ts`
- Modify: `worker/src/tree/orders/create-order.ts` — add DO write before D1 (NOT `routes/orders.ts` which is a barrel re-export)
- Modify: `worker/src/types/env.ts` — add `OrderBroadcaster` binding
- Modify: `worker/src/routes/order-stream.ts` — deprecate (comment out mount in index.ts:168)
- Modify: `worker/src/index.ts` — mount WS route on `/api/realtime/:channelId` (NOT `/{broadcastId}`)
- Modify: `worker/wrangler.toml` — add DO binding

## Implementation Steps (TDD-first)

### Step 1: Write DO unit tests FIRST
Before writing any DO code, create `OrderBroadcaster.test.ts` covering:
1. **Constructor** — initializes empty state, storage is empty
2. **broadcast()** — writes order to `this.ctx.storage`, then to `this.state.orders`
3. **register()** — adds client to `this.state.clients` with role + orderIds
4. **unregister()** — removes client on disconnect
5. **getState(sinceSeq)** — returns orders newer than sequence number
6. **Eviction recovery** — simulates fresh fetch: state loads from `this.ctx.storage` via `this.state`
7. **Error path** — `.broadcast()` throws RangeError → test that error propagates for upstream catch
8. **Concurrent writes** — `Promise.all` with 3+ orders → all stored, no corruption
9. **Storage persistence** — after `.broadcast()`, verify `ctx.storage` contains the order key

### Step 2: Add wrangler.toml DO binding
```toml
[[durable_objects.bindings]]
name = "ORDER_BROADCASTER"
class_name = "OrderBroadcaster"
script_name = "src/index.ts"
```

### Step 3: Add Env type
```typescript
// src/types/env.ts
ORDER_BROADCASTER: DurableObjectNamespace;
```

### Step 4: Implement OrderBroadcaster.ts
```typescript
export class OrderBroadcaster {
  private state: DurableObjectState;
  private clients: Record<string, {role: string, orderIds: string[]}>;
  private seq: number;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.clients = {};
    this.seq = 0;
  }

  async broadcast(event: OrderEvent) {
    // 1. Persist to ctx.storage FIRST (survives eviction)
    await this.state.storage.put(`order:${event.orderId}`, JSON.stringify(event));
    // 2. Update in-memory state
    this.state.orders[event.orderId] = { ...event, updatedAt: Date.now() };
    this.seq++;
    // 3. Fan out to WS clients (on fetch() handler, not here)
    // Method returns the broadcasted event for the fetch() handler
    return { event, seq: this.seq };
  }

  async register(clientId: string, role: string, orderIds: string[]) { ... }
  async unregister(clientId: string) { ... }
  getState(sinceSeq: number): OrderEvent[] { ... }
}
```

**Critical:** CF DO storage uses `this.state` (not `this.ctx.storage.put()`). The `this.state` object is the serialized state — mutations to `this.state.orders` ARE persisted automatically. Use `this.state.storage.put()` for non-structured keys (counter, etc.).

### Step 5: Modify create-order.ts — DO write BEFORE D1
In `worker/src/tree/orders/create-order.ts`:
```typescript
// BEFORE the D1 INSERT (line 50), add:
let doError: string | null = null;
if (env.ORDER_BROADCASTER && (env as any).REALTIME_ENABLED !== 'false') {
  try {
    const stub = env.ORDER_BROADCASTER.get(orderId);
    await stub.broadcast({
      orderId,
      status: 'pending',
      items: data.items,
      total: parseInt(String(data.total)),
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      payment_status: 'unpaid',
      table_id: resolvedTableId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  } catch (e) {
    // RangeError = DO unavailable; any Error = storage failure
    if (e instanceof RangeError || e instanceof Error) {
      doError = (e as Error).message;
      // Log to KV for reconciliation — NEVER store raw error or order body
      const kv = env.AUTH_KV as KVNamespace;
      await kv.put(`broadcast:fail:${orderId}`, JSON.stringify({
        error: 'DO_RANGE_ERROR',
        ts: new Date().toISOString()
      }), { expirationTtl: 86400 });
    }
  }
}
```

### Step 6: Add idempotency check
After the DO block, before D1 INSERT, check if order already exists:
```typescript
const existing = await db.prepare('SELECT id FROM orders WHERE id = ?')
  .bind(orderId).first();
if (existing) {
  return jsonResponse({ success: true, order: existing.order, message: 'Order already exists' }, 200);
}
```

**Note:** `orderId` is generated with `generateId('ORD_')` at line 32 — if the client retries on slow response, a NEW `orderId` is generated each time. True idempotency requires the client to send an idempotency key. For Phase 1, the guard is: if DO broadcast succeeded but D1 didn't, the order IS in D1 on retry (D1 INSERT will execute again). The idempotency check above prevents duplicate rows only if the second retry generates the SAME orderId — which requires a client-side idempotency key. **This is a known limitation addressed in Phase 3 (idempotency key PR to frontend).**

### Step 7: Mount WebSocket upgrade route
In `worker/src/index.ts`, add AFTER all existing `/api/orders` routes:
```typescript
app.get('/api/realtime/:channelId', async(c) => {
  const channelId = c.req.param('channelId');
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 400);
  }
  const stub = env.ORDER_BROADCASTER.get(channelId);
  return stub.fetch(c.req.raw, { headers: c.req.raw.headers });
});
```

**Critical:** This uses CF-native DO `stub.fetch()` which handles WS upgrade natively. Hono's `c.req.raw` passes the raw Request to the DO stub.

### Step 8: Deprecate SSE stream
In `worker/src/index.ts`, comment out line 168:
```typescript
// DEPRECATED — replaced by DO WebSocket (orderStreamRouter, 2026-07-14)
// app.route('/api/orders', orderStreamRouter);
```

## Success Criteria
- [ ] `OrderBroadcaster.test.ts` covers: broadcast, register/unregister, getState, eviction recovery, error propagation, concurrent writes, storage persistence — ALL GREEN
- [ ] Phase 0 regression snapshot test still passes (response shape preserved)
- [ ] `POST /api/orders` writes to DO first, catches RangeError/Error, falls back to D1
- [ ] `createOrder` returns same response shape as baseline (verified by Phase 0 test)
- [ ] SSE stream removed from route mount (line 168 commented)
- [ ] WS route mounted at `/api/realtime/:channelId` — does NOT shadow any existing route
- [ ] All 53+ existing tests pass

## Risk Assessment
- **DO plan limit on CF Free tier** — check billing before deploy; DO requires Workers Paid Plan
- **Split-brain: DO write succeeds, D1 write fails** — D1 insert is AFTER DO broadcast. If D1 fails, order broadcasted but not in DB. Mitigation: catch D1 error → return 500 → client retries → idempotency key prevents duplicate
- **DO eviction** — mitigated by `this.state` auto-persistence; every write to `this.state.X` is persisted
- **Concurrent writes** — CF guarantees single-threaded execution per DO instance; serialization is implicit
