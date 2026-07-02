---
title: "Phase 04 — D1 Migration Auto-apply"
description: "Auto-apply D1 migrations during deploy with --skip-migrations escape hatch"
status: completed
priority: P2
effort: 1.5h
phase: 04
depends_on: [01]
blocks: []
---

## Overview

D1 migrations at `scripts/migrations/` are currently applied manually. Integrate auto-apply into `deploy-cloudflare.sh` so every deploy includes DB schema changes. A `--skip-migrations` flag provides an escape hatch.

## Current State

**Migrations directory:** `scripts/migrations/` — 4 SQL files:
- `001-odoo-tables.sql` — odoo_mappings, odoo_invoices, odoo_sync_logs
- `002-odoo-pos-tables.sql` — odoo_product_sync, odoo_sync_failures
- `003-odoo-crm-tables.sql` — odoo_customer_consent
- `004-rename-odoo-to-erpnext.sql` — rename tables/columns from Odoo to ERPNext

**Existing scripts:** `scripts/apply-migrations.sh` likely exists for this purpose. Check actual state below.

**Worker config:** `worker/wrangler.toml:7-9` — D1 database binding `AURA_DB` → `fnb-caffe-db` (id: `13260741-7795-431f-b491-7c8a17510bda`).

## Design Decision: Idempotent SQL vs Migration Tracking

All 4 migration files use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` with no guard against re-execution. This means:
- **001-003**: Safe to re-run (idempotent via `IF NOT EXISTS`)
- **004**: NOT safe to re-run — `ALTER TABLE RENAME` on already-renamed tables will fail

**Strategy:** Apply files in sorted order using `wrangler d1 execute`. Document that migrations must be idempotent. Migration 004 is a known risk — after it runs once, subsequent runs will fail. This is acceptable because:
1. Migrations are sequential — 004 only runs after 001-003
2. After a successful full migration run, all 4 files become no-ops (the migration tracking system built into `wrangler d1 migrations` is the proper solution, but that requires a `migrations/` folder inside the worker directory with its own structure)

**Pragmatic approach:** Use `wrangler d1 execute --file=` for each migration. Since `CREATE TABLE IF NOT EXISTS` is idempotent, re-applying files 001-003 is safe. File 004 will fail on re-run — this is documented as a known limitation. For proper migration tracking, the team should eventually adopt `wrangler d1 migrations` (out of scope).

## Requirements

- `deploy-cloudflare.sh` applies all `.sql` files from `scripts/migrations/` in sorted order
- Runs AFTER worker deploy (migrations need the D1 database, not the Worker)
- Runs BEFORE post-deploy verification (so health check includes migrated tables)
- `--skip-migrations` flag to bypass
- Each migration file output is summarized (first line + success/error)
- Exit with error if any migration fails

## Implementation Steps

### Step 1: Check existing `scripts/apply-migrations.sh`

Read the file if it exists. If it already has migration logic, refactor `deploy-cloudflare.sh` to source it rather than duplicating.

### Step 2: Add migration step to `deploy-cloudflare.sh`

Insert between worker deploy and post-deploy verification:

```bash
# ── 3a. D1 Migration Auto-apply ──────────────────────────────────────────
if [[ "${1:-}" != "--skip-migrations" && "${2:-}" != "--skip-migrations" && "${3:-}" != "--skip-migrations" ]]; then
  MIGRATIONS_DIR="scripts/migrations"
  if [[ -d "$MIGRATIONS_DIR" ]] && [[ -n "$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null)" ]]; then
    echo ""
    echo "--- D1 Migrations ---"
    cd "$WORKER_DIR"

    for migration in ../"$MIGRATIONS_DIR"/*.sql; do
      migration_name=$(basename "$migration")
      echo "Applying: $migration_name"
      # Run migration; capture output to check for errors
      MIGRATION_OUTPUT=$(npx wrangler d1 execute fnb-caffe-db --file="$migration" 2>&1)
      MIGRATION_EXIT=$?

      if [[ $MIGRATION_EXIT -ne 0 ]]; then
        echo "ERROR: Migration $migration_name failed:"
        echo "$MIGRATION_OUTPUT" | tail -10
        cd ..
        exit 1
      fi
      echo "  OK: $migration_name applied."
    done

    cd ..
    echo "--- Migrations Complete ---"
  else
    echo "No migration files found in $MIGRATIONS_DIR — skipping."
  fi
else
  echo "Skipping D1 migrations (--skip-migrations flag)"
fi
```

### Step 3: Update usage comment

Add `[--skip-migrations]` to the usage line.

### Step 4: Execution order in deploy script

The final execution order must be:
1. `[0/3]` Pre-deploy test gate (Phase 01)
2. `[1/3]` Frontend build
3. `[2/3]` Pages deploy
4. `[3/3]` Worker deploy
5. D1 migration auto-apply (Phase 04)
6. Post-deploy verification (Phase 03)

### Step 5: Verify

```bash
# Dry-run: skip everything except migration check
bash deploy-cloudflare.sh --skip-tests --skip-verify --worker-only 2>&1 | grep -i migration

# Apply specific migration manually first to test
cd /Users/macbook/FnB-Container-Caffe/worker
npx wrangler d1 execute fnb-caffe-db --file=../scripts/migrations/001-odoo-tables.sql
```

## Test Matrix

| Scenario | Expected |
|----------|----------|
| Fresh deploy, all migrations | Each SQL file applied, output shows OK |
| Re-deploy, tables exist | 001-003 succeed (IF NOT EXISTS), 004 fails (column already renamed) |
| `--skip-migrations` | No migration step runs |
| No `scripts/migrations/` dir | "No migration files found" message, continues |
| Migration SQL has syntax error | Exit non-zero, error message shown |
| `--worker-only` (no pages deploy) | Migrations still run (D1 is Worker's concern) |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Migration 004 fails on re-run | High | Medium | Documented limitation; team must write idempotent migrations going forward. `--skip-migrations` flag for re-deploys. |
| `wrangler d1 execute` not authenticated | Low | High | Same auth as `wrangler deploy` — if deploy works, migrations work |
| Migration applied but Worker code not yet updated | Low | High | Worker is deployed BEFORE migrations (order matters — new tables with NULL-safe code first) |
| Long migration on large table blocks deploy | Low | Low | D1 is tiny (SQLite); migrations run in < 1s |

## Known Limitation

Migration 004 (`ALTER TABLE RENAME`) is NOT idempotent. After first successful run, re-applying it will fail. This is acceptable for now because:
1. Re-deploys typically skip migrations with `--skip-migrations`
2. The team should adopt proper `wrangler d1 migrations` with migration tracking (separate task, out of scope)

Future improvement: add a `migrations_applied` table to track which migrations have run.

## Related Files

- `deploy-cloudflare.sh` — modify
- `scripts/migrations/*.sql` — read only (applied)
- `scripts/apply-migrations.sh` — check existing; refactor or source
- `worker/wrangler.toml:7-9` — D1 binding (read only)
