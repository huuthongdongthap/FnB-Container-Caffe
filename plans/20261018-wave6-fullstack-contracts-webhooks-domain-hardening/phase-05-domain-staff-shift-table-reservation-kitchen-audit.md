# Phase 05: Domain Staff, Shift, Table, Reservation, Kitchen, Inventory, Audit & Notification

## Context Links
- Brainstorm Report: [reports/brainstorm-20261018-wave6-deep-audit.md](reports/brainstorm-20261018-wave6-deep-audit.md)
- Plan Overview: [plan.md](plan.md)

## Overview
- **Priority**: High
- **Status**: Pending
- **Scope**: Align staff roles, D1 table/column fallbacks, and security policies across `@aura/domain-{staff,shift,table,reservation,kitchen,inventory,audit,notification,integration}`.

## Related Code Files (Strict Ownership)
- `packages/domain/staff/lib/staff-roles.ts`
- `packages/domain/staff/src/model/authorization-types.ts`
- `packages/domain/staff/src/policies/authorization-policy.ts`
- `packages/domain/staff/commands/staff-auth.ts`
- `packages/domain/staff/commands/staff-tips.ts`
- `packages/domain/shift/commands/shifts.ts`
- `packages/domain/shift/src/routes/reconciliation.ts`
- `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- `packages/domain/shift/src/policies/shift-lifecycle-policy.ts`
- `packages/domain/table/commands/qr-scan.ts`
- `packages/domain/table/commands/tables.ts`
- `packages/domain/table/src/policies/table-availability-policy.ts`
- `packages/domain/table/src/policies/table-reservation-policy.ts`
- `packages/domain/reservation/src/routes/reservations.ts`
- `packages/domain/kitchen/commands/kds-mobile.ts`
- `packages/domain/kitchen/commands/kitchen-stations.ts`
- `packages/domain/kitchen/commands/kitchen-station-tickets.ts`
- `packages/domain/inventory/src/routes/inventory-transactions.ts`
- `packages/domain/inventory/src/routes/order-deduction.ts`
- `packages/domain/audit/src/policies/audit-redaction-policy.ts`
- `packages/domain/audit/src/policies/audit-writer-policy.ts`
- `packages/domain/notification/src/policies/notification-orchestration-policy.ts`
- `packages/domain/integration/src/policies/integration-boundary-policy.ts`

## Implementation Steps
1. **`packages/domain/staff/**`**:
   - In `lib/staff-roles.ts` and `src/model/authorization-types.ts`, include `'admin'`, `'barista'`, `'chef'`, `'kitchen'`, `'cashier'` in `StaffRole` and role hierarchy.
   - In `src/policies/authorization-policy.ts`, add `payment: ['read', 'create']` to `waiter`.
   - In `commands/staff-auth.ts`, allow `'admin'`, `'cashier'`, `'kitchen'`, `'barista'`, `'chef'` in mobile device registration/login and wrap `SELECT email, name FROM users` with a `try/catch` fallback to `SELECT username as email, COALESCE(name, full_name, username) as name FROM users`.
   - In `commands/staff-tips.ts`, include `'cashier'`, `'barista'`, `'chef'`, `'kitchen'` in `requireAuth`.
2. **`packages/domain/shift/**`**:
   - In `commands/shifts.ts`, include `'cashier'` in `shiftStaffAuth` and add D1 schema fallback between `(clock_in, clock_out, hours_worked)` and canonical `016_staff_tables.sql` `(start_time, end_time, actual_start, actual_end)`.
   - In `src/routes/reconciliation.ts`, include `'cashier'` and `'waiter'` in `ALLOWED_RECONCILIATION_ROLES`.
   - In `src/policies/cash-reconciliation-policy.ts`, wrap the `cash_payouts` query in `try/catch` returning `0` when the table is absent.
   - In `src/policies/shift-lifecycle-policy.ts`, include `'waiter'`, `'barista'`, `'chef'`, `'kitchen'` in `canStaffOperateShift` and add fallback from `staff_shifts` to `shifts`.
3. **`packages/domain/table/**` & `packages/domain/reservation/**`**:
   - In `table/commands/qr-scan.ts:49`, prepend `https://` (or `http://` for localhost) when constructing fallback QR URLs.
   - In `table/commands/tables.ts`, include `'cashier'` in table status update roles.
   - In `table/src/policies/table-availability-policy.ts`, `table-reservation-policy.ts`, and `reservation/src/routes/reservations.ts`, add `try/catch` fallback for `reservation_date, reservation_time, phone, pax`, include `'waiter'` and `'cashier'` in `reservations.ts` `requireAuth`, and only set `cafe_tables.status = 'Available'` on reservation cancel/delete when `status = 'Reserved'` (`WHERE id = ? AND status = 'Reserved'`).
4. **`packages/domain/kitchen/**` & `packages/domain/inventory/**`**:
   - In `kitchen/commands/kds-mobile.ts` and `kitchen-stations.ts`, include `'waiter'` in `VIEW_ROLES`, `UPDATE_ROLES`, and `requireStaff`.
   - In `inventory/src/routes/inventory-transactions.ts:52-56`, when `input.type === 'adjust'`, preserve signed `Number(input.quantity)` if negative, otherwise `+Math.abs(input.quantity)`.
   - In `inventory/src/routes/order-deduction.ts`, add fallback in `deductInventoryForOrder` and `restoreInventoryForOrder` so both `inventory_items`/`inventory_transactions` and `ingredients`/`stock_movements` are supported.
5. **`packages/domain/audit/**`, `notification/**` & `integration/**`**:
   - In `audit-redaction-policy.ts`, preserve `Date` instances (`if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;`) and call `seen.delete(obj)` after recursing so shared non-circular object references are not replaced with `'[CIRCULAR]'`.
   - In `audit-writer-policy.ts`, add fallback to canonical `INSERT INTO audit_logs (id, action, actor, resource, resource_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`.
   - In `notification-orchestration-policy.ts` and `integration-boundary-policy.ts`, fix `verifyWebhookSignature` condition so `if (secretKey && (signature !== `sig_${secretKey}` && signature.length < 8))` is corrected (while preserving any existing test expectations on signature format), and add fallback to canonical `notification_audit_log (order_id, customer_id, channel, phone, message_type, status, provider_response, sent_at, created_at)`.

## Success Criteria
- All domain package unit and integration tests pass with 0 TypeScript or ESLint errors.
