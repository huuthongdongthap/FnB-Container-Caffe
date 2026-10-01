# Audit Plan: Backend Risk-Based Audit (Goal: check backend)

**Date:** 2026-09-29  
**Pipeline:** `/audit:plan` (DAG: `rank` → `select` → `allocate`)  
**Scope:** Cloudflare Worker Backend (`worker/`), Domain Packages (`packages/domain/*`), D1 SQLite & KV Storage  
**Goal Context:** `check backend`  
**Status:** **READY FOR EXECUTION**  

---

## 1. DAG Execution Summary

```text
[1. Risk-Rank] ──────▶ [2. Select-Audits] ──────▶ [3. Allocate-Resources]
   (Annual/Risk)        (Budget/Coverage)            (Capacity/Gates)
```

| Group | Sub-command | Focus | Verdict |
|:---|:---|:---|:---|
| **rank** | `risk-rank` | Score vulnerabilities, financial exposure, PII impact | Complete |
| **select** | `select-audits` | Filter high-yield target audits against 388 test suites | Complete |
| **allocate** | `allocate-resources` | Assign test suites, automated linters, and verification gates | Complete |

---

## 2. Risk-Rank (Group 1: `rank`)

### Scoring Methodology
- **Impact (1-5):** Severity of defect (5 = financial loss or auth bypass; 1 = minor logging defect).
- **Likelihood (1-5):** Probability of occurrence under real traffic and untrusted input.
- **Exposure:** Public vs. Authenticated vs. Internal Staff.
- **Risk Score:** `Impact × Likelihood` (Max 25).

### Risk Matrix

| Risk ID | Domain / Component | Failure Mode / Threat | Impact | Likelihood | Risk Score | Exposure | Priority |
|:---|:---|:---|:---:|:---:|:---:|:---|:---:|
| **R-01** | Payment & PayOS Webhook | Signature forgery, duplicate webhook playback, untrusted status transitions | 5 | 2 | **10** | Public Webhook | **CRITICAL** |
| **R-02** | Customer Order Scoping (IDOR) | Customer A reading/mutating Customer B's order via UUID manipulation | 4 | 2 | **8** | Customer API | **HIGH** |
| **R-03** | Order Creation & Pricing Invariant | Client tampering with item prices, bypassing server catalog rate | 5 | 1 | **5** | Public / Dine-in | **HIGH** |
| **R-04** | D1 Binding & Database Resilience | Runtime crash on undefined D1 database (`AURA_DB` vs `DB`), connection leak | 4 | 1 | **4** | Internal Worker | **MEDIUM** |
| **R-05** | CORS with Credentials on Errors | Browser fetch drop when error response returns wildcard `*` with cookies/bearer | 3 | 1 | **3** | Frontend Browser | **MEDIUM** |
| **R-06** | Reservation Authorization (PII) | Unauthorized access to guest name/phone/table bookings without staff JWT | 3 | 1 | **3** | Public / Staff | **MEDIUM** |
| **R-07** | SQL Parameter Injection (ORDER BY) | Unsanitized query string concatenated into dynamic `ORDER BY` clause | 4 | 1 | **4** | Order Listing | **MEDIUM** |
| **R-08** | ERPNext Sync & External APIs | Upstream timeout causing worker invocation hang or unhandled promise rejection | 2 | 2 | **4** | Async Worker | **LOW** |

---

## 3. Select Audits (Group 2: `select`)

Based on risk ranking and existing test coverage (388 files, 3,557 passing tests), the following targeted audits are selected:

### Audit Package A: Financial & Payment Boundary Audit
- **Target:** `packages/domain/payment/`, `worker/src/routes/openapi-payments-handlers/`
- **Key Verifications:**
  1. `POST /api/payment/create-link` guest access (table order QR code diners).
  2. Webhook signature validation and order status progression (`pending` → `paid`).
  3. `POST /api/payments/payment-request` (Apple Pay / Google Pay web token processing).
  4. Idempotency replay on duplicate order submission (`Idempotency-Key` header with 120s KV TTL).

### Audit Package B: IDOR Scoping & Role-Based Access Control (RBAC)
- **Target:** `worker/src/routes/openapi-orders-handlers/helpers.ts`, `worker/src/middleware/auth.ts`
- **Key Verifications:**
  1. `resolveCustomerScope()` correctly restricts `GET /api/orders` and `GET /api/orders/:id` to `customer_id === user.id`.
  2. Unauthenticated requests to customer/admin order endpoints return strict 401.
  3. Foreign order queries return 404 (fail-closed, no existence leak).
  4. Reservation management routes (`GET /api/reservations`, `PATCH /:id/approve`, `PATCH /:id/reject`, `DELETE /:id`) require staff/owner tokens.

### Audit Package C: Runtime Stability & Database Binding Hygiene
- **Target:** `worker/src/lib/db.ts`, `worker/src/routes/openapi-*-handlers/`
- **Key Verifications:**
  1. Database accessor `getDatabase(c)` standardizes `c.env.AURA_DB ?? c.env.DB` across inventory, loyalty, and promotions.
  2. Safe SQL sort parameter sanitization (`ALLOWED_SORT_COLUMNS`).
  3. Worker type safety (`npm run typecheck:worker` passes with 0 errors).
  4. Zero RPC teardown leaks during test executions.

---

## 4. Allocate Resources (Group 3: `allocate`)

### Verification Allocation Matrix

| Audit Package | Automated Suites | Manual / E2E Verification | Target Threshold |
|:---|:---|:---|:---|
| **Package A (Payments)** | `payos-create-link.test.ts`, `create-order.test.ts` | PayOS checkout link generation test | 100% PASS |
| **Package B (IDOR/Auth)** | `m4d-customer-order-projection.test.ts`, `m4d-order-history.test.ts` | Curl with customer vs staff JWT | 100% PASS |
| **Package C (Runtime/DB)** | `admin-orders.test.ts`, `cors.test.ts`, `order-read-handlers.test.ts` | `tsc --project worker/tsconfig.json --noEmit` | 0 Errors |

---

## 5. Audit Plan Sign-Off

- **Risk Assessment:** Completed (Top risk: Payment Integrity & IDOR scoping).
- **Audit Selection:** 3 high-yield packages targeting API boundary, payments, and runtime stability.
- **Resource Allocation:** Integrated into standard Vitest runner and Cloudflare Worker typechecker.
- **Next Step:** Run selected audit test suites and compile findings to `reports/audit/plan/backend-audit-results.md`.
