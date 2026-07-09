# Scout Report — Worker Phases 2 Assessment
Run: 2026-07-08 T01:35 ICT · CWD: worker · 5 parallel agents (all completed)

## Aggregate Stats
- `:any` / `as any` trong src/routes: **4 occurrences** (2 files)
- `:any` / `as any` trong src/tree: **1 occurrence**
- `:any` / `as any` trong src/lib: **0**
- `console.*` trong routes: **4** (tất cả trong `dindin.ts`)
- TODO/FIXME/HACK trong src: **12**
- Routes không test: **35/49** (71%)
- Tree modules không test: **15/19** (79%)
- Clients không test: **6/6** (100%)

## Test Coverage Map

### Well-tested (>3 tests)
- `analytics-hono.ts` — 57 tests (lớn nhất)
- `dindin.ts` — 26
- `tables.ts` / `homeassistant/test` / `payments` (stuck) — 5-17 mỗi file

### Partially tested (1-3 tests)
- `loyalty.ts` (2) · `menu.ts` (2) · `contact.ts` (3) · `reviews.ts` (3) · `cron` (shallow exports-only)

### Untested (0 tests) — business-critical
- `tree/orders/` (8 files — **CRITICAL**)
- `tree/auth/` (9 files — **CRITICAL**)
- `src/routes/refunds.ts` — **CRITICAL** (financial)
- `src/routes/webhooks.ts` — **HIGH** (attack surface)
- `src/routes/payments.ts` — **HIGH** (payment flow)
- `src/routes/erpnext*.ts` (4 files — **HIGH**)
- `src/routes/pretix.ts`, `mautic-bridge.ts`, `zalo.ts`, `campaigns.ts`, `subscriptions.ts`, `referrals.ts` — **HIGH**
- 25+ routes còn lại

### Untested tree modules (15/19)
`analytics/` · `auth/` · `campaigns/` · `integrations/` · `loyalty/` · `mautic/` · `orders/` · `pretix/` · `push/` · `referrals/` · `subscriptions/` · `zalo/` v.v.

## Routes — Candidate Cleanup

P0 (residual `:any`/broken patterns):
- `src/routes/dindin.ts:48` — `e.status as any`, 4× `console.log` TRACE
- `src/routes/payments/momo-create.ts:18,52` — multiple `as any`

P1 (no Zod):
- Xác nhận: Phase 1 đã thêm Zod cho POST/PATCH/PUT routes; residual cần kiểm tra thủ công từng route.

P2 (style):
- `:any` còn sót phụ thuộc vào middleware typing (cần refactor nhẹ hoặc chấp nhận vì CF Hono typing hạn chế)

## Tree Modules

P0:
- `tree/orders/create-order.ts` (core business logic, 0 unit tests)
- `tree/auth/login.ts` (JWT auth, 0 tree tests)

P1:
- `tree/loyalty/` (8 files, 0 tests — cashback logic complex)
- `tree/subscriptions/` (7 files, 0 tests)

P2:
- `tree/pretix/` (3 files — HMAC validation, security-sensitive)
- `tree/zalo/` (3 files)

## Client Layer

- 6 clients 100% không có test: `erpnext-*` (4×) · `frigate-client.ts` · `tastyigniter-client.ts`
- `:any` count: **0**

## Security (advisory từ external audit, xác nhận bằng scout)

CRITICAL:
- JWT `role` từ token không canonicalize vs user store — `auth.ts:51` trust-from-self
- `bootstrap-owner` endpoint hoàn toàn public — `index.ts:216`
- `erpnext-pos` / `erpnext-invoices` routes **không có requireAuth** — `index.ts:412-418`
- Wildcard CORS via `cors.ts` helper bypasses allowlist

HIGH:
- Role "admin" không trong `AuthUser` type nhưng chấp nhận runtime — `auth.ts:15` vs `admin-loyalty.ts:35`
- Token revocation key leak (no TTL) — `auth.ts:46`
- In-memory rate limiter per-isolate — `rate-limit-login.ts:3`
- X-Forwarded-For fallback trong rate limit — `rate-limit.ts:35`
- `err.message` leak đến client trong 4+ routes — `index.ts:377,393` · `customers.ts:96` · `webhooks.ts:198` · `frigate.ts:39`

## Unresolved Questions
1. `orders.test.ts` cover `tree/orders/create-order.ts` trực tiếp hay chỉ qua route wrapper?
2. `payments.test.ts` cover normal payment flow hay chỉ stuck-payment?
3. `cron-integration.test.ts` exports-only — có integration test riêng cho business logic?
4. `tree/erpnext/` empty — ERPNext logic sống hoàn toàn trong routes?
5. Có e2e/playwright tests ngoài `src/__tests__/`?
