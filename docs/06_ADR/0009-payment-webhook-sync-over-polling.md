# ADR 009: Payment Webhook Synchronization Over Polling

**Date:** 2026-03-12  
**Status:** Accepted  
**Decision Maker:** Backend Engineer

## Context

We needed to know when PayOS payments succeed to:
- Update order status
- Credit loyalty points
- Trigger notifications

Options:
1. **Webhook** (push): PayOS POSTs to our endpoint when payment completes
2. **Polling** (pull): Our cron polls PayOS API every N seconds for payment status

## Decision

Chose **Webhook** because it's real-time, efficient, and PayOS supports it.

## Consequences

### Positive
- ✅ **Real-time**: Order updates within seconds of payment
- ✅ **Efficient**: No wasted API calls (push vs pull)
- ✅ **Scalable**: Works regardless of number of orders
- ✅ **Industry standard**: Webhooks are common payment pattern

### Negative
- ⚠️ **Reliability**: If webhook fails (network error, our downtime), we miss update
  - Mitigation: Idempotency (handle duplicate), fallback polling job every 5 minutes to reconcile
- ⚠️ **Security**: Must verify webhook signature to prevent spoofing
- ⚠️ **Retry logic**: Need to return 2xx quickly, handle retries in PayOS
- ⚠️ **Order timeout**: If no webhook after 15 minutes, order stays pending — need manual intervention

### Risks
- **Webhook spoofing**: Fake POST could mark order paid without real payment
  - Mitigation: Verify PayOS signature using `PAYOS_CHECKSUM_KEY` (HMAC-SHA256)
- **Idempotency**: PayOS may resend webhook — must handle gracefully
  - Mitigation: Check if order already paid before updating; use `paymentId` as dedupe key
- **Downtime**: If our endpoint down, PayOS retries with backoff — still may give up after ~24h
  - Mitigation: Monitor webhook failures, manual reconciliation tool

## Implementation

**Webhook flow:**
1. Order created → we call PayOS API to create payment
2. PayOS returns `paymentLinkId` and QR code
3. Customer pays → PayOS sends POST to our `/api/webhook/payos`
4. We verify signature, look up order by `orderCode`
5. Update order status to "paid", credit loyalty
6. Return `200 OK` immediately (PayOS stops retrying)

**Fallback polling:**
```javascript
// Cron every 5 minutes
// Find orders in "pending_payment" older than 15 minutes
// Call PayOS API getPaymentStatus
// Reconcile any missed updates
```

## Alternatives Considered (Rejected)

- **Polling only**: Too slow (customer waits), wasteful API calls
- **Hybrid** (webhook + polling): Our fallback cron essentially does this — acceptable

## Related

- Webhook route: `worker/src/routes/webhooks.js`
- Payment route: `worker/src/routes/payment.js`
- Cron for reconciliation: `worker/src/routes/cron.js`
- PayOS signature verification: `worker/src/lib/payos-verify.js`
- See `CEO-HANDOVER.md` section 7 for payment flow details
