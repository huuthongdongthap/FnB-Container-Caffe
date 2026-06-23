---
date: 2025-06-19
domain: reservations
status: stable
priority: P2
---

# TASKS — RESERVATIONS

## Epic: Table Reservation System

**Description:** Allow customers to book tables in advance via website.

### Story 1: Reservation form

**Acceptance Criteria:**
- [ ] `table-reservation.html` shows calendar date picker
- [ ] Time slot selection based on opening hours (7:00 - 22:00)
- [ ] Guest count selector (1-20, max based on table capacity)
- [ ] Customer fields: name, phone, email (optional), special requests
- [ ] Form validates phone format (Vietnam: 10 digits starting with 0)
- [ ] Submission creates reservation via `POST /api/reservations`

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 2: Admin reservation management

**Acceptance Criteria:**
- [ ] Admin view (`admin/reservations.html`) shows today's reservations by default
- [ ] Calendar view to select date
- [ ] Status per reservation: pending → confirmed → arrived → cancelled → no-show
- [ ] Admin can call customer to confirm (phone link)
- [ ] Admin can add note to reservation
- [ ] Auto-check-in when customer arrives (staff marks as arrived)

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 3: Conflict detection

**Acceptance Criteria:**
- [ ] System prevents double-booking same table at overlapping times
- [ ] System prevents over-capacity (total guests > sum of table capacities for selected zone)
- [ ] Conflict error shown to customer during booking

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 4: Email/SMS confirmation

**Acceptance Criteria:**
- [ ] Upon successful reservation, send confirmation to customer
- [ ] Email includes: date, time, table(s), special requests, contact info
- [ ] SMS alternative (optional, via Zalo or SMS gateway)
- [ ] Reminder sent 2 hours before reservation

**Priority:** P2  
**Status:** ⚠️ Partial (email template exists, sending not automated)

---

## Future Tasks (Backlog)

### Task: Deposit requirement

**Description:** For large parties (>8 people), require deposit payment to secure reservation.

**Effort:** 16h  
**Priority:** P2

---

### Task: Recurring reservation

**Description:** Allow customers to book repeating reservations (e.g., every Tuesday at 12pm).

**Effort:** 12h  
**Priority:** P3

---

### Task: Waitlist management

**Description:** When fully booked, allow customers to join waitlist; auto-notify if cancellation occurs.

**Effort:** 12h  
**Priority:** P3

---

### Task: Table management integration

**Description:** When reservation marked as "arrived", auto-convert table status from "reserved" to "occupied".

**Effort:** 8h  
**Priority:** P2

---

### Task: Outdoor/zone preferences

**Description:** Customer can select preferred seating area (indoor, outdoor, rooftop, private room).

**Effort:** 8h  
**Priority:** P3

---

*Related files:*
- `worker/src/routes/reservations.js`
- `worker/src/routes/tables.js`
- `db/schema.sql` (reservations, cafe_tables)
- `table-reservation.html`
- `admin/reservations.html`
