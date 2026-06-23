# 05_TASKS/orders.md

## Domain: Order Management

This document breaks down tasks for the Orders domain, covering order creation, lifecycle management, status tracking, and kitchen coordination.

---

## Epic 1: Order Creation & Processing

### Story 1: Customer creates order via POS/website

**Acceptance Criteria:**
- [ ] Customer can add items to cart from menu
- [ ] Cart persists in localStorage across page reloads
- [ ] Customer can select table (for dine-in) or delivery address
- [ ] Order total calculated with applicable taxes/fees
- [ ] Order submitted to backend with proper validation

**Priority:** P1
**Status:** {STATUS_1_1}
**Assignee:** {ASSIGNEE_1_1}

---

### Story 2: Order status tracking

**Acceptance Criteria:**
- [ ] Customer can view order status in real-time
- [ ] Status updates: `pending` → `confirmed` → `preparing` → `ready` → `completed`/`cancelled`
- [ ] WebSocket or polling for live updates
- [ ] Kitchen display shows new orders immediately

**Priority:** P1
**Status:** {STATUS_1_2}
**Assignee:** {ASSIGNEE_1_2}

---

## Epic 2: Kitchen Display System (KDS)

### Story 1: Kitchen receives and manages orders

**Acceptance Criteria:**
- [ ] KDS page shows all pending orders
- [ ] Orders can be accepted/declined
- [ ] Status changes propagate to customer view
- [ ] Priority queue for rush hours

**Priority:** P1
**Status:** {STATUS_2_1}
**Assignee:** {ASSIGNEE_2_1}

---

## Epic 3: Order History & Analytics

### Story 1: Admin view of order history

**Acceptance Criteria:**
- [ ] Filter by date, status, customer, table
- [ ] Export to CSV/PDF
- [ ] Revenue metrics displayed
- [ ] Popular items report

**Priority:** P2
**Status:** {STATUS_3_1}
**Assignee:** {ASSIGNEE_3_1}

---

## Backlog Tasks

| Task | Estimate | Priority | Dependencies |
|------|----------|----------|--------------|
| {TASK_1} | {EST_1}h | P{PRIORITY_1} | {DEP_1} |
| {TASK_2} | {EST_2}h | P{PRIORITY_2} | {DEP_2} |
| {TASK_3} | {EST_3}h | P{PRIORITY_3} | {DEP_3} |
| {TASK_4} | {EST_4}h | P{PRIORITY_4} | {DEP_4} |
| {TASK_5} | {EST_5}h | P{PRIORITY_5} | {DEP_5} |

---

## Related Documentation

- **Architecture:** See [03_ARCHITECTURE.md](../03_ARCHITECTURE.md) - Order workflow section
- **API Reference:** `worker/src/routes/orders.js`
- **Database:** `orders`, `order_items` tables in `db/schema.sql`

---

*Replace placeholders `{}` with project-specific task details. Delete unused stories.*
