---
phase: 4
title: "Operations Pages"
status: pending
priority: P2
dependencies: [1]
effort: "10h"
---

# Phase 4: Operations Pages

## Overview

Migrate operations and admin pages. **Red-team corrections:** admin/ directory has 9 HTML pages (2,773 lines), not 6. Added POS, Admin Login, and ERPNext Sync components. KDS Web Audio API spec expanded.

## Pages

| Page | Current | Lines | New Component |
|------|---------|-------|---------------|
| Track Order | `track-order.html` | ~250 | `src/pages/TrackOrder.tsx` |
| KDS | `kds.html` | ~80 | `src/pages/KDS.tsx` |
| Table Reservation | `table-reservation.html` | 505 | `src/pages/TableReservation.tsx` |
| TV Menu | `tv-menu.html` | ~260 | `src/pages/TVMenu.tsx` |
| Check-in | `checkin.html` | ~160 | `src/pages/Checkin.tsx` |
| Admin Dashboard | `admin/dashboard.html` | 306 | `src/pages/admin/Dashboard.tsx` |
| Admin Orders | `admin/orders.html` | 794 | `src/pages/admin/Orders.tsx` |
| Admin POS | `admin/pos.html` | 411 | `src/pages/admin/POS.tsx` |
| Admin Login | `admin/login.html` | 119 | `src/pages/admin/Login.tsx` |
| Admin Checkin Approve | `admin/checkin-approve.html` | 334 | `src/pages/admin/CheckinApprove.tsx` |
| Admin Customers | `admin/customers.html` | 259 | `src/pages/admin/Customers.tsx` |
| Admin Reservations | `admin/reservations.html` | 225 | `src/pages/admin/Reservations.tsx` |
| Admin Staff | `admin/staff.html` | 194 | `src/pages/admin/Staff.tsx` |
| Admin ERPNext Sync | `admin/erpnext-sync.html` | 131 | `src/pages/admin/ERPNExtSync.tsx` |

## Architecture

```
src/
├── pages/
│   ├── TrackOrder.tsx, KDS.tsx, TableReservation.tsx
│   ├── TVMenu.tsx, Checkin.tsx
│   └── admin/
│       ├── Dashboard.tsx, Orders.tsx, POS.tsx, Login.tsx
│       ├── Customers.tsx, Reservations.tsx, Staff.tsx
│       ├── CheckinApprove.tsx, ERPNExtSync.tsx, Reports.tsx
├── components/
│   ├── tracking/
│   │   ├── OrderTimeline.tsx, StatusBadge.tsx, EstimatedTime.tsx
│   ├── kds/
│   │   ├── OrderTicket.tsx, TicketQueue.tsx, OrderCompleteButton.tsx
│   ├── reservation/
│   │   ├── TableMap.tsx, TimeSlotPicker.tsx, ReservationForm.tsx
│   │   ├── IdentityVerification.tsx (replaces prompt())
│   ├── tv-menu/
│   │   ├── MenuSlideshow.tsx, CategoryCarousel.tsx, QRCodeOverlay.tsx
│   ├── checkin/
│   │   ├── CheckinForm.tsx, PhotoUpload.tsx, ApprovalStatus.tsx
│   └── admin/
│       ├── StatsCard.tsx, OrderTable.tsx, CustomerTable.tsx
│       ├── RevenueChart.tsx, SyncStatus.tsx, DateRangePicker.tsx
├── hooks/
│   ├── useTrackOrder.ts     # GET /api/orders/:id (polling 15s)
│   ├── useKDS.ts            # GET /api/admin/orders?status=pending (polling 5s)
│   ├── useReservations.ts   # Cal.com webhook + tables API
│   ├── useTVMenu.ts         # GET /api/menu (auto-refresh 30s)
│   ├── useCheckin.ts        # POST /api/checkin
│   └── useAdmin.ts          # GET /api/stats, /api/admin/orders
```

## TDD: Tests to Write First

1. `src/components/tracking/__tests__/order-timeline.test.tsx` — status steps, highlights current, timestamps
2. `src/components/kds/__tests__/ticket-queue.test.tsx` — pending orders, sort by time, mark complete
3. `src/components/kds/__tests__/order-ticket.test.tsx` — items, modifiers, notes, elapsed time counter
4. `src/components/reservation/__tests__/time-slot-picker.test.tsx` — available slots, selection, past times disabled
5. `src/components/reservation/__tests__/identity-verification.test.tsx` — form modal replaces prompt(), phone validation
6. `src/components/checkin/__tests__/checkin-form.test.tsx` — photo upload, social share, submit flow
7. `src/components/admin/__tests__/stats-card.test.tsx` — revenue/orders/customers, VND currency format
8. `src/components/admin/__tests__/order-table.test.tsx` — filterable columns, status badges, sort
9. `src/hooks/__tests__/use-kds.test.ts` — polling interval, new order detection, completion mutation
10. `src/hooks/__tests__/use-track-order.test.ts` — polling until delivered, status transitions, error on invalid ID

## Implementation Steps

### 4.1 Track Order
- OrderTimeline: confirmed→preparing→ready→delivering→delivered
- StatusBadge with color coding, EstimatedTime countdown
- Auto-polling every 15s via TanStack Query refetchInterval

### 4.2 KDS (Kitchen Display System)
- TicketQueue with auto-polling (5s interval)
- OrderTicket cards with items, modifiers, notes, elapsed time (red after 15min)
- Sound notification: `<audio>` element with static sound file (NOT Web Audio API AudioContext). Existing `js/kds-app.js:40-78` has complex AudioContext lifecycle with click-init workaround. Simplify to `<audio>` element for React — avoids iOS Safari autoplay issues, React Strict Mode double-render leaks, and `prefers-reduced-motion` complexity.
- OrderCompleteButton with confirmation, filter by station (drinks/food)

### 4.3 Table Reservation
- Cal.com embed for calendar/time selection (add `frame-src https://app.cal.com` to CSP)
- TableMap interactive SVG
- ReservationForm with identity verification (replaces `prompt()`)
- Past/future reservation tabs

### 4.4 TV Menu Display
- MenuSlideshow with auto-advance, CategoryCarousel, QRCodeOverlay
- Fullscreen mode with auto-hide cursor
- Real-time availability badges (30s refresh)
- Coordinate with `260630-2045-hybrid-erpnext-tv-menu` plan for ERPNext data contract

### 4.5 Check-in
- CheckinForm: photo upload, social share toggle (Facebook/Zalo)
- ApprovalStatus: pending/approved/rejected
- Campaign period enforcement, loyalty points earned notification

### 4.6 Admin Dashboard (9 pages)
- StatsCard row (today revenue, orders, avg order, active customers)
- RevenueChart (daily/weekly/monthly toggle)
- OrderTable with filters (status, date range, payment method)
- CustomerTable with tier filter, search
- POS page (order entry interface)
- Admin Login (auth gate)
- CheckinApprove (staff approves customer check-in photos)
- ERPNExtSync (sync status monitoring)
- Staff management

## Success Criteria

- [ ] All 10 TDD test files written and passing
- [ ] All 14 pages (6 ops + 9 admin) rendered and functional
- [ ] KDS: new orders appear within 5s, sound plays via `<audio>`, complete flow works
- [ ] Track Order: polling updates status, timeline reflects all states
- [ ] Table Reservation: Cal.com embed loads, identity form replaces prompt()
- [ ] TV Menu: slideshow auto-advances, QR code visible
- [ ] Check-in: photo upload, social share, campaign period enforcement
- [ ] Admin: stats accurate, order filters work, POS functional, login gates access
- [ ] 0 TypeScript errors, 0 lint errors

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| KDS polling overload on D1 | 5s interval with KV cache; exponential backoff on errors |
| TV Menu conflicts with ERPNext TV menu plan | Share data contract via plan coordination |
| Cal.com embed + CSP frame-src | Add `frame-src https://app.cal.com` to CSP in Phase 7 |
| Admin pages have auth requirements | Port `worker/src/middleware/admin-auth.js` auth patterns |
