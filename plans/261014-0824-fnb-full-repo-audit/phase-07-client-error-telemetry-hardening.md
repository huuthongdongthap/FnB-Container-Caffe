# Phase 07: Client Error Telemetry Contract Alignment, PII Scrubbing & Rate Limit Hardening

## Context Links
- Master Plan: [plan.md](plan.md)
- Client Error Route: [worker/src/routes/client-errors.ts](../../worker/src/routes/client-errors.ts)
- Rate Limit Middleware: [worker/src/middleware/rate-limit.ts](../../worker/src/middleware/rate-limit.ts)
- SPA ErrorBoundary: [src/components/shared/ErrorBoundary.tsx](../../src/components/shared/ErrorBoundary.tsx)
- SPA API Client: [src/lib/api-client.ts](../../src/lib/api-client.ts)

---

## Overview
- **Priority:** P1 High
- **Current Status:** Complete
- **Description:** Reconcile the payload contract mismatch between the frontend telemetry emitters (`ErrorBoundary.tsx`, `api-client.ts`) and `worker/src/routes/client-errors.ts`, scrub sensitive query parameters from persisted URLs, add rate limiting (`CLIENT_ERROR_RATE_LIMIT`), and isolate D1 failures with `try/catch`.

---

## Key Insights
1. **Telemetry Contract Drift (P1):**
   - `src/components/shared/ErrorBoundary.tsx:34-40` sends `{ error, stack, componentStack, url, timestamp }`.
   - `src/lib/api-client.ts:51-59` sends `{ type, status, message, path, method, url, timestamp }`.
   - `worker/src/routes/client-errors.ts:23-27` only read `body.route`, `body.message`, `body.stack`, `body.href`, and `body.ts`. Consequently, every React `ErrorBoundary` crash was stored in D1 with `message = 'Unknown error'`, `route = ''`, and `href = null`.
2. **Sensitive Query Parameter Leakage in `href` (P2):**
   - Persisting raw `window.location.href` into `client_errors.href` could store query-string tokens, phone numbers, or auth codes (`?token=...`, `?phone=...`, `?code=...`).
3. **Unthrottled Public D1 Writes & Uncaught DB Errors (P2):**
   - `POST /api/client-error` lacked rate limiting and executed `db.prepare(...).run()` outside `try/catch`.

---

## Implementation Steps
1. In `worker/src/middleware/rate-limit.ts`:
   - Export `CLIENT_ERROR_RATE_LIMIT` (`max: 20`, `windowSec: 60`, `keyPrefix: 'rate:client-error'`).
2. In `worker/src/routes/client-errors.ts`:
   - Attach `rateLimitMiddleware(CLIENT_ERROR_RATE_LIMIT)` to `POST /`.
   - Normalize `route` (`body.route || body.path || pathname(url)`), `message` (`body.message || body.error`), `stack` (`body.stack` + `body.componentStack`), `href` (`body.href || body.url`), and `ts` (`body.ts || body.timestamp`).
   - Scrub sensitive query parameters (`token`, `access_token`, `refresh_token`, `code`, `secret`, `password`, `phone`, `email`, `key`, `authorization`) from `href` before persisting.
   - Wrap the D1 `INSERT` in `try/catch` and return a sanitized 500 error if D1 fails.
3. In `worker/src/__tests__/routes/client-errors.test.ts`:
   - Add unit and regression tests for `ErrorBoundary` payload normalization, `api-client` payload normalization, URL query parameter redaction, rate limiting, and D1 error sanitization.

---

## Todo List
- [x] Export `CLIENT_ERROR_RATE_LIMIT` in `worker/src/middleware/rate-limit.ts`
- [x] Align payload fields, scrub URL query secrets, add rate limiting, and wrap D1 `INSERT` in `worker/src/routes/client-errors.ts`
- [x] Add regression tests in `worker/src/__tests__/routes/client-errors.test.ts`
- [x] Verify with `npm run lint`, `npm run typecheck:all`, and `vitest`
