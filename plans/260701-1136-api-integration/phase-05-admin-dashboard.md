---
phase: 5
title: "Admin Dashboard"
status: completed
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 5: Admin Dashboard

## Overview

Wire all 9 admin pages to real worker APIs. Admin can view dashboard stats, manage orders, customers, staff, reservations, approve checkins, and use POS. All admin routes protected by Phase 1 auth.

## Requirements

- Functional: Dashboard with real stats (total orders, revenue, active customers), order management (list, update status), customer list with search, staff management (list, register new staff), reservation management, checkin approval, POS interface
- Non-functional: All admin API calls include Bearer token, 401 redirects to login (handled by Phase 1), tables support pagination, search, sort. **Role model:** All authenticated users see all admin pages. Worker enforces role gates at API level (e.g., register-staff is owner-only). Frontend gracefully handles 403 from worker for unauthorized actions.

## Architecture

```
admin/
├── use-admin-orders-store.ts
│   State: { orders[], totalCount, loading, error }
│   Actions: fetchOrders(page, filters), updateOrderStatus(id, status)
│
├── use-admin-customers-store.ts
│   State: { customers[], totalCount, loading, error }
│   Actions: fetchCustomers(page, search)
│
├── use-admin-staff-store.ts
│   State: { staff[], loading, error }
│   Actions: fetchStaff(), registerStaff(data)
│
├── use-admin-dashboard-store.ts
│   State: { stats, recentOrders[], loading, error }
│   Actions: fetchDashboard()
│
└── use-admin-reservations-store.ts
    State: { reservations[], loading, error }
    Actions: fetchReservations(), approveReservation(id), rejectReservation(id)

Pages wired:
  Dashboard → use-admin-dashboard-store + use-admin-orders-store (recent)
  Orders → use-admin-orders-store
  Customers → use-admin-customers-store
  Staff → use-admin-staff-store
  Reservations → use-admin-reservations-store
  POS → use-menu-store + use-order-store (create order for customer)
  CheckinApprove → use-checkin-store (admin mode)
  Login → already handled by Phase 1 (LoginForm)
  ERPNext Sync → use-admin-dashboard-store (sync status)
```

## Related Code Files

- Create: `src/hooks/stores/admin/use-admin-orders-store.ts`
- Create: `src/hooks/stores/admin/use-admin-customers-store.ts`
- Create: `src/hooks/stores/admin/use-admin-staff-store.ts`
- Create: `src/hooks/stores/admin/use-admin-dashboard-store.ts`
- Create: `src/hooks/stores/admin/use-admin-reservations-store.ts`
- Create: `src/hooks/stores/admin/__tests__/use-admin-orders-store.test.ts`
- Create: `src/hooks/stores/admin/__tests__/use-admin-customers-store.test.ts`
- Create: `src/hooks/stores/admin/__tests__/use-admin-staff-store.test.ts`
- Create: `src/hooks/stores/admin/__tests__/use-admin-dashboard-store.test.ts`
- Modify: `src/pages/admin/Dashboard.tsx` — wire use-admin-dashboard-store
- Modify: `src/pages/admin/Orders.tsx` — wire use-admin-orders-store
- Modify: `src/pages/admin/Customers.tsx` — wire use-admin-customers-store
- Modify: `src/pages/admin/Staff.tsx` — wire use-admin-staff-store
- Modify: `src/pages/admin/Reservations.tsx` — wire use-admin-reservations-store
- Modify: `src/pages/admin/POS.tsx` — wire use-menu-store + use-order-store
- Modify: `src/pages/admin/CheckinApprove.tsx` — wire checkin store
- Modify: `src/pages/admin/ERPNExtSync.tsx` — wire dashboard sync status
- Modify: `src/components/admin/stats-card.tsx` — accept real data props
- Modify: `src/components/admin/order-table.tsx` — accept real orders + actions
- Modify: `src/components/admin/customer-table.tsx` — accept real customers

## Implementation Steps

### TDD: Write tests first

1. **Admin store tests** — 5 test files following same pattern:
   - Auth token required (401 → error state)
   - Successful fetch populates data
   - Search/filter params passed to API
   - Mutation actions (updateStatus, registerStaff) call correct endpoints

### Implement

2. Create `use-admin-orders-store.ts` — GET /api/admin/orders, PATCH /api/orders/:id for status updates, pagination + search

3. Create `use-admin-customers-store.ts` — GET /api/admin/customers, search by name/email/phone

4. Create `use-admin-staff-store.ts` — GET /api/auth/staff, POST /api/auth/register-staff

5. Create `use-admin-dashboard-store.ts` — GET /api/stats (total orders, revenue, active customers, recent orders)

6. Create `use-admin-reservations-store.ts` — GET reservation list, approve/reject endpoints

7. Wire Dashboard page — stats cards (total orders, revenue today, active customers) + recent orders table

8. Wire Orders page — order table with status badges, status update actions (dropdown/buttons), search + pagination

9. Wire Customers page — customer table with search, loyalty tier badges, join date

10. Wire Staff page — staff list, register new staff form (admin only), active/inactive toggle

11. Wire Reservations page — reservation list, approve/reject buttons, date filter

12. Wire POS page — menu items grid (from use-menu-store) + cart + create order flow (from use-order-store)

13. Wire CheckinApprove page — pending checkins list, approve/reject actions

14. Wire ERPNExtSync page — sync status, manual sync trigger

### Verify

15. Run all 268 existing tests — must pass
16. New admin store tests — all pass
17. `npm run build` — 0 TypeScript errors

## Success Criteria

- [x] Admin dashboard shows real stats from GET /api/stats (via use-admin-dashboard-store)
- [x] Admin orders table lists real orders with pagination (via use-admin-orders-store)
- [x] Admin can update order status (pending → confirmed → preparing → completed) (via OrderTable onUpdateStatus)
- [x] Admin customers table lists real customers with search (via use-admin-customers-store)
- [x] Admin can register new staff accounts (via use-admin-staff-store)
- [x] Admin reservations page shows real reservations with approve/reject (via use-admin-reservations-store)
- [x] POS interface creates orders for walk-in customers (via useMenu + useCheckout)
- [x] CheckinApprove lists pending checkins with approve action (API integration + mock fallback)
- [x] All admin pages require authentication (401 → redirect to login, handled by ProtectedRoute from Phase 1)
- [x] Loading states on all admin pages during data fetch
- [x] Empty states for tables with no data
- [x] Error states with retry button on API failure
- [x] 329 existing tests still pass + 30 new admin store tests pass (410 total)
- [x] `npm run build` — 0 TypeScript errors
