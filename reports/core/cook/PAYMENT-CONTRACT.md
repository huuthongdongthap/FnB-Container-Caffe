# Payment Lifecycle Contract

**Date**: 2026-10-08  
**Scope**: Cloudflare D1 Payment Persistence Alignment, Canonical Lifecycle State Machine, Provider Boundary, Tamper Protection, Cryptographic Verification, COD Synchronization, and Schema Reconciliation.

---

## 1. Canonical Payment Lifecycle Contract

The payment lifecycle is governed by a single unidirectional, immutable state machine:

```
ORDER
  │
  ▼
PAYMENT INTENT  (Server-authoritative total from orders.total; client amount untrusted; idempotency checked)
  │
  ▼
PAYMENT PROVIDER (PayOS API signature built; intent recorded in canonical `payments` table)
  │
  ▼
VERIFY          (Cryptographic HMAC-SHA256 checksum verified; amount compared against DB)
  │
  ├───────────────────────────────┬───────────────────────────────┐
  ▼                               ▼                               ▼
PAID                            FAILED                          EXPIRED
(`payments.status = 'completed'` (`payments.status = 'failed'`    (`payments.status = 'expired'`
 `orders.payment_status = 'paid'`) Order preserved uncorrupted)   Order preserved uncorrupted)
  │                               │                               │
  ▼                               ▼                               ▼
ORDER STATE: PAID               ORDER STATE: PENDING (RETRYABLE) ORDER STATE: PENDING (RETRYABLE)
```

### 1.1 Invariant Rules
1. **Server Authoritative Amount**: Payment amount derives strictly from canonical `orders.total`. Client-supplied amounts are never trusted; if provided, they are validated against `orders.total` and rejected with HTTP 400 if tampered.
2. **Client Status Protection**: Payment status and order payment status cannot be directly modified by client requests. Status transitions occur strictly through verified provider callbacks, verified webhooks, or authenticated staff operations (e.g. COD cash collection).
3. **Cryptographic Webhook Verification**: Provider callbacks/webhooks must be cryptographically verified using HMAC-SHA256 signatures (`PAYOS_CHECKSUM_KEY`). Unsigned or forged callbacks are rejected with HTTP 401.
4. **Idempotent Payment Creation & Callback Handling**:
   - Creating a payment intent for an order with an existing pending payment returns the cached checkout link (`cached: true`).
   - Requesting payment for an already-paid order deterministically returns HTTP 409 (`already_paid`).
   - Duplicate webhook delivery for an already completed payment returns an immediate acknowledgment without re-executing notifications or side effects.
5. **One Canonical Persistence Path (`payments`)**:
   - Canonical D1 table is `payments` (9 columns: `id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at`).
   - Remote-only uncommitted legacy table `order_payments` is retired from runtime code across all OpenAPI and Hono handlers.
6. **Preserved COD Flow**:
   - COD payment creation short-circuits external providers, marking `orders.payment_status = 'paid'`, `orders.status = 'completed'`, and `payments.status = 'completed'`.
   - KDS staff `PATCH /:id/mark-cod-paid` atomically updates `orders` and `payments(method = 'cod')` to `paid`/`completed`.
7. **Provider Boundary (PayOS as Integration, Not Master)**:
   - PayOS is an external gateway, not the domain authority. If a PayOS webhook delivers an amount mismatched with `payments.amount`, the webhook is rejected with HTTP 400 and quarantined in KV DLQ (`payment:stuck:<order_id>`).
8. **Failure Isolation**:
   - Payment failures, cancellations, and expirations update `payments.status` to `failed`, `cancelled`, or `expired`.
   - Order state is never corrupted or deleted on payment failure; `orders.status` remains `pending` and `orders.payment_status` remains `unpaid`, allowing customers to retry checkout.

---

## 2. Canonical Persistence Owner

| Entity | Canonical Table | Owner / Authority | Key Columns |
| :--- | :--- | :--- | :--- |
| **Order Master** | `orders` | `@aura/domain-order` | `id, total, status, payment_status, payment_method, is_cod, created_at, updated_at` |
| **Payment Ledger** | `payments` | `@aura/domain-payment` & Worker payment routes | `id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at` |
| **Audit Log** | `audit_logs` | Audit Middleware | `id, user_id, action, entity_type, entity_id, metadata, created_at` |

*Note on `order_payments`*: Fully retired from all active handlers (`read-handlers.ts`, `mutation-handlers.ts`, `webhook-handlers.ts`, `web-payment-handlers.ts`). All reads, writes, and refunds now operate exclusively on `payments`.

---

## 3. Provider Boundary & Security Model

```
[ Client Checkout ]
        │
        ▼ (POST /api/payment/create-link or /api/payments)
[ Server Payment Intent Handler ]
   ├── Reads orders.total (authoritative VND integer)
   ├── Rejects if amount tampered (HTTP 400)
   ├── Checks idempotency in `payments` (HTTP 409 if paid; returns cached URL if pending)
   ├── Signs payload with HMAC-SHA256 (PAYOS_CHECKSUM_KEY)
   ├── Calls PayOS REST API
   └── Records intent in `payments` (status = 'pending')
        │
        ▼ (Customer pays on PayOS gateway)
[ PayOS Gateway IPN / Webhook ]
        │
        ▼ (POST /api/webhook/payos or /api/payments/webhook/payos)
[ Server Webhook Verifier ]
   ├── Verifies HMAC-SHA256 signature (constant-time comparison)
   ├── Compares webhook amount == payments.amount (mismatch → HTTP 400 + KV DLQ)
   ├── Checks idempotency (payments.status == 'completed' → HTTP 200 ack)
   ├── Atomic DB transition: status != 'completed' guard
   └── On Success: orders.payment_status = 'paid' + Telegram/notification dispatch
```

---

## 4. Verification Matrix

All scenarios tested and passing via Vitest:

| Test Scenario | Test File | Result |
| :--- | :--- | :--- |
| **Server-authoritative amount & intent creation** | `payment-intent-lifecycle.test.ts` | **PASS** |
| **Tampered client amount rejection (HTTP 400)** | `payment-intent-lifecycle.test.ts` | **PASS** |
| **Already-paid order rejection (HTTP 409)** | `payment-intent-lifecycle.test.ts` | **PASS** |
| **Duplicate payment request caching (`cached: true`)** | `payment-intent-lifecycle.test.ts` | **PASS** |
| **Sub-minimum amount rejection (< 1000 VND)** | `payment-intent-lifecycle.test.ts` | **PASS** |
| **Cryptographic HMAC-SHA256 verification & completion** | `payment-webhook-lifecycle.test.ts` | **PASS** |
| **Failed payment failure isolation (no order corruption)** | `payment-webhook-lifecycle.test.ts` | **PASS** |
| **Expired payment failure isolation (no order corruption)** | `payment-webhook-lifecycle.test.ts` | **PASS** |
| **Duplicate webhook callback idempotency** | `payment-webhook-lifecycle.test.ts` | **PASS** |
| **Webhook amount mismatch rejection & KV quarantine** | `payment-webhook-lifecycle.test.ts` | **PASS** |
| **COD cash collection short-circuit (sync orders & payments)** | `payment-cod-lifecycle.test.ts` | **PASS** |
| **KDS staff mark-cod-paid (sync orders & payments)** | `payment-cod-lifecycle.test.ts` | **PASS** |
| **COD idempotent already-paid return** | `payment-cod-lifecycle.test.ts` | **PASS** |
| **COD non-COD / cancelled rejection (HTTP 409)** | `payment-cod-lifecycle.test.ts` | **PASS** |
| **PayOS Webhook E2E Suite** | `payos-webhook-e2e.test.ts` | **PASS** |
| **Domain Payment Router Unit Suite** | `payments.test.ts` | **PASS** |
| **Full Worker Integration Suite (17 files, 143 tests)** | `worker/src/__tests__/integrations/` | **PASS** |
| **Worker Total Suite (173 files, 1,711 tests)** | `worker/src/__tests__/` | **PASS** |

---

## 5. Changed Files

1. `packages/domain/payment/commands/payos-create-link.ts` (190 LOC) — Enforced server-authoritative amount, tamper detection, and COD payment sync.
2. `worker/src/routes/openapi-payments-handlers/read-handlers.ts` (149 LOC) — Reconciled `order_payments` to canonical `payments` table.
3. `worker/src/routes/openapi-payments-handlers/mutation-handlers.ts` (157 LOC) — Reconciled payment creation and refunds to canonical `payments` table with server total validation.
4. `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts` (90 LOC) — Reconciled webhook to canonical `payments` table with cryptographic verification and amount matching.
5. `worker/src/routes/openapi-payments-handlers/web-payment-handlers.ts` (104 LOC) — Reconciled Apple/Google pay persistence to canonical `payments` table.
6. `worker/src/routes/webhooks-handlers/payos.ts` (166 LOC) — Differentiated expired/cancelled/failed statuses; isolated failure from order state.
7. `worker/src/routes/orders-hono-handlers/kds-handlers.ts` (106 LOC) — Synchronized `payments` table on COD payment mark-paid.
8. `worker/src/__tests__/integrations/payment-intent-lifecycle.test.ts` (191 LOC) — Intent lifecycle, tamper protection, idempotency tests.
9. `worker/src/__tests__/integrations/payment-webhook-lifecycle.test.ts` (186 LOC) — Webhook verification, failure isolation, and KV quarantine tests.
10. `worker/src/__tests__/integrations/payment-cod-lifecycle.test.ts` (143 LOC) — COD flow and KDS synchronization tests.
11. `worker/src/__tests__/integrations/payment-test-helpers.ts` (129 LOC) — Reusable mock environments and PayOS signing helpers.
12. `reports/core/cook/PAYMENT-CONTRACT.md` — This report.

---

## 6. Blockers

**None**. All requirements of the Payment Contract are locked, verified, and passing:
- Server is strictly authoritative for payment amount; client amount is never trusted.
- Payment status transitions are strictly guarded by server logic and provider verification.
- Webhooks verify cryptographic HMAC-SHA256 checksums and enforce amount matching.
- Payment intent and webhook handling are completely idempotent.
- Persistence is reconciled to the single canonical D1 `payments` table.
- COD flow and KDS staff flows are synchronized between `orders` and `payments`.
- PayOS remains a gateway integration, not the domain authority.
- Payment failures never corrupt or delete order state.
- All files strictly adhere to modularization (< 200 LOC per file).
- 100% clean across TypeScript typecheck (0 errors) and ESLint (0 errors, 0 warnings).
