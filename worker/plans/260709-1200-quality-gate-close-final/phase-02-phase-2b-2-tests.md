# Phase 2: Phase 2b-2 Unit Tests

## Requirements
Write tests for all modules without coverage:
- `src/inventory/crud.ts` — CRUD edge cases
- `src/inventory/transactions.ts` — stock movement validation
- `src/payments/momo-create.ts` — Momo payment creation flow
- `src/webhooks/momo.ts` — webhook parsing + signature
- `src/tree/refunds/` — refund state machine
- `src/tree/campaigns/` — campaign logic
- `src/tree/referrals/` — referral tracking
- `src/clients/erpnext-crm-client.ts` — CRM methods
- `src/clients/erpnext-client.ts` — REST client
- `src/integrations/frigate.ts` — Frigate API

## Pattern
- `src/__tests__/tree/inventory/crud.test.ts` etc.
- Mock D1 via closure pattern: `{ prepare: (sql) => ({ bind: () => ({first,all,run}) }) }`
- Mock KV via `{ get: k=>Promise.resolve(v), put: (k,v)=>Promise.resolve(), delete: k=>Promise.resolve() }`
- Use `describe`/`it`/`expect` from vitest
- Each test file: 5-15 tests covering happy path + 2-3 error cases

## Target
Add ~80-120 new test cases across 10 files.
