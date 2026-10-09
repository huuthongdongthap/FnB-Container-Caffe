# Customer / CRM Canonical Model Contract

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-08  
**Scope**: Canonical Customer/CRM Domain Flow, Entity Relationship Architecture, Kept vs Retired Models, Profile Assembly, Deduplication, and Lifecycle Invariants  

---

## 1. Canonical Flow Architecture

```
CUSTOMER (customers)
   │ (Single Authoritative Identity Root, cust_*)
   ▼
PROFILE (customer_identities, consents)
   │ (Deterministic Normalized Mapping: phone, email, zalo)
   ▼
VISIT (visits)
   │ (Store Attendance & Channel Traffic, 1:N)
   ▼
ORDER (orders)
   │ (Immutable Transaction Source of Truth, 1:N)
   ▼
ACTIVITY (customer_events)
   │ (Append-Only Event Stream & Audit Trail)
   ▼
SEGMENT (segments, frequency-band)
   │ (Derived RFM Analytics & Behavioral Tags)
   ▼
LOYALTY (loyalty_point_logs, cashback_wallets)
     (Passive Consumer of Verified Activity)
```

---

## 2. Entity Relationship Map

| Entity | Primary Key / Index | Parent Entity | Cardinality | Authoritative Source |
| :--- | :--- | :--- | :--- | :--- |
| **`CanonicalCustomer`** | `id` (`cust_*`) | Root | 1 | `customers` table |
| **`CustomerIdentifier`** | `id` (`ident_*`), `(identifier_type, identifier_value)` | Customer | 1:N | `customer_identities` table |
| **`CustomerConsent`** | `id`, `(customer_id, purpose)` | Customer | 1:N | `consents` table |
| **`StoreVisit`** | `id` (`vis_*`), `order_id` (unique nullable) | Customer | 1:N | `visits` table |
| **`Order`** | `id` (`ORD_*`), `customer_id` | Customer (nullable for guest) | 1:N | `orders` table (immutability root) |
| **`CustomerEvent`** | `id` (`cev_*`), `customer_id`, `idempotency_key` | Customer | 1:N | `customer_events` table |
| **`CashbackWallet`** | `customer_id` | Customer | 1:1 | `cashback_wallets` table |
| **`LoyaltyLog`** | `id`, `customer_id` | Customer | 1:N | `loyalty_point_logs` table |

---

## 3. Kept vs Retired Models

| Model / Table | Decision | Role & Invariant |
| :--- | :--- | :--- |
| **`customers`** | **KEPT (CANONICAL)** | Authoritative customer identity, tier, lifetime points. |
| **`customer_identities`**| **KEPT (CANONICAL)** | Multi-channel identifier registry (phone, email, zalo). Prevents duplicate profiles. |
| **`visits`** | **KEPT (CANONICAL)** | Canonical physical/digital attendance model. |
| **`checkins`** | **KEPT (LEGACY REWARD)** | Preserved for promotional QR check-in rewards; NOT used for visit counting. |
| **`users`** | **RESTRICTED (STAFF ONLY)**| Internal employee authentication table. Separated from customer identity. |
| **`client customer_id`**| **RETIRED / REJECTED** | Client-supplied customer IDs in checkout payloads are rejected or overridden server-side. |

---

## 4. Architectural Invariants

1. **Deterministic Deduplication**: `findOrCreateCustomerByIdentifier` normalizes inputs and performs indexed lookups to prevent duplicate profiles on repeat checkouts.
2. **Guest Order Preservation**: Anonymous guest orders emit with `customer_id: null` and an unforgeable `guestTrackingToken`. Historical order items remain immutable upon linking.
3. **Explicit & Auditable Merging**: `mergeCustomerProfiles` transfers orders, visits, and loyalty balances while logging explicit merge events to `customer_events`.
4. **Order State Immutability**: Historical `orders.items` snapshots are never altered by identity resolution or merging.
5. **Zero Catalog Coupling**: Customer identity resolution has zero dependency on products, modifiers, categories, or pricing.
6. **Strict IDOR Boundaries**: Non-staff actors can only query orders matching their verified session identity or holding an explicit guest tracking token.

---

## 5. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/customer-crm-canonical-model.test.ts`:
- `1. anonymous customer`: PASS
- `2. identified customer`: PASS
- `3. repeat visit/order`: PASS
- `4. guest → customer linking`: PASS
- `5. customer ownership & IDOR boundaries`: PASS
- `6. duplicate customer prevention & merge`: PASS
- `7. historical Order integrity`: PASS
