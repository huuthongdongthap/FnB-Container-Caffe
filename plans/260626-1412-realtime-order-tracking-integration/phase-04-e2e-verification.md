# PHASE 04: E2E VERIFICATION

**Tasks:** RT-6
**Priority:** High
**Status:** Not Started
**Effort:** 30 minutes

---

## Context Links

- Main plan: `plan.md`
- Previous phases: RT-1, RT-2, RT-3, RT-4, RT-5
- Test environment: localhost (127.0.0.1:8787) or production

---

## Overview

Comprehensive manual end-to-end testing across all integrated surfaces: KDS dashboard, customer tracking page, and success page. Verify realtime updates, animations, sound notifications, and error handling work correctly in concert.

---

## Key Insights

1. Requires 3 browser tabs simultaneously: kds.html, track-order.html, checkout flow
2. Test flow: place order → KDS receives it → status changes → tracking and success pages update
3. Must verify timing: updates within 5 seconds (3s poll + network)
4. Sound notifications must play on kitchen station (assumes KDS tab focused or audio permission granted)

---

## Requirements

### Functional
- New order appears in KDS within 5 seconds of placement
- Status change on KDS (preparing → ready) updates track-order and success pages within 5s
- Sound notifications play on KDS tab for new orders and ready status
- Progress bar on success page animates smoothly
- Tracking page timeline updates correctly
- All polling stops on terminal statuses without errors

### Non-Functional
- Zero console errors on any page during test
- No memory leaks (check DevTools heap if needed)
- Smooth animations, no flicker
- All modified files lint-clean

---

## Architecture

Test scenario flow:
```
Tab 1: kds.html (Kitchen)
   ↑ polls /api/kds/orders/latest every 3s
   ↓ updates UI + plays sound

Tab 2: checkout.html → success.html (Customer)
   ↑ polls /api/orders/:id every 5s
   ↓ updates progress bar + notifications

Tab 3: track-order.html (Customer tracking)
   ↑ polls /api/orders/:id every 5s
   ↓ updates timeline

Backend: Cloudflare Worker
   ├── POST /api/orders (checkout creates order)
   ├── PATCH /api/orders/:id (status updates)
   └── KV flag 'latest_order_ts' triggers poll responses
```

---

## Related Code Files

### Test Surfaces
- `kds.html` — Kitchen display
- `track-order.html` — Customer order tracking
- `checkout.html` / `success.html` — Checkout flow

### Backend Routes
- `worker/src/routes/orders-hono.js` — KDS orders
- `worker/src/routes/orders.js` — Customer orders

---

## Implementation Steps

### Step 1: Prepare Test Environment
1. Ensure local worker is running: `npm run dev` or `mekong dev`
2. Open 3 browser tabs:
   - Tab 1: `http://localhost:8787/kds.html`
   - Tab 2: `http://localhost:8787/checkout.html`
   - Tab 3: `http://localhost:8787/track-order.html` (or use order ID from success page)
3. Open DevTools Console in each tab (F12)

### Step 2: Place Test Order
1. In Tab 2 (checkout):
   - Add items to cart
   - Select COD payment
   - Complete checkout
   - Copy order ID from success page URL or order details
2. **Expected within 5s:**
   - Tab 1 (KDS): Order appears in list with "pending" status
   - Tab 3 (track-order): Shows "pending" or "confirmed" status
   - Sound plays on Tab 1 (new order notification)

### Step 3: Update Status to Preparing
1. In Tab 1 (KDS):
   - Click "Start Prep" or status button for test order
   - Order status changes to "preparing"
2. **Expected within 5s:**
   - Tab 3 (track-order): Status updates to "preparing" with animation
   - Success page (Tab 2 after redirect): Progress bar advances
   - No sound (only new order and ready trigger sounds)

### Step 4: Update Status to Ready
1. In Tab 1 (KDS):
   - Click "Mark Ready" or complete prep
   - Order status changes to "ready"
2. **Expected within 5s:**
   - Tab 3 (track-order): Status updates to "ready" with animation
   - Success page: Progress bar advances, notification badge "Order is ready for pickup!"
   - Sound plays on Tab 1 (order ready chime)
   - Notification visible for 5 seconds

### Step 5: Complete Order (Delivered)
1. In Tab 1 (KDS):
   - Click "Deliver" or mark as delivered
   - Order status changes to "delivered"
2. **Expected:**
   - Tab 3 (track-order): Status updates to "delivered", then polling stops
   - Success page: Progress bar completes
   - No further polls after delivered status

### Step 6: Error Handling Test
1. In Tab 1, stop the worker (simulate outage)
2. Wait for poll to fail
3. **Expected:**
   - Console shows warning with backoff message (KDS may log)
   - After 3 failures, error toast appears on affected pages
   - Polling stops gracefully (no infinite retries)
4. Restart worker
5. Click "Retry" on error toast
6. **Expected:** Polling resumes with 5s interval

### Step 7: Linter Check
1. Run: `npm run lint`
2. **Expected:** Zero errors, zero warnings
3. If warnings/errors:
   - Fix formatting issues
   - Address undefined variables
   - Ensure no console.log statements (or use proper logging)

### Step 8: Cleanup Verification
1. Close all tabs
2. Reopen KDS page
3. **Expected:** No orphaned intervals (check DevTools Performance tab for timers)
4. Verify worker logs show clean request/response cycles

---

## Verification Checklist

### KDS (Tab 1)
- [ ] Orders appear within 5 seconds of placement
- [ ] Status changes reflect automatically without manual refresh
- [ ] Sound plays for new orders (pending) and ready status
- [ ] Stats cards update when orders change status
- [ ] Mute toggle works (if implemented)
- [ ] Zero console errors
- [ ] Polling stops cleanly when page closed

### Track Order (Tab 3)
- [ ] Status updates at least every 5 seconds
- [ ] Timeline progress bar animates on transitions
- [ ] Polling stops on delivered/cancelled
- [ ] Error toast appears after 3 failures
- [ ] Retry button resumes polling
- [ ] Zero console errors

### Success Page (Tab 2)
- [ ] Progress bar fills correctly matching status steps
- [ ] Smooth CSS transition on width change
- [ ] Notification appears when order becomes ready
- [ ] Notification auto-dismisses after 5s
- [ ] Polling stops on terminal statuses
- [ ] Zero console errors

### Code Quality
- [ ] `npm run lint` passes on all modified files
- [ ] No console.log debug statements (or proper logging)
- [ ] No unused variables or imports
- [ ] Consistent code style

---

## Test Documentation Template

After completing tests, create a brief report:

```
## E2E Verification Report

Date: 2026-06-26
Tester: [Name]

### Scenarios Tested
1. ✅ New order appears in KDS within 5s
2. ✅ Status updates propagate to track-order and success pages
3. ✅ Sound notifications play correctly
4. ✅ Progress bar animations smooth
5. ✅ Polling stops on terminal statuses
6. ✅ Error handling with backoff and retry works
7. ✅ Linter passes: 0 errors, 0 warnings

### Issues Found
- None / [List any issues with line numbers]

### Conclusion
Integration verified and production-ready ✅
```

---

## Success Criteria

**Minimum:**
- All 7 checklist items above pass
- Linter passes with 0 errors
- No console errors during 10-minute continuous test

**Full:**
- All scenarios verified without manual intervention
- Animations smooth (60fps)
- Sound notifications audible and timely
- Polling stops cleanly in all exit scenarios

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Network latency > 5s | Medium | Medium | Verify poll interval sufficient (5s), test on throttled network |
| Browser blocks audio autoplay | Low | Low | Initialize audio on first user click (already implemented) |
| Local worker not running | Medium | High | Document setup steps clearly before testing |
| Race condition in status updates | Low | Medium | Verify timestamp-based ordering in backend |
| Memory leak from intervals | Low | Medium | pagehide cleanup verified in previous phases |

---

## Next Steps

After verification:
- If all tests pass → proceed to commit and deploy
- If issues found → create bug tasks, fix, re-test
- Update `docs/project-changelog.md` with integration completion
- Update `docs/development-roadmap.md` progress status
