---
date: 2026-09-11
version: 1.0
status: discovery (Phase 0)
source: route inventory, loyalty handbook, deployed flows
---
# CUSTOMER JOURNEY — Current vs Target

## Primary loop (spec §13)

```
DISCOVER → EXPLORE → ORDER/BOOK → PAY → VISIT → EXPERIENCE → LOYALTY → RETURN
```

## Current journey (verified from routes)

| Stage | Current experience | Evidence | Gaps |
|---|---|---|---|
| Discover | Landing `/`, `/about`, brand pages, SEO, gallery | home, seo components | 41 experimental stitch landing variants — no single canonical brand entry |
| Explore | `/menu` (digital menu, TV menu), `/gallery`, `/events`, `/promotions`, `/reviews` | menu routes | menu browsing and availability not a designed journey; contextual features scattered |
| Order/Book | `/order` QR ordering from table, `/checkout` (dine-in/takeaway/delivery per-type contract), `/table-reservation` | create-order tree, migration 014 | order_type rules live in API contract; reservation conflict policy in route handler |
| Pay | Stripe, NOWPayments, COD at checkout | ADR-0009 webhook sync | ✅ solid |
| Visit | Table check-in `/table-checkin`, `/checkin` approve flow | checkins tables | — |
| Experience | KDS-driven kitchen → order timeline `/track-order` (live DO broadcast, shipped 2026-09-11) | order-timeline | track-order duplicated ×3 |
| Loyalty | `/loyalty` 4-tier ladder + calculator + cashback + rewards redemption in account | aa9602f | membership boundary unclear (tier vs membership) |
| Return | Referral `/referral`, promotions, campaigns (Zalo/Mautic push-back) | referrals, campaigns trees | return loop not a designed journey |

## Target journey (Phase 1 — to be ratified with personas)

- **Nav = jobs**: Menu · Order · Space/Booking · Account (spec §13 top-level rule)
- Offers/Events/Reviews/Membership/Referral/Check-in = contextual inside stages, not nav items
- Desktop and mobile get intentional, distinct designs (spec §14)
- Journey state durable: order status, loyalty tier, reservations visible from Account hub

## Staff & Owner journeys (Phase 1 scope, summarized)

- **Waiter (ops)**: open table → take QR/POS order → send to kitchen → serve → close
- **Kitchen (ops)**: ticket queue → in-progress → ready (KDS; DO broadcast keeps screens live)
- **Owner/Manager (hq)**: today's revenue → orders live → staff/shifts → campaigns → customers → decide
- **SaaS tenant (future)**: onboard → configure → bill → MRR (incubating only — no Phase 3 commitment)

## Acceptance scenario seeds (spec §18–19 — become tests)

- Customer creates dine-in order at valid table; unavailable product rejected; price computed server-side; payment success → confirmed order → kitchen ticket → customer sees status (spec §18 example, verbatim)
- Reservation conflict rejected with clear vi message
- Loyalty points earned on payment success; tier upgrade shown post-order
- Referral code applies discount at checkout, once per customer
- Guest COD order (no login) captures phone (VN format, shipped 3472ba4) and tracks anonymously
