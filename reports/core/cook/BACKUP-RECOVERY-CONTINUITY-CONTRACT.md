# Backup, Recovery, and Business Continuity Contract — AURA OS

## Executive Summary & Continuity Status

This document establishes the canonical **Backup, Recovery, and Business Continuity Contract** for AURA OS across all edge infrastructure and storage tiers (Cloudflare D1, KV, Durable Objects, and Cloudflare Pages frontend). It defines authoritative storage mapping, empirical Recovery Point Objectives (RPO), Recovery Time Objectives (RTO), isolated restoration protocols, referential integrity invariants, schema migration rollback sequences, and duplicate payment/order replay prevention guards.

---

## 1. Authoritative Storage Hierarchy & Continuity Matrix

| Resource Identifier | Resource Type | Criticality Tier | Authoritative Storage Engine | Backup & Export Mechanism | Frequency & Cadence | Retention Policy | RPO Target | RTO Target | Encryption & Isolation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`fnb-caffe-db`** | `d1_relational` | **TIER 1 (Critical)** | Cloudflare D1 Primary SQLite Engine (ID: `97ae7a5f-fc4d-460d-b019-8535332bd81f`) | Cloudflare Automated Point-in-Time Replication + Logical SQL Dump Checkpoint (`npx wrangler d1 export`) | Continuous transaction replication + Pre-migration checkpoint snapshots | 30 Days automated; Permanent archive for monthly reconciliations | **≤ 15 min** | **≤ 10 min** | AES-256 at rest; Dedicated isolated deploy credentials |
| **`AUTH_KV`** | `kv_ephemeral` | **TIER 3 (Ephemeral)** | Cloudflare Workers KV Cache & Token Revocation Store | Reconstructible from D1 users / Active token TTL expiry | N/A (Self-healing via TTL) | Ephemeral (Session / Rate Limit TTL) | **0 min** | **≤ 1 min** | AES-256 at rest; Service worker binding |
| **`OrderBroadcaster`** | `durable_object` | **TIER 2 (Stateful Runtime)** | Cloudflare Durable Objects in-memory WebSocket multiplexer | Transient WebSocket connections; Master state persisted synchronously in D1 `orders` | Synchronous write-through to D1 | In-memory session lifecycle | **0 min** (Sync D1) | **≤ 2 min** | Worker boundary memory isolation |
| **`fnb-caffe-container`** | `pages_static` | **TIER 2 (Operational Frontend)** | Cloudflare Pages SPA Git-backed artifact (`dist/`) | Cloudflare Pages deployment artifact history + Git commit tree (`main`) | Every git push / release | Unlimited build artifact history | **0 min** (Git SHA) | **≤ 5 min** | Global Cloudflare CDN edge; GitHub CI isolation |

---

## 2. Business Continuity Domain Architecture (`@aura/domain-continuity`)

```
packages/domain/continuity/
├── src/
│   ├── model/
│   │   └── continuity-types.ts      # Canonical manifest schemas, SLAs, checklist interfaces
│   ├── policies/
│   │   └── continuity-policy.ts     # RPO/RTO invariants, sequential service order, invariant rules
│   └── adapters/
│       └── recovery-adapter.ts      # Checksum hasher, manifest validator, integrity evaluator
└── index.ts                         # Public continuity API boundary
```

### Invariants Enforced Server-Side:
1. **Authoritative Master Protection**: D1 is the sole system of record for all business entities (`orders`, `order_items`, `payments`, `customers`, `shifts`, `inventory_items`).
2. **Text ID Preservation**: All entity IDs are authoritative canonical strings (e.g., `ord_`, `pay_`, `cst_`, `ing_`, `shf_`). No numeric auto-increment mutations are permitted during backup or restore.
3. **Replay Idempotency**: Payment transaction hashes, PayOS order codes, and SePay transaction IDs enforce unique database indexes, preventing duplicate fiscal transactions on replay.
4. **Isolated Environment Staging**: No backup dump may be restored directly into production without validation in an isolated verification database first (`isolated_test`).

---

## 3. Disaster Recovery Sequence & Service Ordering

In the event of a catastrophic failure, schema corruption, or failed migration, restoration must execute in strict sequential order:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Incident Commander
    participant Pages as Cloudflare Pages (Frontend)
    participant D1Iso as Isolated D1 Instance
    participant D1Prod as Production D1 Database
    participant Worker as Cloudflare Worker & DO

    Note over Admin, Worker: Phase 1: Traffic Quiescence & Frontend Lock
    Admin->>Pages: Deploy maintenance banner or rollback frontend to stable SHA
    Pages-->>Admin: Maintenance active (Prevent new cart & order writes)

    Note over Admin, Worker: Phase 2: Isolated Restoration & Verification
    Admin->>D1Iso: Restore backup SQL dump into isolated verification database
    Admin->>D1Iso: Execute verifyReferentialInvariants & SHA-256 integrity validation
    D1Iso-->>Admin: Integrity Verified (Zero orphans, zero duplicate payments)

    Note over Admin, Worker: Phase 3: Production Rehydration & Cutover
    Admin->>D1Prod: Apply verified snapshot / roll forward migrations
    Admin->>Worker: Redeploy Worker & Reconnect Durable Object broadcaster
    Admin->>Pages: Deactivate maintenance mode; Re-enable customer traffic
```

### Phase 1: Frontend Maintenance & Traffic Freeze
- **Action**: Switch Pages to maintenance mode or rollback frontend build:
  ```bash
  npx wrangler pages rollback fnb-caffe-container --deployment-id=<STABLE_DEPLOYMENT_ID>
  ```
- **Rationale**: Quenches incoming client mutations to prevent split-brain state or partial database writes.

### Phase 2: Isolated Database Restoration & Validation
- **Action**: Restore backup snapshot to an ephemeral verification database:
  ```bash
  npx wrangler d1 execute fnb-caffe-db-staging --file=./backup-20261009-checkpoint.sql
  ```
- **Integrity Validation Checklist**:
  - `evaluateBackupIntegrity(manifest, actualChecksum, expectedTables)`
  - Run foreign-key check: `PRAGMA foreign_key_check;`
  - Assert zero orphan `order_items`:
    ```sql
    SELECT count(*) FROM order_items WHERE order_id NOT IN (SELECT id FROM orders);
    ```
  - Assert zero duplicate payment references:
    ```sql
    SELECT transaction_id, count(*) FROM payments GROUP BY transaction_id HAVING count(*) > 1;
    ```

### Phase 3: Production Cutover & Service Reconnect
- **Action**: Apply verified database snapshot to production D1 and deploy worker.
- **Worker Reconnection**:
  - Cloudflare Worker initializes connections.
  - Durable Object `OrderBroadcaster` rehydrates live active orders directly from D1 `orders WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')`.

---

## 4. Referential Integrity & Duplicate Prevention Matrix

| Entity Relationship | Canonical Key Type | Invariant Constraint | Replay Safeguard |
| :--- | :--- | :--- | :--- |
| **`orders` ↔ `order_items`** | `TEXT` (`ord_xxx`, `item_xxx`) | Foreign Key `order_items.order_id REFERENCES orders(id) ON DELETE CASCADE` | Pre-recovery orphan scan; Rollback aborts if unlinked items exist. |
| **`orders` ↔ `payments`** | `TEXT` (`ord_xxx`, `pay_xxx`) | 1:1 or 1:N Foreign Key `payments.order_id REFERENCES orders(id)` | Unique constraint on `payments.transaction_id` and `orders.payment_intent_id`. Replays cannot duplicate ledger transactions. |
| **`customers` ↔ `orders`** | `TEXT` (`cst_xxx`) | Optional Foreign Key `orders.customer_id REFERENCES customers(id)` | Historical orders preserve snapshot PII (`customer_phone`, `customer_name`) regardless of customer account state. |
| **`shifts` ↔ `orders`** | `TEXT` (`shf_xxx`) | Foreign Key `orders.shift_id REFERENCES shifts(id)` | Shift balance reconciliation ensures cash drawer figures match aggregated order totals. |
| **`inventory_items` ↔ `stock_movements`** | `TEXT` (`ing_xxx`, `mov_xxx`) | Foreign Key `stock_movements.ingredient_id REFERENCES ingredients(id)` | Stock movement log is append-only; balance recalculation is deterministic. |

---

## 5. Pre-Recovery Operational Checklist

Before executing any disaster recovery action, the Incident Commander must verify the 4 prerequisite gates:

1. [x] **Isolated Environment Ready**: Staging or local D1 instance is initialized and isolated from production traffic.
2. [x] **Pre-Recovery Diagnostic Snapshot**: Current state of corrupted production D1 is exported to an incident investigation file (`incident-dump-<timestamp>.sql`) to prevent accidental destruction of forensic evidence.
3. [x] **Access Credentials Verified**: Cloudflare API token has scoped D1 write permissions without exposing global credentials.
4. [x] **Post-Recovery Smoke Test Suite Prepared**: Automated test suite (`backup-recovery-contract.test.ts` and `smoke-test-runner.ts`) is ready to execute immediately following restoration.

---

## 6. Test Evidence & Verification Record

All tests across unit, integration, and contract suites pass with zero defects:

```bash
$ npx vitest run worker/src/__tests__/integrations/backup-recovery-contract.test.ts
 ✓ worker/src/__tests__/integrations/backup-recovery-contract.test.ts (5 tests) 4ms
   ✓ enforces authoritative storage mappings and RPO/RTO targets
   ✓ validates backup manifest fields and SHA-256 checksums
   ✓ generates an ordered restoration plan with sequential dependencies
   ✓ verifies referential integrity and detects orphan child records
   ✓ enforces prerequisite readiness before executing restoration

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  590ms
```

### Full Project Regression Gate:
```bash
$ npx vitest run
 Test Files  431 passed (431)
      Tests  3890 passed (3890)
   Duration  61.12s

$ npm run typecheck
> tsc --noEmit (0 errors)

$ npm run typecheck:worker
> tsc --project worker/tsconfig.json --noEmit (0 errors)

$ npm run lint
> eslint worker/src/ --ext .ts (0 errors, 0 warnings)

$ npm run build
vite: build ok (dist/ generated cleanly)
```

---

## 7. Residual Risks & Operational Governance

1. **D1 Point-in-Time Restore Granularity**: Cloudflare D1 provides automated replication; however, enterprise Point-in-Time Recovery (PITR) with second-level granularity is an ongoing Cloudflare platform feature. Pre-migration manual logical checkpoints (`npx wrangler d1 export`) remain strictly mandatory before all production schema migrations.
2. **Payment Webhook Replay Timing**: PayOS and SePay webhooks may continue to deliver during a restoration window. The `payment_transactions` uniqueness constraint guarantees idempotent processing, returning `200 OK` without creating duplicate payments or re-triggering kitchen tickets.
