# Phase 2: TastyIgniter Bridge — Menu Sync + Order Bridge

## Prerequisites
- ERPNext Phase 08 complete (TastyIgniter uses ERPNext as shared customer/product DB when available)
- TastyIgniter instance running with API access (or mock mode for local development)
- Existing `ErpnextClient` in `worker/src/clients/erpnext-client.ts`

## Requirements

1. Menu sync: pull categories + modifiers from TastyIgniter, cache locally in D1
2. Menu sync: push local menu changes to TastyIgniter (when ERPNext not primary DB)
3. Order bridge: receive new orders from TastyIgniter → local D1 order system
4. Order bridge: send order status updates back to TastyIgniter
5. Customer merge: TastyIgniter customers link to ERPNext customers (via phone/email dedup from Phase 01)
6. Mock mode: full read/write without real TastyIgniter connection

## Files to Create

| Action | File |
|--------|------|
| CREATE | `worker/db/migrations/20260708_01_tastyigniter.sql` |
| CREATE | `worker/src/clients/tastyigniter-client.ts` |
| CREATE | `worker/src/tree/tastyigniter/sync-menu.ts` |
| CREATE | `worker/src/tree/tastyigniter/bridge-orders.ts` |
| CREATE | `worker/src/tree/tastyigniter/customer-merge.ts` |
| CREATE | `worker/src/routes/tastyigniter/menu.ts` |
| CREATE | `worker/src/routes/tastyigniter/orders.ts` |
| CREATE | `worker/src/routes/tastyigniter/customers.ts` |
| CREATE | `worker/src/__tests__/routes/tastyigniter-menu.test.ts` |
| CREATE | `worker/src/__tests__/routes/tastyigniter-orders.test.ts` |
| CREATE | `worker/src/__tests__/tree/tastyigniter/customer-merge.test.ts` |

## Files to Modify

| Action | File |
|--------|------|
| MODIFY | `worker/src/index.ts` — register TastyIgniter routes |
| REUSE | `worker/src/tree/sync/dedup.ts` — import customer dedup logic from Phase 01 |

## DB Schema

```sql
-- Phase 02: TastyIgniter Bridge
-- Migration: 20260708_01_tastyigniter.sql

-- Menu cache (local copy of TI categories + items)
CREATE TABLE IF NOT EXISTS ti_menu_cache (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ti_item_id INTEGER NOT NULL,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category_name TEXT,
    category_id INTEGER,
    modifiers TEXT, -- JSON array of modifier groups
    image_url TEXT,
    is_available INTEGER DEFAULT 1,
    last_synced_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ti_menu_sku ON ti_menu_cache(sku);
CREATE INDEX IF NOT EXISTS idx_ti_menu_category ON ti_menu_cache(category_id);
CREATE INDEX IF NOT EXISTS idx_ti_menu_available ON ti_menu_cache(is_available);

-- Order bridge (TI orders → local system)
CREATE TABLE IF NOT EXISTS ti_order_bridge (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ti_order_id INTEGER NOT NULL,
    local_order_id TEXT REFERENCES orders(id),
    status TEXT NOT NULL DEFAULT 'received',
    -- statuses: received | confirmed | preparing | ready | completed | cancelled
    payload TEXT NOT NULL, -- full TI order JSON for replay
    customer_phone TEXT,
    customer_email TEXT,
    total REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(ti_order_id)
);

CREATE INDEX IF NOT EXISTS idx_ti_order_ti_id ON ti_order_bridge(ti_order_id);
CREATE INDEX IF NOT EXISTS idx_ti_order_status ON ti_order_bridge(status);

-- Customer merge tracking
CREATE TABLE IF NOT EXISTS ti_customer_merge (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ti_customer_id INTEGER NOT NULL,
    local_customer_id TEXT REFERENCES customers(id),
    erpnext_customer_name TEXT,
    match_key TEXT, -- phone/email used
    match_key_type TEXT, -- 'phone' | 'email'
    merged_at TEXT DEFAULT (datetime('now')),
    UNIQUE(ti_customer_id)
);
```

## TastyIgniter Client Pattern

```typescript
// worker/src/clients/tastyigniter-client.ts
// Mirror of erpnext-client.ts: token auth, CRUD, mock mode, retry

export interface TiClientConfig {
  baseUrl: string;
  apiKey: string;
  maxRetries?: number;
  isMock?: boolean;
}

// TI API: GET /api/menu/categories, GET /api/menu/items
// TI API: POST /api/orders (receive from TI)
// TI API: PUT /api/orders/{id}/status (send status back)
```

## Tests (TDD First!)

```typescript
// tastyigniter-menu.test.ts
// test 1: pull menu → cache in D1
// test 2: pull menu → DEXISTING items updated, new items inserted
// test 3: push menu change → TI API receives update
// test 4: mock mode (no TI URL) → 200 + { mock: true }

// tastyigniter-orders.test.ts
// test 1: receive order from TI → insert ti_order_bridge + local order
// test 2: send status update → TI API PUT /orders/{id}/status
// test 3: duplicate ti_order_id → 409 conflict

// customer-merge.test.ts
// test 1: TI customer with same phone as ERPNext → merge
// test 2: TI customer with no match → create new local customer
// test 3: reuse Phase 01 dedup logic
```

## Implementation Steps

1. Write all 6 tests (FAIL)
2. Create migration
3. Implement `tastyigniter-client.ts` (mirror `erpnext-client.ts` pattern)
4. Implement `sync-menu.ts` — pull + cache TI menu
5. Implement `bridge-orders.ts` — receive TI orders, translate to local format
6. Implement `customer-merge.ts` — reuse `dedup.ts` from Phase 01
7. Create route files: `menu.ts`, `orders.ts`, `customers.ts`
8. Register routes in `index.ts`
9. Run tests → all PASS
