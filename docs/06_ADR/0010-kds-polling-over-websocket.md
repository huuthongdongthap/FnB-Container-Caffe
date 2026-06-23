# ADR 010: KDS Real-time Updates via Polling Over WebSocket

**Date:** 2026-03-14  
**Status:** Accepted  
**Decision Maker:** Backend Engineer

## Context

Kitchen Display System (KDS) needs real-time order updates:
- New orders appear immediately
- Status changes propagate instantly to all KDS screens

Options:
1. **Polling**: KDS client fetches `/api/kds/orders` every N seconds (3s)
2. **WebSocket**: Persistent connection, server pushes updates
3. **Server-Sent Events (SSE)**: One-way push over HTTP
4. **Long-polling**: Hold request until update

## Decision

Chose **Polling every 3 seconds** for simplicity and reliability.

## Consequences

### Positive
- ✅ **Simple**: No WebSocket connection management, reconnection logic
- ✅ **Works with Cloudflare Workers**: WebSockets supported but more complex
- ✅ **No stateful connections**: Workers are stateless, polling fits perfectly
- ✅ **Easy to debug**: Each poll is a regular HTTP request
- ✅ **Firewall friendly**: WebSockets sometimes blocked on public WiFi

### Negative
- ⚠️ **Latency**: Worst-case 3-second delay
- ⚠️ **Unnecessary requests**: If no changes, still poll
- ⚠️ **Battery drain**: On mobile/tablet, frequent polls keep radio active
- ⚠️ **Scalability**: At 10 KDS screens × 1 request/3s = 1200 req/hr = negligible

### Risks
- **Stale data**: 3s delay acceptable for kitchen workflow (orders don't change that fast)
- **Rate limits**: Polling could hit KV/D1 limits if many screens
  - Mitigation: Cache KDS orders in KV for 5 seconds, reduce D1 reads
- **Battery**: KDS screens are plugged-in tablets, battery not a concern

## Why Not WebSocket?

WebSocket would require:
- Connection management (connect/disconnect/keepalive)
- State tracking (which KDS screen connected)
- Broadcast to all connections on update (pub/sub)
- Edge Workers support WebSocket but need special handling

For our use case (small kitchen, 1-4 screens), polling overhead is < 100 requests/minute — trivial.

## Future Re-evaluation

If we add:
- Real-time order tracking for customers (web/mobile)
- Live chat support
- Multi-location central kitchen

Then WebSocket or SSE may be justified. For now, KISS.

## Implementation

```javascript
// kds-poll.js
setInterval(async () => {
  const res = await fetch('/api/kds/orders?since=' + lastSeen);
  const orders = await res.json();
  renderOrders(orders);
  lastSeen = Date.now();
}, 3000);
```

Server-side: `/api/kds/orders` returns orders with `updated_at > since`.

## Alternatives Considered (Rejected)

- **WebSocket**: Too complex for minimal benefit
- **SSE**: Would work but still requires connection management
- **Long-polling**: Would tie up Workers longer (cost), not needed

## Related

- KDS page: `kds.html`
- Polling script: `js/kds-poll.js`
- KDS API: `worker/src/routes/kds/orders.js`
- Orders table: `db/schema.sql`
