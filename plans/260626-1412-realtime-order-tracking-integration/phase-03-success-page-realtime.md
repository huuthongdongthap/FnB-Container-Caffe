# PHASE 03: SUCCESS PAGE REALTIME STATUS

**Tasks:** RT-3
**Priority:** High
**Status:** Not Started
**Effort:** 30 minutes

---

## Context Links

- Main plan: `plan.md`
- Related code: `success.html`
- Backend: `worker/src/routes/orders.js`
- Configuration: `js/config.js` (API_BASE)

---

## Overview

Add realtime polling to the checkout success page to display animated order status progress. Polls every 5 seconds, updates progress bar based on status, shows notifications on key transitions, and stops on terminal statuses.

---

## Key Insights

1. `success.html` already has inline script with order data from checkout
2. Status mapping to progress steps: pending → confirmed → preparing → ready → delivering → delivered/completed
3. Progress bar should use CSS transitions for smooth animation
4. Need notification badge for status changes (especially preparing→ready)
5. Similar pattern to `track-order.js` but simpler (single order only)

---

## Requirements

### Functional
- Poll order endpoint every 5 seconds after checkout completion
- Update progress bar based on current status
- Animate progress bar fill on status transitions
- Show notification badge when order moves to "ready"
- Stop polling on delivered/cancelled/completed

### Non-Functional
- Smooth CSS transition (0.3s ease)
- No console errors
- Works with environment-aware API_BASE (localhost vs production)
- Minimal code footprint (success page is static HTML)

---

## Architecture

```
success.html inline script
  ├── startSuccessPolling(orderId)
  │   └── setInterval(5000ms) → fetchOrder(orderId)
  │       ├── Success: updateProgressBar(status), animate change
  │       └── Stop if terminal status
  └── updateProgressBar(status)
      └── Map status → step index, set width %, add notification class
```

---

## Related Code Files

### Modify
- `success.html` (inline `<script>` section after order data)

### Read-Only
- `js/config.js` (API_BASE environment detection)

---

## Implementation Steps

### Step 1: Add Polling State Variables
Inside success page script after order data initialization:
```javascript
let successPollIntervalId = null
const STATUS_STEPS = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'completed'
]
```

### Step 2: Implement startSuccessPolling()
```javascript
function startSuccessPolling(orderId) {
  stopSuccessPolling()  // prevent duplicates
  
  successPollIntervalId = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/orders/${orderId}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const order = await response.json()
      
      const previousStatus = window.currentOrderStatus
      window.currentOrderStatus = order.status
      
      updateProgressBar(order.status)
      
      if (previousStatus !== order.status) {
        animateStatusChange()
        
        // Show notification for ready status
        if (order.status === 'ready') {
          showNotification('Order is ready for pickup!')
        }
        
        // Stop on terminal statuses
        if (['delivered', 'cancelled', 'completed'].includes(order.status)) {
          stopSuccessPolling()
        }
      }
    } catch (error) {
      console.error('Success page polling error:', error)
      // Single error doesn't stop polling; next retry continues
    }
  }, 5000)
}
```

### Step 3: Implement stopSuccessPolling()
```javascript
function stopSuccessPolling() {
  if (successPollIntervalId) {
    clearInterval(successPollIntervalId)
    successPollIntervalId = null
  }
}
```

### Step 4: Implement updateProgressBar()
1. Find progress bar elements in DOM (check existing markup)
2. Typical structure: `.progress-bar-fill` or `.progress-step.active`
3. Map status to step index:
   ```javascript
   const currentIndex = STATUS_STEPS.indexOf(order.status)
   const progressPercent = ((currentIndex + 1) / STATUS_STEPS.length) * 100
   progressFillElement.style.width = `${progressPercent}%`
   
   // Update step indicators
   STATUS_STEPS.forEach((status, idx) => {
     const stepElement = document.querySelector(`[data-status="${status}"]`)
     if (stepElement) {
       stepElement.classList.toggle('active', idx <= currentIndex)
     }
   })
   ```

### Step 5: Implement Animate Status Change
```css
/* Add to success.html <style> */
@keyframes status-flash {
  0% { background-color: rgba(255, 193, 7, 0.3); }
  100% { background-color: transparent; }
}
.status-changed {
  animation: status-flash 0.5s ease-out;
}
```
```javascript
function animateStatusChange() {
  const progressContainer = document.querySelector('.progress-container')
  if (progressContainer) {
    progressContainer.classList.remove('status-changed')
    void progressContainer.offsetWidth  // trigger reflow
    progressContainer.classList.add('status-changed')
  }
}
```

### Step 6: Show Notification Badge
```javascript
function showNotification(message) {
  // Check if existing notification element exists
  let notif = document.querySelector('.order-notification')
  if (!notif) {
    notif = document.createElement('div')
    notif.className = 'order-notification'
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--md-sys-color-primary);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
    `
    document.body.appendChild(notif)
  }
  
  notif.textContent = message
  notif.style.display = 'block'
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    notif.style.display = 'none'
  }, 5000)
}
```

### Step 7: Initialize Polling
After order data is rendered in success page:
```javascript
// Existing code: window.orderData = { id: orderId, status: '...' }
if (window.orderData && window.orderData.id) {
  startSuccessPolling(window.orderData.id)
}

// Also stop on pagehide
window.addEventListener('pagehide', stopSuccessPolling)
```

---

## Todo List

- [ ] Read current `success.html` structure and identify progress bar elements
- [ ] Define STATUS_STEPS array matching business logic
- [ ] Add state variables (pollIntervalId, currentOrderStatus)
- [ ] Implement startSuccessPolling() with 5s interval
- [ ] Implement stopSuccessPolling() with cleanup
- [ ] Implement fetch with error handling (no backoff needed for simplicity)
- [ ] Implement updateProgressBar() mapping status → steps
- [ ] Add CSS transition to progress bar (smooth width change)
- [ ] Implement animateStatusChange() with CSS keyframes
- [ ] Implement showNotification() for "ready" status
- [ ] Wire stop polling on delivered/cancelled/completed
- [ ] Test: Simulate order status change in backend, verify progress bar updates
- [ ] Test: Verify animation plays on change
- [ ] Test: Verify notification appears when order becomes ready
- [ ] Check console for errors
- [ ] Run `npm run lint` on HTML (if applicable)

---

## Success Criteria

- ✅ Progress bar updates at least every 5 seconds
- ✅ Smooth width transition (0.3s ease) on status change
- ✅ Notification appears when order reaches "ready" status
- ✅ Polling stops automatically on delivered/cancelled/completed
- ✅ Zero console errors during 5-minute test
- ✅ Works in both localhost and production environments

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Progress bar element not found | Low | Medium | Verify selector before implementation |
| Status value not in STATUS_STEPS | Medium | Low | Validate and log warning, don't crash |
| Memory leak from orphaned interval | Low | Medium | pagehide cleanup |
| Notification spam (multiple) | Low | Low | Check if already shown before creating new |
| API rate limiting from too many clients | Low | Low | 5s interval is conservative; acceptable |

---

## Next Steps

After completion:
- Proceed to RT-4 (KDS Stats Realtime) — quick win (15 min)
- Then RT-5 (Sound Notifications) if not done in RT-1 phase
