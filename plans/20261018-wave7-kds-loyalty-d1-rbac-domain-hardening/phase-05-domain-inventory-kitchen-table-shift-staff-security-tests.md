# Phase 05: Domain Inventory, Kitchen, Table, Shift, Staff, Security, Notification, Integration & Tests

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave7-deep-audit.md](reports/brainstorm-20261018-wave7-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**:
- `packages/domain/{inventory,kitchen,table,shift,staff,security,notification,integration}/**`
- `worker/src/__tests__/**`

---

## Related Code Files
- `packages/domain/inventory/src/routes/order-deduction.ts`
- `packages/domain/inventory/src/model/inventory-schemas.ts`
- `packages/domain/inventory/src/policies/inventory-recipe-policy.ts`
- `packages/domain/kitchen/commands/kds-mobile.ts`
- `packages/domain/kitchen/commands/kitchen-stations.ts`
- `packages/domain/kitchen/commands/kitchen-station-tickets.ts`
- `packages/domain/kitchen/commands/kds-stream.ts`
- `packages/domain/table/policies/status.ts`
- `packages/domain/table/commands/tables.ts`
- `packages/domain/table/src/policies/table-availability-policy.ts`
- `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- `packages/domain/staff/commands/staff-auth.ts`
- `packages/domain/staff/commands/staff-tips.ts`
- `packages/domain/security/src/model/security-types.ts`
- `packages/domain/security/src/policies/security-policy.ts`
- `packages/domain/security/src/policies/pii-masking.ts`
- `packages/domain/notification/src/policies/notification-orchestration-policy.ts`
- `packages/domain/notification/src/policies/notification-eligibility-policy.ts`
- `packages/domain/integration/src/policies/integration-boundary-policy.ts`
- `worker/src/__tests__/tree/_dbg.test.ts`
- `worker/src/__tests__/routes/{debug-patch.test.ts,debug-wrong-sig.test.ts,debug-refund.test.ts,staff-auth-mobile.test.ts}`
- `worker/src/__tests__/middleware/audit-log.test.ts`
- `worker/src/__tests__/orders/loyalty-dual-trigger.test.ts`

---

## Implementation Steps

1. **Domain Inventory (`packages/domain/inventory/**`)**:
   - `order-deduction.ts`: In `restoreInventoryForOrder`, if `inventory_transactions` returns 0 rows, also check `stock_movements` (`reference_id = ? AND type = 'out'`) so BOM-deducted ingredients are restored even when the `inventory_transactions` table exists. In `deductInventoryForOrder`, only run the SKU/name fallback for items that were not already depleted via BOM in `bomRes`, and record the actual deducted delta `-(have - newStock)`.
   - `inventory-schemas.ts`: Allow non-zero negative numbers for `quantity` when `type === 'adjust'` (`z.number().refine((v) => v !== 0)` with a `.superRefine` requiring `quantity > 0` when `type !== 'adjust'`).
   - `inventory-recipe-policy.ts`: Prefer `WHERE product_id = ? AND is_active = 1 LIMIT 1` with fallback to `WHERE product_id = ? LIMIT 1` in `getCanonicalRecipe`.

2. **Domain Kitchen & Table (`packages/domain/kitchen/**`, `packages/domain/table/**`)**:
   - `kds-mobile.ts` & `kitchen-stations.ts`: Add `'cashier'` to `VIEW_ROLES`, `UPDATE_ROLES`, and `requireStaff(...)`.
   - `kitchen-station-tickets.ts`: When all items are ready on an order whose status is `'confirmed'`, transition `confirmed -> preparing` before `preparing -> ready`.
   - `kds-stream.ts`: Include `'ready'` in the initial snapshot query (`WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')`) and clear `warningTimer` and `closeTimer` in the `abort` listener.
   - `table/policies/status.ts`, `table/commands/tables.ts`, `table/src/policies/table-availability-policy.ts`: Normalize table status strings (e.g., `'available' -> 'Available'`) in `canTransitionTo`, `releaseTable`, and `checkTableAvailability`.

3. **Domain Shift, Staff, Security, Notification & Integration**:
   - `cash-reconciliation-policy.ts`: Add `try/catch` fallbacks for `staff_shifts` and `shifts` (`COALESCE(actual_start, start_time) AS clock_in, actual_end AS clock_out`).
   - `staff-tips.ts`: Wrap tip queries in `try/catch` fallbacks (`COALESCE(u.name, u.full_name, u.username, 'Unassigned')` and graceful empty results if `tip_amount` or `table_sessions` is absent).
   - `staff-auth.ts`: Preserve all valid `StaffRole` values (`owner`, `manager`, `staff`, `waiter`, `cashier`, `barista`, `chef`, `kitchen`, `admin`) in `normalizeDeviceRole` and `registerDeviceSchema`.
   - `security-types.ts`, `security-policy.ts`, `pii-masking.ts`: Expand `userRole` and `isStaffRole` to include `'admin' | 'cashier' | 'kitchen' | 'barista' | 'chef'`, block `'guest'` when `target.ownerId` is set, and add `WeakSet` cycle protection + `Date` preservation + non-string redaction in `redactSensitiveObject`.
   - `notification-orchestration-policy.ts` & `notification-eligibility-policy.ts`: Add canonical `notification_audit_log (id, channel, phone, template_key, payload, response, error, status, created_at)` fallback, and preserve `Date` + guard cycles in `sanitizeNotificationPayload`.
   - `integration-boundary-policy.ts`: Normalize `auraEntity.status` using an internal AURA status mapper (`'paid' | 'completed' | 'served' | 'confirmed' | '1' | 'submitted' -> 'success'`, `'pending' | 'draft' -> 'pending'`, `'cancelled' | 'rejected' -> 'rejected'`).

4. **Worker Test Hardening (`worker/src/__tests__/**`)**:
   - `_dbg.test.ts`: Remove `/tmp/dbg.txt` filesystem writes and assert the response status and payload.
   - `debug-patch.test.ts`, `debug-wrong-sig.test.ts`, `debug-refund.test.ts`: Add concrete `expect(...)` assertions without noisy debug `console.log` spam.
   - `middleware/audit-log.test.ts`: Also test the real `audit` middleware export alongside the existing schema tests.
   - `orders/loyalty-dual-trigger.test.ts` & `routes/staff-auth-mobile.test.ts`: Assert exact single call site and test real PBKDF2 hash verification for the 200 JWT login path.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors, and 100% of Vitest suites pass.
