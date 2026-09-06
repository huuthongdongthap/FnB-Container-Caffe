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
npx wrangler deployments list
# or for Pages
npx wrangler pages deployment list --project-name aura-cafe
```

### Rollback Worker
```bash
# Get deployment ID from `wrangler deployments list`
bash scripts/deploy-rollback.sh <deployment-id>
```

### Rollback Pages (Frontend)
```bash
npx wrangler pages rollback <deployment-id> --project-name aura-cafe
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
   npx wrangler deployments list
   ```

2. **Rollback Worker**:
   ```bash
   bash scripts/deploy-rollback.sh <deployment-id>
   ```

3. **Rollback Pages (if frontend changed)**:
   ```bash
   npx wrangler pages rollback <deployment-id> --project-name aura-cafe
   ```

4. **Verify rollback**:
   ```bash
   curl -sS https://api.auraspace.cafe/api/health?db=1
   curl -sS https://api.auraspace.cafe/api/version
   ```

5. **Notify team**: Post to Telegram with deployment ID and reason.

## Schema Compatibility

- Migrations are **forward-only** (no down migrations)
- Rollback does NOT revert D1 schema
- Only rollback if code is compatible with current schema
- If schema incompatible: restore D1 from backup + rollback code

## Post-Deploy Monitoring (10 min minimum)

- Watch Telegram alerts for: `kds_sla_breach`, `payment_failed`, `webhook_rejected`, 5xx spikes
- Check `/api/health?db=1` every 2 min
- Verify order flow: place test order → payment → fulfillment

## Contacts

- Primary: DevOps on-call
- Escalation: CTO

## Last Updated: 2026-08-25
