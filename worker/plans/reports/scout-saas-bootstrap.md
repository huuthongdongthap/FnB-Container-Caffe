# Scout Report — SaaS Bootstrap for FnB Container Caffe

**Project:** `fnb-caffe-worker` (deployed as `aura-space-worker`)  
**Runtime:** Cloudflare Workers (Hono v4, TypeScript)  
**DB:** Cloudflare D1 (`fnb-caffe-db`) — 13 migrations applied  
**kv:** `AUTH_KV` — `5628adf57f1548b5af615de4e9021893`  
**Durable Object:** `OrderBroadcaster` (realtime order fan-out)  
**Current build state:** 38 TS compilation errors — `dist/index.js` stale (Jun 6 build never rebuilt after Aug 4 source updates)

---

## 1. PROJECT TYPE

Monolithic Cloudflare Worker acting as backend for an F&B cafe platform ("Aura Space"). Single Hono router with ~60 route files mounted in `src/index.ts`. Deployed via `wrangler deploy` with SHA verification (`deploy-with-sha.sh`). Cron trigger runs every 5 min (`SLA_THRESHOLD_MINUTES`). Durable Object for realtime WebSocket order stream.

---

## 2. EXISTING ROUTES (RELEVANT TO SAAS BOOTSTRAP)

| Route file | Purpose |
|---|---|
| `src/routes/saas-tenants.ts` | Multi-tenant table — `saas_tenants` (id, slug, tier, status trial/active/suspended) |
| `src/routes/saas-pricing.ts` | Pricing plans — `saas_pricing` table (VND/USD, bilingual vi/en) |
| `src/routes/subscriptions.ts` | Subscription CRUD |
| `src/routes/payments.ts` / `payments-nowpayments.ts` | NOWPayments integration (primary) |
| `src/routes/admin-auth.ts` | Admin/staff auth with JWT + KV session store |
| `src/routes/auth.ts` / `auth-register.ts` | Owner registration, staff bootstrap |
| `src/routes/tenant.ts` | Tenant middleware extraction |
| `src/routes/admin-audit-logs.ts` | Audit trail |
| `src/routes/admin-loyalty.ts` / `loyalty.ts` | Loyalty/cashback schema |

The SaaS tables (`saas_pricing`, `saas_tenants`) exist in migrations 010/011 and have route stubs — **not yet wired end-to-end**. No payment webhook handler for IPN → tier activation flow currently.

---

## 3. MIDDLEWARE CHAIN

`src/middleware/` — 9 files:
- `auth.ts` — `requireAuth` / `requireAdmin` guards
- `tenant.ts` — tenant slug resolution (`c.subdomain` or header)
- `tier-gate.ts` — plan-tier enforcement
- `rate-limit.ts` / `rate-limit-login.ts` — per-IP throttling
- `audit-log.ts` — write audit to D1
- `cors.ts` — wildcard in prod (`*`)
- `error-handler.ts` — top-level catch
- `logger.ts` — structured logging (no `console.log`)

---

## 4. DATABASE SCHEMA FLAVOR

All prices in **integers (VND smallest unit)**. Dual-currency columns exist on `saas_pricing` (`price_vnd`, `price_usd`). Schema.sql has 4 core F&B tables (`orders`, `customers`, `menu_items`, `payments`). Migrations extend with ERPNext sync, refunds, push notifications, staff roles. `loyalty_tier` uses text enum (`bronze/silver/gold/platinum`) — must NOT conflict with new SaaS tier enum (`BASIC/PREMIUM/ENTERPRISE/MASTER` as documented in parent CLAUDE.md, but worker code uses lowercase — risk of inconsistency).

---

## 5. INTEGRATION CLIENTS (src/clients/)

External service wrappers already in place:
- `erpnext-client.ts` / `*-accounting` / `*-crm` / `*-product` — ERPNext integration (mock mode supported)
- `frigate-client.ts` — camera/NVR
- `tastyigniter-client.ts` — POS/order system
- `resend-client.ts` — email (Resend)
- `speedsms-client.ts` — SMS (SpeedSMS Vietnam)
- `pretix-client.ts` — ticketing/events

---

## 6. EXTERNAL TOOLS BOUND (wrangler.toml bindings + env)

| Binding | Purpose |
|---|---|
| `AURA_DB` (D1) | Primary database |
| `AUTH_KV` (KV) | Auth credential cache |
| `ORDER_BROADCASTER` (DO) | Realtime WebSocket fan-out |
| Secrets (wrangler secret) | `JWT_SECRET`, `JWT_EXPIRY`, `RESET_KEY`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` |

Env vars in `.env.example`: PayOS, Telegram, Resend, SpeedSMS, Zalo OA, Mautic, ERPNext, Pretix, Cal.com, Xibo, VAPID, CRON_SECRET.

---

## 7. TESTS

Vitest config present (`vitest.config.ts`). Test directories:
- `src/__tests__/` — unit tests for routes, middleware, auth, orders, inventory, security
- `test-results/.last-run.json` — last CI run tracked

Current state unclear — likely failing due to stale dist (38 TS errors). No dedicated SaaS bootstrap tests exist.

---

## 8. EXISTING PLANS / DOCS AFFECTING SAAS SCOPE

| File | Relevance |
|---|---|
| `docs/03_ARCHITECTURE.md` (47KB) | Full system design — read before any architecture decision |
| `docs/04_ROADMAP.md` | Delivery phases — may collide with sprint |
| `docs/08_BUSINESS_MODEL.md` | Pricing/tier rationale |
| `docs/13_CHANGELOG.md` | Track inconsistencies before adding new features |
| `plans/260804-0001-typescript-audit-cleanup/` | **Active plan** — fixing 38 TS compilation errors. This MUST complete first or will block any new code. |
| `plans/260801-1826-8-month-delivery-breach/` | Delivery timeline pressure — context for scope decisions |
| `fix-summary.md` | Lists specific TS fixes needed in `auth-verify.ts` and others |

---

## 9. SCOPE RISKS / GOTCHAS

1. **Tier enum mismatch:** Parent CLAUDE.md mandates `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase), but worker migrations/source use lowercase `trial`, `basic`. Must reconcile before wiring tenant→tier flow.
2. **Payment provider locked to PayOS:** `.env.example` only has PayOS. NOWPayments shim exists but no PayOS webhook handler. If SaaS billing needs IPN, must add `payments-webhook.ts` route.
3. **Multi-tenant isolation not enforced in middleware:** `tenant.ts` resolves slug but `saas-tenants.ts` route doesn't scope queries — every tenant sees all data unless route adds `WHERE tenant_id = ?`.
4. **Stale build blocks everything:** 38 TS errors in `dist/index.js`. New code cannot deploy until audit-cleanup plan completes.
5. **No i18n layer:** Parent project (Sophia) uses `next-intl`. This worker has no i18n — `name_vi`/`name_en` column pattern in `saas_pricing` suggests intent, but no helper exists.
6. **Subscription status limited:** `status TEXT DEFAULT 'trial'` — no enum constraint, no state machine for `trial→active→past_due→canceled`.

---

## 10. SCOPE AFFIRMATION (FROM EXISTING ARTIFACTS)

| Capability | Status |
|---|---|
| D1 + KV bound | Done |
| JWT auth scaffold | Done |
| Tenant table schema | Done (migration 011) |
| Pricing table schema | Done (migration 010) |
| Route stubs | Exists but thin (~30-50 lines each) |
| Payment webhook → tier activation | **Not implemented** |
| Billing cron / dunning | **Not implemented** |
| Tenant onboarding flow | **Not implemented** |
| Email verification for signup | Partial (`auth-verify.ts`, migration 012) |

---

## 11. RECOMMENDED FIRST ACTIONS

1. Complete `plans/260804-0001-typescript-audit-cleanup` and redeploy cleanly.
2. Normalize tier enum: add `tier` CHECK constraint or app-level enum in `src/types/models.ts`.
3. Add `payments-webhook.ts` route for PayOS IPN → `saas_tenants.status = 'active'`.
4. Wire tenant-scoping in `tenant.ts` middleware before sprinting on features.
5. Do NOT touch Sophia AI Factory (`apps/sophia-ai-factory/`) — different project, different deploy target.

---

_Scout completed. Target: SaaS bootstrap for F&B — lower-risk path is fixing compile errors first, then completing the subscription/payment wiring on existing tables._  
_REPORT_EOF
echo "DONE"