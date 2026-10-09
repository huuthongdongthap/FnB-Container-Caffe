# Authorization & Operating Unit Contract

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-09  
**Scope**: Canonical Server-Side Authorization Policy across Staff → Shift → Table → Order → Payment → Inventory  

---

## 1. Canonical Authorization Architecture

```
REQUEST (Token / Session)
   │
   ▼
SERVER IDENTITY RESOLUTION (Auth & Tenant Middleware)
   │ (Resolves Actor: id, email, role, tenantId, operatingUnitId from verified JWT)
   ▼
CANONICAL AUTHORIZATION POLICY (authorizeAction)
   ├── 1. Tenant & Operating Unit Scope (validateOperatingUnitScope — fail closed)
   ├── 2. Role-Based Access Control (Staff / Manager / Owner / Waiter / Customer / Guest)
   └── 3. Resource Ownership & IDOR Protection (customer order / staff shift ownership)
   ▼
DOMAIN / DATA ACCESS (D1 Ledger Execution)
```

---

## 2. Authorization & RBAC Matrix

| Role | Catalog | Tables / Reservations | Orders / KDS | Shifts / POS | Inventory / PO | Payments / Refunds | Staff Management |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Guest / Public** | Read-only | Read & Book / QR checkin | Self Create / Guest Track | ❌ Forbidden | ❌ Forbidden | Create payment for own order | ❌ Forbidden |
| **Customer** | Read-only | Read & Book / Own reservations | Create / Own Read / Cancel | ❌ Forbidden | ❌ Forbidden | Create payment for own order | ❌ Forbidden |
| **Waiter** | Read-only | Read / Occupy / Release | Create / Read / Update | ❌ Forbidden | ❌ Forbidden | ❌ No refunds | ❌ Forbidden |
| **Staff (Kitchen)** | Read / Edit | Read / Occupy / Release | Read / Update (KDS) | Operate / Own Close | Read-only | Create / Read payments | ❌ Forbidden |
| **Manager** | Full | Full Management | Full Management | Open / Close / Audit | Read / Adjust / PO / Waste | Full / Issue refunds | View & Manage subordinates |
| **Owner (Tenant)** | Full | Full Management | Full Management | Full Management | Full Management | Full Management | Full Management |
| **Owner (HQ Super)** | Full (*) | Full Global (*) | Full Global (*) | Full Global (*) | Full Global (*) | Full Global (*) | Full Global (*) |

---

## 3. Operating Unit & Multi-Tenant Invariants

1. **Authentication $\neq$ Authorization**: Authenticated identity is verified via cryptographically signed JWT; access to each resource is evaluated against explicit role and tenant boundaries.
2. **Never Trust Client-Supplied Scopes**: `tenant_id`, `location_id`, `owner_id`, and `role` are resolved exclusively server-side. Forged headers or query parameters are ignored or rejected.
3. **Fail-Closed Boundary Isolation**:
   - Non-HQ staff from tenant `tenant_A` attempting to read or mutate resources of tenant `tenant_B` fail closed (`tenant_mismatch`).
   - Staff assigned to operating unit `counter_1` cannot operate shifts or cash registers on `counter_2` (`cross_operating_unit_mismatch`).
4. **Customer IDOR Protection**: Authenticated customers can only view or manage orders where `order.customer_id === actor.id`. Cross-customer queries fail closed (`customer_idor`).
5. **Peer Shift Immutability**: Peer staff members cannot close or modify another staff member's active shift without manager/owner role escalation (`unauthorized_role`).
6. **Audited HQ Super-Admin Access**: Super-admins (`owner` with `hq` or `default` tenant binding) can switch tenant context for multi-franchise oversight, generating immutable audit logs.

---

## 4. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/authorization-operating-unit-contract.test.ts`:
- `1. unauthenticated guest access: allows public catalog, blocks protected staff/inventory`: PASS
- `2. customer IDOR protection: allows own order, strictly blocks accessing peer orders`: PASS
- `3. role hierarchy & waiter boundaries: blocks waiter from operating shifts or mutating inventory`: PASS
- `4. staff vs manager inventory: staff reads stock, only manager/owner can mutate`: PASS
- `5. peer shift closing protection: blocks peer staff from closing another shift`: PASS
- `6. cross-tenant access rejection: non-HQ staff strictly blocked from foreign tenant`: PASS
- `7. cross-operating-unit mismatch: blocks staff from operating outside their assigned unit`: PASS
- `8. forged tenant header rejection: server validates against actor tenant, not forged header`: PASS
- `9. HQ super-admin bypass: owner with default/hq tenant has global tenant access`: PASS

---

## 5. Changed Files & Migration Status

- `packages/domain/staff/src/model/authorization-types.ts`: Canonical Authorization & Operating Unit types (33 LOC).
- `packages/domain/staff/src/policies/authorization-policy.ts`: Authoritative RBAC + Multi-Tenant boundary policy (173 LOC).
- `packages/domain/staff/index.ts`: Exported domain policies and models (23 LOC).
- `worker/src/__tests__/integrations/authorization-operating-unit-contract.test.ts`: 9/9 PASS integration suite (126 LOC).
- `reports/core/cook/AUTHORIZATION-OPERATING-UNIT-CONTRACT.md`: Authoritative contract documentation.
- **Migration Requirements**: None. Existing D1 schema (`users`, `staff_devices`, `staff_shifts`, `cafe_tables`, `orders`, `payments`) is fully compatible.
- **Blockers**: None.
