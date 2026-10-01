# Comprehensive Audit Report — AURA F&B Monorepo

**Date:** 2026-10-01  
**Scope:** Monorepo (`worker/src/`, `packages/domain/*`, `src/`)  
**Status:** AUDIT COMPLETED  

---

## 1. Executive Summary

| Category | Status | Verified Metrics |
|---|---|---|
| **Test Suite** | ✅ GREEN | 388/388 test files passed (3,557/3,557 unit & integration tests) |
| **Type Safety** | ✅ GREEN | 0 TypeScript errors across root and worker packages (`npm run typecheck:all`) |
| **Linting** | ✅ GREEN | 0 errors, 0 warnings in worker codebase (`eslint worker/src/ --ext .ts`) |
| **Production Build** | ✅ GREEN | Vite SPA client build successful (`vite: build ok`) |
| **Secrets Exposure** | ✅ GREEN | 0 hardcoded secrets / API tokens found in application source |
| **Logging Compliance**| ✅ GREEN | 0 unauthorized `console.log` statements in worker runtime (all routed to structured sinks) |

---

## 2. Issues Categorized by Severity

### 🔴 HIGH SEVERITY

#### SEC-01: Dynamic SQL `ORDER BY` Clause Without Whitelisting in OpenAPI Handlers
- **Anchor Files**:
  - `worker/src/routes/openapi-categories-handlers/read-handlers.ts:49`
  - `worker/src/routes/openapi-products-handlers/read-handlers.ts:62`
  - `worker/src/routes/openapi-tables-handlers/table-crud-handlers.ts:48`
  - `worker/src/routes/openapi-payments-handlers/read-handlers.ts:74`
  - `worker/src/routes/openapi-auth-handlers/staff-handlers.ts:85`
- **Vulnerability**: Query parameters `sort` and `order` are interpolated directly into SQL queries as `ORDER BY ${orderClause}` (`${sort} ${order.toUpperCase()}`).
- **Impact**: While parameters are partly constrained by schema or authentication, unsanitized user input in `ORDER BY` can lead to blind SQL injection or query manipulation on SQLite/D1.
- **Remediation**: Apply strict column whitelisting (matching the pattern implemented in `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts` and `packages/domain/order/queries/shared-listing.ts`).

#### SEC-02: Missing Production Domain in Worker CORS Allowlist
- **Anchor File**: `worker/src/index.ts:45-51`
- **Issue**: `ALLOWED_ORIGIN_PATTERNS` contains `auraspace.cafe` and `localhost`, but is missing `auracafe.vn` and `*.auracafe.vn`, whereas `worker/src/middleware/cors.ts` specifies `auracafe.vn`.
- **Impact**: Cross-origin requests from the live production frontend (`https://auracafe.vn`) or staging subdomains will be blocked by the browser with a CORS policy violation.
- **Remediation**: Add `/^https:\/\/(www\.)?auracafe\.vn$/` and `/^https:\/\/[a-z0-9-]+\.auracafe\.vn$/` to `ALLOWED_ORIGIN_PATTERNS` in `worker/src/index.ts`.

---

### 🟡 MEDIUM SEVERITY

#### PERF-01: N+1 Query Pattern in Order Read Handlers
- **Anchor File**: `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts:117-120`
- **Issue**:
  ```typescript
  const orders = await Promise.all(rows.results.map(async (_order) => {
    const { items, payments } = await fetchOrderItemsAndPayments(db, _order.id as string);
    return projectForActor(scope, _order, items, formatOrder, formatCustomerOrder, payments);
  }));
  ```
- **Impact**: Fetching 20 orders triggers 40 additional D1 database roundtrips (`items` and `payments` per order ID).
- **Remediation**: Use a single batch query with `WHERE order_id IN (...)` or a SQL JOIN aggregation to load items and payments in O(1) database queries.

#### ARCH-01: Monorepo Files Exceeding the 200 LOC Limit
- **Count**: 38 files in `worker/src/` exceed 200 lines.
- **Top Candidates for Modularization**:
  1. `worker/src/lib/mautic-client.ts` (429 LOC)
  2. `worker/src/tree/subscriptions/sub-handlers.ts` (388 LOC)
  3. `worker/src/erpnext/client/core.ts` (376 LOC)
  4. `worker/src/erpnext/mapper/orders-sales-invoices.ts` (349 LOC)
  5. `worker/src/schemas/auth.ts` (328 LOC)
- **Remediation**: Continue modularization sprints following the successful pattern established with `worker/src/index.ts` (reduced from 610 to 122 LOC) and `packages/domain/payment/commands/payos-create-link.ts` (reduced from 283 to 180 LOC).

---

### 🟢 LOW SEVERITY / TECH DEBT

#### DEP-01: Build & Toolchain Audit Vulnerabilities
- **Details**: `npm audit` reports 18 vulnerabilities (7 moderate, 11 high) in development dependencies (`nanoid`, `sharp`, `humanfs`).
- **Remediation**: Run `npm update` / `npm audit fix` for build toolchains without breaking production bundles.

#### TODO-01: Documented Merchant Verification Placeholders
- **Details**: 5 TODO references across code, primarily regarding Apple Pay / Google Pay live merchant identity certificates (`packages/domain/payment/commands/process-web-payment.ts:152`).
- **Remediation**: Integrate Apple Pay merchant validation certificate exchange when going live with production Apple Merchant ID.

---

## 3. Recommended Remediation Plan

1. **Immediate (P0)**:
   - Patch `ALLOWED_ORIGIN_PATTERNS` in `worker/src/index.ts` to include `https://auracafe.vn` and `https://*.auracafe.vn`.
   - Implement `safeSortColumn` whitelist across `openapi-categories`, `openapi-products`, and `openapi-tables`.
2. **Short-Term (P1)**:
   - Batch order items and payments query in `order-read-handlers.ts` to eliminate N+1 latency on Cloudflare D1.
3. **Medium-Term (P2)**:
   - Modularize remaining 5 largest files in `worker/src/` under 200 lines.
