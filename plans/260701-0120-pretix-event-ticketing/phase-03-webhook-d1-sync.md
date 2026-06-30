# Phase 03 — Webhook Handler + D1 Sync

**Status:** complete
**Priority:** HIGH
**Effort:** 5h
**TDD:** Tests first

## Overview

pretix fires webhooks on order lifecycle events. CF Worker receives webhooks, validates HMAC signature, syncs order data to D1 `ticket_orders` table. Also handle webhook auto-registration (register our webhook URL with pretix on startup).

## D1 Schema

```sql
CREATE TABLE IF NOT EXISTS ticket_orders (
  id TEXT PRIMARY KEY,           -- pretix order code (e.g. "ABC23")
  event_slug TEXT NOT NULL,
  event_name TEXT,
  status TEXT NOT NULL,          -- placed, paid, canceled, expired, refunded
  customer_email TEXT,
  customer_name TEXT,
  total DECIMAL(10,2),
  currency TEXT DEFAULT 'VND',
  items JSON,                    -- [{ name, price, quantity }]
  ticket_secret TEXT,            -- for check-in QR generation
  webhook_raw JSON,              -- last webhook payload
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON ticket_orders(event_slug);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_status ON ticket_orders(status);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_email ON ticket_orders(customer_email);
```

## Webhook Handler

```js
// POST /api/pretix/webhook
async function handleWebhook(c) {
  const signature = c.req.header('X-pretix-Signature');
  const body = await c.req.text();

  // Validate HMAC-SHA256
  if (!validateWebhookSignature(body, signature, PRETIX_WEBHOOK_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const payload = JSON.parse(body);
  const { action, organizer, event, code } = payload;

  switch (action) {
    case 'pretix.event.order.placed':
      await syncNewOrder(c.env, organizer, event, code);
      break;
    case 'pretix.event.order.paid':
      await updateOrderStatus(c.env, code, 'paid');
      break;
    case 'pretix.event.order.canceled':
      await updateOrderStatus(c.env, code, 'canceled');
      break;
    case 'pretix.event.order.refund.done':
      await updateOrderStatus(c.env, code, 'refunded');
      break;
    case 'pretix.event.checkin':
      await recordCheckin(c.env, code);
      break;
    default:
      // Ignore unknown actions — don't error
  }

  return c.json({ ok: true });
}
```

## Webhook Auto-Registration

On Worker cold start or first deploy, check if webhook already registered. If not, create it:

```js
async function ensureWebhookRegistered(env) {
  const client = createPretixClient(env.PRETIX_API_URL, env.PRETIX_API_TOKEN);
  const existing = await client.listWebhooks(env.PRETIX_ORGANIZER);
  const workerUrl = 'https://fnb-caffe-container.pages.dev/api/pretix/webhook';

  const already = existing.results?.find(w => w.target_url === workerUrl);
  if (!already) {
    await client.createWebhook(env.PRETIX_ORGANIZER, {
      target_url: workerUrl,
      action_types: ['pretix.event.order.placed', 'pretix.event.order.paid',
                     'pretix.event.order.canceled', 'pretix.event.checkin'],
      enabled: true,
      all_events: true,
    });
  }
}
```

## Test Plan (~8 tests)

1. [ ] Valid webhook signature → accepted
2. [ ] Invalid webhook signature → 401
3. [ ] order.placed → inserts new row in ticket_orders
4. [ ] order.paid → updates status to 'paid'
5. [ ] order.canceled → updates status to 'canceled'
6. [ ] checkin → records checkin timestamp
7. [ ] Unknown action → 200 OK, no DB change
8. [ ] Missing signature header → 401

## Steps

1. [ ] Write D1 migration for `ticket_orders` table
2. [ ] Write webhook tests (RED)
3. [ ] Implement webhook handler + HMAC validation
4. [ ] Implement D1 sync functions (syncNewOrder, updateOrderStatus, recordCheckin)
5. [ ] Implement auto-registration logic
6. [ ] Run tests → GREEN
7. [ ] Full suite → 0 regressions

## Success Criteria

- [ ] Webhook validates HMAC signature
- [ ] Order lifecycle synced to D1
- [ ] Auto-registration works (idempotent)
- [ ] All tests pass
