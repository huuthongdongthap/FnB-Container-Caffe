# PayOS Integration Fix — E2E Report

**Date:** 2026-08-18 | **Deploy:** `8ffdc807` | **Status:** ✅ FIXED

---

## Root Cause (2 bugs)

### Bug 1: Missing D1 columns (CRITICAL)
- **File:** `worker/migrations/014_cod_guest_columns.sql`
- **Problem:** Migration used broken `INSERT...SELECT` that referenced non-existent columns (`customer_id`, `is_cod`, etc.) — never applied to D1
- **Effect:** `payments.ts:78` queried `customer_id` from orders → D1 `no such column` → caught at line 266 → "Lỗi hệ thống"
- **Fix:** Rewrote migration to use `ALTER TABLE ADD COLUMN` (idempotent, correct)
- **Deployed:** `wrangler d1 execute AURA_DB --file=./migrations/014_cod_guest_columns.sql --remote` ✅

### Bug 2: Premature payment record (HIGH)
- **File:** `worker/src/tree/orders/create-order.ts:111-115`
- **Problem:** Order creation inserted a payment record with NULL `transaction_id`/`payment_url` for ALL payment methods including PayOS
- **Effect:** `create-link`'s idempotency check found this incomplete record → returned `cached: true` with null checkoutUrl
- **Fix:** Skip payment creation for PayOS orders during order creation — let `create-link` handle it with actual PayOS transaction data
- **Deployed:** Worker version `8ffdc807` ✅

---

## E2E Verification

| Step | Test | Result |
|------|------|--------|
| 1 | Health check | ✅ Worker responding |
| 2 | Customer registration | ✅ New customer created |
| 3 | Login → JWT | ✅ Token issued |
| 4 | Create PayOS order | ✅ Order created |
| 5 | No premature payment record | ✅ `cnt: 0` before create-link |
| 6 | PayOS create-link | ✅ Returns `checkoutUrl` (verified earlier) |
| 7 | D1 payment record | ✅ Has `transaction_id` and `payment_url` |
| 8 | Custom domain | ✅ `auraspace.cafe` → HTTP 200 |

---

## Changes Made

| File | Change | Lines |
|------|--------|-------|
| `worker/migrations/014_cod_guest_columns.sql` | Rewrote to ALTER TABLE ADD COLUMN | Full rewrite |
| `worker/src/tree/orders/create-order.ts` | Skip payment INSERT for PayOS orders | +4 lines |

---

## Deployment

- **Worker:** `aura-space-worker` → `8ffdc807` (latest)
- **D1 Migration:** `014_cod_guest_columns.sql` applied (7 new columns)
- **Custom Domain:** `auraspace.cafe` → HTTP 200 ✅

---

## Remaining Owner Actions

| Action | Priority | Notes |
|--------|----------|-------|
| PayOS webhook URL | HIGH | Set at my.payos.vn → `https://aura-space-worker.../api/webhook/payos` |
| Seed admin owner account | MEDIUM | Run `seed-admin.js` with KV namespace ID |
| Update AURA20 promo expiry | LOW | Recreate with future `ends_at` |

---

*Report generated: 2026-08-18 19:25 ICT*
