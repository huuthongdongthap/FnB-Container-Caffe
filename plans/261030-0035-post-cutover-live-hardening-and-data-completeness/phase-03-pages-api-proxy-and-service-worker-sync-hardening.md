# Phase 03: Pages `/api/*` Proxy & Service Worker Sync Hardening

## Context Links
- Brainstorm Report: `plans/reports/brainstorm-261030-post-cutover-live-hardening-and-data-completeness.md`
- Pages Redirects: `public/_redirects`
- Service Worker: `public/sw.js`

## Overview
- **Priority**: P0 (Prevent silent offline order loss in PWA Service Worker & fix relative `/api/*` requests on `auraspace.cafe`)
- **Current Status**: Pending
- **Description**: `public/_redirects` currently routes `/api/*` to `/* /index.html 200` (`text/html`), causing `public/sw.js` `syncPendingOrders()` (`fetch('/api/orders/sync')`) to receive `200 OK` HTML and delete queued offline orders from IndexedDB without syncing them to the Worker.

## Key Insights
- On Cloudflare Pages, `/* /index.html 200` catches every path not matched by an earlier rule or static file.
- Adding `/api/* https://aura-space-worker.sadec-marketing-hub.workers.dev/api/:splat 200` (or redirect) above `/* /index.html 200` in `public/_redirects` ensures relative `/api/*` calls on `auraspace.cafe` never fall through to `index.html`.
- In `public/sw.js:239`, `syncPendingOrders()` must check that `response.ok` AND `content-type` includes `application/json` (and `data.success !== false`) before calling `store.delete(order.id)`.

## Requirements
- **Functional**:
  - Add `/api/*` rule before `/* /index.html 200` in `public/_redirects`.
  - Update `public/sw.js` `syncPendingOrders()` to post to `/api/orders`, verify JSON response content-type, and only delete the pending order from IndexedDB when a valid JSON order response is confirmed.
- **Non-Functional**:
  - Zero impact on SPA client-side routes (`/menu`, `/checkout`, `/track`, `/admin`, `/kds`, `/pos`).

## Architecture
- Browser / Service Worker (`auraspace.cafe`) → `/api/*` rule in `public/_redirects` → `aura-space-worker.sadec-marketing-hub.workers.dev/api/:splat`.
- `public/sw.js` (`syncPendingOrders`) → validates `response.ok && contentType.includes('application/json')` → deletes IndexedDB `pending-orders` entry only on confirmed JSON success.

## Related Code Files
- Modify: `public/_redirects`
- Modify: `public/sw.js`

## Implementation Steps
1. Edit `public/_redirects` to add `/api/* https://aura-space-worker.sadec-marketing-hub.workers.dev/api/:splat 200` immediately before `# SPA fallback`.
2. Edit `public/sw.js` (`syncPendingOrders`, lines 235–256) to:
   - Call `/api/orders` (with fallback/support for `/api/orders`).
   - Check `const contentType = response.headers.get('content-type') || '';` and require `response.ok && contentType.includes('application/json')` before deleting `order.id` from IndexedDB.

## Todo List
- [ ] Add `/api/*` Worker rule in `public/_redirects`
- [ ] Harden `syncPendingOrders()` in `public/sw.js` with JSON content-type verification

## Success Criteria
- `curl -sI https://auraspace.cafe/api/health` does not return `text/html` SPA `index.html`.
- `public/sw.js` never deletes an IndexedDB `pending-orders` record if the response is HTML or non-JSON.

## Risk Assessment
- **Risk**: Cross-origin redirect on POST requests if status code is `301`/`302`.
- **Mitigation**: Configure `public/sw.js` to also support direct Worker origin or verify JSON response before deleting queued orders.

## Security Considerations
- Strictly pinned to `https://aura-space-worker.sadec-marketing-hub.workers.dev/api/:splat`.

## Next Steps
- Proceed to Phase 04 to align `cash-reconciliation-policy.ts` shift table resolution.
