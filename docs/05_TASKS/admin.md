---
date: 2025-06-19
domain: admin
status: stable
priority: P1
---

# TASKS — ADMIN DASHBOARD

## Epic: Admin Authentication & Authorization

**Description:** Secure access to admin panel with role-based permissions.

### Story 1: Admin login

**Acceptance Criteria:**
- [ ] `admin/login.html` has email + password fields
- [ ] POST `/api/auth/login` validates credentials against `staff` table
- [ ] Role check: only users with `role IN ('owner', 'manager', 'staff')` can login
- [ ] JWT token returned and stored in localStorage
- [ ] Session expires after 7 days
- [ ] Redirect to dashboard on success
- [ ] Error message on failure (generic "invalid credentials" — no user enumeration)

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 2: Role-based access control

**Acceptance Criteria:**
- [ ] Owner: full access to all admin pages and all operations
- [ ] Manager: can view/edit orders, reservations, menu; cannot delete or manage staff
- [ ] Staff: can only view orders/KDS, update order status; cannot access settings
- [ ] Unauthorized access redirects to login with error

**Priority:** P1  
**Status:** ✅ Completed (basic roles, needs refinement)

---

## Epic: Dashboard & Analytics

### Story 3: Main dashboard

**Acceptance Criteria:**
- [ ] `admin/dashboard.html` displays:
  - Today's revenue (real-time)
  - Orders count (pending, preparing, ready, served, paid)
  - Top 5 selling products (chart)
  - Customer count (new vs returning)
  - Hourly revenue chart (last 24h)
- [ ] Data auto-refreshes every 30 seconds
- [ ] Dark/light mode toggle works
- [ ] Export dashboard data to PDF (via print)

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 4: Sales reporting

**Acceptance Criteria:**
- [ ] Report by date range (daily, weekly, monthly, custom)
- [ ] Group by: hour, day, product, category, payment method
- [ ] Export to CSV
- [ ] Compare periods (this week vs last week)

**Priority:** P2  
**Status:** ⚠️ Partial (basic CSV export exists, advanced grouping pending)

---

## Epic: POS (Point of Sale)

### Story 5: POS interface

**Acceptance Criteria:**
- [ ] `admin/pos.html` shows table layout (grid of tables with status colors)
- [ ] Selecting table opens order editor
- [ ] Left panel: menu categories → products (click to add)
- [ ] Right panel: current order with quantities, modifiers
- [ ] Subtotal, tax (if any), total displayed
- [ ] Checkout button opens payment modal
- [ ] Quick actions: void item, print bill

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 6: Table status management

**Acceptance Criteria:**
- [ ] Table statuses: available, occupied, reserved, cleaning
- [ ] Visual indicators (green/yellow/red)
- [ ] Auto-change to "occupied" when order placed
- [ ] Auto-change to "available" when order marked paid
- [ ] Manual override allowed for staff

**Priority:** P1  
**Status:** ✅ Completed

---

## Epic: Staff Management

### Story 7: Staff CRUD

**Acceptance Criteria:**
- [ ] Admin can add new staff (email, password, role)
- [ ] Edit staff details (name, role, active status)
- [ ] Delete staff (soft delete via is_active flag, preserve order history)
- [ ] View staff login history (last seen, sessions)
- [ ] Reset staff password

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 8: Shift tracking

**Acceptance Criteria:**
- [ ] Staff clock in/out via dashboard button
- [ ] Shift record: staff_id, clock_in, clock_out, total_hours
- [ ] Shift summary view: who worked when
- [ ] Export shift reports for payroll

**Priority:** P2  
**Status:** ✅ Completed

---

## Future Tasks (Backlog)

### Task: Audit log viewer

**Description:** View all admin actions (order changes, staff edits, config changes) with filter by user/date/action.

**Effort:** 12h  
**Priority:** P2

---

### Task: Bulk operations

**Description:** Select multiple orders to cancel, print, or export in batch.

**Effort:** 8h  
**Priority:** P2

---

### Task: Real-time notifications

**Description:** Push notifications to admin when new order arrives or KDS item ready.

**Effort:** 16h (requires WebSocket)  
**Priority:** P3

---

### Task: Admin mobile app

**Description:** PWA-optimized admin panel for on-the-go order management.

**Effort:** 24h  
**Priority:** P3

---

*Related files:*
- `worker/src/routes/auth.js`
- `worker/src/routes/staff.js` (if separate)
- `worker/src/routes/shifts.js`
- `admin/dashboard.html`
- `admin/pos.html`
- `admin/staff.html`
- `admin/orders.html`
