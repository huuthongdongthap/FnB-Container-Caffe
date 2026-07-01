# PayOS Webhook Hardening — Brainstorm Report

**Date:** 2026-07-01 | **Source:** `/brainstorm next plan ?`
**Decision:** Full hardening (all 3 gaps + frontend UX)

## Problem Statement

PayOS payment flow works end-to-end in production but has 3 reliability gaps that could cause:
- Duplicate payment links on browser double-submit
- Payment status stuck `pending` forever if webhook fails all retries
- Brittle redirect chain through legacy HTML page

## Scout Findings

| Component | File | Status |
|-----------|------|--------|
| **Worker create-link** | `worker/src/routes/payment.js` | ✅ HMAC-SHA256, amount-from-DB, ownership check, collision retry |
| **Worker webhook** | `worker/src/routes/webhooks.ts` | ✅ Signature verify, idempotency, amount mismatch → KV, self-healing |
| **Frontend checkout** | `src/pages/checkout.tsx` | ✅ Order create → payment link → redirect. Button disabled during submit |
| **Payment store** | `src/hooks/stores/use-payment-store.ts` | ✅ `createPaymentLink` with JWT auth |
| **PaymentMethodSelector** | `src/components/order/payment-method-selector.tsx` | ✅ PayOS fully enabled (was disabled in old HTML) |

## Evaluated Approaches

### A: Full Hardening (chosen)
All 3 gaps + frontend UX improvements. 4h.

**Pros:** Complete reliability. No regressions. Admin visibility into stuck payments.
**Cons:** Touches both worker + frontend.

### B: Critical Fixes Only
Gaps 1+2 (idempotency + return URL). 2h.

**Pros:** Fastest.
**Cons:** DLQ blind spot remains. Admin won't know about stuck payments.

### C: Frontend-First
UX improvements only. 2h.

**Pros:** Best user experience for retry/loading states.
**Cons:** Doesn't fix root cause server-side gaps.

## Final Solution

### Gap 1: Idempotency Key for create-link
**Worker:** Before creating PayOS request, check if `payments` table already has a row for this `order_id` with status `pending` or `completed`. If yes, return existing URL (pending) or error (completed).
**Frontend:** Already disabled during submit via `isSubmitting`. Add `preventDoubleSubmit` ref as belt-and-suspenders.

### Gap 2: Return URL → React Route
**Worker `payment.js:86-87`:** Change `returnUrl` from `checkout.html?payment=pending&order_id=X` to direct React route.
**Frontend:** The `CheckoutPage` already handles `?payment=pending` redirect via `useEffect` (line 33-44). Ensure order-success page polls for PayOS status.

### Gap 3: DLQ Visibility
**Worker:** Add `GET /api/admin/payments/stuck` endpoint that reads KV keys `payment:stuck:*` and `webhook:dlq:*`.
**Frontend:** Add "Stuck Payments" card to admin dashboard showing count + ability to view details.

### Frontend UX
- **Retry button** on `createPaymentLink` failure (currently just shows error text)
- **Payment polling timeout** on order-success page (max 10 min, then "Contact support")
- **Loading skeleton** during PayOS redirect

## Touchpoints

| File | Action |
|------|--------|
| `worker/src/routes/payment.js` | Modify: idempotency check before create, fix returnUrl |
| `worker/src/routes/webhooks.ts` | Modify: add stuck-payments list endpoint |
| `src/pages/checkout.tsx` | Modify: retry button on PayOS failure, preventDoubleSubmit |
| `src/pages/order-success.tsx` | Modify: payment polling timeout (10 min max) |
| `src/hooks/stores/use-payment-store.ts` | Modify: retry logic, idempotency key header |
| `src/components/admin/` | Create: StuckPaymentsCard component |

## Acceptance Criteria

1. Double-clicking "Thanh toán" creates exactly 1 payment link (verified via D1 query)
2. Return URL from PayOS lands on React `/order-success?order_id=X` (not `/checkout.html`)
3. Admin dashboard shows count of stuck payments with details
4. PayOS link creation failure shows "Thử lại" button that retries with backoff
5. Order success page stops polling after 10 min and shows "Liên hệ hỗ trợ"
6. All 410 existing tests still pass
7. `npm run build` 0 errors
8. New tests: payment idempotency (worker), retry UX (frontend), stuck payments endpoint (worker)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Return URL change breaks existing in-flight payments | Low | High | Keep old `checkout.html` bridge as fallback for 7 days |
| DLQ endpoint exposes sensitive payment data | Low | Medium | Require owner role, mask amounts in list view |
| Idempotency check race condition | Low | Medium | Use D1 transaction or SELECT + conditional INSERT |

## Unresolved Questions

None.
