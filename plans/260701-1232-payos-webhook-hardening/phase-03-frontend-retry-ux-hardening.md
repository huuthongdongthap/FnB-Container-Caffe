---
phase: 3
title: Frontend Retry & UX Hardening
status: completed
priority: P1
dependencies:
  - 2
effort: 1h
---

# Phase 3: Frontend Retry & UX Hardening

## Overview

Add retry with exponential backoff to `createPaymentLink` failures. Add polling timeout to order-success page. Improve error UX with actionable retry button instead of plain error text.

## Requirements

- Functional: Failed PayOS link creation shows "Thử lại" button with countdown. Order-success page stops polling after 10 min. Double-submit prevention.
- Non-functional: No breaking changes to existing checkout flow. COD path unaffected.

## Architecture

```
Checkout: handleSubmit
  ↓
createOrder → success?
  ↓ YES, PayOS selected
createPaymentLink (with retry)
  ↓ fail?
  ├─ attempt 1 → show "Đang thử lại... (1/3)"
  ├─ attempt 2 → backoff 2s → "Đang thử lại... (2/3)"
  ├─ attempt 3 → backoff 4s → "Đang thử lại... (3/3)"
  └─ all fail → show "Thất bại" + "Thử lại" button + "Liên hệ hỗ trợ"
  ↓ success
redirect to PayOS

Order Success: on mount
  ↓
startPolling(orderId)
  ↓ every 15s
fetchOrder → terminal status? → stop
  ↓ after 10 min
stopPolling → show "Đang chờ xác nhận thanh toán. Liên hệ hỗ trợ nếu quá 10 phút."
```

## Related Code Files

- Modify: `src/hooks/stores/use-payment-store.ts` — add retry logic, idempotency header
- Modify: `src/pages/checkout.tsx` — retry UI, double-submit prevention, new return URL handler
- Modify: `src/pages/order-success.tsx` — polling timeout (10 min max)

## Implementation Steps

### Payment Store Retry

1. **Read `use-payment-store.ts`** — understand current createPaymentLink signature
2. **Add `retryCreatePaymentLink`** — wraps `createPaymentLink` with exponential backoff:
   ```ts
   async retryCreatePaymentLink(orderId: string, amount: number, maxRetries = 3): Promise<string | null> {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       if (attempt > 0) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
       const url = await this.createPaymentLink(orderId, amount);
       if (url) return url;
     }
     return null;
   }
   ```
3. **Add idempotency key header** — `X-Idempotency-Key: ${orderId}_${Date.now()}` to prevent server-side duplicates
4. **Verify** — Phase 1 use-payment-store tests pass

### Checkout Page UX

5. **Read `checkout.tsx`** — understand current handleSubmit flow
6. **Add retry state tracking** — `retryCount`, `retrying` state
7. **Replace direct `createPaymentLink` call** with `retryCreatePaymentLink`:
   ```tsx
   const url = await usePaymentStore.getState().createPaymentLink(order.id, totalWithTip);
   // → becomes:
   const url = await usePaymentStore.getState().retryCreatePaymentLink(order.id, totalWithTip);
   ```
8. **Add retry UI** — show attempts remaining, "Thử lại" button on final failure:
   ```tsx
   {payosError && (
     <div className="rounded-lg bg-red-50 p-4 text-center">
       <p className="text-sm text-red-800 mb-2">{payosError}</p>
       <Button onClick={retryPayOS} variant="secondary">🔄 Thử lại</Button>
     </div>
   )}
   ```
9. **Add double-submit guard** — `useRef(isSubmitting)` check at top of handleSubmit
10. **Add new return URL handler** — handle direct `/order-success?order_id=X` from PayOS (without `?payment=pending`)

### Order-Success Polling Timeout

11. **Read `order-success.tsx`** — understand current polling pattern
12. **Add 10-min timeout** — `useEffect` with `setTimeout(() => stopPolling(), 10 * 60 * 1000)`
13. **Add timeout UI state** — when polling stops due to timeout, show different message:
    ```tsx
    const [timedOut, setTimedOut] = useState(false);
    // After 10 min:
    setTimedOut(true);
    // In render:
    {timedOut && !currentOrder && (
      <p className="text-amber-600">⏳ Đang chờ xác nhận thanh toán. Vui lòng liên hệ hỗ trợ nếu quá 10 phút.</p>
    )}
    ```
14. **Verify** — Phase 1 checkout-payos + order-success-polling tests pass

### Re-verify

15. **Run ALL existing tests** — 410 must pass, no regressions
16. **`npm run build`** — 0 TypeScript errors

## Success Criteria

- [ ] Double-clicking "Thanh toán" only submits once (isSubmitting ref guard)
- [ ] PayOS link failure shows "Đang thử lại... (1/3)" then error + "Thử lại" button
- [ ] Retry with exponential backoff: 0s, 2s, 4s between attempts
- [ ] Max 3 retry attempts, then shows "Liên hệ hỗ trợ" message
- [ ] Order-success page stops polling after 10 min with timeout message
- [ ] Return URL `/order-success?order_id=X` handled correctly (no `payment=pending` param)
- [ ] COD checkout flow unaffected
- [ ] All 410+ tests pass
- [ ] `npm run build` 0 errors

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Retry creates duplicate payment links | Worker idempotency (Phase 2) covers this server-side |
| Timeout shows prematurely for slow PayOS webhooks | 10 min is generous; PayOS webhooks typically arrive < 30s |
| Double-submit guard too aggressive | Only guards PayOS path; COD can still retry naturally |
