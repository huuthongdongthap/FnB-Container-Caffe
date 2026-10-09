# Shift / Staff / POS Contract & Canonical Invariants

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-08  
**Scope**: Canonical Staff → Shift Open → POS Sales → Order → Payment → Shift Close → Reconciliation Flow  

---

## 1. Canonical Flow Architecture

```
STAFF (users, devices, staff_auth)
   │ (Staff Identity & RBAC — authenticated employee, role, operating unit)
   ▼
SHIFT OPEN (openCanonicalShift)
   │ (Operational Gateway — records server opening cash, status='open')
   ▼
POS SALES (recordShiftSale)
   │ (POS Transaction Engine — tags active shift, increments running totals)
   ▼
ORDER & PAYMENT (orders, payments)
   │ (Order & Payment Canonical Contracts — server-settled cash or online)
   ▼
SHIFT CLOSE (closeCanonicalShift)
   │ (Operational Settlement — freezes operational sales totals, status='closed')
   ▼
RECONCILIATION (shift_reconciliations)
   │ (Cash Reconciliation — expected cash vs actual cash, explicit variance)
```

---

## 2. State & Ownership Matrix

| Domain / Boundary | Tables / Entities | Authoritative Role | Non-Authority Constraints |
| :--- | :--- | :--- | :--- |
| **Auth / Staff** | `users`, `staff_devices` | Staff identity, PIN auth, RBAC permissions | Never computes shift totals or cash reconciliation |
| **Operations** | `staff_shifts` | Shift lifecycle, opening cash, operational snapshot | Never alters catalog prices or order line items |
| **Order** | `orders`, `order_items` | Canonical sales transactions, items snapshot | Tied to shift via shift ID; does not alter shift rules |
| **Payment** | `payments` | Monetary settlement (`cash`, `payos`, `card`) | Server-settled; client cannot force 'paid' status |
| **Reconciliation** | `shift_reconciliations` | Audit comparison: expected vs actual cash | Immutable ledger; variance explicitly logged |

---

## 3. Shift State Transitions

```
[Start]
   │
   ▼
[openCanonicalShift] ────────▶ OPEN (One active shift per operator & operating unit)
   │                           ├── POS Sales (Cash / Online)
   │                           └── Running Totals Accumulated
   ▼
[closeCanonicalShift] ───────▶ CLOSED (Operational totals frozen; expected cash computed)
   │                           ├── Cash variance computed (actual - expected)
   │                           └── All subsequent sales mutations strictly blocked
   ▼
[auditAdjustClosedShift] ────▶ AUDITED (Permitted strictly via Manager/Owner audit flow)
```

---

## 4. Cash Reconciliation Rules

1. **Server-Recorded Opening Float**: `opening_cash` is provided upon shift creation and immutably set by the server.
2. **Deterministic Expected Cash Calculation**:
   $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Sales} - \text{Cash Refunds} + \text{Cash In} - \text{Cash Out}$$
3. **Explicit Variance Logging**:
   $$\text{Cash Variance} = \text{Actual Cash Count} - \text{Expected Cash}$$
   - Variance is recorded explicitly as positive (`overage`), zero (`balanced`), or negative (`shortage`).
   - The system never silently corrects or masks cash discrepancies.
4. **Closed Shift Immutability**:
   - Once a shift transitions to `closed`, it strictly prohibits attachment of new POS orders or payments (`closed_shift_immutable`).
   - Historical sales and cash totals cannot be modified retroactively without manager/owner audit escalation.

---

## 5. Architectural Invariants

1. **Role-Based Authorization**: Only authorized staff (`owner`, `manager`, `staff`) can open or close a cash register shift; subordinate staff (e.g., `waiter`) are strictly rejected.
2. **Single Active Shift Invariant**: A staff member cannot open a second concurrent shift while an active shift remains unclosed (`duplicate_active_shift`).
3. **No Duplicate Order or Pricing Models**: POS sales strictly consume canonical `@aura/domain-order` and `@aura/domain-pricing` pipelines.
4. **Server-Authoritative Payment Settlement**: Cash and online payments are settled server-side; clients cannot inject 'paid' or 'settled' flags directly.
5. **Operating Unit Boundary Isolation**: Transactions directed to mismatched operating units are rejected (`cross_operating_unit_mismatch`).
6. **Edge Resiliency**: Local Cloudflare D1 processing allows uninterrupted POS operation during upstream ERP or third-party CRM outages.

---

## 6. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/shift-staff-pos-contract.test.ts`:
- `1. open shift: records server opening cash and initializes zeroed totals`: PASS
- `2. duplicate active shift: blocks opening second active shift for same staff`: PASS
- `3. staff authorization: blocks unauthorized roles from opening shift`: PASS
- `4. POS sale & cash payment: increments cash_sales and total_sales server-side`: PASS
- `5. POS sale & online payment: increments online_sales without inflating cash_sales`: PASS
- `6. cross-operating-unit access: rejects sale sent to mismatched operating unit`: PASS
- `7. shift close & expected cash calculation: freezes totals and computes expected cash`: PASS
- `8. cash variance: explicitly calculates overage or shortage, never silently zeros it`: PASS
- `9. closed-shift mutation rejection: strictly blocks new sales after close`: PASS
- `10. unauthorized closer: blocks peer staff from closing another staff shift`: PASS

---

## 7. Changed Files & Migration Status

- `packages/domain/shift/src/model/shift-pos-types.ts`: Canonical Shift, Staff & POS domain models.
- `packages/domain/shift/src/policies/shift-lifecycle-policy.ts`: Authoritative shift opening, POS sales recording, closing, and reconciliation policy.
- `packages/domain/shift/index.ts`: Exported canonical shift types and lifecycle policies.
- `worker/src/__tests__/integrations/shift-staff-pos-contract.test.ts`: Complete 10/10 verification integration suite.
- **Migration Requirements**: None. Existing D1 schema (`staff_shifts`, `shift_reconciliations`, `orders`, `payments`, `users`) is fully compatible.
- **Blockers**: None.
