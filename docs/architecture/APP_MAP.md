---
date: 2026-09-11
version: 1.0
status: discovery (Phase 0)
source: src/routes/*.tsx (85 routes), src/pages/, src/components/
---
# APP MAP — Current Surfaces → Target Apps

## 1. Current route surfaces (85 routes across 4 files)

### Customer (public-routes.tsx — 30 routes)
```
/ (home) · /menu · /checkout · /order-success · /order-failure
/loyalty · /loyalty-calculator · /referral · /promotions · /events
/track-order · /table-reservation · /tv-menu · /account · /checkin · /table-checkin
/about · /reviews · /subscriptions · /contact · /brand · /order · /container
/gallery · /saas/dashboard · /saas/onboard(/tenant) · /stitch-gallery-screen-showcase
```

### Staff (admin-routes.tsx — 29 routes) + mobile (mobile-routes.tsx — 5)
```
/admin: dashboard · orders · pos · customers · staff · reservations · table-management
        · manage-menu · promotions · campaigns · broadcasts · notifications · metrics
        · sales-reports · invoice-history · erpnext-sync · checkin-approve · audit-logs
        · birthday-config · generate-qr · devices · chat · subscriptions · dindin/*(4)
/mobile: login · kds · orders · tables
/kds (public route — kitchen display) · /tv-menu
```

### Stitch prototypes (stitch-routes.tsx — 21 routes, 41 page variants)
```
One-off landing experiments: luxury-cafe-1(×2) · events-1 · events-promotions-1(×2)
· referral-rewards-1(×2) · digital-menu · kds · track-order · premium-checkout
· order-management · mobile-ordering · kitchen-display · loyalty-calc · loyalty-rewards
· promotions-new · reservation-new · subscriptions-new · gallery-new · luxury-landing(-hero)
· our-story · mobile · not-found · order-failure
```

## 2. Target surface mapping (spec §5.1)

| Target app | Absorbs (current) | Jobs (spec §13) |
|---|---|---|
| **apps/space** | /, /menu, /order, /checkout, /track-order, /table-reservation, /account, /loyalty(+calculator), /referral, /promotions, /events, /reviews, /checkin, /about, /gallery, /container | Discover → Explore → Order/Book → Pay → Visit → Experience → Loyalty → Return |
| **apps/ops** | /kds, /mobile/*, /admin/pos, /admin/orders, /admin/table-management, /admin/reservations, /admin/staff, /admin/checkin-approve, /tv-menu, dindin flows | Take orders, run kitchen (KDS), manage tables/staff |
| **apps/hq** | /admin (dashboard, metrics, sales-reports, customers, campaigns, promotions, broadcasts, invoice-history, subscriptions, erpnext-sync, audit-logs, devices, notification-settings, birthday-config, generate-qr, chat) | See the business, decide, act on customers |
| **Saas incubation** | /saas/*, /subscriptions + admin subscriptions + mrr | stays until Phase 5 decision — not a 4th app yet |

## 3. Navigation targets (spec §13 — top-level = primary customer jobs)

- **Space top nav**: Menu · Order · Space/Booking · Account (+ contextual: Offers, Events, Reviews, Membership, Referral, Check-in inside journeys, not nav)
- **Ops**: role-gated, station-first (KDS, POS, Tables)
- **HQ**: owner/manager analytics-first

## 4. Duplicate surface flag (must dedupe in Phase 1)

- Track-order exists ×3: `/track-order` (shipped StitchTrackOrderNew 2026-09-11), `stitch/track-order`, `mobile` variant
- KDS exists ×3: `/kds`, `stitch/kds`, `kitchen-display`, `mobile/kds`
- Checkout ×2: `/checkout` vs `premium-checkout`; loyalty-calc ×2; reservation ×2 (`table-reservation` vs `reservation-new`); promotions ×3; events ×2; referrals ×2; subscriptions ×3

**Rule**: for each duplicated job, pick ONE canonical experience per surface, archive the rest after migration (spec §26). The 2026-09-11 shipped StitchTrackOrderNew is the current canonical track-order.

## 5. Design system sources (spec §14)

- `src/components/md3/` + `docs/m3-token-mapping.md` + `m3-component-usage.md` — MD3 tokens (ADR-0006) become packages/ui seed
- Brand: `/brand` page + `brand-guideline-colors.ts` + `brand-voice-section.tsx` → consolidated into ONE brand source in Phase 2
- Component families in `src/components/`: ui, shared, admin, auth, cart, menu, payment(s), kds, loyalty, promotions, referral, reservation, checkin, tracking, tv-menu, staff, chat, push, pwa, seo, events, contact, home, brand, md3

## 6. Platform surfaces (non-route)

- PWA (push, offline queue `offline-queue.ts`), SEO (helmet + seo components), ErrorBoundary guard on lazy routes, i18n locale routing `[locale]`
