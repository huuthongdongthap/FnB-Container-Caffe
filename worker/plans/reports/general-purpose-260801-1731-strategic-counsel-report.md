# Kongming Strategic Counsel — F&B Container Caffe Worker
**Date:** 2026-08-01 | **Stack:** CF Workers + Hono + D1 + KV + DO

---

## 1. Priority-Ordered Roadmap (Next 3-5 Deliverables)

| # | Deliverable | Rationale |
|---|-------------|-----------|
| **1** | **Auth hardening: token revocation + session lifecycle** | Current JWT is stateless with 7-day expiry. KV-backed revocation check exists but there's no logout endpoint that actually expires tokens (logout handler likely just clears local state). Token revocation list grows unbounded in KV. With mobile staff auth now live, stale tokens on lost devices are a real risk. This is the highest-leverage security fix. |
| **2** | **Production deployment pipeline (wrangler + migrations)** | `wrangler.toml` has secrets commented but no deploy workflow. CI/CD is absent. Migrations are manual SQL files with no apply script. Every production push currently requires manual `wrangler deploy` + manual migration. This breaks on the first person who forgets. |
| **3** | **Observability: structured logging → Loki/Logflare + alerting** | Logger writes JSON to `console.error` (CF's log drain). But there's no external log aggregation, no dashboard, no P99 latency tracking beyond basic D1 metrics tables. The cron jobs run 8+ background tasks with zero visibility into failures. |
| **4** | **Delivery Order (DO) integration** | Marked "Phase 1" in the gap list. For a food & beverage business, DO (phieu xuat kho) connects kitchen output to inventory deduction and billing. Without it, orders in the system don't trigger inventory movement — making ERPNext sync incomplete. |
| **5** | **Rate limiting unification + DDoS hardening** | Rate limit logic is duplicated 3 ways: `rate-limit.ts` exports `checkRateLimit`, `index.ts` has inline `authRateLimit` and `orderRateLimit` lambdas. KV-based rate limiting is correct for CF Workers but the duplication means new routes forget to add it. Also no per-endpoint limits, no API key auth for admin routes (JWT only). |

---

## 2. Recommended Next Single Task

**Auth Hardening: Token Revocation + Session Cleanup**

**Why this first:**
- Mobile staff devices can now authenticate (`/mobile/*` routes are live). A lost phone with a valid 7-day token is an open door.
- The revocation check exists but the KV list will grow forever without a TTL cleanup.
- Logout doesn't actually invalidate tokens server-side.
- Fixing this is self-contained (auth module only), has clear acceptance criteria, and removes the biggest security gap before any other feature scales on top of it.

**Concrete subtasks:**
1. Fix `logoutUser` to write token hash to `revoked:<token>` KV with TTL matching JWT expiry
2. Add KV TTL cleanup on login (purge expired revocation entries older than max expiry)
3. Add `device_session` table in D1 for tracking active staff device sessions with last-used timestamp
4. Add `/api/auth/sessions` endpoint for users to view/revoke their active sessions
5. Reduce default JWT TTL from 7 days to 24h with optional refresh token

---

## 3. Architectural Concerns (Before Scaling)

### 3a. Route coupling — `index.ts` is a monolith (576 lines)
Every new route gets pasted into `src/index.ts`. This file imports 40+ modules and wires them inline. It violates single-responsibility and makes it impossible to:
- Lazy-load routes for cold start optimization (CF Workers cold start is ~5-50ms; every import adds to it)
- Test route wiring independently
- Reason about which middleware applies to which routes

**Fix:** Convert to Hono sub-apps or `app.route()` groups. Each domain (orders, payments, staff) should be a self-contained router that handles its own middleware.

### 3b. Rate limiter duplication
Three separate implementations of the same auth rate limiter:
- `src/middleware/rate-limit.ts` exports `checkRateLimit` (unused by index.ts)
- `src/index.ts` lines 144-156 inline `orderRateLimit`
- `src/index.ts` lines 228-237 inline `authRateLimit`

They all do `ip = cf-connecting-ip || x-forwarded-for`, all use `AUTH_KV`, all have the same TTL logic. If the algorithm needs to change (e.g., sliding window instead of fixed counter), you fix it in three places.

### 3c. No request ID propagation
`newRequestId()` exists in `logger.ts` but is never called in the request pipeline. `requestMetricsMiddleware` runs but doesn't correlate with the structured logger. When debugging a production error, you get metrics rows without log lines and vice versa.

### 3d. CORS origins hardcoded
`ALLOWED_ORIGIN_PATTERNS` is an array of RegExp literals in `index.ts`. To add a new frontend domain, you edit source code and redeploy. This should be environment-variable driven (`CORS_ORIGIN` var already exists in wrangler.toml but isn't used).

### 3e. Legacy JS files still present
Three JS files remain:
- `src/index.js`, `src/middleware/admin-auth.js`, `src/utils/logger.js`, `src/tree/erpnext/sync.js`
- They may shadow the `.ts` versions or cause wrangler bundling confusion. The git status shows `src/index.js` was recently modified.

### 3f. D1 as the only persistent store — no backup strategy
All customer data, orders, subscriptions live in D1. D1 has point-in-time recovery but no automated export. The CEO handover doc mentions manual `.export backup.sql` as Step 3. In production, this should be automated hourly or at minimum daily.

---

## 4. Stack-Specific Risks (CF Workers + D1)

| Risk | Detail | Severity |
|------|--------|----------|
| **D1 query limits** | D1 caps at 128KB per query result. Multi-join analytics queries will silently truncate or fail. Aggregation queries (SUM, COUNT across date ranges) need `GROUP BY` pagination or a materialized summary table. | HIGH |
| **D1 write concurrency** | D1 handles concurrent writes but conflicts on the same row are resolved by last-write-wins. The `inventory` table with stock counts is a race condition waiting to happen when two orders fire simultaneously. | HIGH |
| **KV eventual consistency** | KV is eventually consistent across CF's global network. Rate limit counters stored in KV can "jump" across edge nodes. For a cafe serving a single location, this is acceptable — but worth knowing. | MEDIUM |
| **10ms CPU wall clock** | CF Workers enforce a 10ms CPU subrequest limit. The ERPNext sync retry logic runs in cron and could hit this on complex JSON parsing + DB writes. If it does, the cron silently fails. | MEDIUM |
| **DO memory (128MB)** | The `OrderBroadcaster` DO accumulates connected WebSocket clients per channel. A viral TikTok mention could spike connections. 128MB is generous for connection tracking but need to monitor. | LOW |
| **No request body streaming** | CF Workers buffer the full request body before the handler runs. Large uploads (menu images, product photos) hit the 100MB request body limit and will 413. | MEDIUM |
| **D1 migration immutability** | D1 migrations cannot be rolled back. A bad migration bricks production until a compensatory forward migration fixes it. The current 8 migration files have no rollback counterparts. | MEDIUM |

---

## Unresolved Questions

1. Is AURA_DB (D1) currently in production or still staging? Affects priority of backup automation.
2. What is the expected order volume? 10/hour or 1000/hour? Changes the architecture recommendation for rate limiting and inventory locking.
3. Are the remaining JS files (`src/index.js`, `admin-auth.js`, etc.) loaded by wrangler or dead code?
4. Is there a CF Workers binding for R2 (object storage) in the roadmap for product images?

Status: DONE
