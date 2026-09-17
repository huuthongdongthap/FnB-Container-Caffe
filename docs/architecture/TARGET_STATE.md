---
date: 2026-09-11
version: 1.0
status: proposed (not yet approved)
source: AURA_FnB_OS_Rebuild_Master_Spec.md §5, §8, §9, §10
---
# TARGET STATE — AURA F&B OS

## 1. Product model

AURA becomes an **All-in-one F&B Operating System** with three experience surfaces (spec §5.1):

```
apps/
├── space/   # Customer Experience — discover, order, book, pay, loyalty, return
├── ops/     # Staff Operations — POS, KDS, tables, floor, staff
└── hq/      # Owner/Manager HQ — analytics, finance, campaigns, customers
```

AI copilots (customer/staff/manager) are deferred until domain contracts stabilize (spec §5.1, §25 Phase 6).

## 2. Architecture model (spec §1)

```
EXPERIENCE (apps/*)
→ DOMAIN (packages/domain/* — owns business truth)
→ APPLICATION (use cases, orchestration)
→ PLATFORM (db, auth, i18n, config, observability)
→ INTEGRATIONS (ports + adapters per provider)
```

API law (§10): handlers are thin — `VALIDATE → AUTHORIZE → CALL USE CASE → MAP RESULT`. Zod schemas stay the transport contract.

## 3. Target repository

Per spec §8, adjusted only where current repo evidence justifies (monorepo stays in this repo, root restructured):

```
FnB-Container-Caffe/           # repo renamed conceptually to "aura"
├── apps/
│   ├── space/   ← from src/pages (customer subset) + stitch landing pages (deduped)
│   ├── ops/      ← from kds/, staff/, dindin, kitchen-display, floor-plan pages
│   └── hq/       ← from admin/ pages (29 admin routes)
├── packages/
│   ├── ui/         ← from src/components/ui + md3 tokens (ADR-0006, m3-token-mapping)
│   ├── domain/     ← from worker/src/tree/ (18 trees) + worker/src/schemas (zod)
│   ├── application/ ← use cases extracted from route handlers + hooks business logic
│   ├── api/        ← from worker/src/routes (91 files → thin handlers)
│   ├── db/         ← worker/schema.sql (31 tables) + migrations
│   ├── auth/       ← worker/src/middleware/auth.ts + jwt.ts + staff-roles
│   ├── i18n/       ← src/locales (vi canonical, en secondary)
│   ├── config/     ← wrangler, vite, env contracts
│   └── integrations/ ← worker/src/lib clients + worker/src/clients (ports+adapters)
├── .ai/
│   ├── context/  ├── specs/  ├── skills/  ├── workflows/
│   ├── policies/ ├── state/  └── evals/
├── docs/{product,architecture,decisions,operations}/
├── tests/{unit,integration,e2e,evals}/
├── scripts/
├── AGENTS.md · README.md · package.json
```

Deployment stays Cloudflare Pages + Workers + D1/KV/DO (ADR-0001/0002/0004 preserved).

## 4. Domain package contract (spec §9)

```
packages/domain/<domain>/
├── model      # entities, invariants
├── commands   # state-changing use case inputs
├── queries    # reads
├── policies   # business rules (pricing, promotion eligibility, loyalty calc)
├── schemas    # zod input/output contracts (from worker/src/schemas)
├── events     # OrderCreated, PaymentSucceeded, KitchenTicketCreated, ... (spec §11)
└── tests
```

## 5. Bounded contexts (spec §6 — mapped to current evidence)

| Target context | Current seed |
|----------------|--------------|
| Identity / Customer / Staff | `users`, `customers`, `staff_shifts`, `users_roles`, tree/auth |
| Catalog / Menu | `categories`, `menu_items`, `products`, schemas/products |
| Space / Table / Reservation | `cafe_tables`, `reservations`, floor-plan routes |
| Order / Payment / Kitchen | `orders`, `order_items`, `payments`(+new), tree/orders, KDS |
| Loyalty / Membership / Promotion | `loyalty_*` (4 tables), `rewards`, `user_rewards`, tree/loyalty, tree/campaigns, `promotions` |
| Inventory | inventory routes + schemas |
| Notification | push, telegram, zalo, sms, email trees |
| Finance / Analytics | mrr_snapshots, metrics tables, tree/analytics |
| Subscription/SaaS (incubating) | `subscriptions` family, saas_tenants, nowpayments |

## 6. Event model (spec §11 — adopt where async helps)

Keep: order lifecycle broadcast via DO (OrderBroadcaster already exists), payment webhook sync (ADR-0009). Add domain events only when they reduce coupling: OrderCreated → KitchenTicketCreated; PaymentSucceeded → LoyaltyPointsEarned.

## 7. Experience targets (spec §13, §14)

- Customer nav = primary jobs: Home · Menu · Order · Space · Booking · Account; contextual: Offers, Events, Reviews, Membership, Referral, Check-in
- ONE design token source (MD3, existing `m3-token-mapping.md` merges into packages/ui)
- Desktop and mobile designed intentionally — mobile patterns (bottom nav) must not leak to desktop
- vi-VN canonical; every user-facing string via i18n key (glossary-driven, no duplicates)

## 8. Migration sequence (spec §25)

```
Phase 0 Discovery       ← this artifact set (§31)
Phase 1 Product Truth   ← personas, journeys, feature hierarchy, glossary
Phase 2 Foundation      ← packages/ui, i18n, auth, domain contracts, db
Phase 3 Core F&B Loop   ← Catalog → Menu → Order → Payment → Kitchen → Customer
Phase 4 Operations      ← POS, KDS, Tables, Staff, Inventory, Reservation
Phase 5 Growth          ← CRM, Loyalty, Membership, Promotion, Campaign, Analytics
Phase 6 AI              ← copilots (only after contracts stable)
```

## 9. What stays / changes (binding rule §26: never DELETE → REWRITE → HOPE)

- **KEEP (behavior preserved)**: all 31 D1 tables + data, 4800 tests as migration evidence, RBAC, DO broadcast, webhook-sync payments, runbooks, ADRs
- **MOVE**: tree/→domain, routes/→api (thinned), clients→integrations, admin pages→hq, kds/staff→ops, customer pages→space
- **MERGE**: payments/payments_new, subscription_invoices(_new), duplicated stitch variants ×2, split vi keys
- **REWRITE**: page-first UX into BRAND→DESIGN SYSTEM→IA→JOURNEY→EXPERIENCE; business logic out of hooks/routes into domain policies
- **ARCHIVE**: 41 stitch one-offs after their surviving variants move to apps/space; stale docs (2025-06 architecture) → docs/decisions as ADR-history
- **DELETE**: nothing until replacement verified in Phase 3+ (done = verified, §27)
