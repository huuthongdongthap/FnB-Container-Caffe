# 05_TASKS/reservations.md

## Domain: Table Reservations

This document breaks down tasks for the Reservations domain, covering table management, booking flow, capacity planning, and scheduling.

---

## Epic 1: Table Management

### Story 1: Define table inventory

**Acceptance Criteria:**
- [ ] Tables defined with: number, capacity, location/zone
- [ ] Table status: `available`, `reserved`, `occupied`, `out-of-service`
- [ ] Combine tables for large parties
- [ ] Table attributes (outdoor, VIP, high-chair available)

**Priority:** P1
**Status:** {STATUS_1_1}
**Assignee:** {ASSIGNEE_1_1}

---

### Story 2: Table availability calendar

**Acceptance Criteria:**
- [ ] Visual calendar showing reserved slots
- [ ] Time slot duration (default: {SLOT_DURATION} minutes)
- [ ] Operating hours configuration
- [ ] Block dates for private events

**Priority:** P1
**Status:** {STATUS_1_2}
**Assignee:** {ASSIGNEE_1_2}

---

## Epic 2: Booking Flow

### Story 1: Customer makes reservation

**Acceptance Criteria:**
- [ ] Select date, time, party size
- [ ] System suggests available tables
- [ ] Customer provides: name, phone, email, special requests
- [ ] Confirmation sent via SMS/email
- [ ] Deposit requirement (if applicable)

**Priority:** P1
**Status:** {STATUS_2_1}
**Assignee:** {ASSIGNEE_2_1}

---

### Story 2: Reservation modification & cancellation

**Acceptance Criteria:**
- [ ] Customer can modify reservation up to {CUTOFF_HOURS} hours before
- [ ] Cancellation policy enforced (free before {FREE_CANCEL_HOURS}h)
- [ ] Admin can modify/cancel any reservation
- [ ] Waitlist functionality for fully booked times

**Priority:** P2
**Status:** {STATUS_2_2}
**Assignee:** {ASSIGNEE_2_2}

---

## Epic 3: Walk-in Management

### Story 1: Queue system for walk-ins

**Acceptance Criteria:**
- [ ] Add walk-in party to queue with estimated wait time
- [ ] Notify via SMS when table ready
- [ ] Queue position updates in real-time
- [ ] Convert walk-in to reservation for future

**Priority:** P2
**Status:** {STATUS_3_1}
**Assignee:** {ASSIGNEE_3_1}

---

## Epic 4: Admin Dashboard

### Story 1: Reservation management interface

**Acceptance Criteria:**
- [ ] View all reservations (day/week/month)
- [ ] Edit reservation details
- [ ] Assign specific table manually
- [ ] View no-show history
- [ ] Export reservation data

**Priority:** P1
**Status:** {STATUS_4_1}
**Assignee:** {ASSIGNEE_4_1}

---

## Backlog Tasks

| Task | Estimate | Priority | Dependencies |
|------|----------|----------|--------------|
| {TASK_1} - Online booking widget for external sites | {EST_1}h | P{PRIORITY_1} | {DEP_1} |
| {TASK_2} - Reservation analytics (show rates, avg party size) | {EST_2}h | P{PRIORITY_2} | {DEP_2} |
| {TASK_3} - Recurring reservation support | {EST_3}h | P{PRIORITY_3} | {DEP_3} |
| {TASK_4} - Table layout editor (visual) | {EST_4}h | P{PRIORITY_4} | {DEP_4} |
| {TASK_5} - Integration with Cal.com for external bookings | {EST_5}h | P{PRIORITY_5} | {DEP_5} |

---

## Related Documentation

- **Architecture:** [03_ARCHITECTURE.md](../03_ARCHITECTURE.md) - Reservations section
- **API:** `worker/src/routes/reservations.js`
- **Database:** `cafe_tables`, `reservations` tables

---

*Replace placeholders `{}` with project-specific values. Adjust slot duration, cancellation policies, and features.*
