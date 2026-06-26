# REALTIME ORDER TRACKING INTEGRATION — IMPLEMENTATION PLAN

## Work Context
- **Project:** FnB-Container-Caffe (AURA Space Sa Dec)
- **Plan Created:** 2026-06-26
- **Reports Path:** /Users/mac/mekong-cli/FnB-Container-Caffe/plans/reports/
- **Plans Path:** /Users/mac/mekong-cli/FnB-Container-Caffe/plans/

---

## Overview

**Priority:** High
**Status:** Not Started
**Total Effort:** 4-6 hours
**Dependencies:** None — all tasks can start immediately

This plan integrates realtime order tracking across KDS, customer tracking, and success pages using HTTP polling pattern (backend already supports KV flag-based polling). Backend routes exist; this is pure frontend integration work.

**Tasks:**
- RT-1: KDS Frontend Integration (KdsPollClient)
- RT-2: Track Order Polling
- RT-3: Success Page Realtime Status
- RT-4: KDS Stats Realtime
- RT-5: Sound Notifications
- RT-6: E2E Verification

---

## Key Insights from Scout

1. **Polling pattern established:** Backend uses Cloudflare KV flag (`latest_order_ts`) for change detection. Frontend polling at 3-10s intervals is standard.
2. **API_BASE centralized:** `config.js` defines `API_CONFIG.WORKER_BASE_URL` with environment auto-detection.
3. **Status values consistent:** pending → confirmed/preparing → ready → delivered/completed (variations across contexts).
4. **No WebSocket infrastructure:** Current code has WebSocket dead code; should be removed before integration.
5. **KdsPollClient exists:** `js/kds-poll.js` provides polling client with CustomEvent dispatch; needs to be wired into `kds-app.js`.

---

## Requirements

### Functional
- RT-1: KDS updates automatically when kitchen orders change
- RT-2: Track order page shows live status changes
- RT-3: Success page displays animated progress bar with realtime updates
- RT-4: KDS stats cards reflect current order counts
- RT-5: Sound notifications for new orders and order ready events
- RT-6: E2E verification across all three surfaces

### Non-Functional
- Polling intervals: KDS 3s, track order 5s, success page 5s
- Error handling: graceful degradation, no silent failures
- Performance: minimal CPU/memory impact from polling
- UX: smooth animations, no jarring refreshes

---

## Architecture

### Pattern: HTTP Long-Polling with KV Flag Detection

```
Frontend (KdsPollClient)
  ↓ GET /api/kds/orders/latest every 3s
Backend (Cloudflare Worker)
  ↓ Checks AUTH_KV 'latest_order_ts'
  ↓ Returns orders if timestamp changed
Frontend receives new orders
  ↓ dispatches CustomEvent('kds:update')
  ↓ triggers UI refresh
```

### API Contracts

**KDS Polling endpoint:** `GET /api/kds/orders/latest`
- Returns: `{ orders: Order[], lastTs: number }`
- 304 Not Modified if no change

**Track Order endpoint:** `GET /api/orders/:orderId`
- Returns: `Order` with status field

**KDS Stats endpoint:** `GET /api/kds/stats` or computed client-side
- Group orders by status → counts

---

## Related Code Files

### To Modify
- `js/kds-app.js` (lines 378-421: polling init, stats refresh)
- `js/track-order.js` (lines 206-241: polling loop)
- `success.html` (polling script section)
- `js/kds/kds-api.js` (fetchKDSStats hardcoded values)

### Existing Components (Read-Only)
- `js/kds-poll.js` (KdsPollClient class)
- `js/config.js` (API_BASE configuration)
- `worker/src/routes/orders-hono.js` (KDS backend routes)

---

## Implementation Steps

### RT-1: Connect KDS Frontend with KdsPollClient
1. Read `js/kds-app.js` current state
2. Remove dead WebSocket code (kdsWebSocket, connectWS functions if present)
3. Import `KdsPollClient` from `js/kds-poll.js`
4. Replace `initKdsPollClient()` to instantiate KdsPollClient with 3000ms interval
5. Wire `onUpdate` callback to call `fetchKDSOrdersAPI()` → update `KDS_STATE.orders`
6. Keep stats refresh at 10s interval (separate concern)
7. Ensure status button clicks call `updateOrderStatusAPI()` then let poll refresh automatically

### RT-2: Fix Track Order to HTTP Polling
1. Read `js/track-order.js` current WebSocket implementation
2. Remove WebSocket connection code
3. Add `setInterval` calling `fetch('/api/orders/' + orderId)` every 5000ms
4. On response: compare `order.status` with previous, update timeline UI with animation
5. Stop polling when `order.status` in ['delivered', 'cancelled']
6. Add exponential backoff on fetch errors (start 1s, max 30s)
7. Show user-friendly error toast after 3 consecutive failures

### RT-3: Success Page Realtime Status
1. Read `success.html` inline script
2. Add polling logic after order data initialization
3. Poll `GET /api/orders/:orderId` every 5000ms
4. Update progress bar based on status: pending → confirmed → preparing → ready → delivered/completed
5. Animate progress bar fill on status transition (CSS transition)
6. Show notification badge on key status changes (preparing ready)
7. Stop polling on terminal statuses

### RT-4: KDS Stats Realtime
1. Read `js/kds/kds-api.js` fetchKDSStats function
2. Replace hardcoded return with actual API call: `fetch('/api/kds/orders?status=pending,preparing,ready')`
3. Count orders by status from response
4. Return `{ pending, preparing, ready }` object
5. Update stats cards in `kds-app.js` when KdsPollClient triggers update

### RT-5: Order Status Sound Notifications
1. In `js/kds-app.js`, create Web Audio context on user interaction (first click)
2. Add sound config: `KDS_CONFIG.SOUND_ENABLED` (default true)
3. Define two sounds:
   - newOrder: 800Hz sine, 200ms duration
   - orderReady: 1200Hz sine, 300ms duration
4. Play newOrder sound when new pending order detected in poll
5. Play orderReady sound when order transitions to 'ready'
6. Add mute toggle in UI (settings panel)

### RT-6: E2E Verification
1. Manual checklist:
   - [ ] Open kds.html in tab 1, checkout.html in tab 2
   - [ ] Place COD order, verify KDS shows within 5s
   - [ ] Change status on KDS (preparing → ready), verify sound plays
   - [ ] Open track-order.html, verify status updates
   - [ ] Verify success page progress bar animates
   - [ ] Check console for errors (zero errors)
   - [ ] Run `npm run lint` on modified files
2. Document any discrepancies in report

---

## Todo List

### RT-1: KDS Frontend Integration
- [ ] Read js/kds-app.js to understand current implementation
- [ ] Remove WebSocket dead code
- [ ] Import and instantiate KdsPollClient with 3s interval
- [ ] Wire onUpdate callback to refresh orders
- [ ] Verify status button updates trigger poll refresh
- [ ] Test locally: changes reflect within 5s

### RT-2: Track Order Polling
- [ ] Read js/track-order.js current implementation
- [ ] Replace WebSocket with setInterval polling (5s)
- [ ] Implement exponential backoff on errors
- [ ] Animate timeline on status change
- [ ] Stop polling on delivered/cancelled
- [ ] Add error toast after 3 consecutive failures

### RT-3: Success Page Realtime
- [ ] Read success.html script section
- [ ] Add 5s polling loop after order init
- [ ] Update progress bar with status mapping
- [ ] Add CSS transition for smooth animation
- [ ] Show notification on key status changes
- [ ] Stop polling on terminal statuses

### RT-4: KDS Stats Realtime
- [ ] Read js/kds/kds-api.js fetchKDSStats
- [ ] Replace hardcoded with actual API call
- [ ] Count orders by status from response
- [ ] Wire stats refresh to KdsPollClient updates
- [ ] Verify stats cards display correct counts

### RT-5: Sound Notifications
- [ ] Create Web Audio context initialization
- [ ] Add sound config toggle
- [ ] Implement newOrder beep (800Hz, 200ms)
- [ ] Implement orderReady chime (1200Hz, 300ms)
- [ ] Wire events to KdsPollClient order detection
- [ ] Add mute toggle in settings UI

### RT-6: E2E Verification
- [ ] Prepare 3-browser tab test setup
- [ ] Place test order, verify KDS updates in 5s
- [ ] Test status change sounds
- [ ] Verify track-order.html updates
- [ ] Verify success page progress bar
- [ ] Check console for errors
- [ ] Run linter on all modified files
- [ ] Write final verification report

---

## Success Criteria

### Minimum Viable
- KDS shows new orders within 5 seconds (not immediate, polling interval)
- Track order page updates status at least every 5 seconds
- Success page progress bar reflects current status
- KDS stats show real counts (not hardcoded 0/1/2)
- Sound notifications play for new orders and ready status
- Zero console errors during normal operation

### Full Success
- Smooth animations without flicker
- Exponential backoff handles network hiccups gracefully
- User-friendly error messages after repeated failures
- All modified files lint-clean (`npm run lint` passes)
- E2E test passes on first attempt
- Commit message: `feat: realtime order-kds-tracking integration`

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Polling interval too aggressive | Low | Medium | Stick to 3-5s as per existing pattern; test load |
| API endpoint mismatch | Medium | High | Read source code before implementing; verify routes in `orders-hono.js` |
| Race condition in status updates | Medium | Medium | Ensure fetch completes before state update; use last-write-wins |
| Web Audio API blocked by browser | Low | Low | Initialize on first user interaction; fallback silent |
| Exponential backoff never recovers | Low | Medium | Cap backoff at 30s; reset on success |
| E2E test fails due to environment | Medium | Medium | Test incrementally after each task, not all at end |

---

## Security Considerations

- **No new auth needed:** Uses existing Cloudflare Workers auth (already in place)
- **API_BASE respects environment:** Local dev uses localhost, production uses workers domain
- **No sensitive data leakage:** Order details already visible in KDS; polling just fetches same data
- **Rate limiting:** Already enforced by Cloudflare Workers (per route); polling at 3-5s is well within limits

---

## Next Steps

1. Create worktree for isolation (optional but recommended)
2. Begin RT-1: read `js/kds-app.js` and understand current polling integration
3. Implement RT-1, then immediately test locally
4. Continue RT-2 in parallel (independent)
5. Implement RT-3, RT-4, RT-5
6. Complete RT-6 E2E verification
7. Run `npm run lint` on all modified files
8. Commit with conventional message
9. Update `docs/project-changelog.md` with entry

---

## Unresolved Questions

None — all necessary information from scout analysis.

---

## References

- `js/kds-poll.js` — Polling client implementation
- `js/kds-app.js` — KDS application orchestrator
- `js/track-order.js` — Customer tracking page
- `success.html` — Checkout success page
- `js/kds/kds-api.js` — KDS API functions
- `worker/src/routes/orders-hono.js` — Backend KDS routes
- `js/config.js` — API_BASE configuration
- `plans/260626-1415-final-prioritized-work-plan.md` — Overall project plan
