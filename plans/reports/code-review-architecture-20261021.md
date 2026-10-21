# Code Review — Architecture & Core Modules

**Date:** 2026-10-21  
**Scope:** Full architecture review — CLAUDE/AGENTS, package.json, tsconfig, vite, domain packages, worker entry, frontend entry, middleware, stores  
**Files Reviewed:** ~60 files  
**LOC:** ~15,000+ (estimated)

> **Verification pass — 2026-10-21 (later same day).** Findings **1–15** were re-checked against
> the live tree; **16–30 remain unverified** and may be stale in the same way. Statuses are
> annotated inline as `✅ RESOLVED` / `⚠️ STALE` / `🔴 STILL OPEN`.
> Commits `9a5a47f`, `6c59dad`, and `2f8fa44` landed between this review and the re-check and
> resolved several items. Do not spend time on a `✅`/`⚠️` item without first re-reading the
> cited file. Tally for 1–15: 9 resolved, 4 stale, 2 still open — #2 (CORS falls back to
> `ALLOWED_ORIGINS[0]` for unmatched origins) and #4 (rate-limit key is IP-only).

---

## Overall Assessment

The codebase is a **well-structured monorepo** with clear domain-driven boundaries, modern TypeScript configuration, and production-grade Cloudflare Workers backend. Key strengths:

- **Domain separation** via `@aura/domain-*` path aliases (17 packages) with clean public exports
- **Strict TypeScript** (`strict: true`, `noUncheckedIndexedAccess: true`) in frontend
- **Unified orders router** with explicit route precedence (static before parameterized)
- **Durable Objects** for real-time order broadcasting with D1 as source of truth
- **OpenAPI 3.1 + Scalar/ReDoc** documentation auto-generated from Zod schemas
- **Comprehensive middleware stack**: correlation IDs, tenant isolation, rate limiting, audit logging, security headers
- **Offline-first frontend** with IndexedDB queue + SSE/polling fallback

---

## Critical Issues

### 1. Worker `tsconfig.json` has `strict: false` — **BLOCKER for production**

> ⚠️ **STALE — verified `worker/tsconfig.json:9` is `"strict": true`.** The file also sets
> `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
> `strictPropertyInitialization`, `noImplicitThis`, and `useUnknownInCatchVariables`.
> The reviewed tree did not match the file on disk. Closed — no action.

```json
// worker/tsconfig.json
"strict": false,
```

**Impact:** Disables all strict type checks in the backend. Null/undefined errors, implicit any, missing property checks will **not** be caught at compile time.

**Fix:** Enable `strict: true` incrementally. Start with:
```json
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true,
"strictFunctionTypes": true,
```
Then fix errors module by module. This is non-negotiable for production.

---

### 2. CORS origin validation uses regex allowlist but **no `origin: false` fallback for unmatched**

> 🔴 **STILL OPEN — verified `worker/src/middleware/cors.ts:29-31`.** The logic moved into its
> own module since the review, but the behavior is unchanged and deliberate:
> `getCorsOrigin` returns `ALLOWED_ORIGINS[0]` for any unmatched origin rather than rejecting.
> Hardening item, not a defect. Fix = decide whether an unmatched origin should get a
> restrictive origin header or a hard 403.

```ts
// worker/src/index.ts:54-73
origin: (origin: string) => {
  if (!origin) return '';  // empty string = reject
  return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : '';
}
```

**Issue:** Returns empty string for unmatched origins, which **some browsers treat as "allow all"** depending on Hono/cors implementation. Safer to explicitly reject.

**Fix:** Return `false` or throw for unmatched:
```ts
return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : false;
```

---

### 3. `verifyJWT` / `getAuthToken` imported from `../lib/jwt` — **file not found in reviewed set**

> ⚠️ **STALE — `worker/src/lib/jwt.ts` exists.** The reviewed file set was incomplete, not the
> tree. Closed — no action.

```ts
// worker/src/middleware/auth.ts:7
import { verifyJWT, getAuthToken } from '../lib/jwt';
```

**Risk:** If this module uses weak algorithms (HS256 without key rotation), lacks `exp`/`nbf` validation, or doesn't verify `aud`/`iss`, tokens can be forged. **Must verify implementation.**

---

### 4. Rate limiting uses **IP-based key only** (`cf-connecting-ip` / `x-forwarded-for`)

> 🔴 **STILL OPEN — verified `worker/src/middleware/rate-limit.ts:31,126`.** The `cf-connecting-ip`
> preference is intentional (`:27` documents that CF sets it at the edge and xff is only trusted
> behind a known proxy). Remaining question is whether the key should combine IP with a route or
> subject bucket so one caller cannot exhaust a shared IP's budget.

```ts
// worker/src/middleware/rate-limit.ts:58, 62
const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
const key = `${config.keyPrefix}:${ip};
```

**Risk:** Behind Cloudflare, `cf-connecting-ip` is reliable, but **shared IPs (corporate NAT, mobile carriers)** will cause false positives. No user-scoped or tenant-scoped limiting.

**Fix:** Combine IP + userId (when authenticated) + tenantId:
```ts
const user = c.get('user');
const keyBase = user ? `${config.keyPrefix}:user:${user.id}` : `${config.keyPrefix}:ip:${ip}`;
```

---

### 5. Order SSE endpoint `/api/orders/:id/events` **no auth middleware**

> ✅ **RESOLVED — verified `worker/src/routes/orders-unified.ts:71`.** Now
> `optionalAuth()`-guarded, and the handler enforces ownership at
> `worker/src/routes/order-stream.ts:48-49` (`canAccessOrder` → 403). Covered by `9a5a47f`.

```ts
// worker/src/routes/orders-unified.ts:70
ordersUnifiedRouter.get('/:id/events', handleOrderStreamEvents);
```

**Risk:** Any caller with order ID can stream real-time order updates. Order IDs are guessable (UUID v4 helps but not sufficient).

**Fix:** Add `requireAuth` or at minimum `optionalAuth` + ownership check in handler.

---

### 6. `orderRateLimit` applied to `POST /` (create order) but **not to `POST /checkout` (POS)**

> ✅ **RESOLVED — verified `worker/src/routes/orders-unified.ts:60`.** `/checkout` now runs
> `rateLimitMiddleware(POS_CHECKOUT_RATE_LIMIT)` plus `requireAuth` and `audit`; `/guest-checkout`
> at `:51` is rate-limited too. Covered by `9a5a47f`.

```ts
// worker/src/routes/orders-unified.ts:57, 61
ordersUnifiedRouter.post('/checkout', requireAuth([...]), audit(...), handlePosCheckout);
ordersUnifiedRouter.post('/', orderRateLimit, handleCreateOrder);
```

**Risk:** POS checkout bypasses order rate limit. Staff could spam orders.

**Fix:** Apply `orderRateLimit` to `/checkout` too.

---

## High Priority

### 7. Dual `ordersUnifiedRouter` mounts create **route shadowing ambiguity**

> ✅ **RESOLVED — verified `worker/src/index.ts:106,111`.** `/api/kds/orders` now mounts its own
> `kdsOrdersRouter` instead of a second mount of the unified router. Covered by `6c59dad`.

```ts
// worker/src/index.ts:97-100
app.route('/api/orders', ordersUnifiedRouter);
app.route('/api/kds/orders', kdsStreamRouter);
app.route('/api/kds/orders', ordersUnifiedRouter);  // ← second mount
```

**Issue:** Hono matches in registration order. `/api/kds/orders` will hit `kdsStreamRouter` first, then `ordersUnifiedRouter` for unmatched paths. But `kdsStreamRouter` only handles `/events` (from `kds-stream.ts`). All other `/kds/orders/*` go to `ordersUnifiedRouter`. **Confusing and fragile.**

**Fix:** Mount once with clear separation:
```ts
app.route('/api/orders', ordersUnifiedRouter);
app.route('/api/kds/orders', kdsStreamRouter); // only /events
// Remove second ordersUnifiedRouter mount
```

---

### 8. `tenantMiddleware` allows **HQ super-admins to override tenancy via query/header** — no audit log

> ✅ **RESOLVED — verified `worker/src/middleware/tenant.ts:4`.** The override path now calls
> `writeTenantOverrideAudit`. Covered by `6c59dad`.

```ts
// worker/src/middleware/tenant.ts:39-44
if (isHQSuperAdmin(user)) {
  const requestedTenant = c.req.query('tenant_id') || c.req.header('x-tenant-id');
  if (requestedTenant) {
    c.set('tenantId', requestedTenant);  // No logging!
    return next();
  }
}
```

**Risk:** Privilege escalation path with no audit trail. If `x-tenant-id` is spoofed by compromised admin token, cross-tenant data access occurs silently.

**Fix:** Add audit log entry when tenancy overridden:
```ts
if (requestedTenant && requestedTenant !== user.tenantId) {
  await auditLog(c, 'tenant_override', { from: user.tenantId, to: requestedTenant, by: user.id });
}
```

---

### 9. `OrderBroadcaster` state **unbounded growth** — only 200-order cap on terminal states

> ✅ **RESOLVED — verified `worker/src/do/OrderBroadcaster.ts:39-47,53-86`.** The old 200-item
> scan is replaced by `evictStaleOrders`: a 24h TTL on terminal orders plus a `MAX_ORDERS` of
> 500 with oldest-first overflow, always retaining the order written in the current tick.
> Both bounds are documented at `:29-38` and pinned by the `OrderBroadcaster bounded retention`
> suite. **Caveat:** no production caller reaches `broadcast()` today — `ORDER_BROADCASTER`
> is referenced only by the WS-upgrade forwarder — so the bounds are exercised by tests, not
> by live traffic. Treat as verified-by-test, not verified-in-prod.

```ts
// worker/src/do/OrderBroadcaster.ts:71-75
for (const key of Object.keys(orders)) {
  if (Object.keys(orders).length <= 200) break;
  if (key !== parsed.orderId && terminal.has(orders[key].status)) delete orders[key];
}
```

**Issue:** Only cleans up **terminal-state orders** when >200 total. Active orders accumulate indefinitely. Memory pressure in long-running DO.

**Fix:** Add TTL-based eviction (e.g., orders older than 24h) + max active orders cap.

---

### 10. Frontend `useOrderStore` **race condition** in `subscribeToOrder` + `startPolling`

> ✅ **RESOLVED — verified `src/hooks/stores/use-order-store.ts:94` (re-entrancy guard) and the
> AbortController added in `2f8fa44`.** Repeated SSE failures no longer stack pollers, and a
> terminal order no longer restarts the fetch loop.

```ts
// src/hooks/stores/use-order-store.ts:88-113
subscribeToOrder: (id: string) => {
  get().unsubscribeFromOrder();
  const es = new EventSource(url, { withCredentials: true });
  es.onerror = () => { es.close(); set({ eventSource: null }); get().startPolling(id); };
}
startPolling: (id: string) => {
  get().stopPolling();
  const intervalId = window.setInterval(async () => {
    const { currentOrder } = get();
    if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) { get().stopPolling(); return; }
    await get().fetchOrder(id);
  }, POLL_INTERVAL);
}
```

**Race:** SSE `onerror` fires → calls `startPolling` → `stopPolling` clears interval → but SSE might reconnect internally before `onerror` fires again, creating **duplicate pollers**.

**Fix:** Use a `isPolling` flag + `AbortController` for fetch cancellation.

---

### 11. `apiFetch` **attaches Bearer token from localStorage automatically** — **CSRF risk if cookies also used**

> ✅ **RESOLVED — verified via commit `2f8fa44`.** The session cookie is `SameSite=None`, so it
> rides cross-site posts; the worker now requires the caller to *name* its credential
> (Authorization header or SSE token param), both unreadable cross-origin, and
> `requireAuth` rejects cookie-only writes with 403. Reads still accept the cookie because
> EventSource cannot set headers. `src/lib/api-client.ts` drops `credentials: 'include'`.

```ts
// src/lib/api-client.ts:89-96
const token = typeof window !== 'undefined' ? localStorage.getItem('aura_auth_token') : null;
if (token && !headers['Authorization']) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

**Issue:** `credentials: 'include'` sends cookies. If backend accepts **both** cookie and Bearer, and cookie is HttpOnly but Bearer is in localStorage (XSS-exfiltratable), attacker can steal token via XSS and replay with cookie.

**Fix:** Choose **one** auth transport. If cookies, remove Bearer auto-attach. If Bearer, use `credentials: 'omit'`.

---

### 12. `worker/src/index.ts` imports `@aura/domain-kitchen` for `kdsStreamRouter` but **no version pin in package.json**

> ⚠️ **STALE — verified `package.json:7-11` declares `packages/domain/*` as a yarn workspace.**
> Workspace packages resolve by path, not by a registry version, so there is no version to pin.
> Closed — no action.

```ts
// worker/src/index.ts:24
import { kdsStreamRouter } from '@aura/domain-kitchen';
```

**Risk:** Domain packages are local workspaces (no version). If `packages/domain/kitchen/index.ts` exports change, worker breaks silently at runtime (no compile-time check since `worker/tsconfig.json` has separate config).

**Fix:** Ensure `worker/tsconfig.json` includes domain packages in `include` or run `typecheck:all` in CI (already in package.json scripts — verify it runs).

---

### 13. **No request body size limit** on order creation endpoints

> ✅ **RESOLVED — verified `worker/src/index.ts:84-86`.** A dedicated `orderBodyLimit` middleware
> from `worker/src/middleware/body-limit.ts` is applied to `/api/orders/*`, `/api/orders`, and
> `/api/kds/orders/*` (there is an `authBodyLimit` too). Covered by `9a5a47f`.

```ts
// worker/src/routes/orders-unified.ts:61
ordersUnifiedRouter.post('/', orderRateLimit, handleCreateOrder);
```

**Risk:** Large payloads (e.g., 10MB+ items array) can OOM the Worker. Cloudflare Workers have 128MB limit but parsing large JSON is CPU-intensive.

**Fix:** Add body size middleware:
```ts
import { bodyLimit } from 'hono/body-limit';
app.use('/api/orders*', bodyLimit({ maxSize: 1024 * 1024 })); // 1MB
```

---

### 14. `vite.config.js` proxy **hardcodes production worker URL** for dev

> ✅ **RESOLVED — verified `vite.config.js:99`.** The target is now
> `env.VITE_DEV_PROXY_TARGET || DEFAULT_WORKER_ORIGIN`, loaded via `loadEnv` because the config
> module evaluates before `import.meta.env` exists. Set `VITE_DEV_PROXY_TARGET` in `.env.local`
> to point a dev server at wrangler. Covered by `2f8fa44`.

```ts
// vite.config.js:91-95
proxy: {
  '/api': {
    target: 'https://aura-space-worker.sadec-marketing-hub.workers.dev',
    changeOrigin: true,
    secure: false,
  },
}
```

**Issue:** Dev environment hits production API. No local worker simulation. Breaks offline dev, leaks dev traffic to prod.

**Fix:** Use local wrangler dev (`http://localhost:8787`) with env override:
```ts
target: import.meta.env.VITE_API_BASE || 'http://localhost:8787',
```

---

### 15. **Duplicate type definitions** between frontend `order-store-types.ts` and worker `schemas/orders.ts`

> ⚠️ **STALE as framed — real duplication exists, but the two sides are not interchangeable.**
> Frontend is compile-time TS interfaces for the client store (`order-store-types.ts:12` —
> `CustomerOrder` carries `subtotal`/`totalAmount`); worker is runtime Zod for validation and
> OpenAPI generation (`worker/src/schemas/orders.ts:27-42`). Unifying them would pull Zod into
> the browser bundle and couple client rendering to the wire schema. **Recommendation: keep
> both, add a contract test** asserting the shapes stay aligned, rather than merging modules.

```ts
// src/hooks/stores/order-store-types.ts:76-100
export type OrderStatus = 'pending' | 'confirmed' | ... | 'refunded';

// worker/src/schemas/orders.ts (not read but referenced)
```

**Risk:** Drift between client/server enums. `CustomerOrder` in store mirrors worker DTO but not enforced.

**Fix:** Generate types from OpenAPI spec (`@asteasolutions/zod-to-openapi` already used) or share via `@aura/domain-order` package.

---

## Medium Priority

### 16. `packages/domain/payment/index.ts` exports **only PayOS + NowPayments** — no abstraction

```ts
// packages/domain/payment/index.ts:3-5
export { paymentRouter } from './commands/payos-create-link';
export { nowPaymentsIPN } from './commands/nowpayments-ipn';
```

**Issue:** Payment domain is **gateway-coupled**. Adding Stripe/MoMo requires changing exports. No `PaymentGateway` interface.

**Fix:** Define `PaymentProvider` interface in domain, register implementations via factory.

---

### 17. `OrderBroadcaster` **legacy storage fallback** uses `put(key, string)` — **no serialization safety**

```ts
// worker/src/do/OrderBroadcaster.ts:78-80
} else if (this.legacyStorage) {
  await this.legacyStorage.put(`order:${parsed.orderId}`, JSON.stringify(persisted));
}
```

**Risk:** `legacyStorage` type is `{ put(key: string, value: string): Promise<void> }` — no `get` method defined. Hydration from legacy storage **not implemented**.

**Fix:** Remove legacy path or fully implement `SnapshotStorage` interface.

---

### 18. `useOrderStoreWithOfflineFlush` **runs flush on every `isOnline` change** — potential duplicate flushes

```ts
// src/hooks/stores/use-order-store.ts:155-158
useEffect(() => {
  if (wasOffline && queuedOffline) void flushQueuedOrders();
  lastOnline = isOnline;
}, [isOnline, wasOffline, queuedOffline, flushQueuedOrders]);
```

**Issue:** `wasOffline` resets to `false` after first online render (see `use-online-status.ts:19`). But `queuedOffline` may still be true if flush failed. Next `isOnline` toggle (flaky connection) triggers another flush.

**Fix:** Track `flushInProgress` flag in store.

---

### 19. **No API versioning strategy** — `/api/v1` aliases to root via rewrite

```ts
// worker/src/index.ts:125-131
const v1 = new Hono<{ Bindings: Env }>();
v1.use('/*', async (c) => {
  const url = new URL(c.req.raw.url);
  url.pathname = url.pathname.replace(/^\/api\/v1/, '/api');
  return app.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});
app.route('/api/v1', v1);
```

**Issue:** Rewrite strips `/api/v1` → `/api`. No way to run v1 and v2 simultaneously. Breaking changes require coordinated deploy.

**Fix:** Mount versioned routers separately:
```ts
app.route('/api/v1', v1Router);
app.route('/api/v2', v2Router);
```

---

### 20. `worker/src/middleware/auth.ts` **Playwright test bypass** checks `x-playwright-test` header

```ts
// worker/src/middleware/auth.ts:36-48
const testHeader = c.req.header('x-playwright-test');
const isPlaywright = !isProd && testHeader === 'true';
if (isPlaywright) { c.set('user', {...}); return next(); }
```

**Risk:** Header-based bypass in non-prod. If staging uses same code, test header grants staff access.

**Fix:** Gate behind `ENVIRONMENT !== 'production' && ENVIRONMENT !== 'staging'` or use dedicated test JWT.

---

### 21. **Missing security headers middleware** review — `securityHeaders()` imported but not read

```ts
// worker/src/index.ts:11, 77
import { securityHeaders } from './middleware/security-headers';
app.use('*', securityHeaders());
```

**Need to verify:** CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy are set correctly for SPA + Worker.

---

### 22. `packages/domain/order/policies/order-snapshot.ts` exports `calculateOrderSnapshot` but **no validation of input completeness**

```ts
// packages/domain/order/index.ts:19
export { calculateOrderSnapshot } from './policies/order-snapshot';
```

**Risk:** Snapshot used for audit/loyalty. If input missing items/modifiers, snapshot is silently wrong.

**Fix:** Add Zod schema for `OrderSnapshotInput` and validate at boundary.

---

### 23. **No database migration strategy visible** — `db/schema.sql` and `worker/schema.sql` both exist

```bash
# Both exist per git status
M db/schema.sql
M worker/schema.sql
```

**Risk:** Two schema files drift. D1 migrations should be single source of truth with versioned `.sql` files in `migrations/`.

**Fix:** Consolidate to `worker/migrations/` with `wrangler d1 migrations apply`.

---

### 24. Frontend **no CSP nonce/inject** for inline scripts (Helmet only)

```tsx
// src/main.tsx:42-47
<HelmetProvider>
  <SWInit />
  <App />
</HelmetProvider>
```

**Issue:** `react-helmet-async` sets meta tags but **CSP `script-src` needs nonce** for inline scripts (Vite injects). Without nonce, CSP blocks dev tools or requires `'unsafe-inline'`.

**Fix:** Use `vite-plugin-csp` or generate nonce in `index.html` transform.

---

## Low Priority / Code Quality

### 25. `worker/src/routes/features-router.ts` — **13,025 bytes** (large router file)

Consider splitting by feature domain.

### 26. `src/hooks/stores/order-store-constants.ts` — **magic numbers** `POLL_INTERVAL = 3000`

Should be configurable via env or derived from `SLA_THRESHOLD_MINUTES`.

### 27. **No `eslint.config.js`** — uses CLI `eslint worker/src/ --ext .ts` (flat config missing)

Flat config (`eslint.config.js`) is required for ESLint 9+. Current command may fail.

### 28. `package.json` has **both `@vitest/coverage-v8` and `vitest`** — coverage config not visible

Verify `vitest.config.ts` exists with coverage thresholds.

### 29. **No `tsconfig.json` for `packages/domain/*`** — relies on root `tsconfig.json` paths

Each domain package should have its own `tsconfig.json` with `composite: true` for project references.

### 30. `vite.config.js` manualChunks — **`vendor-ui` includes `zustand` but store is app-specific**

```js
// vite.config.js:81
if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/clsx/') || id.includes('node_modules/zustand/')) return 'vendor-ui';
```

`zustand` is tiny (~1KB). Chunking it separately adds HTTP request overhead. Merge into main chunk.

---

## Positive Observations

| Area | Observation |
|------|-------------|
| Domain architecture | Clean bounded contexts with explicit public exports (`index.ts` barrels) |
| TypeScript | Frontend `strict: true`, `noUncheckedIndexedAccess: true` — excellent |
| Route precedence | `orders-unified.ts` documents and enforces static-before-parameterized |
| Observability | Correlation IDs (W3C traceparent), structured logging, error classification |
| Offline support | IndexedDB queue + SSE + polling fallback — comprehensive |
| OpenAPI | Auto-generated from Zod schemas, Scalar + ReDoc UIs |
| Tenant isolation | JWT-derived tenantId, HQ override with explicit check |
| Order state machine | Explicit `ORDER_STATUSES`, `ORDER_TRANSITIONS`, `canTransition` guard |
| i18n | `i18next` + `react-i18next` configured, locale in menu queries |
| PWA | Service worker registration, install prompt, update prompt |

---

## Recommended Actions (Priority Order)

1. **Enable `strict: true` in `worker/tsconfig.json`** — fix errors incrementally
2. **Add auth to `/api/orders/:id/events` SSE endpoint**
3. **Fix CORS origin validation to return `false` for unmatched**
4. **Add request body size limit middleware**
5. **Audit `verifyJWT` implementation for algorithm/claims validation**
6. **Add audit log for tenant override in `tenantMiddleware`**
7. **Implement TTL eviction in `OrderBroadcaster`**
8. **Fix SSE/polling race in `useOrderStore`**
9. **Choose single auth transport (cookie OR Bearer) — remove dual**
10. **Add user-scoped rate limiting (IP + userId + tenantId)**
11. **Apply `orderRateLimit` to `/checkout` POS endpoint**
12. **Fix vite dev proxy to use local worker**
13. **Generate shared types from OpenAPI spec**
14. **Consolidate D1 migrations to single versioned directory**
15. **Add CSP nonce support for production build**

---

## Unresolved Questions

1. **JWT implementation** — need to read `worker/src/lib/jwt.ts` to verify algorithm, expiration, audience validation
2. **Security headers** — need to read `worker/src/middleware/security-headers.ts`
3. **D1 migration workflow** — how are `db/schema.sql` and `worker/schema.sql` kept in sync?
4. **CI pipeline** — does `typecheck:all` run on PR? Does it fail build on worker errors?
5. **Secrets management** — `.env.example` shows many keys; verify none committed (`.env` in `.gitignore`?)
6. **Load testing** — any k6/Artillery scripts for order throughput + SSE connections?

---

## Metrics

| Metric | Value |
|--------|-------|
| Domain packages | 17 (`@aura/domain-*`) |
| Worker routes | ~120 files under `worker/src/routes/` |
| Frontend routes | 5 route groups (public, stitch, mobile, admin, not-found) |
| TypeScript strict (frontend) | ✅ Enabled |
| TypeScript strict (worker) | ❌ Disabled — **Critical** |
| OpenAPI coverage | All domain routers registered |
| Test setup | Vitest + Playwright + happy-dom |
| Linting | ESLint 9 (flat config missing) |