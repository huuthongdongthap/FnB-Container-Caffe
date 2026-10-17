# Phase 17: Live D1 Schema Verification, Migration Ledger Baseline & 3-Tier Rollback Orchestration

**Context Links:**
- [Overview Plan](plan.md)
- [Phase 04: Staging Smoke Verification & Go-Live Gates](phase-04-staging-smoke-verification-and-go-live-gates.md)
- [Phase 16: Web Payment Fail-Closed, Staging Gates & Fail-Closed D1 Migration Runners](phase-16-web-payment-staging-gates-and-fail-closed-migrations.md)
- [Operational Readiness Report](../reports/audit-261014-repo-operational-readiness-verification.md)

## Overview
- **Priority:** P0 / P1 (Database Integrity, Migration Ledger & Release Gate Unblocking)
- **Current Status:** Planned (Awaiting Owner Authorization on Live D1 Read-Only Inspection & `GATE_3` Policy)
- **Description:** Defines the deep architectural options and step-by-step execution plan to: (1) inspect live D1 schema/data read-only without mutating production, (2) establish a checksum-verified `schema_migrations` ledger table with one-time `baseline_verified` seeding, (3) consolidate the 3 legacy migration directories into `worker/db/migrations/`, and (4) align `scripts/deploy-rollback.sh` and `GATE_3_ROLLBACK_READINESS` with the 3-tier Cloudflare Pages REST API + Worker `wrangler rollback` + D1 Time Travel architecture.

---

## Deep Brainstorm: Architectural Options & Trade-Off Analysis

### Decision Axis A: D1 Migration Tracking & Baseline Strategy
| Option | Mechanism | Pros | Cons / Risks | Verdict |
|:---|:---|:---|:---|:---:|
| **A1. Custom `schema_migrations` Ledger with Checksum + `baseline_verified` Mode** | Create `schema_migrations(filename PRIMARY KEY, checksum_sha256, applied_at, applied_by, execution_mode)` after read-only live D1 schema verification; seed already-applied migrations as `'baseline_verified'` without re-executing their SQL; `apply-migrations.sh --file <name.sql>` checks checksum & records `'forward_apply'`. | Zero replay of destructive table-rebuild SQL (`20260710_02`, `20261003_02`); detects accidental edits to historical SQL via SHA-256 mismatch; works identically on local and remote D1. | Requires a one-time read-only live D1 schema inspection before seeding the baseline rows. | **Recommended** |
| **A2. Native `wrangler d1 migrations apply` (`d1_migrations` table)** | Configure `migrations_dir = "db/migrations"` in `worker/wrangler.toml` and use Wrangler's built-in `d1_migrations` table. | Native Wrangler CLI command. | Wrangler's `d1 migrations apply` replays every unrecorded file in `migrations_dir` unless `d1_migrations` is manually pre-populated first, and does not verify SHA-256 checksums or block superseded files (`20260706_11`, `20260824_02`) still sitting in the directory. | Reject unless pre-seeded + superseded files removed |

### Decision Axis B: `GATE_3_ROLLBACK_READINESS` & D1 Production Rollback Policy
| Option | Mechanism | Pros | Cons / Risks | Verdict |
|:---|:---|:---|:---|:---:|
| **B1. 3-Tier PITR Rollback Policy (Pages REST API + Worker `wrangler rollback` + D1 Time Travel / Dump + Forward-Fix)** | Update `scripts/deploy-rollback.sh` to support `--layer=pages|worker|d1` with project `fnb-caffe-container`, `wrangler rollback --config worker/wrangler.toml`, and `wrangler d1 time-travel info/restore fnb-caffe-db`; update `GATE_3` policy to validate 3-tier rollback readiness + D1 Time Travel/backup runbook instead of requiring destructive `.down.sql` files for historical table-creation migrations. | Prevents catastrophic `DROP TABLE` data loss on live production D1; matches Cloudflare's official D1 PITR architecture. | Requires explicit owner sign-off to change `GATE_3` criteria from `1:1 .down.sql` to `PITR + 3-tier rollback script`. | **Recommended** |
| **B2. Full 36/36 `.down.sql` File Parity** | Author 29 missing `.down.sql` files and rewrite the 7 existing `.down.sql` files to use non-destructive archival/table-rebuild patterns. | Satisfies strict `1:1` file-count check. | SQLite cannot reverse `CREATE TABLE` without `DROP TABLE` (which is flagged as a data-loss hazard by `lint-d1-migrations.mjs`). | Not viable without redefining hazard rules |

---

## Implementation Steps (Upon Owner Approval)

### Step 1: Read-Only Live D1 Schema & Data Audit (Requires Owner Approval for Live Read-Only Query)
1. Inspect live table list and DDL:
   - `npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;"`
2. Check whether `push_subscriptions` and `audit_logs` suffered column resets from prior bulk migration runs:
   - `npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT role, COUNT(*) AS total, COUNT(device_id) AS with_device, COUNT(last_used_at) AS with_last_used FROM push_subscriptions GROUP BY role;"`
   - `npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT COUNT(*) AS total, COUNT(user_id) AS with_user_id, COUNT(entity_type) AS with_entity_type, COUNT(operating_unit_id) AS with_ou, COUNT(tenant_id) AS with_tenant, COUNT(correlation_id) AS with_corr FROM audit_logs;"`
3. Export DDL of the 9 remote-only tables (`_cf_KV`, `bonus_campaigns`, `signup_bonus_log`, `loyalty_audit_log`, `erpnext_product_sync`, `campaign_logs`, `campaign_configs`, `sessions`, `order_payments`) into a reference snapshot migration or schema archive.

### Step 2: `schema_migrations` Ledger & Baseline Seeding
1. Add forward migration `worker/db/migrations/20261015_01_schema_migrations_ledger.sql` creating `schema_migrations`.
2. Update `worker/scripts/apply-migrations.sh` to:
   - Compute SHA-256 of each requested `--file <migration.sql>`.
   - Support `--verify-ledger` (offline/online check) and `--record-baseline` (only when explicitly authorized with verified live schema snapshot).
   - Fail closed if a file in `schema_migrations` has a mismatched SHA-256 checksum.

### Step 3: 3-Tier `scripts/deploy-rollback.sh` & Legacy Migration Directory Consolidation
1. Update `scripts/deploy-rollback.sh` to fix `--project-name=fnb-caffe-container`, support `--worker` (`npx wrangler rollback <VERSION_ID> --config worker/wrangler.toml`), and support `--d1-bookmark=<BOOKMARK_ID>` (`npx wrangler d1 time-travel restore fnb-caffe-db --bookmark=<BOOKMARK_ID>`).
2. Archive/remove duplicate legacy directories (`db/migrations`, `scripts/migrations`, `worker/migrations`) after confirming zero unmerged SQL diffs against `worker/db/migrations/`.
3. Update `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts` to test all new rollback script modes and ledger verification paths offline.

## Todo List
- [ ] Obtain owner approval on Decisions 1–5 in `plans/reports/audit-261014-repo-operational-readiness-verification.md` (Section 6.6)
- [ ] Execute read-only live D1 inspection and record findings (`sqlite_master`, `push_subscriptions`, `audit_logs`, 9 remote-only tables)
- [ ] Implement `20261015_01_schema_migrations_ledger.sql` and ledger checksum verification in `worker/scripts/apply-migrations.sh`
- [ ] Upgrade `scripts/deploy-rollback.sh` to 3-tier rollback (`fnb-caffe-container` Pages + `aura-space-worker` Worker + `fnb-caffe-db` D1 Time Travel)
- [ ] Consolidate legacy migration directories (`db/migrations`, `scripts/migrations`, `worker/migrations`) into `worker/db/migrations`
- [ ] Provision 6 `*_STAGING` credentials and execute the 4-stage live staging smoke run (`Phase 04`)
