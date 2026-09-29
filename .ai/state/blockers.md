# Blockers — AURA OS

## Active Blockers
None.

## Non-Blocking Gaps (YELLOW)

### Y-01: ESLint Pre-existing Errors (RESOLVED)
**Area:** AUDIT #15 — Build / Typecheck / Lint
**Detail:** `npm run lint` reports 0 errors (91 warnings, primarily unused parameters/vars with allowed underscore exceptions). All syntax, duplicate blocks, and TS compile errors eliminated.
**Status:** RESOLVED — 0 errors.

### Y-02: No Live Production E2E
**Area:** AUDIT #10 / #16 — E2E / Runtime
**Detail:** E2E verification was performed via Hono in-process `app.fetch()` with mocked D1 and a mock `ExecutionContext`. No live Cloudflare Workers deployment was exercised against real D1.
**Assessment:** M4-B Automated Verification = GREEN. Production Verification = NOT PERFORMED.
**Action:** Deferred to deployment window; requires `wrangler deploy` + staging D1 seed.

### Y-03: Channel Pricing (RESOLVED in M4-C)
**Area:** AUDIT #05 — Price
**Resolution:** Implemented via `resolveItemPrice()` in `@aura/domain-catalog/policies/pricing.ts` supporting `dine_in`, `takeaway`, and `delivery` sales channels with integer VND cents arithmetic. Tested in `pricing.test.ts`. Closed during M4-C Phase 01.
