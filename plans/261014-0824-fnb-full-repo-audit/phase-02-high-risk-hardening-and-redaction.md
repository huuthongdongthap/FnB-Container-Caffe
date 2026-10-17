# Phase 02: High-Risk Hardening & Redaction

## Context Links
- Master Plan: [plan.md](plan.md)
- Audit Findings: [phase-01-audit-findings-and-severity-matrix.md](phase-01-audit-findings-and-severity-matrix.md)
- Pricing Contract Tests: [worker/src/__tests__/integrations/server-pricing-contract.test.ts](../../worker/src/__tests__/integrations/server-pricing-contract.test.ts)
- Health Tests: [worker/src/__tests__/routes/health.test.ts](../../worker/src/__tests__/routes/health.test.ts)
- Logger Redaction Tests: [worker/src/__tests__/middleware/logger-redaction.test.ts](../../worker/src/__tests__/middleware/logger-redaction.test.ts)

---

## Overview
- **Priority:** P1 High
- **Current Status:** Complete (Code changes & regression tests verified locally)
- **Description:** Implement hardened invariants for catalog price resolution, edge readiness status mapping, unauthenticated health response sanitization, and logger context/message masking.

---

## Key Insights
1. **Catalog Integrity**: Catalog items must only resolve if exact `id` exists in `products` or `menu_items`. Falling back to `.split('-')[0]` breaks pricing when compound IDs (e.g. `prod-coffee-special`) unintentionally resolve to an unrelated base item (`prod-coffee`).
2. **Readiness Contract**: Cloudflare Worker edge load balancers rely on HTTP 503 to evict degraded nodes. When `?ready=1` fails on D1, the handler must return 503 regardless of legacy status strings.
3. **Information Scrubbing**: Database engine fault messages (e.g. SQLite syntax or connection strings) must never be returned to unauthenticated public callers on `/api/health`.
4. **Structured Logger**: Contextual fields in `LoggerContext` and bare phone numbers in `msg` must be masked before formatting JSON lines.

---

## Implementation Details

### 1. Catalog Exact ID Query
In `packages/domain/catalog/policies/pricing-resolver.ts`:
- Replaced iterative candidate fallback with strict single parameterized query:
  ```typescript
  dbItem = await db
    .prepare('SELECT id, name, price, is_available as available FROM products WHERE id = ?')
    .bind(productId)
    .first<{ id: string; name: string; price: number; available: number | boolean }>();
  ```
- Regression test added in `server-pricing-contract.test.ts` verifying `prod-coffee-special` rejects with `item_not_found`.

### 2. Readiness HTTP 503 Status Mapping
In `worker/src/routes/features-router.ts`:
- Ensured readiness boolean determines HTTP response:
  ```typescript
  const isHealthy = result.status === 'ok' && (!checkDeps || result.readiness);
  const httpStatus = isHealthy ? 200 : 503;
  return c.json(result, httpStatus as 200 | 503);
  ```

### 3. Production Health Response Sanitization
In `worker/src/routes/health.ts`:
- Masked error output when `env.ENVIRONMENT === 'production'`:
  ```typescript
  const isProd = env.ENVIRONMENT === 'production';
  const exposedError = isProd
    ? (d1Probe.error ? 'Database connectivity probe failed' : undefined)
    : (d1Probe.error || undefined);
  ```

### 4. Logger Context & Message Redaction
In `worker/src/middleware/logger.ts`:
- Applied `redact()` recursively to `base` context and filtered phone numbers in `msg`.

---

## Todo List
- [x] Enforce exact product ID lookup in `pricing-resolver.ts`
- [x] Add regression test for nonexistent hyphenated product rejection
- [x] Enforce HTTP 503 on readiness probe failure in `features-router.ts`
- [x] Sanitize health probe database error in production in `health.ts`
- [x] Add regression test for production health sanitization
- [x] Redact `base` and `msg` in `logger.ts`
- [x] Add regression test for logger context and message redaction

---

## Success Criteria
- 100% test pass on targeted suites (`server-pricing-contract.test.ts`, `health.test.ts`, `logger-redaction.test.ts`).
- Clean TypeScript compilation across root frontend and worker edge.
- Zero secrets or internal database fault strings exposed to unauthenticated callers.

---

## Next Steps
Proceed to Phase 03 for CI pipeline enhancement and database migration sequence linting.
