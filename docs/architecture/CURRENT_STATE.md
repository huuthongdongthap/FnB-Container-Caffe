---
date: 2026-09-11
version: 1.0
status: discovery (Phase 0)
source: repository audit per AURA_FnB_OS_Rebuild_Master_Spec.md §31
---
# CURRENT STATE — FnB-Container-Caffe (as audited)

## 1. What this system is today

A single-tenant café commerce platform:
- **Frontend**: React 19 + Vite SPA (`src/`), deployed to Cloudflare Pages (`fnb-caffe-container.pages.dev`, prod alias `auraspace.cafe`)
- **Backend**: Hono Worker (`worker/src/`, name `aura-space-worker`) on Cloudflare Workers
- **DB**: D1 (SQLite) — 31 tables (`worker/schema.sql`) + 11 incremental migrations (004–014)
- **Realtime**: Durable Object `OrderBroadcaster` (`worker/src/do/OrderBroadcaster.ts`)
- **Auth**: JWT (KV-backed sessions), 5 roles: customer, staff, waiter, manager, owner (`worker/src/middleware/auth.ts`, `staff-auth.ts`, `staff-roles.ts`)
- **i18n**: i18next, vi + en, 1833 keys each (`src/locales/`), locale-prefixed routing (`[locale]`)

## 2. Scale (verified counts)

| Area | Count | Evidence |
|------|-------|----------|
| FE routes | 85 total (30 public, 29 admin, 21 stitch, 5 mobile) | `src/routes/*.tsx` |
| FE pages | ~54 page components + 41 stitch subpages | `src/pages/` |
| FE hooks | 42 hooks + 17 Zustand stores | `src/hooks/` |
| BE route files | 91 | `worker/src/routes/` |
| BE domain trees | 18 domains / 102 files | `worker/src/tree/` |
| BE middleware | 13 | `worker/src/middleware/` |
| BE schemas (zod) | 11 files | `worker/src/schemas/` |
| Tests | FE 357 files/3249 tests, Worker 151 files/1551 tests | vitest suites |
| D1 tables | 31 in schema + metrics/alerts/SaaS in migrations | `worker/schema.sql` |

## 3. Current architecture shape

```
React SPA (pages-by-page)
  → fetch / hooks → Worker routes (91 files, thin Hono handlers)
    → tree/ domains (18 trees: orders, loyalty, auth, sync, qr, referrals, ...)
      → D1 / KV / DO
    → lib/ clients (ERPNext, Pretix, Mautic, Mixpost, Zalo, SpeedSMS, Resend, Frigate, HomeAssistant, Cal-Booking)
```

Layering exists but is **page-first**: features were added page-by-page
(`PAGE → COMPONENT → API → DB` — the exact tendency the master spec §4 calls out).

## 4. What already matches the target model (KEEP)

- **18 domain trees** in `worker/src/tree/` ≈ embryonic domain layer: orders, loyalty, auth, referrals, subscriptions, campaigns, analytics, qr, push, sync, zalo, mautic, mixpost, pretix, erpnext, homeassistant, cal-booking, integrations
- **Zod schemas** for 11 domains (orders, payments, loyalty, products, staff, tables, inventory, promotions, categories, auth, cron) — contract seeds
- **RBAC**: 5-role JWT + staff-role gates, audit logging (`audit-logger.ts`), rate limiting (ADR-0007)
- **D1 schema**: 31 tables covering Customer/Order/Payment/Loyalty/Reservation/Review/Referral/Checkin/Subscription — the core domain entities already exist
- **Bilingual i18n** with 1833 keys/vi — language system exists, keys not yet consolidated into a glossary
- **ADR discipline**: 10 ADRs in `docs/06_ADR/` (Workers, D1, Hono, JWT, rate limiting, KDS polling, webhook-sync)
- **Runbooks**: deploy-rollback, D1 backup-restore, incident triage in `docs/`
- **Test coverage**: ~4800 tests across FE+BE
- **OpenAPI surface**: `openapi-*.ts` route modules + `@scalar/hono-api-reference`

## 5. What contradicts the target model (problems)

| # | Problem | Evidence | Spec violation |
|---|---------|----------|----------------|
| P1 | Page-first UX — 41 one-off "stitch" landing pages duplicated per feature (luxury-cafe-1, events-1, referral-rewards-1 ×2 variants) | `src/pages/stitch/` | §4, §14: no single BRAND→TOKENS→COMPONENTS pipeline |
| P2 | Business logic leaks into React components and route handlers | `src/hooks/` stores with pricing logic; 91 route files with inline logic | §2 Law 1/3, §10 |
| P3 | No `apps/` separation — customer, staff (KDS), owner share one SPA bundle and one route tree | 85 routes in 4 files, mixed surfaces | §5.1 |
| P4 | ~~Duplicated/legacy tables~~ RESOLVED 2026-09-13: live-D1 verification showed no `_new` duplicates (recreate+rename migrations already unified); 9 verified-empty orphan tables (users_legacy, checkin_log, odoo_*, erpnext_invoices) retired via migration 20260913_02 with DDL preserved in its down-file. Remaining: `subscriptions` in both schema and migrations; payments refund-column apply-state divergence (live table lacks 006's refund columns) | migrations 004–014 vs schema.sql; live sqlite_master 2026-09-13 | §12 duplicate identification |
| P5 | Docs sprawl: 40+ docs at `docs/` root, mixed eras (2025-06 architecture doc describes 11 tables; reality is 31+) | `docs/03_ARCHITECTURE.md` stale | §24 docs explain decisions |
| P6 | No `.ai/` control plane — specs, state, evals scattered or absent | `.ai/` did not exist | §17 |
| P7 | Terminology drift: same concepts have multiple vi keys (`nav.reservations`="Đặt bàn" vs `admin.reservations`="Đặt bàn"; loyalty appears as both "Tích điểm" and "Thành viên") | locale flat-map | §15 NO duplicate terminology |
| P8 | Integrations coupled at route layer (erpnext-*.ts ×5 route files) rather than port/adapter | `worker/src/routes/erpnext*` | §21 |

## 6. Integration inventory (adapters, not business truth)

Payment: Stripe, NOWPayments (subscriptions), COD (migration 014), SePay (docs). Messaging: Telegram (order tree), Zalo, SpeedSMS, Resend (email), web-push. Marketing: Mautic, Mixpost. Ticketing: Pretix. ERP: ERPNext (accounting/CRM/product clients). Other: Frigate (vision), HomeAssistant, Cal-Booking, Xibo (docs).

## 7. Production reality

Deployed 2026-09-11: FE `5b9e8842` (Pages), Worker `92f52c22` (2264 KiB). Cron `*/5`. Bindings: ORDER_BROADCASTER (DO), AUTH_KV, AURA_DB (D1). Prod URL `auraspace.cafe` + workers.dev. No multi-tenancy in prod core; `saas_tenants` tables exist (migration 011) but single-tenant operationally.

## 8. Verdict

The repository is a **working single-tenant F&B commerce system with strong test coverage and embryonic domain layering**, buried under page-first UX duplication and doc drift. It is a migration asset, not a rewrite target. Per spec §3: classify every artifact KEEP / MOVE / MERGE / REWRITE / ARCHIVE before touching code.
