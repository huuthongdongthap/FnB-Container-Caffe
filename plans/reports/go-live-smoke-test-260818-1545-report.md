# Go-Live Smoke Test Report

**Date:** 2026-08-18 | **Branch:** main | **Deploy:** `80c4d9eb`

---

## Summary

| Check | Status | Details |
|-------|--------|---------|
| Health | ✅ | Worker responding 200 OK |
| Menu | ✅ | 49 items, 10 categories |
| Register | ✅ | New customer created (fixed missing `email_verifications` table) |
| Login | ✅ | JWT issued, role=customer |
| Auth Me | ✅ | Session valid, user profile returned |
| Order Create | ✅ | Order created with COD payment method |
| Promo Validate | ✅ | WELCOME 10% valid, AURA20 expired |
| Custom Domain | ✅ | `auraspace.cafe` serving production (SHA matched) |

---

## Issues Fixed

### 1. Missing `email_verifications` table (BLOCKER)
- **Root cause:** Auth register route referenced `email_verifications` table that was never created in D1
- **Fix:** Created migration `worker/db/migrations/20260818_01_email_verifications.sql` and deployed to D1
- **Impact:** Customer self-registration was broken — now working

### 2. AURA20 promo expired
- **Status:** `starts_at` / `ends_at` window passed — not a code bug, data maintenance needed
- **Action:** Update promo validity window or remove from DB

---

## Go-Live Readiness

| Category | Status |
|----------|--------|
| Frontend (SPA) | ✅ LIVE at `auraspace.cafe` |
| Backend (Worker) | ✅ LIVE, all endpoints responding |
| Auth (register/login/me) | ✅ Working |
| Menu + Categories | ✅ 49 items, 10 categories |
| Orders | ✅ Create + list working |
| Promotions | ✅ 3 active promos (WELCOME, AURA10, AURA20-expired) |
| Custom Domain | ✅ `auraspace.cafe` — SSL, SPA routing |
| D1 Database | ✅ 39 tables, migration deployed |

---

## Remaining Owner Actions

| Action | Priority | Notes |
|--------|----------|-------|
| PayOS production secrets | HIGH | `wrangler secret put PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY` |
| PayOS webhook URL | HIGH | Configure at my.payos.vn → `https://aura-space-worker.../api/webhook/payos` |
| Update AURA20 promo expiry | LOW | Recreate with future `ends_at` |
| Seed admin owner account | MEDIUM | Run `seed-admin.js` with KV namespace ID |

---

## Deployment

- **Frontend:** Cloudflare Pages → `8839504e` (latest deploy)
- **Worker:** `aura-space-worker` → deployed to `sadec-marketing-hub.workers.dev`
- **Custom Domain:** `auraspace.cafe` ✅ live
- **D1 Migration:** `20260818_01_email_verifications.sql` deployed ✅

---

*Report generated: 2026-08-18 15:50 ICT*
