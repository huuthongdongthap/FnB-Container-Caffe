---
date: 2026-09-11
version: 1.0
status: discovery (Phase 0)
source: worker/schema.sql, worker/src/tree/, worker/src/schemas/, worker/src/routes/
---
# DOMAIN MAP — Current Entities → Target Bounded Contexts

## 1. Entity inventory (31 D1 tables, `worker/schema.sql`)

### Identity & People
- `users` (auth, roles), `customers` (loyalty-linked consumer profile)
- `staff_shifts` (ops scheduling)

### Catalog
- `categories`, `menu_items`, `products`

### Space & Booking
- `cafe_tables` (floor/QR), `reservations`, `checkins`

### Order
- `orders` (order_type: dine-in/takeaway/delivery — per-type required fields contract documented in POST /api/orders), `order_items`

### Payment
- `payments` (single table — recreate+rename migrations already unified; no `_new` duplicate exists), COD columns (migration 014)

### Loyalty & Growth
- `loyalty_point_logs`, `loyalty_tiers` (4-tier ladder shipped 2026-09), `cashback_transactions`, `cashback_wallets`, `rewards`, `user_rewards`, `referral_codes`, `referrals`, `promotions`, `reviews`

### Notification & Audit
- `push_subscriptions`, `notification_audit_log`, `contact_messages`

### SaaS/Finance (incubating — tables NOT provisioned in prod D1 as of 2026-09-13)
- `subscription_plans`, `subscription_invoices`, `subscriptions`, `mrr_snapshots`, `erpnext_mappings`, `erpnext_sync_logs`

### Metrics (migrations 004–005)
- `_metrics`, `_alerts` (system tables)

## 2. Relationships (verified from schema + tree logic)

```
CUSTOMER ──┬── Reservation ── Table (cafe_tables)
           ├── Order ──┬── OrderItem ── Product/MenuItem ── Category
           │          ├── Payment (payments)
           │          ├── Promotion
           │          └── Kitchen (KDS via DO broadcast)
           ├── Loyalty (tiers, point_logs, cashback_wallets)
           ├── Rewards / UserRewards
           ├── Referral ── ReferralCode
           └── Checkin

ERP/SYNC: erpnext_mappings + erpnext_sync_logs mirror orders/customers/products → ERPNext
SUBSCRIPTION: plans → invoices → subscriptions → mrr_snapshots (SaaS incubation)
```

## 3. Current domain trees → target contexts

| worker/src/tree/ | Target bounded context (spec §6) | Notes |
|---|---|---|
| auth | Identity | JWT issue/verify, role gates |
| orders | Order (+Kitchen trigger) | create-order, telegram, split-orders, timeline |
| loyalty | Loyalty | 4-tier ladder, cashback |
| campaigns | Promotion / Campaign | |
| referrals | Promotion (Referral) | |
| subscriptions | Finance (Subscription) | NOWPayments |
| analytics | Analytics | metrics aggregation |
| sync | Integration (data sync) | |
| qr | Catalog/Space (QR ordering) | |
| push | Notification | web-push |
| zalo, mautic, mixpost | Notification / Integration (marketing) | adapters |
| pretix | Integration (ticketing/events) | |
| erpnext | Integration (ERP) | accounting/CRM/product |
| homeassistant, cal-booking | Integration (facility/booking) | |
| integrations | Integration (registry) | |

## 4. Target domain map (spec §7)

```
IDENTITY    users, roles, sessions, staff
CATALOG     products, categories, menu_items, modifiers, pricing
SPACE       locations→areas→tables, availability
ORDER       orders, order_items, order_type contract, timeline events
PAYMENT     payments (single table post-merge), webhooks, COD
KITCHEN     stations, tickets, KDS (DO broadcast)
CUSTOMER    customers, checkins, reviews, referral
LOYALTY     tiers (4-tier), points, cashback, rewards
PROMOTION   promotions, campaigns, vouchers
SUBSCRIPTION plans, invoices, subscriptions (SaaS incubation)
ANALYTICS   metrics, mrr, dashboards
```

## 5. Duplicate/dead-field flags (spec §12 — resolution log)

1. ~~`payments` vs `payments_new`~~ — RESOLVED-NOT-NEEDED 2026-09-13: live-D1
   sqlite_master shows no `payments_new`; `migrations/006` was
   recreate+rename (already unified). Open item: live `payments` lacks
   the refund columns 006 defines (apply-state divergence, separate batch).
2. ~~`subscription_invoices` vs `subscription_invoices_new`~~ —
   RESOLVED-NOT-NEEDED 2026-09-13: same recreate+rename pattern in
   `migrations/013`; the whole subscription family was never provisioned
   in prod D1.
3. `subscriptions` exists in both schema.sql and migration 008 — confirm schema.sql is authoritative
4. `contact_messages` — classify: customer domain (Contact) or archive
5. `products` vs `menu_items` — two product concepts; Catalog consolidation target (M2, D10)

Retired 2026-09-13 (migration 20260913_02, DDL preserved in its
down-file): `users_legacy`, `checkin_log`, `odoo_*` (6 tables),
`erpnext_invoices` — 0 rows, zero code consumers.

## 6. Events emitted today (evidence for spec §11)

- Order lifecycle via DO broadcast (order-timeline tracking shipped 2026-09-11)
- Payment webhook → order status sync (ADR-0009)
- Loyalty earn on order success (order-success earned display)
- Telegram notify on order creation (tree/orders/telegram.ts)

Target events: OrderCreated, OrderConfirmed, PaymentSucceeded/Failed, KitchenTicketCreated, OrderReady, ReservationCreated/Confirmed, LoyaltyPointsEarned, PromotionRedeemed, CustomerCheckedIn — adopt incrementally where async coupling already exists.
