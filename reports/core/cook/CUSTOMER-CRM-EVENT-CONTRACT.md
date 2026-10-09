# Customer / CRM Event Contract

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-08  
**Scope**: Canonical Customer/CRM Event Flow, Single Authoritative Event Producer & Consumer, Customer-Safe Payload Sanitization, CRM Failure Isolation, Historical Event Immutability, Replay Safety  

---

## 1. Canonical Flow Architecture

```
[1. Order Lifecycle Mutation]
       │  (Order Created, Paid, Cancelled, Completed, Claimed in D1)
       ▼
[2. Customer Identity Resolution]
       │  (resolveServerOrderOwnership: Anonymous Guest vs Authenticated User)
       ▼
[3. Domain Event Generation]
       │  (Server-authoritative, timestamped in UTC ISO 8601, sanitized)
       ▼
[4. Customer Event Log (`customer_events`)]
       │  (D1 append-only immutable storage with idempotency multi-guard)
       ▼
[5. CRM Consumer Dispatch (`consumeCrmEvent`)]
          (Visits Materialization, Loyalty Accrual, Refunds, Segmentation)
```

---

## 2. Canonical Event Contract & Matrix

All customer events implement the authoritative envelope `CanonicalCustomerEvent<T>` with schema version `v: 1` and server-generated timestamps.

| Event Type | Canonical Producer | Key Payload Fields | CRM Consumer Actions | Idempotency Guard |
| :--- | :--- | :--- | :--- | :--- |
| **`order_created`** | Order Creation Pipeline (`handleCreateOrder`) | `orderId`, `orderNumber`, `customerId`, `totalAmount`, `channel`, `itemsCount` | If customer present, records store visit (`visits`). | `idempotencyKey` on payload in `customer_events` |
| **`order_paid`** | Payment Confirmation (`webhook`, `mark-cod-paid`, POS) | `orderId`, `orderNumber`, `customerId`, `totalAmount`, `paymentMethod`, `paidAt` | Credits loyalty points & cashback wallet (`applyAccrual`). | Checks `cashback_transactions.order_id` |
| **`order_cancelled`** | Order Cancellation (`handleCancelOrder`) | `orderId`, `orderNumber`, `customerId`, `totalAmount`, `reason`, `cancelledAt` | Proportional points deduction & tier downgrade (`reverseAccrual`). | Checks `loyalty_point_logs.reason = 'refund'` |
| **`order_completed`** | Order State Machine (`completed` transition) | `orderId`, `orderNumber`, `customerId`, `totalAmount`, `channel`, `completedAt` | Materializes visit record in `visits` table; ensures loyalty points credited. | Checks `visits.order_id` & `cashback_transactions` |
| **`visit_recorded`** | Customer Check-in / Table QR scan (`recordVisit`) | `visitId`, `customerId`, `orderId`, `channel`, `spent` | Records walk-in or order visit in `visits` table without scanning orders. | Checks `visits.order_id` |
| **`customer_identified`** | Profile Capture (`identifyCustomer`) | `customerId`, `identifierType`, `identifierValue`, `source` | Stores verified phone/email in `customer_identities`. | Unique `(identifier_type, identifier_value)` index |
| **`customer_linked`** | Guest Order Claim (`claimGuestOrder`) | `orderId`, `customerId`, `previousCustomerId`, `totalAmount` | Reassigns historical visits; credits backfilled loyalty points. | Single claim guard on `orders.customer_id` |

---

## 3. Core Architectural Invariants

1. **Server-Side Emission**: All events are generated and emitted strictly on the server; clients cannot inject, forge, or mutate event history.
2. **One Canonical Producer & Consumer**: `dispatchCustomerEvent` is the sole entrypoint for event persistence; `consumeCrmEvent` is the single authoritative consumer for CRM downstream effects.
3. **Customer-Safe & Versioned Payloads**: `sanitizeCustomerEventPayload` strips confidential supplier costs, gross margins, staff pins, and JWT secrets before persisting in `customer_events`.
4. **Order State Source of Truth**: Order records in D1 remain the single source of truth; CRM subsystems only observe and react to order events.
5. **Guest Event Resolution**: Guest orders emit with `customer_id: 'guest'`. When a registered member claims the order, `customer_linked` attaches the order to the customer profile.
6. **CRM Failure Isolation**: CRM consumer operations run in safe isolated try/catch boundaries; any failure in loyalty calculation or visit recording is logged and **never aborts or rolls back the order transaction**.
7. **Replay & Reprocessing Safety**: `replayCustomerEvents` allows historical event replay without duplicating points, cashback transactions, or visit rows due to deterministic idempotency checks.
8. **Historical Immutability**: The `customer_events` table is append-only; historical event rows are never updated or deleted.

---

## 4. Verification Suite

All 8 contract invariants verified in `worker/src/__tests__/integrations/customer-crm-events.test.ts`:
- `1. order → event`: PASS
- `2. guest → customer event`: PASS
- `3. completed order → CRM activity`: PASS
- `4. duplicate event`: PASS
- `5. replay/reprocess`: PASS
- `6. CRM failure isolation`: PASS
- `7. event payload safety`: PASS
- `8. historical immutability`: PASS
