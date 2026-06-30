# Phase 04 — Widget Embed + Check-in Integration

**Status:** complete
**Priority:** MEDIUM
**Effort:** 4h
**TDD:** Tests first

## Overview

Embed pretix widget on cafe website `/workshops` page. Build check-in proxy endpoint for door scanning (QR code → redeem API). Build `/api/pretix/generate` endpoint that creates social-media-ready post content from upcoming events (for Mixpost cross-posting).

## Widget Embed

pretix provides a custom element JS widget. Embed on `/workshops` page:

```html
<!-- On /workshops page -->
<link rel="stylesheet" href="https://tickets.auraspace.cafe/widget/v2.css" crossorigin>
<script src="https://tickets.auraspace.cafe/widget/v2.en.js" async crossorigin></script>
<pretix-widget event="https://tickets.auraspace.cafe/aura-cafe/workshop-thang-7/"></pretix-widget>
```

Or use `pretix-button` for a simple buy-now button per event:

```html
<pretix-button event="https://tickets.auraspace.cafe/aura-cafe/workshop-thang-7/"
               items="item_1=1">
  🎫 Mua vé / Buy Ticket
</pretix-button>
```

## Check-in Proxy

```
POST /api/pretix/checkin
Body: { secret, event, listId? }
Response: { status: "green"|"yellow"|"red", message: "..." }
```

CF Worker proxies to pretix redeem endpoint. The door scanner app (simple web page) sends QR-scanned ticket secret to this endpoint.

```js
mixpostRouter.post('/checkin', async (c) => {
  const { secret, event, listId } = await c.req.json();
  if (!secret) return c.json({ error: 'secret required' }, 400);

  const client = getPretix(c);
  const result = await client.redeemCheckin(
    organizer, event, listId, secret
  );
  return c.json(result);
});
```

## Social Post Generation

```
POST /api/pretix/generate
Body: { source: "event", slug: "workshop-thang-7" }
Response: { success: true, data: { content, hashtags, mediaUrls } }
```

Generates Vietnamese branded content:

```js
function eventToPostContent(event, items) {
  const date = new Date(event.date_from).toLocaleDateString('vi-VN');
  const itemList = items.map(i => `🎫 ${i.name}: ${Number(i.default_price).toLocaleString('vi-VN')}đ`).join('\n');
  return {
    content: `🎪 ${event.name.en || event.name}\n📅 ${date}\n📍 Aura Cafe, Sa Đéc\n\n${itemList}\n\n🎟️ Đặt vé ngay: ${event.url}\n\n#AuraCafe #SuKien #Workshop`,
    hashtags: ['AuraCafe', 'SuKien', 'Workshop'],
    mediaUrls: [],
  };
}
```

## Test Plan (~7 tests)

1. [ ] GET /events/:slug → includes widget embed HTML snippet
2. [ ] POST /checkin → valid secret → green
3. [ ] POST /checkin → already checked in → yellow
4. [ ] POST /checkin → invalid secret → red
5. [ ] POST /checkin → missing secret → 400
6. [ ] POST /generate → event source → branded post content
7. [ ] POST /generate → unknown event → 404

## Steps

1. [ ] Write tests (RED)
2. [ ] Implement check-in proxy endpoint
3. [ ] Implement event→social post content generator
4. [ ] Create `/workshops` page with pretix widget embed (or document embed snippet)
5. [ ] Run tests → GREEN
6. [ ] Full suite → 0 regressions

## Success Criteria

- [ ] Check-in proxy works with all 3 pretix statuses
- [ ] Social post generation outputs VN-branded content
- [ ] Widget embed instructions clear for cafe owner
- [ ] All tests pass
