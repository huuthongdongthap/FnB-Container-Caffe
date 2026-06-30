# Phase 02 — Cal.com Embed Widget

**Status:** ✅ complete
**Priority:** Medium
**TDD:** N/A (frontend embed, tested via Phase 03 E2E)

## Overview

Add Cal.com popup embed widget to the reservation page. Customers click "Đặt Bàn" → Cal.com popup → select date/time → book → webhook fires.

## Implementation

### Modify: `table-reservation.html` (or relevant page)

Add Cal.com embed script + button:

```html
<script type="module">
  import Cal from 'https://app.cal.com/embed/embed.js';
</script>

<button data-cal-link="cafe/dat-ban"
        data-cal-config='{"layout":"month_view"}'
        class="cal-booking-btn">
  📅 Đặt Bàn Ngay
</button>
```

### Design tokens
- Button matches Bazi v5.1: Navy bg, Gold border, Space Grotesk font
- Cal.com embed theme: dark mode (`data-cal-theme="dark"`)

### Cal.com Setup (one-time, manual)
1. Create free account at cal.com
2. Create event type "Đặt Bàn" (60 min slots, 08:00-22:00)
3. Set seats per slot = 20 (max cafe capacity)
4. Add custom fields: phone (required), guest_count (number)
5. Configure webhook: POST to `https://aura-space-worker.sadec-marketing-hub.workers.dev/api/webhooks/cal-booking`
6. Generate webhook secret → set in CF Worker env

## Touchpoints

- **MODIFY:** `table-reservation.html` (add embed)
- **NO backend changes**

## Success Criteria

- [x] Cal.com embed button visible on reservation page
- [x] Click opens Cal.com popup with month view
- [x] Dark theme matches Bazi design
- [x] Booking flow: select slot → fill info → confirm → success
