---
date: 2026-09-11
version: 1.0
status: ratified-structure, content-ratification-pending
---
# PRODUCT CONTEXT — what an agent needs to know about AURA

## Product
- **AURA F&B OS**: all-in-one F&B operating system (currently: AURA Space café platform at auraspace.cafe)
- Rebuilding per `AURA_FnB_OS_Rebuild_Master_Spec.md` (master contract)

## Surfaces (spec §5.1)
- `apps/space` — Customer Experience (jobs: discover, explore, order/book, pay, visit, experience, loyalty, return)
- `apps/ops` — Staff/POS/KDS/Operations
- `apps/hq` — Owner/Manager/Analytics

## Languages
- vi-VN canonical (default), en-US secondary. No hard-coded user-facing strings; i18n keys only; terminology via `.ai/context/glossary.vi-en.yaml`

## Personas (Phase 1 ratification pending)
Customer · Waiter · Kitchen staff · Manager · Owner · (SaaS tenant — incubating)

## Core domain jobs (production-verified)
Order (dine-in/takeaway/delivery per-type contract) · Payment (Stripe/NOWPayments/COD, webhook-sync) · Kitchen (KDS + DO broadcast) · Loyalty (4-tier ladder + cashback) · Reservation · QR ordering · Referral · Reviews · Notifications (Telegram/Zalo/push/SMS/email)

## Non-goals / deferred
- AI copilots (spec §25 Phase 6 — after domain contracts stable)
- Multi-tenancy commitment (SaaS tables incubate until Phase 5 decision)
- Microservices extraction (modular monolith preferred, spec §6)

## Source-of-truth artifacts
- Current: `docs/architecture/CURRENT_STATE.md`
- Target: `docs/architecture/TARGET_STATE.md` · `DOMAIN_MAP.md` · `APP_MAP.md` · `REPO_MIGRATION.md`
- Product: `docs/product/FEATURE_MATRIX.md` · `CUSTOMER_JOURNEY.md`
- Deployment: Cloudflare Pages + Workers + D1/KV/DO (ADRs 0001–0010 in docs/06_ADR/ — carry into docs/decisions/)
