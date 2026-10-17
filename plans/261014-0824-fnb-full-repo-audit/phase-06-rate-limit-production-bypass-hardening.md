# Phase 06: Rate Limit Production Bypass Hardening & Public Endpoint Protection

## Context Links
- Master Plan: [plan.md](plan.md)
- Rate Limit Middleware: [worker/src/middleware/rate-limit.ts](../../worker/src/middleware/rate-limit.ts)
- Rate Limit Tests: [worker/src/__tests__/middleware/rate-limit.test.ts](../../worker/src/__tests__/middleware/rate-limit.test.ts)
- Recruitment Routes: [worker/src/routes/recruitment.ts](../../worker/src/routes/recruitment.ts)

---

## Overview
- **Priority:** P1 High
- **Current Status:** Complete
- **Description:** Close the production rate-limit bypass vulnerability where client-spoofed `Origin: http://localhost`, `Referer: http://127.0.0.1`, or loopback headers bypassed KV rate limiting in production, and attach KV rate limiting (`RECRUITMENT_RATE_LIMIT`) to public recruitment submission routes.

---

## Key Insights
1. **Spoofable Header Bypass in Production (P1):** `worker/src/middleware/rate-limit.ts:38-46` evaluated `origin.includes('localhost') || origin.includes('127.0.0.1')` and `ip === '127.0.0.1' || ip === 'localhost'` without gating on `!isProd`. Because `Origin` and `Referer` are arbitrary client headers, an external attacker could bypass login (`AUTH_RATE_LIMIT`) and order (`ORDER_RATE_LIMIT`) throttling in production.
2. **Unthrottled Public D1 Writes (P2):** `POST /api/recruitment/apply` writes to both `recruitment_applications` and `contact_messages` without rate limiting. Wiring `rateLimitMiddleware(RECRUITMENT_RATE_LIMIT)` (5 requests / 10 minutes per IP) protects D1 write quota.

---

## Implementation Steps
1. In `worker/src/middleware/rate-limit.ts`:
   - Gate `origin`/`referer` localhost check and loopback IP bypass strictly behind `!isProd`.
   - Define and export `RECRUITMENT_RATE_LIMIT` (`max: 5`, `windowSec: 600`, `keyPrefix: 'rate:recruitment'`).
2. In `worker/src/routes/recruitment.ts`:
   - Attach `rateLimitMiddleware(RECRUITMENT_RATE_LIMIT)` to `POST /apply` and `POST /`.
3. In `worker/src/__tests__/middleware/rate-limit.test.ts`:
   - Add regression test verifying that in `ENVIRONMENT: 'production'`, requests with `Origin: http://localhost:5173` and `x-playwright-test: true` are strictly rate-limited and return HTTP 429 when exceeding `max`.

---

## Todo List
- [x] Gate localhost/loopback rate-limit bypass behind `!isProd` in `worker/src/middleware/rate-limit.ts`
- [x] Export `RECRUITMENT_RATE_LIMIT` and wire to `POST /api/recruitment/apply`
- [x] Add production spoofed-origin regression test in `worker/src/__tests__/middleware/rate-limit.test.ts`
- [x] Verify with `npm run lint`, `npm run typecheck:all`, and `vitest`
