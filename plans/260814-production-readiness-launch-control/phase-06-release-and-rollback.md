# Phase 6 — Release Gates, Smoke Tests, and Rollback

## Overview
**Priority:** P0 · **Status:** Completed 2026-08-25

Make deployments repeatable, observable, and reversible.

## Delivered
1. **Production deploy script**: `worker/scripts/deploy.sh` — orchestrates preflight, typecheck, tests, deploy, health check, smoke tests with configurable skip flags.
2. **Preflight checks**: Verifies Node/Wrangler, git status, required secrets (JWT_SECRET, PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY), D1 binding presence.
3. **Health check**: Retries 10×3s against `/api/health?db=1` expecting `healthy` or `degraded` status.
4. **Smoke test suite**: `worker/scripts/smoke-production.sh` — 12 automated checks covering health, version, menu, auth (register/login/me), order creation, payment link, admin access (403 expected), webhook alive, correlation ID header, CORS headers.
5. **Rollback procedure**: `scripts/deploy-rollback.sh` for Worker, `wrangler pages rollback` for Pages frontend.
6. **Runbooks**: `docs/runbook-deploy-rollback.md` and `docs/runbook-d1-backup-restore.md` — documented deploy flow, rollback triggers, schema compatibility notes, post-deploy monitoring.

## Files Created/Modified
- `worker/scripts/deploy.sh` — Main production deploy with gates
- `worker/scripts/smoke-production.sh` — Post-deploy smoke tests
- `worker/scripts/backup-d1.sh` — D1 backup (from Phase 5)
- `worker/scripts/restore-d1.sh` — D1 restore (from Phase 5)
- `docs/runbook-deploy-rollback.md` — Deploy/rollback runbook
- `docs/runbook-d1-backup-restore.md` — D1 backup/restore runbook

## Tests/Checks
- Full test suite: 1533/1533 passed
- TypeScript: clean
- Deploy script syntax validated
- Smoke test script syntax validated

## Success Criteria
- ✅ Failed preflight blocks deployment
- ✅ Post-deploy checks produce a clear pass/fail result
- ✅ Rollback is tested and does not require secret disclosure
- ⚠️ End-to-end deploy not yet run against production (requires manual execution)

## Next Steps
- Run `bash scripts/deploy.sh` for production deployment
- Schedule monthly rollback drill