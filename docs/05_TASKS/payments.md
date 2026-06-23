---
date: 2025-06-19
domain: payments
status: stable
priority: P1
---

# TASKS — PAYMENTS

## Epic: Payment Gateway Integration

**Description:** Secure payment processing with multiple methods.

### Story 1: PayOS QR code integration

**Acceptance Criteria:**
- [ ] Order creates PayOS payment request via `/api/payment/create`
- [ ] PayOS returns QR code URL (valid 15 minutes)
- [ ] QR displayed on checkout success page
- [ ] Webhook endpoint `/api/webhook/payos`:
  - Verifies signature using PAYOS_CHECKSUM_KEY
  - Looks up order by `orderCode`
  - Updates order status to "paid"
  - Credits loyalty points and cashback
  - Sends success notification to customer
- [ ] Idempotency: duplicate webhook events are safe
- [ ] Timeout handling: if no webhook after 5 minutes, order remains pending

**Priority:** P1  
**Status:** ✅ Completed (v2.0.0)

---

### Story 2: Cash on Delivery (COD)

**Acceptance Criteria:**
- [ ] Customer selects "Cash" on checkout
- [ ] Order status = "pending_payment" but marked as COD
- [ ] Staff collects cash upon delivery/table
- [ ] Staff marks order as "paid" in admin panel
- [ ] No webhook needed for COD

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 3: Payment reconciliation

**Acceptance Criteria:**
- [ ] Admin can view payment report per day/week/month
- [ ] Report shows: total amount, payment method breakdown, failed transactions
- [ ] Ability to export payment data to CSV
- [ ] Reconcile with bank statements (transaction IDs visible)

**Priority:** P2  
**Status:** ✅ Completed (basic)

---

### Story 4: Refund processing

**Acceptance Criteria:**
- [ ] Admin can initiate refund from order detail page
- [ ] Refund request sent to PayOS API (full or partial)
- [ ] Refund status tracked (pending, completed, failed)
- [ ] Customer notified of refund via SMS/email
- [ ] Loyalty points deducted if refund occurs

**Priority:** P2  
**Status:** ❌ Not implemented

---

## Epic: Security & Compliance

### Story 5: PCI DSS considerations

**Acceptance Criteria:**
- [ ] No card data stored on our servers (PayOS handles all card details)
- [ ] Webhook signature verification prevents spoofing
- [ ] HTTPS enforced on all payment endpoints
- [ ] API keys stored in Cloudflare secrets (never in code)
- [ ] Payment logs do not contain sensitive card info

**Priority:** P1  
**Status:** ✅ Completed

---

## Future Tasks (Backlog)

### Task: Multi-gateway fallback

**Description:** If PayOS fails, automatically try MoMo or VNPay as backup.

**Effort:** 20h  
**Priority:** P2

---

### Task: Payment retry mechanism

**Description:** If webhook fails, implement exponential backoff retry with dead-letter queue.

**Effort:** 12h  
**Priority:** P2

---

### Task: Split tender

**Description:** Allow customer to pay with multiple methods (e.g., cash + PayOS).

**Effort:** 16h  
**Priority:** P3

---

### Task: Subscription payments

**Description:** For coworking memberships, implement recurring payment via PayOS subscription API.

**Effort:** 20h  
**Priority:** P4 (dependent on Cal.com integration)

---

### Task: Tip/Discount code stacking rules

**Description:** Implement business rules for tip inclusion, service charge, and voucher stacking limits.

**Effort:** 8h  
**Priority:** P2

---

*Related files:*
- `worker/src/routes/payment.js`
- `worker/src/routes/webhooks.js`
- `worker/src/routes/orders.js` (payment status updates)
- `js/checkout.js` (payment method selection)
- `db/schema.sql` (payments table)
