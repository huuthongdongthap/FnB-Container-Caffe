# ASSET_INVENTORY — Reusable Features/Components

Generated: 2026-08-03
Source: worker/src/routes/, src/components/, src/lib/, worker/schema.sql

## Triage Results

### REUSE (copy as-is, 0-1hr adaptation)

| Asset | Path | Why Reuse |
|-------|------|-----------|
| Badge | src/components/ui/badge.tsx | Generic status/feature badge |
| Button | src/components/ui/button.tsx | Generic CTA button |
| Card | src/components/ui/card.tsx | Generic card container |
| Drawer | src/components/ui/drawer.tsx | Slide-out panel pattern |
| Input | src/components/ui/input.tsx | Form input |
| Modal | src/components/ui/modal.tsx | Dialog overlay |
| Navbar | src/components/ui/navbar.tsx | Top navigation (ADAPT for SaaS layout) |
| Footer | src/components/ui/footer.tsx | Page footer (ADAPT for SaaS) |
| Skeleton | src/components/ui/skeleton.tsx | Loading placeholder |
| Switch | src/components/ui/switch.tsx | Toggle control |
| cn() | src/lib/cn.ts | Classname merge utility |
| formatVND() | src/lib/format.ts | Currency formatter |
| logger | src/lib/logger.ts | Logging utility |
| Zod validators | src/lib/validators.ts | Schema validation (extend) |
| SEOHead | src/components/shared/SEOHead.tsx | Meta tags wrapper |

### ADAPT (2-4hr effort, schema/logic changes needed)

| Asset | Path | Adaptation Needed |
|-------|------|-------------------|
| Auth routes | worker/src/routes/auth.ts | Add tier checks, JWT enrichment |
| Subscription routes | worker/src/routes/subscriptions.ts | Rename concepts: container lease → SaaS plan |
| Analytics routes | worker/src/routes/analytics-hono.ts | Add tenant_id filter, role-scoped |
| Customer routes | worker/src/routes/customers.ts | Add tenant_id, multi-tenant isolation |
| Subscription tables | worker/schema.sql:422-485 | subscription_plans/invoices → SaaS plans |
| Admin layout | src/pages/admin/AdminLayout.tsx | Dual-mode: cafe admin + SaaS admin |
| Auth forms | src/components/auth/LoginForm.tsx, RegisterForm.tsx | Add tier selection flow |
| ProtectedRoute | src/components/auth/ProtectedRoute.tsx | Add tier gate check |

### IGNORE (cafe-specific, not reusable for SaaS)

| Asset | Path | Reason |
|-------|------|--------|
| KDS components | src/components/kds/* | Kitchen display system — cafe only |
| TVMenu components | src/components/tv-menu/* | Digital signage — cafe only |
| Table management | src/components/reservation/TableMap.tsx, etc. | Dine-in table system |
| Order components | src/components/order/* | Dine-in/delivery order flow |
| Loyalty calculator | src/components/loyalty/loyalty-calculator.tsx | Cafe loyalty program |
| Reservation flow | src/components/reservation/* | Table reservation |
| Checkin components | src/components/checkin/* | Customer check-in |
| Brand components | src/components/brand/* | AURA CAFE brand assets |
| Stitch screens | src/components/stitch/* | AURA CAFE visual design |
| PWA shell | src/components/pwa/* | Cafe mobile app |
| Payment modals | src/components/payments/* | Cafe payment flow |
| ERPNext routes | worker/src/routes/erpnext* | 3rd party ERP integration |
| Mautic bridge | worker/src/routes/mautic-bridge.ts | Marketing automation |
| Mixpost routes | worker/src/routes/mixpost.ts | Social media posting |
| Pretix routes | worker/src/routes/pretix.ts | Event ticketing |
| Birthday routes | worker/src/routes/birthday.ts | Cafe birthday rewards |
| Referral system | worker/src/routes/referrals.ts | Cafe referral program |

## D1 Tables Triage

### REUSE (generic data patterns)
- categories, products — product catalog pattern
- customers — customer data pattern
- orders, order_items — order pattern
- payments — payment pattern
- reservations — booking pattern
- contact_messages, reviews — feedback pattern
- promotions — promo pattern

### ADAPT (need tenant_id column)
- subscription_plans — rename to saas_pricing or add saas_plans
- subscriptions — add tenant_id, change semantics
- subscription_invoices — add tenant_id, change semantics
- loyalty_tiers — could reuse tier structure for SaaS (or create separate)
- cashback_wallets, cashback_transactions — optional SaaS credits feature

### IGNORE (cafe-specific data)
- cafe_tables, menu_items — cafe-specific
- loyalty_point_logs, rewards, user_rewards — cafe loyalty
- referral_codes, referrals — cafe referral
- staff_shifts — cafe staff management
- erpnext_sync_logs, erpnext_mappings — ERP integration
- notification_audit_log — cafe notifications
- push_subscriptions — cafe push

## Effort Summary

| Category | Count | Est. Effort |
|----------|-------|-------------|
| REUSE | 14 assets | 2-4hrs |
| ADAPT | 8 assets | 16-32hrs |
| IGNORE | 30+ assets | N/A |
