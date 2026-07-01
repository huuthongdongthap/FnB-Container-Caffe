---
phase: 2
title: Worker Idempotency & Return URL Fix
status: completed
priority: P1
dependencies:
  - 1
effort: 1h
---

# Phase 2: Worker Idempotency & Return URL Fix

## Overview

Add idempotency check to `POST /api/payment/create-link` so duplicate requests for the same order don't create duplicate PayOS payment links. Fix return URL to point directly to React route instead of legacy `checkout.html`.

## Requirements

- Functional: Same order_id called twice returns existing payment link (not a new one). Return URL uses React route.
- Non-functional: No breaking change to PayOS API contract. Backward compatible with existing payments.

## Architecture

```
POST /api/payment/create-link
  ↓
1. Validate order_id, auth
2. SELECT FROM payments WHERE order_id = ? AND status IN ('pending','completed')
   ↓ found?
3a. YES → return existing checkoutUrl (pending) or 409 (completed)
3b. NO  → create new PayOS payment request (existing flow)
   ↓
4. INSERT INTO payments (with orderCode collision retry)
5. return { checkoutUrl, orderCode }
```

## Related Code Files

- Modify: `worker/src/routes/payment.js` — add idempotency check (L58-78 area), fix returnUrl (L86-87)
- Reference: `worker/src/routes/webhooks.ts` — existing idempotency pattern to follow (L64-83)

## Implementation Steps

### Idempotency

1. **Read current payment.js** — understand the create-link flow
2. **Add SELECT check** after ownership verification (after L69):
   ```js
   const existingPayment = await db.prepare(
     'SELECT id, transaction_id, checkout_url, status FROM payments WHERE order_id = ? AND method = \'payos\' AND status IN (\'pending\', \'completed\') ORDER BY created_at DESC LIMIT 1'
   ).bind(order_id).first();
   if (existingPayment) {
     if (existingPayment.status === 'completed') {
       return c.json({ success: false, error: 'Order already paid' }, 409);
     }
     return c.json({ success: true, checkoutUrl: existingPayment.checkout_url, orderCode: parseInt(existingPayment.transaction_id), cached: true });
   }
   ```
3. **Verify with unit tests** from Phase 1 — idempotency test must pass

### Return URL Fix

4. **Change returnUrl** from `checkout.html` bridge to direct React route:
   ```js
   const returnUrl = `${baseUrl}/order-success?order_id=${order_id}`;
   const cancelUrl = `${baseUrl}/checkout?cancelled=true&order_id=${order_id}`;
   ```
5. **Verify frontend handles new URL** — CheckoutPage already has `useEffect` parsing `?payment=pending` param (line 33-44). Add direct `?order_id=X` handler:
   ```tsx
   useEffect(() => {
     const orderId = searchParams.get('order_id');
     if (orderId && !searchParams.get('payment')) {
       navigate(`/order-success?order_id=${orderId}`, { replace: true });
     }
   }, [searchParams, navigate]);
   ```
6. **Run worker tests** — Phase 1 returnUrl test must pass

## Success Criteria

- [ ] `POST /api/payment/create-link` with same order_id returns cached URL (200, not new PayOS request)
- [ ] `POST /api/payment/create-link` for already-paid order returns 409
- [ ] Return URL uses `/order-success?order_id=X` pattern
- [ ] Cancel URL uses `/checkout?cancelled=true&order_id=X` pattern
- [ ] Existing `checkout.html` bridge still works (fallback, not removed)
- [ ] Worker tests pass (Phase 1 idempotency + returnUrl tests)
- [ ] Frontend CheckoutPage handles both old and new return URL patterns

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing in-flight payments use old returnUrl | Keep old code path as fallback, don't delete `checkout.html` redirect handler |
| Race condition: two concurrent requests both pass SELECT check | Acceptable — PayOS orderCode uniqueness handles this; second INSERT fails gracefully |
| `cached: true` field breaks frontend | Frontend ignores unknown fields; `checkoutUrl` is only field used |
