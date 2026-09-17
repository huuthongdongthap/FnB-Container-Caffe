# Audit Plan: Codebase Refactor & Consolidation

- **Date**: 2026-09-17
- **Target**: `FnB-Container-Caffe` (Worker Backend & React Frontend)
- **Status**: Ready for Execution
- **Pipeline**: `risk-rank` → `select-audits` → `allocate-resources`

---

## 1. Executive Summary

- **Current State**:
  - Vitest: **369 test files, 3,374 tests pass (100%)**
  - Frontend: `npm run build` succeeds (`vite: build ok`)
  - Backend: `npx wrangler deploy --dry-run` compiles and bundles with 0 errors
  - Local runtime: Frontend on `http://localhost:5173`, Worker on `http://localhost:8787`
- **Goal**: Audit remaining oversized files (>200 LOC), prioritize refactoring batches, and establish a safe Git checkpoint before further mutations.

---

## 2. Pipeline Phase 1: Risk Ranking (`risk-rank`)

We rank remaining files exceeding the 200 LOC standard based on:
- **Blast Radius**: Core transaction vs secondary reporting
- **Test Coverage**: Number of unit/integration tests guarding the module
- **Dependency Coupling**: How many external modules import from this file

| Rank | File Path | LOC | Blast Radius | Test Suite | Risk Score | Recommended Strategy |
|:---:|---|:---:|:---:|:---:|:---:|---|
| **R1** | `worker/src/routes/crm.ts` | 371 | High (Customer events, orders, referrals) | High (Passes) | **Medium** | Split into `crm/events.ts`, `crm/account.ts`, `crm/segments.ts` |
| **R2** | `worker/src/routes/dindin.ts` | 361 | High (Cart & checkout operations) | High (Passes) | **Medium** | Extract cart/checkout handlers into `dindin/` |
| **R3** | `worker/src/routes/openapi-categories.ts` | 338 | Medium (Catalog categories CRUD) | High (Passes) | **Low** | Extract route handlers into `openapi-categories-handlers/` |
| **R4** | `worker/src/routes/openapi-products.ts` | 333 | Medium (Product catalog & happy-hour) | High (Passes) | **Low** | Extract route handlers into `openapi-products-handlers/` |
| **R5** | `worker/src/routes/analytics-hono.ts` | 310 | Low (Read-only metrics & aggregations) | Medium | **Low** | Extract analytical queries into `analytics/queries.ts` |
| **R6** | `worker/src/routes/openapi-payments.ts` | 307 | Critical (PayOS gateway webhooks) | High (Passes) | **High** | Defer refactor until after Git commit checkpoint |
| **R7** | `worker/src/routes/promotions.ts` | 266 | Medium (Discount vouchers) | Medium | **Low** | Consolidate with existing `openapi-promotions-handlers` |
| **R8** | `worker/src/routes/refunds.ts` | 260 | High (PayOS refund & loyalty reversals) | High (Passes) | **Medium** | Extract refund command execution into domain |

---

## 3. Pipeline Phase 2: Select Audits (`select-audits`)

### Scope Constraints
- **Do NOT break the 3,374 test baseline**.
- **Keep barrel re-exports** so public route interfaces (`app.route('/api/crm', crmRouter)`) remain 100% backward compatible.
- **Immediate Action Items (Batch 1)**:
  1. Checkpoint current green fixes (`package.json`, symlinks, `@hono/zod-openapi` imports).
  2. Refactor `src/routes/crm.ts` (371 LOC → 3 focused modules < 150 LOC).
  3. Refactor `src/routes/dindin.ts` (361 LOC → 2 focused modules < 200 LOC).

---

## 4. Pipeline Phase 3: Allocate Resources (`allocate-resources`)

### Execution Steps & Safety Gates

```
[Gate 0: Current Commit Checkpoint]
      │
      ▼
[Batch 1: Refactor crm.ts] ──▶ vitest check (3,374 pass)
      │
      ▼
[Batch 2: Refactor dindin.ts] ──▶ vitest check (3,374 pass)
      │
      ▼
[Batch 3: Modularize Category/Product routes] ──▶ wrangler dry-run check
```

---

## 5. Decision on Git Push & Future Refactoring

1. **Commit checkpointing is mandatory**: Current changes fixed critical worker bundling errors and enabled 100% test pass. They should be committed now as `fix(worker): resolve domain symlinks and hono-zod-openapi schemas`.
2. **Pushing does NOT block future refactoring**: Pushing to GitHub records a verified, green milestone. Any refactoring done afterward is simply tracked as a new branch or new commit on top of this stable base.
