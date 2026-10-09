# Customer Identity & Order Ownership Contract

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-08  
**Scope**: Canonical Customer Identity Ladder, Server-Authoritative Ownership Resolution, IDOR Prevention, Auditable Guest Order Claiming, Zero Catalog Dependency  

---

## 1. Canonical Identity Ladder

```
[1. Anonymous Guest]
        │  (Ordering without account creation; customer_id = NULL)
        ▼
[2. Customer Identifier]
        │  (Captured phone / email / Zalo ID stored in customer_identities)
        ▼
[3. Customer Profile]
        │  (Canonical customers table record; deterministic deduplication)
        ▼
[4. Member / Loyalty]
        │  (Authenticated account with tier [BRONZE/SILVER/GOLD/PLATINUM] & points)
        ▼
[5. Behavioral CRM Profile]
           (Aggregated RFM, lifetime spend, taste profile; read-only projection)
```

| Ladder Stage | Canonical Store | Primary Identifier | Capabilities & Ownership Scope |
| :--- | :--- | :--- | :--- |
| **1. Anonymous Guest** | `orders.customer_id IS NULL` | CSPRNG `orders.id` | Table QR / takeaway ordering without friction. Unassigned ownership. |
| **2. Customer Identifier** | `customer_identities` | E.164 phone / email | Unregistered lookup key. Correlates repeat visits across channels. |
| **3. Customer Profile** | `customers` | `id` (`cust_*`) | Canonical profile with name, phone, email, and visit history. |
| **4. Member / Loyalty** | `customers` + JWT token | `user.id` (`cust_*`) | Authenticated member. Accrues loyalty points, redeems discounts, claims guest orders. |
| **5. Behavioral CRM Profile** | `customer_events` / analytics | `customer_id` | Aggregated RFM segmentation and personalized preferences. |

---

## 2. Server-Authoritative Ownership Resolution Matrix

**Golden Rule**: *Client-supplied `customer_id` or `owner_id` is NEVER trusted. Server derives ownership strictly from verified authentication context and database lookups.*

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Incoming Order Request Payload                            │
│                  { items, channel, customer: { id?, name?, phone? } }                 │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                  Actor Context (JWT)
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      [Role: Owner/Staff]           [Role: Customer]            [Unauthenticated]
               │                            │                            │
   Staff may override with         Enforce actor.id              Ignore client id.
   client id or matched phone.     IGNORE client id.             Check customer_phone?
               │                            │                            │
               │                            │              ┌─────────────┴─────────────┐
               │                            │              ▼                           ▼
               │                            │         [Phone Found]              [No Match / None]
               │                            │      cust_* profile found         customer_id = NULL
               │                            │              │                           │
               ▼                            ▼              ▼                           ▼
       `staff_override`           `authenticated_user` `deterministic_identifier` `anonymous_guest`
```

| Actor Context | Client `customer_id` | Client `customer_phone` | Resolved `orders.customer_id` | Resolved Stage | Resolution Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unauthenticated** | Provided (tamper attempt) | `NULL` | `NULL` | Anonymous Guest | `anonymous` (tamper ignored) |
| **Unauthenticated** | Any | Deterministic match (`0901234567`) | `cust_repeat_123` | Customer Profile | `deterministic_identifier` |
| **Unauthenticated** | Any | Unmatched phone | `NULL` | Customer Identifier | `anonymous` (unregistered identifier) |
| **Customer (`cust_A`)**| `cust_B` (tamper attempt) | Any | `cust_A` | Member / Loyalty | `authenticated_user` (tamper overridden) |
| **Staff (`staff_1`)** | `cust_assigned` | Any | `cust_assigned` | Customer Profile | `staff_override` (POS operator assignment) |
| **Staff (`staff_1`)** | `NULL` | Deterministic match | Matched ID | Customer Profile | `deterministic_identifier` |

---

## 3. Order Ownership & IDOR Protection Matrix

Single authoritative gate: `canAccessOrder(actor, order)` (`@aura/domain-customer`).

| Actor | Target Order Ownership | Result | Status Code | Policy Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Anonymous Guest** | `order.customer_id IS NULL` | **ALLOW** | `200 OK` | Guest tracking unassigned order via explicit ID |
| **Anonymous Guest** | `order.customer_id = 'cust_123'` | **DENY** | `403 Forbidden` | Registered customer order cannot be snooped anonymously |
| **Customer (`cust_A`)** | `order.customer_id = 'cust_A'` | **ALLOW** | `200 OK` | Order owner access |
| **Customer (`cust_B`)** | `order.customer_id = 'cust_A'` | **DENY** | `403 Forbidden` | Cross-customer IDOR access rejected |
| **Customer (`cust_A`)** | `order.customer_id IS NULL` | **ALLOW** | `200 OK` | Customer viewing unclaimed guest order |
| **Staff / Manager / Owner** | Any order | **ALLOW** | `200 OK` | Staff role authorized across all orders |

---

## 4. Explicit & Auditable Guest Order Claiming

To link a historical guest order (`customer_id = NULL`) to a registered customer account:
- **Endpoint**: `POST /api/orders/:id/claim`
- **Canonical Function**: `claimGuestOrder({ db, orderId, actor })` (`@aura/domain-customer`)
- **Invariants**:
  1. Actor must be authenticated with role `customer` (HTTP 401 if unauthenticated).
  2. If already claimed by another customer, returns HTTP 403 Forbidden (Anti-hijacking).
  3. If already claimed by current customer, returns `{ success: true, idempotent: true }`.
  4. On successful claim:
     - Updates `orders.customer_id = actor.id` and `orders.updated_at = NOW()`.
     - Appends `OrderLinked` event to `customer_events`.
     - Appends `order_claimed` audit record to `audit_logs`.
     - **Frozen snapshots in `orders.items` and `order_items` remain 100% immutable.** Zero Catalog lookup is triggered.

---

## 5. Architectural Invariant Compliance

1. **Ordering Without Account Creation**: Diners order via QR or POS without registration; orders persist with `customer_id = NULL`.
2. **Server-Authoritative Ownership Model**: `resolveServerOrderOwnership` enforces actor claims, stripping client-supplied IDs.
3. **Repeat Visit Survival**: Verified phone numbers map repeat guest orders to the existing customer profile in D1 without duplicate account proliferation.
4. **Historical Snapshot Immutability**: Order items and pricing remain permanently frozen in `orders.items` regardless of identity linking.
5. **Zero Catalog Dependency**: No SQL joins or queries against `products`, `menu_items`, or `categories` exist in the identity/ownership pipeline.
6. **File Size Compliance**: Every newly authored or refactored module strictly complies with the `< 200 LOC` constraint.
