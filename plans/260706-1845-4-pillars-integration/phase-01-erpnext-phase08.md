# Phase 1: ERPNext Phase 08 — Customer/Vendor/Expense Sync

## Prerequisites
- Phase 1-7 routes exist at `worker/src/routes/erpnext/`
- ERPNext credentials configured via KV (`erpnext:api_url`, `erpnext:api_key`, `erpnext:api_secret`) or env vars
- `erpnext-sync.ts` sub-router exists (inventory sync works)

## Requirements

1. Customer sync bidirectional (ERPNext ↔ local D1)
2. Vendor sync (local → ERPNext)
3. Expense sync (local → ERPNext)
4. Deduplication logic (match by phone, email, or tax_id)
5. Retry queue for failed syncs (exponential backoff, max 5 attempts)
6. Sync status tracking per record

## Files to Create

| Action | File |
|--------|------|
| CREATE | `worker/db/migrations/20260707_01_erpnext_phase08.sql` |
| CREATE | `worker/src/tree/sync/dedup.ts` |
| CREATE | `worker/src/tree/sync/queue.ts` |
| CREATE | `worker/src/routes/erpnext/customers.ts` |
| CREATE | `worker/src/routes/erpnext/vendors.ts` |
| CREATE | `worker/src/routes/erpnext/expenses.ts` |
| CREATE | `worker/src/__tests__/tree/sync/dedup.test.ts` |
| CREATE | `worker/src/__tests__/tree/sync/queue.test.ts` |
| CREATE | `worker/src/__tests__/routes/erpnext-customers.test.ts` |

## Files to Modify

| Action | File |
|--------|------|
| MODIFY | `worker/src/routes/erpnext-sync.ts` — register customer/vendor/expense endpoints |
| MODIFY | `worker/src/tree/erpnext/sync.js` — add syncCustomer, syncVendor, syncExpense helpers |

## DB Schema

```sql
-- Phase 08: Customer/Vendor/Expense sync with retry queue
-- Migration: 20260707_01_erpnext_phase08.sql

-- Sync queue (shared across all entity types)
CREATE TABLE IF NOT EXISTS erpnext_sync_queue (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    entity_type TEXT NOT NULL CHECK(entity_type IN ('customer', 'vendor', 'expense')),
    entity_id TEXT NOT NULL,
    erpnext_id TEXT,
    action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'done', 'error', 'skipped')),
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON erpnext_sync_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON erpnext_sync_queue(entity_type, entity_id);

-- Customer-ERPNext link table (tracks local ↔ remote mapping)
CREATE TABLE IF NOT EXISTS erpnext_customer_links (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    local_customer_id TEXT NOT NULL REFERENCES customers(id),
    erpnext_customer_name TEXT NOT NULL,
    match_key TEXT NOT NULL, -- phone or email used for dedup
    match_key_type TEXT NOT NULL, -- 'phone' | 'email' | 'tax_id'
    synced_at TEXT DEFAULT (datetime('now')),
    UNIQUE(local_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_links_match ON erpnext_customer_links(match_key, match_key_type);

-- Vendor-ERPNext link
CREATE TABLE IF NOT EXISTS erpnext_vendor_links (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    local_vendor_id TEXT NOT NULL,
    erpnext_supplier_name TEXT NOT NULL,
    synced_at TEXT DEFAULT (datetime('now'))
);

-- Expense-ERPNext link
CREATE TABLE IF NOT EXISTS erpnext_expense_links (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    local_expense_id TEXT NOT NULL,
    erpnext_jv_name TEXT, -- Journal Entry name in ERPNext
    erpnext_pe_name TEXT, -- Payment Entry name (if paid)
    synced_at TEXT DEFAULT (datetime('now'))
);
```

## Tests (TDD First!)

Write these tests BEFORE any implementation. Each test should FAIL initially.

### dedup.test.ts

```typescript
// test 1: same phone number → detect match
// test 2: same email → detect match
// test 3: same tax_id → detect match
// test 4: different records → no match
// test 5: empty/partial fields → safe fallback (no match)
```

### queue.test.ts

```typescript
// test 1: enqueue → status 'pending'
// test 2: failed sync → increment attempts, set next_retry_at with backoff
// test 3: max retries reached → status 'error'
// test 4: retry eligible entries → filter by status + next_retry_at <= now
// test 5: mark done → update status + erpnext_id
```

### erpnext-customers.test.ts

```typescript
// test 1: create customer → enqueue sync → mock ERPNext returns 201
// test 2: update customer → enqueue update sync
// test 3: dedup on create: existing ERPNext customer with same phone → link, don't duplicate
// test 4: mock mode (no credentials) → 200 + { mock: true }
// test 5: missing required fields → 400 via Zod validation
```

## Implementation Steps

1. **Write all 9 tests** — confirm they FAIL
2. **Create migration** — run via `bash worker/scripts/apply-migrations.sh` or direct D1
3. **Implement `dedup.ts`** — `findMatch(db, key, value)` and `linkCustomer(db, localId, erpnextName, key, keyType)`
4. **Implement `queue.ts`** — `enqueue(db, type, entityId, action, payload)`, `retryEligible(db)`, `markDone(db, id, erpnextId)`, `markError(db, id, message)`
5. **Extend `sync.js`** — add `syncCustomer(env, customerData)`, `syncVendor(env, vendorData)`, `syncExpense(env, expenseData)` using `ErpnextClient`
6. **Implement `customers.ts`** — GET/POST/PUT /api/erpnext/sync/customers
7. **Implement `vendors.ts`** — POST /api/erpnext/sync/vendors
8. **Implement `expenses.ts`** — POST /api/erpnext/sync/expenses
9. **Register routes** in `erpnext-sync.ts`
10. **Run tests** — all must PASS

## Key Patterns (from existing codebase)

- Route handlers: named exports, `(req: Request, env: Env) => Response` signature
- Sub-router: `export function erpnextSyncRoutes(app: Hono<{ Bindings: Env & ErpnextEnv }>)` mounting at `/api/erpnext/sync/...`
- DB access: `env.AURA_DB.prepare(sql).bind(...).first()` — never `await env.AURA_DB`
- Mock mode: `createErpnextClient(env)` returns `null` when credentials missing → return `{ mock: true }`
- Logger: `createLogger({ route: 'erpnext-customers' })` from `../../middleware/logger`
- Error handling: try/catch per handler, return JSON error with appropriate status
