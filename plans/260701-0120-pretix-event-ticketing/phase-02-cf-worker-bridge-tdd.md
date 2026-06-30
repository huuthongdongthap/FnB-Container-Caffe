# Phase 02 — CF Worker Bridge (TDD)

**Status:** complete
**Priority:** HIGH
**Effort:** 8h
**TDD:** Tests first, then implementation

## Overview

Build `pretix-client.js` (HTTP client for pretix REST API) + `pretix.js` (Hono router with event/order endpoints). Follow exact same pattern as `mixpost-client.js` + `mixpost.js`.

## Architecture

```
tests/pretix-bridge.test.js  (TDD — written first)
  ↓ tests drive
worker/src/lib/pretix-client.js   (HTTP client, token auth)
worker/src/routes/pretix.js       (Hono router, 4-5 endpoints)
worker/src/index.js               (register /api/pretix route)
```

## pretix-client.js

```js
export class PretixApiError extends Error {
  constructor(status, body, endpoint) {
    super(`pretix API error: ${status} on ${endpoint}`);
    this.name = 'PretixApiError';
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

export function createPretixClient(apiUrl, apiToken, options = {}) {
  // Token auth: Authorization: Token <token>
  // Retry 5xx once after retryDelay
  // 401 → throw immediately

  async function request(method, endpoint, body) { ... }

  return {
    // Events
    async listEvents(organizer) { ... },          // GET /api/v1/organizers/{org}/events/
    async getEvent(organizer, eventSlug) { ... }, // GET .../events/{slug}/
    async createEvent(organizer, data) { ... },   // POST .../events/

    // Items (ticket types)
    async listItems(organizer, eventSlug) { ... },
    async getItem(organizer, eventSlug, itemId) { ... },

    // Orders
    async listOrders(organizer, eventSlug) { ... },
    async getOrder(organizer, eventSlug, code) { ... },

    // Check-in
    async redeemCheckin(organizer, eventSlug, listId, secret) { ... },

    // Webhooks
    async listWebhooks(organizer) { ... },
    async createWebhook(organizer, data) { ... },
  };
}
```

## pretix.js Routes

```
GET  /api/pretix/events          → list events + ticket types from pretix
GET  /api/pretix/events/:slug    → get single event with items
GET  /api/pretix/orders          → list recent orders (admin)
POST /api/pretix/webhook         → receive pretix webhook events
POST /api/pretix/checkin         → proxy check-in scan (QR → redeem)
POST /api/pretix/generate        → generate social post from event data
```

## Test Plan (TDD)

Test file: `tests/pretix-bridge.test.js`

### pretix-client tests (~8)
1. listEvents sends correct request with Token auth
2. getEvent returns event with items
3. listOrders returns paginated orders
4. redeemCheckin sends POST with untrusted_input=true
5. createWebhook sends POST with action_types
6. retries once on 5xx
7. throws PretixApiError on 401
8. throws PretixApiError on 4xx

### Route tests (~15)
1. GET /events → returns events list with items
2. GET /events/:slug → returns event details
3. GET /events/:slug → 404 for unknown slug
4. GET /orders → returns paginated orders
5. POST /webhook → order.placed: syncs to D1
6. POST /webhook → order.paid: updates D1 status
7. POST /webhook → order.canceled: updates D1 status
8. POST /webhook → invalid signature → 401
9. POST /webhook → unknown action → 200 (ignored)
10. POST /checkin → valid ticket → returns green
11. POST /checkin → already checked in → returns yellow
12. POST /checkin → invalid ticket → returns red
13. POST /checkin → missing secret → 400
14. POST /generate → event source → branded social post content
15. GET /orders → 500 when pretix API fails

### Steps

1. [ ] Write `tests/pretix-bridge.test.js` — all client + route tests (RED)
2. [ ] Write `worker/src/lib/pretix-client.js` — HTTP client
3. [ ] Write `worker/src/routes/pretix.js` — Hono router
4. [ ] Register route in `worker/src/index.js`
5. [ ] Run tests → all GREEN
6. [ ] Run full test suite → 0 regressions
7. [ ] Build → 0 errors

## Success Criteria

- [ ] All ~23 TDD tests pass
- [ ] Full test suite: 0 regressions
- [ ] Build: 0 errors
- [ ] pretix-client.js follows same pattern as mixpost-client.js
