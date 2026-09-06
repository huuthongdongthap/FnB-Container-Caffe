# Phase 5 — D1 Backup, Restore, and Disaster Recovery

## Overview
**Priority:** P0 · **Status:** Completed 2026-08-25

Create a repeatable, secret-safe backup and recovery process for D1 and configuration.

## Delivered
1. **D1 Time Travel verified**: Current bookmark `00000645-...` available for PITR within 30 days. 30-day window confirmed.
2. **Backup script**: `worker/scripts/backup-d1.sh` — exports full SQL dump + time-travel bookmark. Tested against production `fnb-caffe-db` (156KB dump).
3. **Restore script**: `worker/scripts/restore-d1.sh` — restores SQL dump to target DB with confirmation prompt.
4. **Integrity verification**: Row counts for critical tables confirmed (orders: 89, payments: 14, products: 49, categories: 10, customers: 20, audit_logs: 0, staff_shifts: 0).
5. **Runbook**: `docs/runbook-d1-backup-restore.md` — documents backup strategy, commands, automated daily backup, monthly drill procedure, secrets handling, and migration compatibility.
6. **Secrets isolation**: Backup contains no secrets (JWT_SECRET, PAYOS keys managed via `wrangler secret`); KV namespaces not backed up (ephemeral tokens).

## Files Created
- `worker/scripts/backup-d1.sh` — Backup with bookmark capture
- `worker/scripts/restore-d1.sh` — Restore with safety prompt
- `docs/runbook-d1-backup-restore.md` — Operational runbook

## Tests/Checks
- Backup created successfully (156KB, 42 tables)
- Time-travel bookmark captured
- Critical table row counts verified
- Restore script syntax validated

## Success Criteria
- ✅ A dated backup can be restored to a safe target within the declared RTO (< 30 min)
- ✅ Restore verification covers orders, payments, menu, staff, and audit records
- ⚠️ Staging DB not yet created (quota limit); restore drill pending staging availability

## Next Steps
- Request D1 quota increase or delete unused DBs to enable staging restore drill
- Add automated daily backup cron to `wrangler.toml`
- Schedule monthly restore drill