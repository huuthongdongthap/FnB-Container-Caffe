---
phase: 4
title: "Operations + Reservations"
status: completed
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 4: Operations + Reservations

## Overview

Wire operations pages (TrackOrder, TableReservation, Checkin, Contact, KDS, TVMenu) to real backend data. Customers can track orders, book tables, check in for loyalty points, and submit contact forms.

## Requirements

- Functional: Track order by ID, reserve table with time slot, check in for loyalty points, submit contact form, KDS shows real order queue, TV menu display shows real menu
- Non-functional: Order tracking polls for updates, reservation prevents double-booking, checkin validates phone number

## Architecture

```
use-reservation-store.ts
  State: { availableSlots[], currentReservation, loading, error }
  Actions: fetchSlots(date), createReservation(data)

use-checkin-store.ts
  State: { checkinResult, loading, error }
  Actions: submitCheckin(phone, code?)

use-contact-store.ts
  State: { submitted, loading, error }
  Actions: submitContact(name, email, phone, message)

Pages wired:
  TrackOrder → use-order-store.fetchOrder(id) — shared with Phase 2
  TableReservation → use-reservation-store
  Checkin → use-checkin-store
  Contact → use-contact-store
  KDS → use-order-store (poll recent orders)
  TVMenu → use-menu-store (shared with Phase 2)
```

## Related Code Files

- Create: `src/hooks/stores/use-reservation-store.ts`
- Create: `src/hooks/stores/use-checkin-store.ts`
- Create: `src/hooks/stores/use-contact-store.ts`
- Create: `src/hooks/stores/__tests__/use-reservation-store.test.ts`
- Create: `src/hooks/stores/__tests__/use-checkin-store.test.ts`
- Create: `src/hooks/stores/__tests__/use-contact-store.test.ts`
- Modify: `src/pages/TrackOrder.tsx` — wire use-order-store
- Modify: `src/components/tracking/order-timeline.tsx` — accept real order data
- Modify: `src/components/reservation/time-slot-picker.tsx` — accept real slots
- Modify: `src/pages/TableReservation.tsx` — wire store
- Modify: `src/pages/Checkin.tsx` — wire store
- Modify: `src/components/checkin/CheckinForm.tsx` — wire store
- Modify: `src/pages/Contact.tsx` — wire store
- Modify: `src/components/contact/ContactForm.tsx` — wire store
- Modify: `src/pages/KDS.tsx` — wire use-order-store (poll)
- Modify: `src/pages/TVMenu.tsx` — wire use-menu-store

## Implementation Steps

### TDD: Write tests first

1. **`use-reservation-store.test.ts`**
   - `fetchSlots(date)`: returns time slots from API
   - `createReservation(data)`: POST reservation, returns confirmation
   - `createReservation(data)`: sets error when slot already taken

2. **`use-checkin-store.test.ts`**
   - `submitCheckin(phone)`: POST checkin, returns points earned
   - `submitCheckin(phone)`: sets error on invalid phone format

3. **`use-contact-store.test.ts`**
   - `submitContact(data)`: POST contact form, returns success
   - `submitContact(data)`: sets error on validation failure

### Implement

4. Create `use-reservation-store.ts` — fetch time slots, create reservation, validate availability

5. Create `use-checkin-store.ts` — submit phone for checkin, display earned points

6. Create `use-contact-store.ts` — submit contact form, track submission state

7. Wire TrackOrder page — input order ID → `useOrderStore.fetchOrder(id)` → display timeline

8. Wire TableReservation page — date picker → fetch slots → pick slot → create reservation

9. Wire Checkin page — phone input → submit → display points earned

10. Wire Contact page — form submit → API call → success/error

11. Wire KDS page — poll `useOrderStore` for recent orders, display ticket queue

12. Wire TVMenu page — use `useMenuStore` (already created in Phase 2), display in TV-friendly layout

### Verify

13. Run all 268 existing tests — must pass
14. New store tests — all pass
15. `npm run build` — 0 TypeScript errors

## Success Criteria

- [x] TrackOrder displays real order timeline from GET /api/orders/:id (via existing useTrackOrder hook — Phase 2 stores not available)
- [x] TrackOrder shows "not found" state for invalid order IDs (via existing useTrackOrder hook)
- [x] TableReservation shows available time slots for selected date
- [x] TableReservation creates reservation and shows confirmation
- [x] Checkin submits phone number and displays points earned
- [x] Checkin validates Vietnamese phone format (10 digits, starts with 0)
- [x] Contact form submits to POST /api/contact
- [x] Contact form shows validation errors for invalid inputs
- [x] KDS polls for recent orders (via existing useKDS hook — Phase 2 stores not available)
- [x] TVMenu displays real menu items (via existing useTVMenu hook — Phase 2 stores not available)
- [x] All 410 tests pass (56 test files, 0 failures)
- [x] `npm run build` — 0 TypeScript errors
