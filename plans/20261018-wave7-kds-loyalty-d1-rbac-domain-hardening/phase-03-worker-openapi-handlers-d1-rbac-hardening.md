# Phase 03: Worker OpenAPI Handlers D1 & RBAC Hardening

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave7-deep-audit.md](reports/brainstorm-20261018-wave7-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**: `worker/src/routes/openapi-{products,tables,orders,staff,inventory,loyalty,promotions,payments,auth,cron}-handlers/**`

---

## Related Code Files
- `worker/src/routes/openapi-products-handlers/mutation-handlers.ts`
- `worker/src/routes/openapi-tables-handlers/{routes.ts,table-crud-handlers.ts,zone-crud-handlers.ts}`
- `worker/src/routes/openapi-orders-handlers/{routes.ts,order-write-handlers.ts}`
- `worker/src/routes/openapi-staff-handlers/{staff-handlers.ts,shift-handlers.ts,attendance-handlers.ts}`
- `worker/src/routes/openapi-inventory-handlers/{ingredient-handlers.ts,movement-handlers.ts,supplier-handlers.ts,purchase-order-handlers.ts}`
- `worker/src/routes/openapi-loyalty-handlers/{tier-handlers.ts,account-handlers.ts,reward-handlers.ts,admin-handlers.ts}`
- `worker/src/routes/openapi-promotions-handlers/{crud-handlers.ts,validation-handlers.ts}`
- `worker/src/routes/openapi-payments-handlers/read-handlers.ts`
- `worker/src/routes/openapi-auth-handlers/{auth-handlers.ts,staff-handlers.ts,device-handlers.ts}`
- `worker/src/routes/openapi-cron-handlers/{job-crud-handlers.ts,run-handlers.ts,summary-handlers.ts}`

---

## Implementation Steps

1. **Resilient `audit_logs` Helper / Fallbacks**:
   - Across all OpenAPI mutation handlers (`products`, `tables`, `orders`, `staff`, `inventory`, `loyalty`, `promotions`, `auth`, `cron`), wrap `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)` in `try/catch` with fallback to canonical `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)` (and `.catch(() => {})` so audit logging never crashes the primary mutation).

2. **Canonical Table & Column Fallbacks**:
   - `openapi-products-handlers/mutation-handlers.ts`: Wrap `SELECT COUNT(*) as count FROM order_items WHERE product_id = ?` in `try/catch` (defaulting to `{ count: 0 }` if `order_items` does not exist) and add canonical `products` insert/update fallback.
   - `openapi-tables-handlers/{routes.ts,table-crud-handlers.ts,zone-crud-handlers.ts}`: Add `'cashier'` to `routes.ts`, and add `cafe_tables` fallbacks in `table-crud-handlers.ts` and graceful empty/in-memory fallbacks in `zone-crud-handlers.ts` when `tables` or `table_zones` do not exist.
   - `openapi-orders-handlers/{routes.ts,order-write-handlers.ts}`: Add `'cashier'` and `'waiter'` to `routes.ts`, and add canonical `orders` (`total`, `notes`, `status`, `updated_at`) fallback in `order-write-handlers.ts` when extended columns (`order_number`, `location_id`, `total_amount`, etc.) are absent.
   - `openapi-staff-handlers/{staff-handlers.ts,shift-handlers.ts,attendance-handlers.ts}`: Add `try/catch` fallbacks for canonical `users` (`id, phone, name, role, is_active, created_at, updated_at`), `shifts` (`user_id, shift_date, start_time, end_time, status`), and graceful fallbacks when `staff_attendance` or `zones` are absent.
   - `openapi-inventory-handlers/{ingredient-handlers.ts,movement-handlers.ts,supplier-handlers.ts,purchase-order-handlers.ts}`: Add `try/catch` fallbacks to `inventory_items` and `inventory_transactions` when `ingredients`, `stock_movements`, `suppliers`, or `purchase_orders` do not exist.
   - `openapi-loyalty-handlers/{tier-handlers.ts,account-handlers.ts,reward-handlers.ts,admin-handlers.ts}`:
     - Use `body.idempotencyKey ?? null` in `reward-handlers.ts:244` and `admin-handlers.ts:21` so `undefined` is never passed to D1 `.bind(...)`.
     - Bind `String(currentYear)` in `account-handlers.ts:92` for `strftime('%Y', created_at) = ?`.
     - Add `try/catch` fallbacks to `tier_configs`, `customers`, and canonical `loyalty_rewards` (`reward_type`, `reward_value`, `points_cost`) / `loyalty_transactions`.
   - `openapi-promotions-handlers/{crud-handlers.ts,validation-handlers.ts}`:
     - Enforce staff/manager/owner/admin role check (`['owner', 'manager', 'admin', 'staff']`) in `create`, `update`, and `delete` handlers in `crud-handlers.ts` (rejecting `'customer'` with 403).
     - Add canonical `promotions` column fallbacks (`discount_type`, `discount_value`, `min_order`, `max_discount`, `usage_limit`, `used_count`, `expires_at`, `'percent'`) in `crud-handlers.ts` and `validation-handlers.ts`.
   - `openapi-payments-handlers/read-handlers.ts`: When `user.role === 'customer'`, scope `GET /api/payments` to orders belonging to `user.id` (`JOIN orders o ON o.id = payments.order_id WHERE o.customer_id = ?` with fallback).
   - `openapi-auth-handlers/{auth-handlers.ts,staff-handlers.ts,device-handlers.ts}` & `openapi-cron-handlers/*`: Wrap queries against optional tables (`sessions`, `trusted_devices`, `email_verifications`, `cron_jobs`, `cron_runs`) in `try/catch` with canonical `users`/`customers` fallbacks.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors, and all OpenAPI handler tests pass.
