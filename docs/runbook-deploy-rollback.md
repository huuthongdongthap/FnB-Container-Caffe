# Runbook — Deploy, Verify, Rollback (Cloudflare Workers + Pages)

Applies to: AURA CAFE worker (Cloudflare Workers + D1 + KV) + Pages frontend.

## Deployment Flow

```
Preflight → TypeCheck → Tests → Deploy Worker → Health Check → Smoke Tests → Monitor
```

## Commands

### Full Production Deploy
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
bash scripts/deploy.sh
```

### Deploy with Skip Flags
```bash
# Skip unit tests (not recommended for production)
bash scripts/deploy.sh --skip-tests

# Skip smoke tests (emergency hotfix only)
bash scripts/deploy.sh --skip-smoke
```

### List Recent Deployments
```bash
# Worker deployments
npx wrangler deployments list --config worker/wrangler.toml

# Pages deployments (production project: fnb-caffe-container)
npx wrangler pages deployment list --project-name=fnb-caffe-container --environment=production
```

### Rollback Worker (`aura-space-worker`)
```bash
# Get version ID from `npx wrangler deployments list --config worker/wrangler.toml`
npx wrangler rollback <VERSION_ID> --config worker/wrangler.toml --message "Emergency rollback"
```

### Rollback Pages Frontend (`fnb-caffe-container`)
> **Note:** Wrangler's `pages` command suite (`wrangler pages deployment list|create|tail`) does not provide a native `wrangler pages rollback` subcommand. Roll back via the Cloudflare Pages REST API or Cloudflare Dashboard (`Workers & Pages -> fnb-caffe-container -> Deployments -> Rollback to this deployment`).

The checked-in helper supports all three targets from any working directory:

```bash
bash scripts/deploy-rollback.sh --target pages <PAGES_DEPLOYMENT_UUID>
bash scripts/deploy-rollback.sh --target worker <WORKER_VERSION_UUID>
bash scripts/deploy-rollback.sh --target d1 <UNIX_OR_RFC3339_TIMESTAMP> [DATABASE_NAME]
bash scripts/deploy-rollback.sh --target d1 <D1_BOOKMARK> [DATABASE_NAME]
```

Pages requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (legacy `CF_ACCOUNT_ID` / `CF_API_TOKEN` also work). Set `CLOUDFLARE_PAGES_PROJECT` to override `fnb-caffe-container`. The helper uses POST to the Pages rollback REST endpoint and rejects failed or mismatched deployment confirmations. Worker and D1 commands use the repository's absolute `worker/wrangler.toml` path; the D1 database defaults to `fnb-caffe-db`.

An invocation without arguments only lists Pages deployments. An unknown target or invalid identifier fails before any rollback command. D1 restore overwrites the selected database; obtain explicit operational approval and a recovery bookmark before invoking it. A successful command is not health or version verification: perform the target-specific checks below after an approved rollback.

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/fnb-caffe-container/deployments/${DEPLOYMENT_ID}/rollback" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json"
```

## Preflight Checks (Automated in deploy.sh)

| Check | Failure Action |
|-------|----------------|
| Node + Wrangler installed | Block deploy |
| Git working tree clean | Warn only |
| Required secrets present | Block deploy |
| D1 database accessible | Block deploy |

## Health Check Criteria

```bash
curl -sS https://api.auraspace.cafe/api/health?db=1
```
- HTTP 200
- JSON: `{ "status": "healthy" | "degraded", ... }`
- Retries: 10 × 3s = 30s max wait

## Smoke Test Suite (Automated in smoke-production.sh)

| Test | Endpoint | Expected |
|------|----------|----------|
| Health (DB) | `GET /api/health?db=1` | `status: healthy/degraded` |
| Version | `GET /api/version` | SHA present |
| Menu | `GET /api/menu` | `success: true` |
| Auth Register | `POST /api/auth/register` | `success: true` |
| Auth Login | `POST /api/auth/login` | Token returned |
| Auth Me | `GET /api/auth/me` | Email matches |
| Order Create | `POST /api/orders` | Order ID returned |
| Payment Link | `POST /api/payment/create-link` | `checkoutUrl` returned |
| Admin Access | `GET /api/admin/orders` | 403 for non-owner (expected) |
| Webhook Alive | `GET /api/webhook/payos` | Message present |
| Correlation ID | Any | `X-Request-ID` header |
| CORS | OPTIONS preflight | `Access-Control-Allow-Origin` |

## Rollback Triggers

| Trigger | Action |
|---------|--------|
| Health check fails post-deploy | Auto-rollback to previous |
| Smoke test fails | Manual rollback |
| Critical alert (P0) within 10 min | Manual rollback |
| Error rate > 5% for 5 min | Manual rollback |

## Rollback Procedure

1. **Identify last good deployment**:
   ```bash
   npx wrangler deployments list --config worker/wrangler.toml
   npx wrangler pages deployment list --project-name=fnb-caffe-container --environment=production
   ```

2. **Rollback Worker**:
   ```bash
   npx wrangler rollback <VERSION_ID> --config worker/wrangler.toml --message "Emergency rollback"
   ```

3. **Rollback Pages (if frontend changed)**:
   ```bash
   curl -X POST \
     "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/fnb-caffe-container/deployments/${DEPLOYMENT_ID}/rollback" \
     -H "Authorization: Bearer ${CF_API_TOKEN}" \
     -H "Content-Type: application/json"
   ```

4. **Verify rollback**:
   ```bash
   curl -sS https://api.auraspace.cafe/api/health?db=1
   curl -sS https://api.auraspace.cafe/api/version
   ```

5. **Notify team**: Post to Telegram with deployment ID and reason.

## Schema Compatibility & D1 Recovery

- Canonical D1 migrations live in `worker/db/migrations/` and are applied explicitly via `bash worker/scripts/apply-migrations.sh --file <migration.sql>` (bulk replay is disabled fail-closed).
- Code rollback does NOT revert D1 schema. Only roll back Worker/Pages code directly if the previous version is compatible with the current D1 schema.
- If a migration corrupted D1 schema or data, restore D1 using Cloudflare D1 Time Travel (PITR) or SQL backup before/with code rollback:
  ```bash
  npx wrangler d1 time-travel info fnb-caffe-db
  npx wrangler d1 time-travel restore fnb-caffe-db --bookmark="<BOOKMARK_ID>"
  # Or restore from SQL dump:
  bash worker/scripts/restore-d1.sh worker/backups/fnb-caffe-db-YYYYMMDD-HHMMSS.sql --target-db fnb-caffe-db-staging
  ```

## Post-Deploy Monitoring (10 min minimum)

- Watch Telegram alerts for: `kds_sla_breach`, `payment_failed`, `webhook_rejected`, 5xx spikes
- Check `/api/health?db=1` every 2 min
- Verify order flow: place test order → payment → fulfillment

## Contacts

- Primary: DevOps on-call
- Escalation: CTO

## Last Updated: 2026-08-25
