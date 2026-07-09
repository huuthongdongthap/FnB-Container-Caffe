# Phase 2b-3: Client-Level Unit Tests — ERPNext + Frigate
Run: 2026-07-08 · Parent: `plans/260708-1002-test-coverage-blitz/plan.md`
Mode: deep unit tests (pure mocking, no source changes)

## Context
Phase 2b-2 complete: 9 new test files, ~30 tests, all passing (760 total).
These 4 client modules (1,426 lines) have **zero dedicated tests** — they make real HTTP
calls to external services (ERPNext, Frigate) with minimal validation.

## Scope — 39 tests across 5 files

### Core

| Module | Lines | Test file | Tests | Behaviors |
|--------|-------|-----------|-------|-----------|
| `erpnext-client.ts` | 429 | `src/__tests__/clients/erpnext-client.test.ts` | 12 | Auth header, retry/backoff, timeout (AbortController), HTTP error classification (4xx vs 5xx vs network), `searchModified` timestamp .0 suffix, `createInvoice`, `createSalesOrder`, `createLead` mock mode, malformed JSON, null factory |
| `erpnext-crm-client.ts` | 232 | `src/__tests__/clients/erpnext-crm-client.test.ts` | 8 | `createLead` consent gate, `updateCustomer` field filtering, `addTag`/`removeTag` idempotent + JSON parse of `_user_tags`, `getCustomerInfo` mapping, null factory |
| `erpnext-accounting-client.ts` | 273 | `src/__tests__/clients/erpnext-accounting-client.test.ts` | 8 | `processOrderToInvoice` idempotent mapping, phone/email customer lookup, VAT update, `getInvoiceByOrderId` null return, `_markMappingFailed` DB write, null factory |
| `erpnext-product-client.ts` | 238 | `src/__tests__/clients/erpnext-product-client.test.ts` | 6 | `getProductAvailability` KV cache hit/miss, stock aggregation, `searchChangedProducts` timestamp .0, `syncProductsToLocal` ON CONFLICT DO UPDATE batch, `updateProduct` field whitelist, null factory |
| `frigate-client.ts` | 154 | `src/__tests__/clients/frigate-client.test.ts` | 5 | `createFrigateClient` null on disabled/missing URL, `getRecentEvents` mock + HTTP fallback, `getEvent` mock, `getCameraSnap` HEAD, non-null factory |

## Mock Strategy
- **HTTP**: `vi.stubGlobal('fetch', mockFn)` — single fetch mock per test, restored in `afterEach`
- **KV**: Plain object `{ get: vi.fn(), put: vi.fn(), delete: vi.fn() }`
- **D1**: Closure-based `{ prepare: (sql) => ({ bind: () => ({ first: async () => null, run: async () => ({ success: true }) }) }) }`
- **No module mocks** — import clients directly (esm paths with `.js`)

## Constraints (same as 2b-2)
- Zero `:any` types, zero `console.*`, ESM `.js` extensions
- Tests only — no source changes
- Each test file self-contained with its own mocks

## Files to Create
```
src/__tests__/clients/erpnext-client.test.ts
src/__tests__/clients/erpnext-crm-client.test.ts
src/__tests__/clients/erpnext-accounting-client.test.ts
src/__tests__/clients/erpnext-product-client.test.ts
src/__tests__/clients/frigate-client.test.ts
```

## Deferred (not this phase)
- `src/clients/tastyigniter-client.ts`
- `src/tree/erpnext/sync.js`
- `src/routes/erpnext-pos.ts`, `erpnext-invoices.ts`, `erpnext-sync.ts`
- Campaigns tree: `cashback-expiry.ts`, `winback.ts`, `cron-handler.ts`, `templates.ts`, `types.ts`
- Referrals: `reverse-cashback.ts`

## Validation
- `npx vitest run src/__tests__/clients/` → all pass, ≥39 new tests
- `npx vitest run` → 0 regressions from 760 baseline
- `git diff --stat` shows only 5 new test files

## Rollback
Delete all 5 files in `src/__tests__/clients/`.
