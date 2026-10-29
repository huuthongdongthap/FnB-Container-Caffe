# Runbook — D1 Backup & Restore (Cloudflare Workers)

Applies to: AURA CAFE worker (Cloudflare Workers + D1 + KV).

## Backup Strategy

| Tier | Mechanism | Frequency | Retention | RPO |
|------|-----------|-----------|-----------|-----|
| Primary | D1 Time Travel (30-day PITR) | Continuous (auto) | 30 days | Near-zero |
| Secondary | `wrangler d1 export` (SQL dump) | Daily via cron / manual | 90 days | 24h |
| Tertiary | R2 artifact of export | Daily (script) | 1 year | 24h |

**RTO Target:** < 30 minutes for SQL restore + smoke test.

## Commands

### Create a Backup (Remote Production)
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
bash scripts/backup-d1.sh --remote
```
Outputs:
- `backups/fnb-caffe-db-YYYYMMDD-HHMMSS.sql` — Full schema + data
- `backups/fnb-caffe-db-YYYYMMDD-HHMMSS.bookmark` — Time-travel bookmark for PITR

### Create a Backup (Local Dev)
```bash
bash scripts/backup-d1.sh --local
```

### List Backups
```bash
ls -la backups/
```

### Restore from SQL Dump (Staging/DR Target)
```bash
# ⚠️ DESTRUCTIVE — only run against non-production target
bash scripts/restore-d1.sh backups/fnb-caffe-db-20260825-204654.sql --target-db fnb-caffe-db-staging
```

### Point-in-Time Restore (Time Travel)
```bash
# 1. Inspect current bookmark or resolve bookmark for a specific RFC3339 / Unix timestamp
npx wrangler d1 time-travel info fnb-caffe-db
npx wrangler d1 time-travel info fnb-caffe-db --timestamp="2026-10-15T00:00:00Z"

# 2. Restore using bookmark from backup or any valid bookmark/timestamp within 30 days
npx wrangler d1 time-travel restore fnb-caffe-db --bookmark=00000645-00000000-000050d2-48dcfd28eff342f20ea3c049d1f2f5f9
npx wrangler d1 time-travel restore fnb-caffe-db --timestamp="2026-10-15T00:00:00Z"
```

### Verify Restore Integrity
```bash
# Row counts for critical tables
npx wrangler d1 execute fnb-caffe-db --remote --command "
  SELECT 'orders' AS table_name, COUNT(*) AS count FROM orders
  UNION ALL SELECT 'payments', COUNT(*) FROM payments
  UNION ALL SELECT 'products', COUNT(*) FROM products
  UNION ALL SELECT 'categories', COUNT(*) FROM categories
  UNION ALL SELECT 'customers', COUNT(*) FROM customers
  UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
  UNION ALL SELECT 'staff_shifts', COUNT(*) FROM staff_shifts;
"

# Schema sanity
npx wrangler d1 execute fnb-caffe-db --remote --command "
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
"
```

## Automated Daily Backup (Cron)

Add to `wrangler.toml` cron or external scheduler:
```toml
[triggers]
crons = [
  "0 2 * * *",  # Daily at 02:00 UTC
]
```

With a scheduled handler that calls the backup script and uploads to R2.

## Restore Drill Procedure (Monthly)

1. **Create staging DB** (or reuse existing):
   ```bash
   npx wrangler d1 create fnb-caffe-db-drill-$(date +%Y%m)
   ```
2. **Run restore script** against staging.
3. **Run smoke tests** (see `scripts/smoke-saas.sh` adapted for staging URL).
4. **Record results** in incident log with timestamps.
5. **Clean up** staging DB after verification.

## Sensitive Data & Secrets Handling

- **CLASSIFICATION: SENSITIVE / RESTRICTED.** While Worker runtime secrets (`JWT_SECRET`, `PAYOS_*`, etc.) are managed via `wrangler secret put` and not stored in D1, D1 SQL exports (`backups/*.sql`) contain **sensitive authentication and personal data**, including `users.password_hash` (PBKDF2 Staff credential hashes), `staff_login_identities`, `staff_devices`, and customer PII (`customers.phone`, `customers.email`, `customers.date_of_birth`, wallet balances).
- Treat all SQL dumps and R2 backup artifacts with the same access control as production credentials: restrict read/export/restore permissions to authorized DB/Platform Admins with MFA, encrypt artifacts at rest, never commit `.sql` dumps to git, and audit every export/download/restore operation.
- KV namespaces (`AUTH_KV`) are **not backed up** — if `AUTH_KV` is lost or a D1 backup is restored after an incident, increment `users.auth_version` (and revoke compromised `staff_devices` rows) in D1 before reopening traffic so previously issued Staff tokens are invalidated at the D1 authority layer without relying on KV revocation entries.

## Migration Compatibility

- All canonical schema changes live in `worker/db/migrations/` (see `worker/db/migrations/README.md`).
- Bulk replay of all historical migrations is disabled (fail-closed) because re-running table-rebuild migrations (`20260710_02_notifications_fixed.sql`, `20261003_02_admin_metrics_and_inventory.sql`) overwrites live columns.
- Apply each pending forward migration explicitly: `bash worker/scripts/apply-migrations.sh --file <migration.sql>`
- Run integrity checks after any restore + migration apply.

## Contacts

- Primary: DevOps on-call (Telegram)
- Escalation: CTO

## Last Drill

- Date: 2026-08-25
- Status: Backup created, restore not yet tested against staging (no staging DB quota)
- Next drill: 2026-09-25
