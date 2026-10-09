# Table / Reservation Contract & Canonical Invariants

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-09  
**Scope**: Canonical Table → Reservation → Seating → Order → Checkout → Table Release Flow  

---

## 1. Canonical Flow Architecture

```
TABLE (cafe_tables)
   │ (Physical Table Entity — capacity, zone, physical status)
   ▼
RESERVATION (reservations, createCanonicalReservation)
   │ (Customer Booking Intent — date, time, guest count, status='confirmed')
   ▼
SEATING (seatTable, handleGuestCheckin)
   │ (Physical Seating — cafe_tables.status='Occupied', reservation.status='seated')
   ▼
ORDER (orders, validateOrderTable)
   │ (Sales Transaction — authoritative order with valid table_id reference)
   ▼
CHECKOUT (payments, guest-checkout)
   │ (Payment Settlement — monetary settlement & bill settlement)
   ▼
TABLE RELEASE (releaseTable)
   │ (Operational Reset — cafe_tables.status='Available', reservation.status='completed')
```

---

## 2. State & Ownership Matrix

| Domain / Boundary | Tables / Entities | Authoritative Role | Non-Authority Constraints |
| :--- | :--- | :--- | :--- |
| **Table Domain** | `cafe_tables` | Master table record, zone, capacity, physical status (`Available`, `Occupied`, `Reserved`, `Overdue`) | Does not manage customer identities or line-item pricing |
| **Reservation Domain** | `reservations` | Booking intent, schedule (`date`, `time`), guest count, status (`pending`, `confirmed`, `seated`, `completed`, `cancelled`, `no_show`) | Does not directly mutate catalog items or settle payments |
| **Seating / Sessions** | `table_sessions` | Guest table occupancy lifecycle, order count & total | Derived operational view; physical master remains `cafe_tables` |
| **Order Domain** | `orders` | Sales record; validates table reference via `validateOrderTable` | Must resolve to valid `cafe_tables.id`; cannot invent tables |
| **Checkout / Settlement** | `payments` | Monetary settlement | Table release triggered on full order settlement or staff action |

---

## 3. Table & Reservation State Transitions

```
[Physical Table Lifecycle]
  Available ──────(seatTable / guestCheckin)──────▶ Occupied
     ▲                                                │
     │                                                │
     └──────────────(releaseTable)────────────────────┘

[Reservation Lifecycle]
  pending ──────▶ confirmed ──────(seatTable)──────▶ seated ──────(releaseTable)──────▶ completed
                     │                                  │
                     ├────────▶ cancelled               └────────▶ no_show
                     │
                     └────────▶ no_show
```

---

## 4. Operational Invariants & Rules

1. **`cafe_tables` Canonical Truth**: `cafe_tables` is the sole physical master. No secondary table models or duplicate tables in other domains.
2. **Overlap Prevention**: Two active reservations (`confirmed`, `pending`, `seated`) cannot overlap on the same `table_id`, `date`, and `time` slot (`overlapping_reservation`).
3. **Server-Authoritative Seating & Release**:
   - `seatTable`: Updates `cafe_tables.status = 'Occupied'` and reservation to `seated`.
   - `releaseTable`: Updates `cafe_tables.status = 'Available'` and any active `seated` reservation to `completed`.
4. **Order-Table Reference Integrity**: Orders referencing a `table_id` are strictly verified against `cafe_tables` using `validateOrderTable`. Orders targeting nonexistent tables are rejected (`table_not_found`).
5. **Idempotency**: Calling `releaseTable` on an already-available table or seating an already-seated guest succeeds idempotently without corrupting state.
6. **Operating Unit & Zone Boundary Isolation**: Reservations specifying mismatched table zones or operating units are rejected (`cross_operating_unit_mismatch`).
7. **Historical Record Preservation**: Historical reservations, sessions, and orders maintain permanent TEXT IDs; no destructive purging or forced schema migrations.

---

## 5. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/table-reservation-contract.test.ts`:
- `1. table availability: queries available tables excluding occupied ones`: PASS
- `2. reservation create: creates valid confirmed reservation for available table`: PASS
- `3. overlapping reservations: strictly rejects duplicate booking for same table and time slot`: PASS
- `4. guest check-in & seating: marks table Occupied and updates reservation to seated`: PASS
- `5. order-table integrity: validates table exists and rejects invalid table reference`: PASS
- `6. table release: frees occupied table back to Available upon checkout`: PASS
- `7. idempotent seating & release: repeated release of Available table succeeds gracefully`: PASS
- `8. reservation cancel: updates reservation status to cancelled`: PASS
- `9. cross-operating-unit / zone mismatch: rejects reservation for wrong zone`: PASS

---

## 6. Changed Files & Migration Status

- `packages/domain/table/src/model/table-reservation-types.ts`: Canonical Table and Reservation domain types.
- `packages/domain/table/src/policies/table-availability-policy.ts`: Table availability and order-table validation policies.
- `packages/domain/table/src/policies/table-reservation-policy.ts`: Canonical reservation creation, update, seating, and release policies.
- `packages/domain/table/index.ts`: Exported domain policies and models.
- `worker/src/routes/openapi-orders-handlers/order-write-handlers.ts`: Integrated server-side table existence validation.
- `worker/src/__tests__/integrations/table-reservation-contract.test.ts`: 9/9 PASS integration test suite.
- **Migration Requirements**: None. Existing D1 schema (`cafe_tables`, `reservations`, `table_sessions`, `orders`) is fully compatible.
- **Blockers**: None.
