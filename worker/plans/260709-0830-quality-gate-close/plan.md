---
status: in_progress
created: 2026-07-09
source: ck:cook
mode: auto
phases:
  - id: qgc-3a
    title: Finish Quality Gate - Zod Validation + :any Cleanup
    file: phase-qgc-3a-zod-and-any.md
    status: pending
    priority: P0
  - id: qgc-3b
    title: Security Hardening - Auth, CORS, Rate Limits
    file: phase-qgc-3b-security.md
    status: pending
    priority: P0
---

# Quality Gate Close: Zod Finalization + Security Hardening

## Context
From `260702-0053-quality-gate-foundations`:
- tsc --noEmit exits 0
- vitest 1166/1166 green
- 25/49 routes have Zod validation
- 1 `:any` remains in production code (`process-booking.ts:53`)

This plan closes the remaining quality gaps and adds security hardening.

## Phase 1: Zod Finalization + :any Cleanup (P0)

### 1a: Zod — 24 routes need validation
Routes without Zod (manual validation or none):
admin-audit-logs, admin-loyalty, admin-metrics, admin-qr, auth, broadcast,
cal-booking-webhook, campaigns, cron, erpnext-invoices, erpnext-sync,
erpnext, health, mautic-bridge, menu, order-stream, orders, push, reports,
signage, subscriptions, version, zalo

For each route:
- Identify POST/PATCH/PUT handlers with manual body parsing
- Add or reuse schema from `validators.ts` (schemas exist for 75+ cases)
- Replace `let body: any; try { body = await c.req.json() }` with `.safeParse()`
- Use existing error handler pattern: `errorResponse(c, 'Validation failed', 400, issues)`

Priority: admin-metrics, subscriptions, campaigns (high-traffic)

### 1b: :any cleanup
`src/tree/cal-booking/process-booking.ts:53`: rename `anyResults` → `tablesResults`
`anyResults` is just a destructuring label, not a type escape.

### 1c: Add missing schemas
Any route with manual validation that doesn't have a matching schema yet:
- admin-loyalty (loyalty actions)
- admin-qr (QR regenerate)
- broadcasts (create broadcast)
- etc.

### 1d: One shared Zod error helper
Consolidate repeated error response pattern:
```typescript
export function zodErrorResponse(c: Context, error: z.ZodError) {
  return c.json({ success: false, error: error.issues[0].message }, 400);
}
```

### Tests
- Run full vitest suite after each route change
- Add 2-3 edge case tests per route (missing required field, wrong type, extra fields)
- Target: 1175+ tests (9+ new)

## Phase 2: Security Hardening (P0)

### 2a: CORS tighten (admin routes)
Currently: `Access-Control-Allow-Origin: *` for all.
Change: Allow only configured origin for admin/api routes.
Config: `ADMIN_ORIGIN` env var, fallback to `*`.

### 2b: Rate limit headers
Add `X-RateLimit-Remaining` to all `/api/` responses using existing limiter.
Pattern: pass limit config through middleware context.

### 2c: Auth bypass audit
Scan all `src/routes/` for patterns:
- Handlers missing auth middleware that should have it
- `c.set('user', ...)` without prior verification
- `env.AUTH_SECRET` usage that could be spoofed

### 2d: SQL injection check
Verify all DB queries use parameterized `bind()` (not string interpolation).
Scan for `.prepare(` to check bind count matches `?` count.

### 2e: Secret hygiene
- No API keys in test files (except mocked)
- No `console.*` in production paths (already zero per previous audit)
- No `:any` types (fix remaining 1)

## Acceptance
- `npx vitest run`: 1175+ tests, 0 failures
- `npx tsc --noEmit`: 0 errors
- `npx eslint src/`: 0 warnings
- Zero `:any` in `src/` (production)
- All POST/PATCH/PUT have Zod validation
- CORS tightened for admin routes
- Rate limit headers present
- No SQL injection vectors
- Run via `/ck:cook` multi-agent parallel execution
