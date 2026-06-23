---
date: 2025-06-19
domain: orders
status: stable
priority: P1
---

# TASKS — ORDER MANAGEMENT

## Epic: Order Lifecycle

**Description:** Manage the complete order flow from creation to completion.

### Story 1: Customer creates order via POS/website

**Acceptance Criteria:**
- [ ] Customer can add items to cart from menu
- [ ] Cart persists in localStorage across page reloads
- [ ] Customer can select table (for dine-in) or delivery address
- [ ] Promo code field validates and applies discount
- [ ] Total calculation includes taxes, delivery fee, discounts
- [ ] Order submits to `/api/orders` with auth token
- [ ] Success redirects to order confirmation page with order ID

**Priority:** P1  
**Status:** ✅ Completed (v2.0.0)

---

### Story 2: Order appears in KDS automatically

**Acceptance Criteria:**
- [ ] New order POSTs to `/api/kds/orders`
- [ ] KDS page (`kds.html`) polls `/api/kds/orders` every 3 seconds
- [ ] Order shows in "pending" column with all items
- [ ] Order includes: table number, special instructions, timestamp

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 3: Staff updates order status

**Acceptance Criteria:**
- [ ] Staff clicks order in KDS to view details
- [ ] Status dropdown: pending → preparing → ready → served → paid → cancelled
- [ ] Each status change logs audit entry
- [ ] Order updates in real-time across all KDS screens
- [ ] Customer tracking page reflects status changes

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 4: Admin order management

**Acceptance Criteria:**
- [ ] Admin can view all orders (filter by date, status, table)
- [ ] Search by order ID or customer phone
- [ ] Bulk actions: cancel multiple orders
- [ ] Export orders to CSV (daily summary)
- [ ] Print receipt with thermal printer support

**Priority:** P1  
**Status:** ✅ Completed

---

## Epic: Payment Integration

### Story 5: PayOS QR code payment

**Acceptance Criteria:**
- [ ] Order creates PayOS payment request via `/api/payment/create`
- [ ] QR code displays on checkout page (valid 15 minutes)
- [ ] Webhook `/api/webhook/payos` verifies signature and updates order
- [ ] Idempotency: duplicate webhook events do not double-credit
- [ ] On success: order status → "paid", loyalty points credited
- [ ] On failure: order remains "pending payment", customer can retry

**Priority:** P1  
**Status:** ✅ Completed

---

## Epic: SLA & Cron

### Story 6: Automatic overdue order detection

**Acceptance Criteria:**
- [ ] Cron job runs every 5 minutes (`/api/cron/overdue`)
- [ ] Finds orders in "preparing" status older than 30 minutes
- [ ] Auto-cancels with notification to customer (if phone provided)
- [ ] Logs action to audit trail

**Priority:** P2  
**Status:** ✅ Completed

---

## Future Tasks (Backlog)

### Task: Order cancellation with refund

**Description:** Allow staff to cancel paid orders and trigger refund via PayOS API.

**Effort:** 8h  
**Priority:** P2

---

### Task: Split payment

**Description:** Support multiple payment methods on single order (e.g., half cash, half PayOS).

**Effort:** 16h  
**Priority:** P3

---

### Task: Order modification after submission

**Description:** Allow adding/removing items from pending orders before preparation begins.

**Effort:** 12h  
**Priority:** P2

---

### Task: Order hold/queue

**Description:** Ability to place order on hold for later fulfillment (e.g., customer not ready).

**Effort:** 8h  
**Priority:** P3

---

*Related files:*
- `worker/src/routes/orders.js`
- `worker/src/routes/orders-hono.js`
- `worker/src/routes/kds/`
- `js/checkout.js`
- `js/kds-poll.js`
- `db/schema.sql` (orders, order_items tables)
