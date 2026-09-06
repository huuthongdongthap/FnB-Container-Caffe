# API Layer Audit — AURA CAFE (FnB-Container-Caffe)

**Command:** `api --audit` · **Pipeline:** architecture-review · **Date:** 2026-08-25
**Scope:** `worker/src/` (Hono on Cloudflare Workers, D1, KV, DO), FE client layer `src/`
**Auditor:** ox-alpha (static analysis; no runtime traffic replayed)

---

## Executive Summary

The API surface is large (**~296 unique method+path pairs** across **86 route files**, plus a `/api/v1` alias that mirrors everything) and sits on a fundamentally sound Hono foundation: a proper global error boundary (`middleware/error-handler.ts`), correlation IDs, request metrics, an origin allowlist for CORS, near-universal parameterized SQL, structured logging with **zero** `console.*` in route code, and rate limits on the two highest-risk money paths.

However, the audit found **3 P0 issues** that undermine the security model:

1. **The entire billing/subscriptions API is publicly writable** — 17 endpoints (plan CRUD, invoice generation/payment, MRR stats) are mounted with **no authentication whatsoever**.
2. **Full customer PII is publicly listable** via `GET /api/customers` (names, phones, emails, tiers, search, pagination) with no auth.
3. **The frontend/backend auth transports disagree**: the FE believes auth rides on httpOnly cookies (`credentials:'include'`, "backend sets access_token cookie"), while the Worker exclusively reads `Authorization: Bearer` and **contains zero cookie-handling code** — meaning every authenticated call made through `apiFetch()` cannot carry credentials the backend accepts.

Beyond the P0s: multi-tenant scoping is trivially spoofable (`X-Tenant-Id` trusted blindly), ~14% of admin-capable endpoints lack any role gate, zod validation covers only ~21% of route files, response envelopes are split three ways (`success:` / `ok:` / ad-hoc), and there are at least **5 confirmed FE↔BE contract breaks** including a dead telemetry endpoint (`/api/errors`) silently discarding client error reports.

**Security posture: 4/10** — strong engineering hygiene underneath, critical exposure holes on top.

| Metric | Value |
|---|---|
| Route files analyzed | 86 (+ `index.ts`) |
| Endpoint registrations | ~318 (≈296 unique; orders router double-mounted; `/api/v1` mirrors all) |
| Explicitly auth-protected | ~205 (~69%) |
| Signature/secret-verified (webhooks, cron) | ~12 (~4%) |
| Intentionally public (catalog, telemetry, booking) | ~38 (~13%) |
| **Public but should NOT be (missing auth)** | **~41 (~14%)** |
| Route files using zod | 18 / 86 (**21%**) |
| Files on `success:` envelope | 62 (72%); `ok:` 5; ad-hoc 20 |
| FE↔BE mismatches confirmed | 5 |
| SQL injection vectors found | 0 exploitable (1 fragile-but-safe dynamic site) |

---

## Route Map

Legend — Auth: 🔒 `requireAuth/requireStaff` role gate · 🎫 signature/secret · 🌐 public by design · ❌ **public, should be protected**
Valid.: ✅ zod schema · ⚠️ manual/ad-hoc · ➖ none needed (read-only)

### Top-level mounts (`worker/src/index.ts`)

| Method | Path | Handler | Auth | Valid. |
|---|---|---|---|---|
| GET | `/api/menu`, `/api/menu/:id` | routes/menu.ts | 🌐 | ⚠️ query params manual |
| POST | `/api/orders` | tree/orders/create-order | 🌐 + IP rate-limit (KV 5/10min) | ⚠️ |
| POST/GET/PATCH | `/api/orders(/split,/latest,:id)` | tree/orders/* | PATCH 🔒 owner,staff; rest 🌐 | ⚠️ |
| * | `/api/orders/*` (checkout, guest-checkin, guest-checkout, my-orders, :id, :id/status, :id/mark-cod-paid) | routes/orders-hono.ts (mounted 201) | mixed 🔒/🌐 | ✅ partial (validators lib) |
| * | `/api/kds/orders/*` | routes/orders-hono.ts (**same router re-mounted**) | 🔒 owner,staff (use 191) | ✅ partial |
| GET | `/api/realtime/:channelId` | routes/realtime-orders.ts (DO WS) | 🌐 | ➖ |
| GET | `/api/admin/orders`, `/api/admin/customers` | routes/admin-handlers.ts | 🔒 via `/api/admin/*` use (204) | ⚠️ page/limit parseInt |
| GET | `/api/admin/payments/stuck` | routes/admin-handlers.ts | 🔒 owner | ➖ |
| GET | `/api/stats` | tree/orders/stats | 🔒 owner,staff (211) | ➖ |
| POST/GET | `/api/auth/register,login,verify-email,reset-password,change-password,logout,me,session` | routes/auth-register/auth-session/auth-verify, tree/auth/* | 🌐 + IP rate-limit 20/5min | ✅ (bootstrapOwnerSchema et al.) |
| POST/GET | `/api/auth/register-staff,staff` | tree/auth/* | 🔒 owner + audit() | ✅ |
| POST | `/api/auth/bootstrap-owner` | tree/auth/bootstrap.ts | 🌐 (one-time: 409 if owner exists) | ✅ |
| * | `/api/payment`, `/api/payments` | routes/payments.ts, refunds.ts | 🔒 customer/owner/staff | ✅ partial |
| * | `/api/push` | routes/push.ts | subscribe/unsubscribe/key 🌐; send-staff 🔒 owner | ⚠️ |
| * | `/api/webhook/payos`, `/api/webhooks/nowpayments`, `/api/webhooks/cal-booking` | routes/webhooks.ts, payments-nowpayments.ts, cal-booking-webhook.ts | 🎫 PayOS/NowPayments HMAC, cal secret | ✅/⚠️ |
| * | `/api/categories`, `/api/products` | routes/categories.ts, products.ts | reads 🌐; writes 🔒 owner + audit | ⚠️ |
| * | `/api/tables`, `/api/qr` | routes/tables.ts | reads/QR 🌐; occupy/release/status 🔒 owner,staff + audit | ⚠️ |
| * | `/api/table-sessions` | routes/table-sessions.ts | 🔒 owner,staff,manager (246) | ⚠️ |
| * | `/api/menu-modifiers` | routes/menu-modifiers.ts | ❌ **NO GUARD — 13 endpoints incl. POST/DELETE** | ✅ partial |
| * | `/api/kitchen-stations` | routes/kitchen-stations.ts | ❌ **NO GUARD — 10 endpoints incl. POST/DELETE** | ⚠️ |
| * | `/api/floor-plan` | routes/floor-plan.ts | 🔒 owner,staff,manager (file-level use:34) | ⚠️ |
| POST | `/api/client-error` | routes/client-errors.ts | 🌐 (truncates inputs) | ⚠️ |
| * | `/api/staff-tips` | routes/staff-tips.ts | 🔒 owner,staff,manager (file use:26) | ⚠️ |
| * | `/api/admin/qr` | routes/admin-qr.ts | 🔒 via `/api/admin/*` | ⚠️ |
| * | `/api/reservations` | routes/reservations.ts | availability/create 🌐; manage 🔒 owner,staff | ✅ partial |
| GET | `/api/customers` | routes/customers.ts:185 | ❌ **NO GUARD — full PII list** | ⚠️ |
| GET/PATCH | `/api/customers/me` | routes/customers.ts | 🌐 (phone-header based?) | ⚠️ |
| * | `/api/pos/customer` | routes/pos-customer.ts | 🔒 requireStaff all roles (file:16) | ⚠️ |
| * | `/api/promotions` | routes/promotions.ts | validate/redeem 🌐; CRUD 🔒 owner | ✅ partial |
| * | `/api/signage` | routes/signage.ts | 🌐 (digital-signage feeds) | ➖ |
| * | `/api/pretix` | routes/pretix.ts | webhook 🎫 HMAC; rest 🌐 (events/orders/checkin/generate) | ⚠️ |
| * | `/api/shifts` | routes/shifts.ts | 🔒 owner,staff (all 4) | ⚠️ |
| * | `/api/subscriptions` | routes/subscriptions.ts | ❌ **NO GUARD — 17 billing endpoints** (plans CRUD, invoice pay/generate, MRR, cancel/pause/resume) | ⚠️ |
| GET | `/api/subscriptions/invoices/:id/receipt` | routes/subscription-receipt.ts | 🔒 owner,customer (263) | ➖ |
| * | `/api/campaigns` | routes/campaigns.ts | 🔒 owner,staff (file use:80) | ✅ partial |
| * | `/api/broadcast` | routes/broadcast.ts | 🔒 owner,staff (265) | ⚠️ |
| * | `/api/chat` | routes/chat.ts | POST messages 🌐; conversations/history 🔒 owner,staff | ⚠️ |
| * | `/api/analytics` | routes/analytics-hono.ts | 🔒 owner,staff (270); payout 🔒 owner | ⚠️ |
| POST | `/api/vitals` | routes/vitals.ts | 🌐 sendBeacon | ⚠️ |
| * | `/api/reviews`, `/api/contact` | routes/reviews.ts, contact.ts | 🌐 (contact rate-limited internally) | ⚠️ |
| * | `/api/loyalty`, `/loyalty/referral`, `/loyalty/birthday`, `/loyalty/checkin` | routes/loyalty.ts, referrals.ts, birthday.ts, checkin.ts | custom `authCustomer` phone-session (tree/loyalty/auth-middleware); approve/reject 🔒 | ⚠️ |
| * | `/api/admin/loyalty` | routes/admin-loyalty.ts | 🔒 via `/api/admin/*` | ⚠️ |
| * | `/api/reports` | routes/reports.ts | 🔒 owner,staff (296) | ⚠️ date params manual |
| * | `/api/inventory` | routes/inventory/{crud,transactions,snapshots}.ts | 🔒 read: owner,staff,customer / write: owner,staff (300) | ✅ (schemas.ts) |
| GET | `/api/health`, `/api/version` | routes/health.ts, version.ts | 🌐 | ➖ |
| * | `/api/admin/dindin` | routes/dindin.ts | 🔒 via `/api/admin/*` (envelope: `ok:` mixed) | ⚠️ |
| GET | `/api/admin/sales/csv` | routes/admin-sales.ts | 🔒 via `/api/admin/*` | ⚠️ |
| GET | `/api/admin/metrics` | routes/admin-metrics.ts | 🔒 via `/api/admin/*`; internal role recheck | ➖ |
| GET | `/cron/alerts`, `/cron/digest` | routes/cron-admin.ts:51,62 | 🎫 shared cron secret — **but mounted outside `/api`** | ➖ |
| POST | `/api/test/telegram-sim`, `/api/test/zalo-zns`, `/api/admin/zalo/send-expiry-warnings` | routes/cron-admin.ts:78,112,130 | 🔒 owner + audit | ⚠️ |
| * | `/api/erpnext*`, `/api/erpnext-pos`, `/api/erpnext-invoices`, `/api/erpnext/sync/*`, `/api/erpnext/{customers,vendors,expenses}` | routes/erpnext*.ts, erpnext/* | 🔒 owner (334) / owner,staff for sync | ✅ zod confParsed (erpnext.ts:73) |
| GET | `/api/public/products/:productId/availability` | routes/erpnext-pos.ts (via 358) | 🌐 | ➖ |
| * | `/api/mixpost` | routes/mixpost.ts | 🔒 owner,staff (380) | ⚠️ |
| * | `/api/mautic-bridge` | routes/mautic-bridge.ts | 🔒 owner (386) | ⚠️ |
| * | `/api/zalo` | routes/zalo.ts (lazy import) | 🔒 owner (392) | ⚠️ |
| * | `/api/ha` | routes/homeassistant/index.ts | custom HA `auth` middleware (all 6) | ⚠️ |
| * | `/api/integrations/tastyigniter`, `/api/integrations/frigate` | routes/integrations/* | 🔒 owner,staff (401,405) | ⚠️ |
| * | `/api/saas/pricing` | routes/saas-pricing.ts | 🌐 | ➖ |
| * | `/api/saas/tenants` | routes/saas-tenants.ts | 🔒 + tenantMiddleware (463) — **spoofable, see F-04** | ⚠️ |
| POST | `/mobile/login`, `/mobile/refresh` | routes/staff-auth.ts | 🌐 device-token flow | ✅ |
| GET | `/mobile/me` | routes/auth-session.ts | 🌐 Bearer-checked inside | ⚠️ |
| * | `/mobile/devices`, `/mobile/kds`, `/mobile/notifications`, `/mobile/tables`, `/mobile/orders` | routes/*-mobile.ts | 🔒 requireStaff (417–448) — except notifications GET `/` & POST `/subscribe` **uncovered** | ⚠️ |
| GET | `/sw-mobile.js` | index.ts:456 | 🌐 static stub | ➖ |
| * | `/api/v1/**` | alias → rewrite to `/api/**` (473–481) | inherits; emits deprecation header | — |

---

## Findings

| ID | Sev | Area | Description | Evidence | Recommendation |
|---|---|---|---|---|---|
| F-01 | **P0** | AuthZ | Entire subscriptions/billing router public: 17 endpoints — create/update plans, generate & pay invoices, MRR trend, cancel/pause/resume subs. Zero `requireAuth` in file; mounted bare. | `worker/src/routes/subscriptions.ts:20–40`; `worker/src/index.ts:262` | Wrap: `app.use('/api/subscriptions/*', requireAuth(['owner']))` before mount (receipt route already separately gated at index.ts:263). Split public plan-reads (`GET /plans`) into `/api/saas/pricing`. |
| F-02 | **P0** | AuthZ/PII | `GET /api/customers` lists all customers (name/phone/email/tier) with search+pagination — no auth. One curl dumps the entire CRM. | `worker/src/routes/customers.ts:185–215` | Gate behind `requireAuth(['owner','staff'])`; keep `/me` public-with-phone-session. |
| F-03 | **P0** | AuthN contract | FE authenticates via assumed httpOnly cookie (`credentials:'include'`; comment claims "Backend sets access_token cookie") but Worker has **zero** cookie code — `getAuthToken()` reads only `Authorization: Bearer`. `apiFetch()` never attaches a token ⇒ every protected call from the web app is unauthenticated (401) or relies on undefined behavior. | `src/lib/api-client.ts:69–81`; `src/hooks/stores/use-auth-store.ts:5–6,34–42`; `worker/src/lib/jwt.ts:getAuthToken`; repo-wide grep "cookie" in `worker/src` = 0 hits | Decide one transport: (a) implement Set-Cookie in login/logout + cookie parsing in `getAuthToken` (with CSRF token), or (b) store JWT in memory and attach `Authorization` header in `apiFetch`. Add integration test asserting a logged-in FE call reaches a protected route. |
| F-04 | **P1** | Multi-tenancy | `tenantMiddleware` trusts client header verbatim: first branch does `c.set('tenantId', req.header('X-Tenant-Id'))` with no ownership check ⇒ any authenticated user can act as any tenant on `/api/saas/tenants/*`. | `worker/src/middleware/tenant.ts:15–21` | Only accept header for platform-admin role; otherwise resolve strictly from verified JWT payload (`user.tenantId`) and cross-check membership table. |
| F-05 | **P1** | AuthZ | Kitchen configuration fully public: create/delete stations & category mappings, ticket start/ready actions (10 endpoints, incl. destructive DELETEs). | `worker/src/routes/kitchen-stations.ts:77–243` (no `requireAuth` anywhere in file) | Add file-level `kitchenStationsRouter.use('/*', requireAuth(['owner','staff','manager']))`; keep `GET /:id/tickets` optionally staff-scoped. |
| F-06 | **P1** | AuthZ | Menu modifier groups/choices & happy-hour scheduling publicly writable/deletable (13 endpoints). Happy-hour windows directly alter prices shown to guests. | `worker/src/routes/menu-modifiers.ts:66–262` (no guard) | Same pattern: router-level `use(requireAuth(['owner','staff']))`, leaving `GET /happy-hour/now` public for POS pricing display. |
| F-07 | **P1** | Contract drift (FE→BE) | FE reports client errors to `POST /api/errors` — endpoint doesn't exist (real route is `/api/client-error`). All window.onerror + API failure telemetry is silently discarded (fire-and-forget, no retry). | `src/lib/api-client.ts:44–59`; `src/components/shared/ErrorBoundary.tsx:40–43`; backend `worker/src/index.ts:251`, `worker/src/routes/client-errors.ts:14` | Point FE at `/api/client-error` (or add alias route). Add a contract test enumerating FE-called paths against the route table. |
| F-08 | **P1** | Contract drift (FE→BE) | Additional dead/mismatched FE calls: `/api/dashboard/overview` (no such backend route; dashboard uses `/api/stats` + `/api/analytics`), `/api/admin/checkins` (backend is `/api/loyalty/checkin` + `/api/checkins` approve/reject live under `/api/loyalty/checkin/:id/approve`), `/api/admin/erpnext-sync/*` (backend mounts `/api/erpnext/sync/*`). | FE greps: `src/pages/admin/*` (dashboard/overview), checkins calls; backend `worker/src/index.ts` (no dashboard route), `worker/src/index.ts:293`, `worker/src/routes/erpnext-sync.ts:26` | Fix FE paths; introduce generated typed client from a single source of truth (see F-14). |
| F-09 | **P1** | Error UX contract | FE extracts `body.message` from failures, but the standard envelope is `{success:false, error, detail}` ⇒ users always see generic "Request failed: 400" instead of the Vietnamese field messages the backend carefully produces. | `src/lib/api-client.ts:90–94` vs `worker/src/middleware/error-handler.ts:32–49` | Map `body.error ?? body.detail ?? body.message`; propagate `fields[]` from zod errors into form UIs. |
| F-10 | **P1** | Config drift | Three different hardcoded production worker origins coexist: `aura-space-worker.agencyos-openclaw.workers.dev`, `aura-space-worker.sadec-marketing-hub.workers.dev`, `http://localhost:8787`. Two different accounts ⇒ whichever builds last wins; mobile/offline clients may post to a stale deployment. | `src/lib/api-client.ts:3`; `src/hooks/use-mobile-auth.tsx:79,108,135`; `src/hooks/use-offline-sync.ts:11`; `src/pages/admin/DinDinCheckout.tsx:26`; `src/pages/admin/DinDinMenu-constants.ts:3` | Single `VITE_API_BASE` from `.env.production` (fail build if unset); remove inline fallbacks; add smoke test hitting `/api/version` and comparing `GIT_COMMIT_SHA` (already exposed at `wrangler.toml`). |
| F-11 | **P1** | Validation | zod on only 18/86 route files (~21%). Most POST/PUT bodies parsed with `await c.req.json<T>()` casts or manual `if (!body.x)` checks — type assertions, not validation. High-risk examples: promotions redeem/validate, loyalty redeem/spend-cashback, table-sessions, dindin checkout, staff-tips assign. | grep `from 'zod'` = 18 files; contrast `worker/src/lib/validators.ts` (good central schemas, under-used); e.g. `worker/src/routes/table-sessions.ts:95`, `routes/promotions.ts:164–215` | Mandate schema-per-endpoint in `lib/validators.ts`; reject unknown fields; lean on existing global ZodError→400 mapping (`error-handler.ts:26–41`) which already renders field errors. |
| F-12 | **P1** | Rate limiting | Limits exist only on `POST /api/orders` (5/10min/IP), auth endpoints (20/5min/IP) and `guest-checkin`. Everything else — customer search, promotions redeem, loyalty phone-auth, contact — unthrottled; combined with F-02/F-06 enables scraping/brute-force. `middleware/rate-limit-login.ts` exists but is imported nowhere (dead code); `rateLimitMiddleware` used once (`orders-hono.ts:247`). | `worker/src/index.ts:170–182,215–224`; `worker/src/middleware/rate-limit.ts` usage scan; unused `middleware/rate-limit-login.ts` | Apply `rateLimitMiddleware` to: `/api/customers*`, `/api/loyalty/*`, `/api/promotions/validate|redeem`, `/api/contact`, `/mobile/login`. Delete or wire `rate-limit-login.ts`. Note KV-based counters are eventually-consistent — consider Durable Object limiter for strictness. |
| F-13 | **P2** | Surface area | `ordersHonoRouter` mounted twice (`/api/kds/orders` **and** `/api/orders`) exposing checkout/guest-checkin/my-orders under the KDS prefix too; plus legacy `POST /api/orders` (tree handler) coexists with `POST /api/orders/checkout` (hono router) — two order-creation paths with different validation/envelopes. | `worker/src/index.ts:184,191–192,200–201`; `worker/src/routes/orders-hono.ts:84,153,247,377,403` | Mount KDS-specific subset (`/kds`, `/:id/status`) only; consolidate creation on one endpoint; keep legacy path with deprecation header like the `/api/v1` mechanism. |
| F-14 | **P2** | Spec/tooling | No OpenAPI spec anywhere (config/ holds only `brand.json`; zero openapi/swagger references in worker or docs). Route truth lives implicitly in 86 files ⇒ drift like F-07/F-08 is undetectable by CI. | `find config docs worker/src -name '*openapi*'` = ∅ | Adopt `@hono/zod-openapi` or generate spec from route table; publish `docs/openapi.yaml`; CI diff-check FE fetch paths against spec. |
| F-15 | **P2** | Consistency | Response envelopes split three ways: `{success,data}` (62 files) vs `{ok,...}` (5 files — `dindin.ts` mixes **both** styles in one file) vs ad-hoc (20 files: cron `{fired}`, health `{status}`, raw arrays). Status codes are otherwise sane (400/404/500/401/201/409/403 dominant; no rogue codes — earlier 255/100 hits were false positives from `.slice(0,255)`). | `rg 'success:'`=62 files; `[,{ ]ok:`=5 (`routes/dindin.ts`, `push.ts`, `cron-admin.ts`, …); neither-list incl. `orders.ts`, `subscriptions.ts`, `vitals.ts`, `webhooks/momo.ts` | Codify `ApiResponse<T>` helper in `lib/`; migrate `dindin.ts` first (it also serves admin UI); leave telemetry/webhook raw shapes exempted by convention doc. |
| F-16 | **P2** | Headers | No security headers on API responses (no CSP/X-Frame-Options/HSTS middleware; `_headers` covers only Pages static hosting). CORS itself is a solid regex allowlist with credentials:true — but `wrangler.toml [vars] CORS_ORIGIN="*"` is dead config inviting future misuse. | `worker/src/index.ts:129–150` (good); repo-wide grep secureHeaders/XFO/CSP in worker = ∅; `worker/wrangler.toml` vars block | Use `hono/secure-headers` globally; delete `CORS_ORIGIN="*"` var or wire it into the allowlist builder. |
| F-17 | **P2** | Naming/versioning | Versioning exists but is cosmetic: `/api/v1` is a rewrite shim over identical handlers (good back-compat story, deprecation header emitted), yet cron endpoints live **outside** `/api` (`/cron/alerts`, `/cron/digest`) and mobile APIs live at root `/mobile/*` — three namespaces, one version. Mixed singular/plural (`/api/payment` vs `/api/payments`; `/api/client-error` singular). | `worker/src/index.ts:469–481` (v1 shim — praise); `routes/cron-admin.ts:51,62`; mounts at 239–240 | Move cron under `/api/cron/*` (secret still required); rename `/api/payment`→`/api/payments`; document namespace rules in AGENTS.md. |
| F-18 | **P2** | Mobile guard gap | Under `/mobile/notifications`, only `/:id/read` gets `requireStaff`; `GET /` and `POST /subscribe` run bare. Handlers do `c.get('user')` which will be `undefined` ⇒ likely 500s rather than leaks, but the invariant is enforced nowhere. | `worker/src/index.ts:433–438`; `worker/src/routes/notifications-mobile.ts:16,69,102` | Guard whole sub-app: `mobileNotifs.use('*', requireStaff([...]))`. |
| F-19 | **P2** | SQLi posture (informational) | Queries are parameterized throughout (bind()-style) — no exploitable injection found. One dynamic-SQL site builds SET clauses by joining **static literal strings** with values always bound — safe today, fragile tomorrow. LIKE wildcards from user search are bound parameters (safe, though `%` injection widens match — acceptable). | sole dynamic site: `worker/src/tree/subscriptions/sub-handlers.ts:276`; clean scans for `ORDER BY ${`/`LIMIT ${`/concat-prepare | Allowlist column names explicitly at sub-handlers.ts:276 + comment marking the invariant; add eslint rule banning template literals inside `prepare(`. |
| F-20 | **P2** | Token lifecycle | Web JWTs: HS256, exp checked, KV revocation list (`revoked:<token>`) — solid. But 7-day TTL with no refresh/rotation on the web side (mobile staff flow has refresh); logout revocation depends on exact token string reaching KV. `alg` confusion impossible (header ignored during verify — fixed HMAC). Bootstrap-owner correctly one-shot (409 when owner exists). | `worker/src/lib/jwt.ts` (verifyJWT/getAuthToken); `worker/wrangler.toml JWT_EXPIRY_SECONDS=604800`; `worker/src/tree/auth/bootstrap.ts:20–28` | Shorten web access token to ≤1h + silent refresh; consider jti for revocation instead of full-token keys (KV key size). |

### Positive observations (keep)
- Global error boundary maps ZodError→400 with field list, AppError→status, unknown→generic 500 **without stack leak** (`middleware/error-handler.ts`).
- Structured logging + correlation-ID echo (`X-Request-ID`) + non-blocking metrics pruning on cron (`index.ts:152–160`, `scheduled`).
- CORS regex allowlist with credential support and explicit method/header lists (`index.ts:130–150`).
- `audit()` trail on sensitive mutations (order status, product CRUD, staff mgmt, refunds, telegram sims).
- Inventory module is the consistency exemplar: role-split READ/WRITE constants, zod schemas, snapshots (`routes/inventory/*`).
- Zero `console.*` in routes; PBKDF2 password hashing with legacy SHA-256 fallback documented in jwt.ts.

---

## Security Assessment

| Dimension | Rating | Notes |
|---|---|---|
| Authentication | 5/10 | Solid JWT primitives (HS256 verify, exp, revocation KV) undermined by F-03 transport mismatch; 7-day tokens; no refresh for web. |
| Authorization | 3/10 | ~69% endpoints role-gated and role model (owner/manager/staff/waiter/customer) is coherent — but 41 endpoints (~14%), **including the entire billing API and CRM dump**, are anonymous (F-01, F-02, F-05, F-06, F-18). |
| Multi-tenancy | 2/10 | Present in SaaS layer only; identity comes from a client-supplied header (F-04). Core FnB routes are effectively single-tenant (acceptable for single-café phase, dangerous for Phase 5 ambitions). |
| Input validation | 3/10 | 21% schema coverage; global ZodError handling exists but most handlers never emit ZodError. Parameterized SQL everywhere (excellent); body trust is the weak link. |
| Transport/headers | 5/10 | Good CORS allowlist; missing security headers; dead `CORS_ORIGIN="*"` landmine. |
| Abuse resistance | 4/10 | Money paths limited; long tail unthrottled; one limiter implementation duplicated (inline KV + middleware) with a third dead variant. |
| Observability | 8/10 | Correlation IDs, structured logs, request metrics, audit trail on sensitive mutations — best-in-audit area. Client-side telemetry, ironically, is dropped (F-07). |
| Contract integrity | 3/10 | ≥5 confirmed FE↔BE breaks, no OpenAPI source of truth, triple envelope, double-mounted router, three hardcoded origins. |

**Overall: 4/10.** Engineering hygiene (logging, error handling, SQL discipline, audit trails) would score 7–8 alone; the anonymous billing/PII exposure and the broken FE auth transport cap the score until P0s close.

---

## Recommendations (prioritized)

**Sprint 0 (this week — P0 closure)**
1. Gate `/api/subscriptions/*` behind `requireAuth(['owner'])` except public plan catalog (F-01).
2. Gate `GET /api/customers` behind `requireAuth(['owner','staff'])` (F-02).
3. Resolve auth transport: pick cookie OR bearer end-to-end; update `api-client.ts`, `use-auth-store.ts`, `getAuthToken()`; add E2E test "login → PATCH /api/orders/:id/status reaches handler" (F-03).
4. Fix `X-Tenant-Id` trust in `tenantMiddleware` — derive from verified JWT, header only for platform admin (F-04).

**Sprint 1 (P1 hardening)**
5. Router-level guards for `menu-modifiers`, `kitchen-stations`; guard `/mobile/notifications` wholesale (F-05, F-06, F-18).
6. Repoint FE telemetry to `/api/client-error`; fix `/api/dashboard/overview`, `/api/admin/checkins`, `/api/admin/erpnext-sync/*` paths; fix `ApiClientError.message` extraction to read `error`/`detail` (F-07–F-09).
7. Unify `VITE_API_BASE` via env; fail CI if missing; verify deploy SHA through exposed `/api/version` (F-10).
8. Roll `rateLimitMiddleware` onto loyalty/promotions/customers/contact/mobile-login; delete `rate-limit-login.ts` (F-12).
9. Schema sprint: port the 10 highest-traffic mutating endpoints to `lib/validators.ts` schemas (F-11).

**Quarter (structural)**
10. Generate OpenAPI from route definitions (`@hono/zod-openapi`), CI-check FE calls against it; collapse envelope onto `ApiResponse<T>` starting with `dindin.ts`; unmount duplicate KDS router; move cron under `/api`; add `secureHeaders()`; rotate web tokens to short-TTL + refresh (F-13–F-17, F-20).

---

*Report generated by static analysis on commit `d746f397` (per wrangler.toml GIT_COMMIT_SHA). Line numbers refer to working tree as of 2026-08-25.*
