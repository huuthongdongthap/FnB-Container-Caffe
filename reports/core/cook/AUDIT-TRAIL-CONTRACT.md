# Audit Trail & Operational Event Contract

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-09  
**Scope**: Canonical Server-Side Audit Trail & Operational Event Ledger across Authentication, Catalog, Orders, Payments, Shifts, Tables, Inventory, Customer Identity, and Multi-Tenant Administration.

---

## 1. Canonical Audit Architecture

```
CRITICAL MUTATION / ACCESS ATTEMPT
   │
   ▼
SERVER IDENTITY & SCOPE RESOLUTION (Auth Context)
   │ (Resolves: Actor ID, Role, Tenant ID, Operating Unit ID, Correlation ID)
   ▼
SENSITIVE DATA SANITIZATION (redactSensitiveData)
   ├── Passwords, Secrets, Tokens, API Keys → [REDACTED]
   ├── Payment PANs & CVVs → Masked (**** **** **** 1234)
   └── Auth / Bearer Headers → Sanitized
   ▼
CANONICAL AUDIT WRITER (writeCanonicalAuditLog)
   ├── 1. Safe Diff Computation (before vs after state delta)
   ├── 2. Policy Enforcement (best_effort vs strict_fail_closed)
   └── 3. Immutable Append-Only Ledger Write
   ▼
D1 AUDIT LEDGER (audit_logs)
```

---

## 2. Audit Trail Matrix & Critical Events

| Subsystem | Actions Tracked | Resource Type | Scope & Context Recorded | Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Auth / Access** | `auth.login`, `auth.logout`, `auth.rejected`, `auth.device_registered` | `auth` / `staff` | Actor ID, IP, Tenant, Failure Reason | `best_effort` |
| **Catalog** | `catalog.product_create`, `catalog.product_update`, `catalog.delete` | `catalog` | Actor ID, Product SKU/ID, Safe Diff | `best_effort` |
| **Order** | `order.created`, `order.updated`, `order.cancelled`, `order.claimed` | `order` | Order ID, Customer ID, Table ID, Correlation ID | `strict_fail_closed` |
| **Payment / COD** | `payment.created`, `payment.webhook_verified`, `payment.refunded` | `payment` | Payment Txn ID, Order ID, Method, Correlation ID | `strict_fail_closed` |
| **Shift / POS** | `shift.opened`, `shift.closed`, `shift.cash_reconciled` | `shift` | Staff ID, Operating Unit (Counter/Bar), Opening/Closing Cash | `strict_fail_closed` |
| **Table / RSV** | `table.status_changed`, `table.seated`, `table.released`, `reservation.*` | `table` / `reservation` | Table Number, Zone, Guest Count, Reservation ID | `best_effort` |
| **Inventory** | `inventory.stock_in`, `inventory.stock_out`, `inventory.adjustment` | `inventory` | Item ID, SKU, Quantity, Unit Cost, Supplier / Reason | `strict_fail_closed` |
| **Customer CRM**| `customer.linked`, `customer.consent_granted`, `customer.merged` | `customer` | Customer ID, Source Order ID, Consent Type | `strict_fail_closed` |
| **Tenant / HQ** | `tenant.settings_updated`, `tenant.operating_unit_reassigned` | `tenant` | Tenant ID, Operating Unit ID, Admin Actor ID | `strict_fail_closed` |

---

## 3. Core Contract Invariants

1. **Server-Authoritative Scope**: Actor, role, tenant, and operating unit are resolved strictly server-side from verified cryptographic tokens; client-provided audit overrides are rejected.
2. **Zero Credential / Token Leakage**: All credentials, tokens, JWTs, card numbers, and secret keys are automatically sanitized prior to log generation.
3. **Append-Only Immutability**: The audit log table is strictly append-only. Corrections, voided transactions, or reversals insert new records referencing the parent `correlation_id`.
4. **Lifecycle Correlation**: Operations spanning multiple domains (e.g. Shift → Order → Payment) propagate a single `correlation_id` across all audit entries for complete traceability.
5. **Explicit Failure Policy**:
   - `best_effort`: Used for non-blocking telemetry and standard read/write audits; storage errors log gracefully without breaking the user request.
   - `strict_fail_closed`: Used for critical financial, identity, and compliance mutations; audit storage failures abort the transaction to prevent un-audited state changes.
6. **Dual Schema Compatibility**: The canonical writer supports both legacy columns (`user_id`, `entity_type`, `entity_id`, `metadata`) and unified columns (`actor_id`, `resource_type`, `details`, `operating_unit_id`, `tenant_id`, `status`, `correlation_id`).

---

## 4. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/audit-trail-contract.test.ts` (10/10 PASS):
- `1. successful mutation: writes canonical audit log with actor, action, and correlation ID`: PASS
- `2. rejected authorization: records rejected auth attempt with reason and actor context`: PASS
- `3. before/after diff: computes safe diff capturing changed keys and values`: PASS
- `4. cross-unit access: logs operating unit mismatch when actor crosses boundary`: PASS
- `5. retry/idempotency: retries with same correlation ID log idempotency trace`: PASS
- `6. sensitive-field redaction: masks credentials, tokens, cards, and authorization headers`: PASS
- `7. append-only behavior: mutations create new records with linked correlation IDs`: PASS
- `8. audit-write failure handling: best_effort logs error, strict_fail_closed throws`: PASS
- `9. correlation across Order/Payment/Shift: unified correlation links related lifecycle events`: PASS
- `10. schema and migration compatibility: generates both legacy and canonical field mappings`: PASS

---

## 5. Changed Files & Migration Status

- `packages/domain/audit/package.json`: Workspace registration for `@aura/domain-audit` (5 LOC).
- `packages/domain/audit/src/model/audit-types.ts`: Canonical Audit & Operational Event types (49 LOC).
- `packages/domain/audit/src/policies/audit-redaction-policy.ts`: Automated Sensitive Data Redaction policy (39 LOC).
- `packages/domain/audit/src/policies/audit-writer-policy.ts`: Authoritative Audit Writer & Diff Engine (160 LOC).
- `packages/domain/audit/index.ts`: Public domain interface (21 LOC).
- `worker/db/migrations/20261009_01_audit_trail_canonical_contract.sql`: Database schema migration adding operating unit, tenant, and correlation columns (10 LOC).
- `worker/src/__tests__/integrations/audit-trail-contract.test.ts`: Integration test suite (192 LOC).
- `worker/src/lib/audit-logger.ts`: Refactored to delegate to canonical `@aura/domain-audit` writer.
- `worker/src/middleware/audit-log.ts`: Refactored to delegate to canonical `@aura/domain-audit` writer.
- `reports/core/cook/AUDIT-TRAIL-CONTRACT.md`: Authoritative contract documentation.
- **Migration Requirements**: Run `worker/db/migrations/20261009_01_audit_trail_canonical_contract.sql` against D1.
- **Blockers**: None.
