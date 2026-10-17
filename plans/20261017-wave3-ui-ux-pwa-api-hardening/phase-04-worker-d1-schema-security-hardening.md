# Phase 04: Worker D1 Schema Mismatches, Payment/Refund/Loyalty Guards & Chat Direction

## Context Links
- [Plan Overview](plan.md)

## Overview
- **Priority**: P0 (Backend Correctness, D1 Schema Compatibility & Security)
- **Status**: Pending
- **Description**: Resolve SQL column mismatches against `worker/schema.sql` (`cafe_tables.updated_at`, `audit_logs` columns, `promotions` PK, `orders` columns in mobile/cashback/analytics), fix payment refund status check (`completed` vs `paid`), guard loyalty point accrual to paid/completed orders, require staff auth for COD completion, and preserve customer name on admin chat replies.

## Key Insights
- `cafe_tables` has no `updated_at` column in `worker/schema.sql`, causing `createOrder`, `splitOrders`, `table-sessions`, `tables-mobile`, and `floor-plan` to fail when updating table status.
- `audit_logs` has columns `(actor_id, actor_name, action, resource_type, resource_id, details, ip_address, created_at)`, whereas `openapi-payments-handlers` inserts `(id, user_id, action, entity_type, entity_id, metadata, created_at)`.
- `refunds-handlers/mutation-handlers.ts` rejects payments unless `status === 'paid'`, even though PayOS/MoMo/SePay webhooks set `status = 'completed'`.
- `chat.ts` hardcodes `direction = 'customer'` and overwrites `chat_conversations.customer_name = 'Admin'` when an admin replies.

## Related Code Files
- `packages/domain/order/commands/create-order.ts`
- `packages/domain/order/commands/split-orders.ts`
- `packages/domain/order/commands/update-order.ts`
- `packages/domain/order/policies/loyalty-trigger.ts`
- `packages/domain/order/queries/admin-orders.ts`
- `packages/domain/payment/commands/payos-create-link.ts`
- `worker/src/routes/table-sessions-handlers/session-handlers.ts`
- `worker/src/routes/tables-mobile.ts`
- `worker/src/routes/floor-plan.ts`
- `worker/src/routes/orders-mobile.ts`
- `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts`
- `worker/src/routes/openapi-payments-handlers/mutation-handlers.ts`
- `worker/src/routes/refunds-handlers/mutation-handlers.ts`
- `worker/src/routes/promotions-handlers/validation-handlers.ts`
- `worker/src/tree/loyalty/spend-cashback-handler.ts`
- `worker/src/routes/analytics-handlers/metrics-handlers.ts`
- `worker/src/routes/chat.ts`
- `worker/src/routes/signage.ts`

## Implementation Steps
1. **`cafe_tables` SQL Updates**: Remove `, updated_at = CURRENT_TIMESTAMP` / `, updated_at = ?` from `UPDATE cafe_tables` in `create-order.ts`, `split-orders.ts`, `table-sessions-handlers/session-handlers.ts`, `tables-mobile.ts`, and `floor-plan.ts`.
2. **`audit_logs` SQL Inserts**: Update `openapi-payments-handlers/webhook-handlers.ts` and `mutation-handlers.ts` to insert into `audit_logs (actor_id, action, resource_type, resource_id, details, created_at)` (wrapped in `try/catch` so audit logging never crashes a completed payment/refund).
3. **Refund Status Check (`refunds-handlers/mutation-handlers.ts`)**: Accept both `payment.status === 'paid'` and `payment.status === 'completed'`.
4. **Promotions Redeem (`promotions-handlers/validation-handlers.ts`)**: Query `SELECT * FROM promotions WHERE code = ?`, update `WHERE code = ?`, only cap `max_discount` when `promo.max_discount > 0`, and wrap `promotion_redemptions` insert in `try/catch` so missing optional audit table does not crash redemption.
5. **Cashback Spend (`spend-cashback-handler.ts`)**: Select `SELECT id, total, total_amount, status FROM orders WHERE id = ?`, compute `const orderAmount = Number(order.total ?? order.total_amount ?? 0)`, and check `(updateResult.meta?.changes ?? updateResult.changes) === 0`.
6. **Mobile Orders (`orders-mobile.ts`)**: Include `total, customer_name, customer_phone` defaults in the fallback `INSERT INTO orders`.
7. **Loyalty Accrual & COD Auth (`loyalty-trigger.ts`, `update-order.ts`, `payos-create-link.ts`)**:
   - In `loyalty-trigger.ts`, only credit loyalty points when `order.payment_status === 'paid' || order.status === 'completed'`.
   - In `payos-create-link.ts`, only auto-complete COD orders when the caller is authenticated staff/admin (`owner`, `manager`, `staff`, `cashier`), otherwise leave `payment_status = 'cod_pending'` for staff collection.
8. **Chat Replies (`worker/src/routes/chat.ts`)**: Respect `body.direction === 'admin'` (or `name === 'Admin'`), keep existing `customer_name` on `chat_conversations` when `direction === 'admin'`, and reset `unread_count = 0` on admin reply.
9. **Signage Promos (`worker/src/routes/signage.ts`)**: Fix duplicate `category_id` alias and filter out expired promotions (`(expires_at IS NULL OR expires_at >= datetime('now'))`).

## Todo List
- [ ] Remove non-existent `cafe_tables.updated_at` from SQL updates
- [ ] Fix `audit_logs` column names in `openapi-payments-handlers`
- [ ] Allow refunding `'completed'` payments in `refunds-handlers`
- [ ] Fix `promotions/redeem`, `spend-cashback-handler`, and `orders-mobile` SQL queries
- [ ] Guard loyalty accrual & COD completion, and support `direction: 'admin'` in `chat.ts`
