---
date: 2026-09-11
version: 1.0
status: discovery (Phase 0)
source: route files, schema, tree/, deployments, git log (5b9417f, 3472ba4, aa9602f)
---
# FEATURE MATRIX — Exists? Complete? Verified?

Legend: EXISTS (code found) · PROD (deployed evidence) · COMPLETE (acceptance-quality) · TEST (suite exists)

| Feature | EXISTS | PROD | COMPLETE | TEST | Domain seed | UI surface | Migration status |
|---|---|---|---|---|---|---|---|
| Menu (categories, menu_items, products) | ✅ | ✅ | ⚠ dual product concepts | ✅ | tree/ + schemas/products | /menu, /tv-menu | keep + consolidate |
| Cart | ✅ | ✅ | ⚠ logic in FE hooks | ✅ | FE store use-cart | /checkout | move rules server-side |
| Checkout (dine-in/takeaway/delivery) | ✅ | ✅ | ✅ per-type contract doc'd (1e86d65) | ✅ | tree/orders/create | /checkout | preserve contract |
| QR Ordering | ✅ | ✅ | ✅ table QR → order | ✅ | tree/qr | /table-checkin, admin/generate-qr | keep |
| Payment — Stripe | ✅ | ✅ | ✅ webhook-sync (ADR-0009) | ✅ | routes/payments | checkout | keep |
| Payment — NOWPayments | ✅ | ✅ | ✅ subscription billing | ✅ | tree/subscriptions | /subscriptions | keep |
| Payment — COD | ✅ | ✅ | ✅ guest columns (migration 014) | ✅ | orders | checkout | keep |
| Payment — SePay | ⚠ docs/config only | ❓ | — | — | docs | — | verify before claiming |
| Order tracking (timeline) | ✅ | ✅ | ✅ shipped 5b9417f (StitchTrackOrderNew + DO) | ✅ | tree/orders + DO | /track-order | canonical; retire 2 duplicates |
| POS | ✅ | ✅ | ⚠ admin-pos + dindin overlap | ✅ | admin routes | /admin/pos, dindin/* | merge in Phase 4 |
| KDS | ✅ | ✅ | ✅ polling (ADR-0010) + DO broadcast | ✅ | kds-stream/kds-mobile | /kds, /mobile/kds | canonicalize 1 of 3 |
| Table Management | ✅ | ✅ | ✅ | ✅ | floor-plan + cafe_tables | /admin/table-management | keep |
| Reservation | ✅ | ✅ | ⚠ conflict policy in route | ✅ | reservations | /table-reservation | move policy to domain |
| Customer CRM | ✅ | ✅ | ⚠ admin/customers thin | ✅ | customers | /admin/customers | expand Phase 5 |
| Loyalty (4-tier ladder) | ✅ | ✅ | ✅ shipped aa9602f | ✅ | tree/loyalty, 4 tables | /loyalty(+calculator) | keep |
| Cashback | ✅ | ✅ | ✅ wallets + transactions | ✅ | loyalty family | account | keep |
| Membership | ⚠ tier page only | ✅ | partial | ✅ | loyalty_tiers | /loyalty | Phase 5 decision |
| Rewards/Redemption | ✅ | ✅ | ✅ | ✅ | rewards, user_rewards | /account | keep |
| Promotion/Voucher | ✅ | ✅ | ✅ | ✅ | promotions | /promotions, admin | keep |
| Campaigns | ✅ | ✅ | ⚠ via Mautic/Mixpost trees | ✅ | tree/campaigns | /admin/campaigns | adapter-ify |
| Referral | ✅ | ✅ | ✅ | ✅ | referrals, codes | /referral | keep |
| Check-in | ✅ | ✅ | ✅ approve flow | ✅ | checkins | /checkin | keep |
| Reviews | ✅ | ✅ | ⚠ | ✅ | reviews | /reviews | keep |
| Events | ✅ | ✅ | ⚠ Pretix-backed | ✅ | tree/pretix | /events | verify Pretix usage |
| Staff management | ✅ | ✅ | ✅ roles+shifts | ✅ | staff, staff_shifts | /admin/staff | keep |
| Inventory | ✅ | ❓ | partial | ✅ | inventory routes/schemas | admin | Phase 4 |
| Notifications (push/telegram/zalo/sms/email) | ✅ | ✅ | ✅ audit logged | ✅ | tree/push, zalo + lib | /admin/broadcasts | keep (port/adapter) |
| Analytics/Reports | ✅ | ✅ | ⚠ metrics + sales-reports split | ✅ | tree/analytics, _metrics | /admin/metrics | Phase 5 consolidate |
| ERPNext sync | ✅ | ✅ | ✅ mapping+sync_log | ✅ | erpnext trees + 5 routes | /admin/erpnext-sync | adapter-ify |
| Auth (JWT, 5 roles) | ✅ | ✅ | ✅ | ✅ | tree/auth + middleware | all | keep |
| Audit logging | ✅ | ✅ | ✅ ADR-0008 | ✅ | audit-logger | /admin/audit-logs | keep |
| Subscriptions/SaaS | ⚠ incubating | ⚠ | mrr + tenants tables, /saas routes | ✅ | subscriptions family | /saas/*, /subscriptions | Phase 5 product call |
| Contact | ✅ | ✅ | ✅ | ✅ | contact_messages | /contact | classify |
| PWA | ✅ | ✅ | ✅ offline queue | ⚠ | src/pwa + offline-queue | app shell | keep |
| SEO | ✅ | ✅ | ✅ | ⚠ | src/seo | all public | keep |
| i18n vi/en | ✅ | ✅ | ⚠ 1833 keys, dup terms | ✅ | src/locales | all | dedupe Phase 2 |
| Design system MD3 | ✅ | ✅ | ✅ ADR-0006 tokens | ✅ | src/md3 + docs | all | consolidate Phase 2 |
| TV Menu | ✅ | ✅ | ✅ | ✅ | menu | /tv-menu | ops surface |
| Chat (customer support) | ⚠ admin chat | ⚠ | partial | ⚠ | admin/chat | /admin/chat | classify |
| Birthday automation | ⚠ config page | ⚠ | partial | ⚠ | admin/birthday-config | admin | classify |
| HomeAssistant / Frigate / Cal-Booking | ✅ | ⚠ internal | niche | ✅ | trees | — | integration adapters |
| Xibo signage | ⚠ docs only | ❌ | — | — | docs/xibo-setup-guide | — | archive or implement later |
| AI Copilots | ❌ | ❌ | — | — | — | — | Phase 6 (deferred per spec) |

## Key findings

1. **Core F&B loop (spec §25 Phase 3) is fully in production**: Menu→Order→Payment→Kitchen→Customer all EXIST+PROD+TEST — migration is port-and-verify, not build
2. **Triplicated surfaces** (track-order, KDS, checkout) need deduplication before apps/ split
3. **Growth features (Phase 5)** exist as v1: loyalty ladder complete, CRM thin, SaaS incubating
4. **Nothing declared AI yet** — consistent with spec §25 Phase 6 deferral
5. Dual product tables (`products`/`menu_items`) and dual payment tables are the schema debts to resolve in Phase 2
