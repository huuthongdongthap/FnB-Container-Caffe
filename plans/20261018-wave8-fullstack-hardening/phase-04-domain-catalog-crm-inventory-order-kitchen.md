# Phase 04: Domain Packages & Analytics Hardening

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave8-deep-audit.md](reports/brainstorm-20261018-wave8-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**:
- `packages/domain/catalog/commands/{categories.ts,products.ts,menu-modifiers.ts}`
- `packages/domain/catalog/policies/{availability.ts,menu-projection.ts}`
- `packages/domain/crm/commands/{campaign/detect.ts,get-customer-account.ts,customer-360.ts,consume-crm-event.ts,get-fulfillment.ts}`
- `packages/domain/customer/events/customer-event-dispatcher.ts`
- `packages/domain/inventory/src/{policies/bom-policy.ts,routes/inventory-crud.ts,routes/inventory-transactions.ts}`
- `packages/domain/kitchen/commands/kds-status-transition.ts`
- `packages/domain/order/commands/split-orders.ts`
- `packages/domain/order/notifications/{notify-order-status.ts,telegram.ts}`
- `packages/domain/order/queries/{get-order.ts,stats.ts}`
- `worker/src/tree/analytics/{zone-analytics.ts,summary.ts,top-products.ts,csv-export.ts}`
- `worker/src/tree/referrals/apply-referral.ts`
- `worker/src/routes/reports-handlers/analytics-handlers.ts`

---

## Requirements & Implementation Steps

1. **Catalog Domain Hardening**:
   - `categories.ts`: Auto-generate slug from name if slug is empty, and add fallback omitting `image_url` for legacy schemas.
   - `products.ts`: Include `tags` and `badge` in insert/update, add legacy column fallback, and return 409 Conflict on duplicate slug.
   - `menu-modifiers.ts`: Provide fallbacks omitting `is_active`/`is_available`, and call `syncModifierChoiceToMenuProjection` after choice insertion.
   - `availability.ts`: Fix `parseAvailabilityFilter` to return `null` for unrecognized/empty strings.
   - `menu-projection.ts`: Wrap projection writes in `try/catch` so primary catalog mutations never fail when projection tables are unmigrated.

2. **CRM Domain & Customer Events**:
   - `campaign/detect.ts`: Join `cashback_wallets` on `wallet_id` instead of querying non-existent `customer_id` on `cashback_transactions`, and guard `last_expiry_warning_at`.
   - `get-customer-account.ts`: Query `COALESCE(total, total_amount, 0)` instead of non-existent `total_cents`.
   - `customer-360.ts`: Add safe fallback when both `order_type` and `channel` are absent.
   - `customer-event-dispatcher.ts`: Avoid inserting `customer_id = 'guest'` which triggers FK violation on `customers(id)`. Insert `null` or skip FK insert for anonymous events.
   - `consume-crm-event.ts`: Propagate failure flags from loyalty and visit handlers; wrap `UPDATE visits` in `try/catch`.
   - `get-fulfillment.ts`: Include `'delivered'` and `'completed'` in `TERMINAL_STATUSES`.

3. **Inventory, Kitchen & Order Domain**:
   - `bom-policy.ts`: Log movements to `stock_movements` when operating on `ingredients` table.
   - `kds-status-transition.ts`: Broadcast transitions to `ORDER_BROADCASTER` DO, restore inventory on cancel, and trigger loyalty on completion.
   - `split-orders.ts`: Validate child order line item prices against original order items snapshot.
   - `notify-order-status.ts`: Await `sendZNS` and `sendSMS` via `Promise.allSettled`.
   - `get-order.ts` & `stats.ts` & `telegram.ts`: Use `COALESCE(total, total_amount, 0)` to prevent `NaN` revenue and `NaN₫` rendering. Parse line items in memory for top products aggregation instead of `GROUP BY items`.

4. **Analytics Engine & Referrals**:
   - `analytics-handlers.ts`: Filter out guest orders (`WHERE customer_id IS NOT NULL`) in repeat customer aggregation.
   - `zone-analytics.ts`, `summary.ts`, `top-products.ts`: Add fallbacks for `tables` table and cart items in JSON.
   - `csv-export.ts`: Prepend UTF-8 BOM (`﻿`) and sanitize cells starting with formula characters (`=`, `+`, `-`, `@`).
   - `apply-referral.ts`: Set `pending = row ? { id: row.id, bonus_type: 'cashback' } : null` instead of fabricating dummy objects.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors.
- Guest checkouts process CRM events without D1 foreign key crashes.
- Analytics aggregations exclude null guest IDs and format CSVs securely with UTF-8 BOM.
