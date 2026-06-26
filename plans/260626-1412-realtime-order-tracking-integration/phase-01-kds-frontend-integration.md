# PHASE 01: KDS FRONTEND INTEGRATION

**Tasks:** RT-1, RT-4, RT-5
**Priority:** High
**Status:** Not Started
**Effort:** 1.5 hours total

---

## Context Links

- Main plan: `plan.md`
- Related code: `js/kds-app.js`, `js/kds-poll.js`, `js/kds/kds-api.js`
- Backend: `worker/src/routes/orders-hono.js`
- Configuration: `js/config.js`

---

## Overview

Integrate the existing `KdsPollClient` polling mechanism into the KDS application, remove dead WebSocket code, wire realtime stats updates, and add sound notifications for order events. This phase establishes the core realtime foundation.

---

## Key Insights

1. `KdsPollClient` already exists and functional — needs initialization and callback wiring
2. Stats refresh currently at 10s interval — should respond to order updates automatically
3. Sound notifications use Web Audio API; need user interaction to initialize context
4. All modifications are in `js/kds-app.js` except stats API fix in `js/kds/kds-api.js`

---

## Requirements

### Functional
- KDS polls `/api/kds/orders/latest` every 3 seconds
- New orders automatically appear in UI without manual refresh
- Status button clicks trigger immediate status update then poll refresh
- Stats cards (pending/preparing/ready) update automatically
- Sound plays on: new order arrival, order ready
- Mute toggle in settings

### Non-Functional
- No console errors
- Polling stops cleanly when user navigates away
- Web Audio context initialized on first user click
- Configurable intervals via `KDS_CONFIG.POLL_INTERVAL`

---

## Architecture

```
kds-app.js
  ├── initKdsPollClient()
  │   └── new KdsPollClient({ pollMs: 3000, onUpdate: onOrdersUpdate })
  ├── onOrdersUpdate(newOrders)
  │   ├── playSoundIfNeeded(newOrders)
  │   ├── set KDS_STATE.orders
  │   └── fetchKDSStats() → update stats cards
  └── updateOrderStatusAPI(orderId, newStatus)
      └── poll automatically picks up change on next tick

kds-api.js
  └── fetchKDSStats() calls real API instead of returning hardcoded values
```

---

## Related Code Files

### Modify
- `js/kds-app.js` (lines 378-421: polling setup, stats refresh, sound integration)
- `js/kds/kds-api.js` (fetchKDSStats function)

### Read-Only
- `js/kds-poll.js` (KdsPollClient class reference)
- `js/config.js` (API_BASE)

---

## Implementation Steps

### Step 1: Remove WebSocket Dead Code
1. Search `kds-app.js` for "websocket", "ws", "WebSocket"
2. Remove any dead code, variables, connection logic
3. Ensure no console warnings about undefined variables

### Step 2: Initialize KdsPollClient
1. Verify `KdsPollClient` import path: `import { KdsPollClient } from './kds-poll.js'` or similar
2. In `initKdsPollClient()` function:
   - `const pollClient = new KdsPollClient({ pollMs: KDS_CONFIG.POLL_INTERVAL || 3000 })`
   - `pollClient.onUpdate = (orders) => { handlePollUpdate(orders) }`
   - `pollClient.start()`
3. Remove old `setInterval` polling code if present

### Step 3: Wire Order Update Handler
1. Create `handlePollUpdate(orders)` function:
   - Compare with previous `KDS_STATE.orders` to detect changes
   - If changes detected:
     - Update `KDS_STATE.orders = orders`
     - Call `fetchKDSOrdersAPI()` to refresh UI
     - Trigger sound notifications for new/ready orders
     - Call `fetchKDSStats()` to update stats cards

### Step 4: Fix Stats API
1. In `js/kds/kds-api.js`, locate `fetchKDSStats()` function
2. Replace hardcoded return with:
   ```javascript
   const response = await fetch(`${API_BASE}/kds/orders?status=pending,preparing,ready`)
   const orders = await response.json()
   const stats = { pending: 0, preparing: 0, ready: 0 }
   orders.forEach(o => {
     if (o.status === 'pending') stats.pending++
     else if (o.status === 'preparing') stats.preparing++
     else if (o.status === 'ready') stats.ready++
   })
   return stats
   ```
3. Ensure this is called from `handlePollUpdate()`

### Step 5: Add Sound Notifications
1. At top of `kds-app.js`, add:
   ```javascript
   let audioCtx = null
   const SOUND_CONFIG = {
     newOrder: { freq: 800, duration: 200 },
     orderReady: { freq: 1200, duration: 300 }
   }
   ```
2. Create `initAudioContext()` — called on first user click:
   ```javascript
   function initAudioContext() {
     if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
   }
   document.addEventListener('click', initAudioContext, { once: true })
   ```
3. Create `playSound(type)` function:
   ```javascript
   function playSound(type) {
     if (!audioCtx || !KDS_CONFIG.SOUND_ENABLED) return
     const osc = audioCtx.createOscillator()
     const gain = audioCtx.createGain()
     osc.connect(gain)
     gain.connect(audioCtx.destination)
     osc.frequency.value = SOUND_CONFIG[type].freq
     osc.type = 'sine'
     gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
     gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + SOUND_CONFIG[type].duration/1000)
     osc.start()
     osc.stop(audioCtx.currentTime + SOUND_CONFIG[type].duration/1000)
   }
   ```
4. In `handlePollUpdate()`, detect:
   - New order: if `order.status === 'pending'` and previously not in orders → `playSound('newOrder')`
   - Order ready: if `order.status === 'ready'` and was `'preparing'` → `playSound('orderReady')`

### Step 6: Add Mute Toggle
1. In settings UI (existing settings panel), add checkbox:
   ```html
   <label>
     <input type="checkbox" id="sound-enabled" checked>
     Sound notifications
   </label>
   ```
2. Bind to `KDS_CONFIG.SOUND_ENABLED` on change

---

## Todo List

- [ ] Read current `js/kds-app.js` implementation (lines 1-500)
- [ ] Remove all WebSocket-related dead code
- [ ] Verify `KdsPollClient` import path and availability
- [ ] Implement `initKdsPollClient()` with KdsPollClient instantiation
- [ ] Create `handlePollUpdate()` with change detection and UI refresh
- [ ] Wire stats refresh call in `handlePollUpdate()`
- [ ] Fix `fetchKDSStats()` in `js/kds/kds-api.js` to call real API
- [ ] Add Web Audio context initialization on first click
- [ ] Implement `playSound(type)` function
- [ ] Add sound trigger logic for new orders and ready orders
- [ ] Add mute toggle in settings UI
- [ ] Test: Open kds.html, verify orders load and refresh every 3s
- [ ] Test: Change order status in backend, verify UI updates and sound plays
- [ ] Check console for errors (should be none)
- [ ] Run `npm run lint` on `js/kds-app.js` and `js/kds/kds-api.js`

---

## Success Criteria

- ✅ KDS displays new orders within 5 seconds (3s poll + processing)
- ✅ Stats cards show accurate counts (pending, preparing, ready)
- ✅ Sound notifications play for new orders and ready status changes
- ✅ Mute toggle works (sound can be disabled)
- ✅ Zero console errors during 5-minute test session
- ✅ Linter passes on modified files

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Web Audio context blocked | Low | Low | Initialize on user click (guaranteed) |
| KdsPollClient not imported correctly | Medium | High | Verify import path before coding |
| Memory leak from unclosed audio | Low | Medium | Ensure audio context reused, not recreated |
| Stats API returns wrong format | Medium | Medium | Read backend route to verify response shape |
| Polling continues after page exit | Medium | Low | Ensure `pollClient.stop()` called on pagehide |

---

## Next Steps

After completion:
- Proceed to RT-2 (Track Order Polling) — independent, can run parallel
- Or continue to RT-4/RT-5 if those not completed in this phase
