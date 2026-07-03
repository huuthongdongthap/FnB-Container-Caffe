# B5: Refund Processing (PayOS)

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1 High
**Source:** docs/05_TASKS/payments.md Story 4 (not implemented, P2)
**Effort:** 6-8 hours
**Dependencies:** None
**Blocks:** None

---

## 1. Technical Design

### Problem Statement

When a customer requests a refund (wrong item, order issue, cancellation), cafe staff have no way to process it through the system. The only option is to manually mark the order as "cancelled" without triggering any refund through PayOS. This means paid transactions are never reversed, resulting in either customer dissatisfaction or manual bookkeeping.

### Architecture

Add refund endpoint that calls PayOS refund API, tracks refund status, and updates the order/loyalty state.

```
Admin Order Detail Page:
  Staff clicks "Refund" button
    ├── Modal: select refund type (full / partial), enter reason
    ├── POST /api/payments/refund → Worker → PayOS API
    │     ├── Success: update order status, deduct loyalty points
    │     └── Failure: show error, allow retry
    └── Refund status tracked in payments table
```

### PayOS Refund API

PayOS supports refund via their API:
- Endpoint: `POST {payos_base_url}/v2/payment-requests/{orderCode}/refund`
- Body: `{ "amount": number, "description": string }`
- Response: refund transaction object with status

### Database Changes

Add `refund_status` and `refund_amount` columns to existing `payments` table:
```sql
ALTER TABLE payments ADD COLUMN refund_status TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN refund_amount INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN refund_reason TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN refunded_at TEXT DEFAULT NULL;
```

### Key Design Decisions

1. **Full and partial refund** — Staff can refund the entire amount or a partial amount. Minimum refund amount: 1,000 VND (PayOS minimum).

2. **Refund reversal on loyalty** — When refund is completed, deduct the earned loyalty points from that order. If points were already redeemed, log the pending deduction (operator intervention for edge case).

3. **Idempotency** — Store `refund_id` from PayOS response. Duplicate refund requests check for existing refund before calling API.

4. **Notification** — On successful refund, send notification to customer via existing channels (ZNS/SMS if configured).

5. **Audit trail** — Refund events recorded via B4 audit logger (if enabled) or at minimum in a `refund_log` field.

---

## 2. File List

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/routes/refunds.ts` | `POST /api/payments/refund`, `GET /api/payments/refunds/:paymentId` |
| `src/tree/payments/use-refund-store.ts` | Zustand store for refund state |
| `worker/src/__tests__/routes/refunds.test.ts` | Tests for refund endpoints |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/index.ts` | Register refund routes |
| `src/pages/admin/OrderDetail.tsx` (or equivalent) | Add "Refund" button + modal to paid orders |
| `worker/src/routes/loyalty.ts` | Add `deductPointsForRefund()` function |

---

## 3. Database Changes

### Migration: `006_refund_columns.sql`

```sql
ALTER TABLE payments ADD COLUMN refund_status TEXT DEFAULT NULL
  CHECK(refund_status IN (NULL, 'pending', 'processing', 'completed', 'failed'));
ALTER TABLE payments ADD COLUMN refund_amount INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN refund_reason TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN refunded_at TEXT DEFAULT NULL;
```

### Index
No new indexes needed — queries filter by `payment_id` which is already indexed.

---

## 4. API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/payments/refund` | Initiate refund | Staff (owner/manager) |
| GET | `/api/payments/refunds/:paymentId` | Get refund status | Staff |

POST `/api/payments/refund` request body:
```json
{
  "paymentId": 1234,
  "amount": 50000,
  "reason": "Customer cancelled order"
}
```

Response (success):
```json
{
  "success": true,
  "refundId": "ref_abc123",
  "refundStatus": "completed",
  "refundedAmount": 50000,
  "payosRefundId": "payos_ref_xyz789"
}
```

Error responses:
```json
{ "success": false, "error": "REFUND_AMOUNT_EXCEEDS_PAYMENT", "message": "Số tiền hoàn vượt quá số tiền đã thanh toán" }
{ "success": false, "error": "PAYMENT_ALREADY_REFUNDED", "message": "Đơn hàng đã được hoàn tiền trước đó" }
{ "success": false, "error": "PAYOS_API_ERROR", "message": "Lỗi từ PayOS: ...", "retryable": true }
```

---

## 5. Frontend Components

| Component | File | Description |
|-----------|------|-------------|
| RefundModal | Inline in OrderDetail or separate | Full/partial refund selection, reason input, confirm/cancel |
| RefundStatus | Inline | Status badge: pending, processing, completed, failed |
| use-refund-store | `src/tree/payments/use-refund-store.ts` | Refund state: processRefund(), getRefundStatus(), loading/error |

States for Refund flow:
- **Loading:** Disabled button with spinner while processing
- **Success:** Green success banner with refund ID, order status updated
- **Error:** Inline error with retry button (for retryable errors) or "Contact support" message
- **Edge case:** Partial refund remaining balance shown to staff
- **Edge case:** Network timeout during PayOS call — refund status set to "pending" until webhook/callback confirms

---

## 6. Tests

| Test | File | What to verify |
|------|------|----------------|
| Refund endpoint | `worker/src/__tests__/routes/refunds.test.ts` | Full refund, partial refund, duplicate refund rejection, invalid amount, PayOS error handling |
| Loyalty deduction | `worker/src/__tests__/routes/refunds.test.ts` | Points deducted on completed refund |
| Frontend store | `src/tree/payments/__tests__/use-refund-store.test.ts` | State transitions through refund flow |

---

## 7. Acceptance Criteria

### Refund Processing
- [ ] Staff can refund from order detail page (paid orders only)
- [ ] Full and partial refund supported
- [ ] PayOS API called correctly with amount and reason
- [ ] Refund status tracked: pending, processing, completed, failed
- [ ] Duplicate refund request returns error (idempotent)
- [ ] Loyalty points deducted on refund completion
- [ ] Customer notification sent on refund (ZNS/SMS if configured)

### Admin UI
- [ ] Refund button visible on paid orders (owner/manager role only)
- [ ] Refund modal with amount field, reason textarea, confirm/cancel
- [ ] Success confirmation with refund ID
- [ ] Error state with retry option for payos API errors
- [ ] Refund history visible on order detail
- [ ] Loading states: spinner during PayOS API call

### Quality Gates
- [ ] `npm run build` = 0 errors
- [ ] `npm test` = all tests pass
- [ ] Migration `006_refund_columns.sql` applies cleanly
- [ ] Zod validation on all refund API inputs
- [ ] PayOS API errors are caught and returned gracefully (not 500)

---

## 8. Rollback Plan

```bash
# Revert code
git checkout HEAD -- worker/src/routes/refunds.ts src/tree/payments/use-refund-store.ts

# Revert migration
npx wrangler d1 execute AURA_DB --command "
  ALTER TABLE payments DROP COLUMN refund_status;
  ALTER TABLE payments DROP COLUMN refund_amount;
  ALTER TABLE payments DROP COLUMN refund_reason;
  ALTER TABLE payments DROP COLUMN refunded_at;
"
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Create D1 migration (alter payments table) | 15 min |
| Build POST /api/payments/refund endpoint | 1.5h |
| Build GET /api/payments/refunds/:paymentId endpoint | 30 min |
| Build loyalty point deduction on refund | 30 min |
| Build use-refund-store Zustand store | 20 min |
| Add RefundModal to OrderDetail page | 1h |
| Wire customer notification on refund | 30 min |
| Write tests | 1h |
| Build + test verification | 20 min |
| **Total** | **~6h** |
