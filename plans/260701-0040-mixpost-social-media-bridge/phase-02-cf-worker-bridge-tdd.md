# Phase 02 — CF Worker Bridge (TDD)

**Status:** complete
**Priority:** High
**TDD:** ✅ Write tests first, then implement

## Overview

Build CF Worker routes that bridge Aura D1 data to Mixpost API. Two layers: (1) `mixpost-client.js` — reusable HTTP client for Mixpost REST API, (2) `mixpost.js` — Hono routes with D1 queries + content generation.

## Mixpost Client (`worker/src/lib/mixpost-client.js`)

### Functions

```
createMixpostClient(apiUrl, apiToken) → { createPost, uploadMedia, listAccounts, getAccount }
```

- `createPost({ accounts, tags, date, time, content })` — POST /api/mixpost/posts
- `uploadMediaFromUrl(imageUrl)` — POST /api/mixpost/media/download
- `listAccounts()` — GET /api/mixpost/accounts
- `getAccount(id)` — GET /api/mixpost/accounts/{id}

All methods: Bearer token auth, structured error handling, retry on 5xx, log failures.

### Error handling
- `MixpostApiError` class: `{ status, body, endpoint }`
- 401 → token expired, log warning
- 5xx → retry once after 2s
- Network error → throw with cause

## Worker Routes (`worker/src/routes/mixpost.js`)

### `POST /api/mixpost/posts`
Create a scheduled social post in Mixpost.

**Request:**
```json
{
  "content": "Hôm nay Aura Cafe có Espresso giảm 20%! ☕",
  "accounts": [1],
  "scheduledAt": "2026-07-02T07:00:00+07:00",
  "mediaUrls": ["https://aura.pages.dev/images/espresso.jpg"]
}
```

**Flow:** Validate input (Zod) → upload media via Mixpost API → create post with media → return Mixpost post ID.

### `POST /api/mixpost/generate`
Auto-generate post content from D1 data.

**Request:** `{ "source": "promotion", "id": "AURA20" }` or `{ "source": "menu", "category": "Cà phê" }`

**Flow:** Query D1 → apply content template → return `{ content, mediaUrls, hashtags }` (does NOT publish — returns draft for review).

### `GET /api/mixpost/accounts`
Proxy to Mixpost `GET /api/mixpost/accounts` — list connected social accounts.

### `GET /api/mixpost/posts`
Proxy to Mixpost `GET /api/mixpost/posts` — list recent posts (with status).

## Content Templates

```js
function promoToPostContent(promo) {
  return {
    content: `🎉 ${promo.code}: Giảm ${promo.percent}% đơn hàng!\n\n${promo.percent > 20 ? '🔥 Siêu hot! ' : ''}Áp dụng tại Aura Cafe.\n\n#AuraCafe #KhuyenMai #CaPhe`,
    mediaUrls: [],
    hashtags: ['AuraCafe', 'KhuyenMai', 'CaPhe'],
  };
}

function specialsToPostContent(products) {
  const items = products.map(p => `☕ ${p.name} — ${p.price.toLocaleString('vi-VN')}đ`).join('\n');
  return {
    content: `📋 Món đặc biệt hôm nay tại Aura Cafe:\n\n${items}\n\nGọi ngay: 1900 1234\n\n#AuraCafe #MenuHangNgay`,
    mediaUrls: products.filter(p => p.image).slice(0, 4).map(p => p.image),
    hashtags: ['AuraCafe', 'MenuHangNgay'],
  };
}
```

## Requirements

### Functional
- Hono router at `/api/mixpost` with 4 endpoints
- Mixpost API client with token auth, retry, error handling
- Content templates for promotions + daily specials
- Zod validation on POST inputs
- Structured logger on all operations

### Non-functional
- No auth required on CF Worker routes (internal network)
- `MIXPOST_API_URL` + `MIXPOST_API_TOKEN` from env
- Mixpost client reusable (not tied to routes)
- Content templates configurable (separate template file or inline constants)

## Implementation Steps

1. [ ] Write TDD tests for `mixpost-client.js` (mock fetch, test auth, retry, errors)
2. [ ] Write TDD tests for `/api/mixpost/posts` + `/api/mixpost/generate` (mock D1 + mock Mixpost API)
3. [ ] Implement `worker/src/lib/mixpost-client.js`
4. [ ] Implement `worker/src/routes/mixpost.js` with 4 endpoints
5. [ ] Register routes in `worker/src/index.js` (`app.route('/api/mixpost', mixpostRouter)`)
6. [ ] Verify all tests pass, 0 build errors

## Files

- **NEW:** `worker/src/lib/mixpost-client.js` (~60 lines)
- **NEW:** `worker/src/routes/mixpost.js` (~120 lines)
- **NEW:** `tests/mixpost-bridge.test.js` (~250 lines)
- **MODIFIED:** `worker/src/index.js` (+2 lines)

## Success Criteria

- [ ] `POST /api/mixpost/posts` creates a post in Mixpost (verified via mock)
- [ ] `POST /api/mixpost/generate` returns branded content from promo/menu data
- [ ] Content templates produce Vietnamese + hashtags + emoji
- [ ] Mixpost client handles 401, 5xx, network errors gracefully
- [ ] All TDD tests pass before and after implementation
- [ ] Build: 0 errors, 0 regressions
