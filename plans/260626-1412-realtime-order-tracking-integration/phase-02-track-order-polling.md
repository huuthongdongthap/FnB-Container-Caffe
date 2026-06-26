# PHASE 02: TRACK ORDER POLLING

**Tasks:** RT-2
**Priority:** High
**Status:** Not Started
**Effort:** 45 minutes

---

## Context Links

- Main plan: `plan.md`
- Related code: `js/track-order.js`
- Backend: `worker/src/routes/orders.js` (order detail endpoint)
- Configuration: `js/config.js`

---

## Overview

Replace WebSocket-based tracking in `track-order.js` with HTTP polling every 5 seconds, adding exponential backoff, error handling, and animated status timeline updates. Polling stops when order reaches terminal status (delivered/cancelled).

---

## Key Insights

1. Current `track-order.js` uses `setInterval` already (5s) but may have WebSocket dead code
2. API endpoint pattern: `${API_BASE}/orders/${orderId}`
3. Status values: pending, confirmed, preparing, ready, delivered, cancelled
4. Need exponential backoff: start 1s, double on failure, cap at 30s, reset on success
5. Timeline UI needs animation on status change (CSS transition)

---

## Requirements

### Functional
- Poll order endpoint every 5 seconds on active tracking page
- Update timeline UI with current order status
- Animate progress bar on status transitions
- Stop polling on delivered/cancelled status
- Handle network errors gracefully with retry/backoff
- Show user-friendly error after 3+ consecutive failures

### Non-Functional
- Exponential backoff prevents hammering backend on outage
- Smooth CSS animations (no jarring jumps)
- No memory leaks — clear interval on page exit
- Lint-clean code

---

## Architecture

```
track-order.js
  ├── startPolling(orderId)
  │   └── setInterval(5000ms) → fetchOrder(orderId)
  │       ├── Success: updateTimeline(status), reset backoff
  │       └── Failure: increment failure count, increase interval
  ├── stopPolling()
  │   └── clearInterval, reset backoff state
  └── updateTimeline(status)
      └── animate progress bar, show notification badge
```

---

## Related Code Files

### Modify
- `js/track-order.js` (lines 206-241: polling loop, error handling, UI updates)

### Read-Only
- `js/config.js` (API_BASE)
- `worker/src/routes/orders.js` (GET /api/orders/:id response format)

---

## Implementation Steps

### Step 1: Clean Up WebSocket Code
1. Read entire `js/track-order.js`
2. Remove any WebSocket connection variables and methods
3. Remove dead code flagged with "TODO" or "FIXME" related to WebSocket

### Step 2: Implement Poll Loop with Backoff
1. Define variables at module scope:
   ```javascript
   let pollIntervalId = null
   let pollIntervalMs = 5000
   let consecutiveFailures = 0
   const MAX_BACKOFF_MS = 30000
   const FAILURE_THRESHOLD = 3
   ```
2. Create `startPolling(orderId)` function:
   ```javascript
   function startPolling(orderId) {
     stopPolling()  // prevent duplicates
     pollIntervalId = setInterval(() => {
       fetchOrderWithRetry(orderId)
     }, pollIntervalMs)
   }
   ```
3. Create `fetchOrderWithRetry(orderId)`:
   ```javascript
   async function fetchOrderWithRetry(orderId) {
     try {
       const response = await fetch(`${API_BASE}/orders/${orderId}`)
       if (!response.ok) throw new Error(`HTTP ${response.status}`)
       const order = await response.json()
       consecutiveFailures = 0
       pollIntervalMs = 5000  // reset backoff
       handleOrderUpdate(order)
     } catch (error) {
       consecutiveFailures++
       if (consecutiveFailures >= FAILURE_THRESHOLD) {
         stopPolling()
         showErrorToast('Cannot fetch order status. Please refresh.')
       } else {
         // Exponential backoff
         pollIntervalMs = Math.min(pollIntervalMs * 2, MAX_BACKOFF_MS)
         console.warn(`Polling error, backing off to ${pollIntervalMs}ms`)
       }
     }
   }
   ```

### Step 3: Status Timeline Updates
1. In `handleOrderUpdate(order)`:
   ```javascript
   function handleOrderUpdate(order) {
     const previousStatus = currentOrder?.status
     currentOrder = order
     updateTimelineUI(order.status)
     
     // Animate on change
     if (previousStatus !== order.status) {
       animateStatusChange()
       
       // Stop on terminal statuses
       if (['delivered', 'cancelled'].includes(order.status)) {
         stopPolling()
       }
     }
   }
   ```
2. Implement `updateTimelineUI(status)`:
   - Find timeline step elements by data-status attribute
   - Add `.active` class to current and all preceding steps
   - Remove `.active` from succeeding steps
   - Update progress bar width percentage

3. Implement `animateStatusChange()`:
   - Brief highlight animation (flash) on timeline container
   - CSS: `@keyframes flash { 0% { background: yellow; } 100% { background: transparent; } }`

### Step 4: Stop Polling Cleanly
1. Add `stopPolling()`:
   ```javascript
   function stopPolling() {
     if (pollIntervalId) {
       clearInterval(pollIntervalId)
       pollIntervalId = null
     }
     consecutiveFailures = 0
     pollIntervalMs = 5000
   }
   ```
2. Call `stopPolling()` on pagehide/unload events:
   ```javascript
   window.addEventListener('pagehide', stopPolling)
   ```

### Step 5: Error Handling
1. Create `showErrorToast(message)` function:
   - Show toast notification with error message
   - Auto-dismiss after 5 seconds
   - Include "Retry" button that resets backoff and resumes polling
2. Ensure no silent failures — all errors logged to console

---

## Todo List

- [ ] Read current `js/track-order.js` implementation
- [ ] Remove WebSocket dead code (if any)
- [ ] Add backoff state variables (pollIntervalMs, consecutiveFailures)
- [ ] Implement `startPolling(orderId)` with setInterval
- [ ] Implement `fetchOrderWithRetry(orderId)` with try/catch and backoff logic
- [ ] Implement `handleOrderUpdate(order)` with status change detection
- [ ] Implement `updateTimelineUI(status)` to update active steps and progress bar
- [ ] Implement `animateStatusChange()` with CSS flash animation
- [ ] Implement `stopPolling()` and wire to pagehide event
- [ ] Implement `showErrorToast()` with retry button
- [ ] Add CSS animation keyframes for status change flash
- [ ] Test: Open track-order page, verify polling every 5s
- [ ] Test: Simulate network error, verify backoff increases
- [ ] Test: After 3 failures, verify error toast appears and polling stops
- [ ] Test: Set order to delivered, verify polling stops automatically
- [ ] Check console for errors
- [ ] Run `npm run lint`

---

## Success Criteria

- ✅ Order status updates at least every 5 seconds
- ✅ Timeline progress bar animates smoothly on status change
- ✅ Polling stops automatically on delivered/cancelled
- ✅ Network errors trigger exponential backoff (1s → 2s → 4s → 8s → ... → 30s max)
- ✅ After 3 consecutive failures, user-friendly error toast appears
- ✅ Retry button resets backoff and resumes polling
- ✅ Zero console errors during 5-minute test
- ✅ Linter passes

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Backoff grows unbounded | Low | Low | Cap at 30s, reset on success |
| Timeline UI flickers on update | Medium | Low | Use CSS transitions, avoid full re-render |
| Memory leak from orphaned interval | Low | Medium | Ensure `stopPolling()` on pagehide |
| API returns unexpected status value | Medium | Medium | Validate status against known values before updating UI |
| User leaves page before polling stops | Medium | Low | pagehide event listener handles cleanup |

---

## Next Steps

After completion:
- Proceed to RT-3 (Success Page Realtime) — similar pattern, can reuse code
- Or parallelize if independent workstream
