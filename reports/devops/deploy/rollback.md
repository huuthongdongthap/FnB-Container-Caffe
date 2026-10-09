# Rollback & Disaster Recovery Plan

**Target**: Cloudflare Pages (`fnb-caffe-container`) & Cloudflare Workers (`aura-space-worker`)  
**Date**: 2026-10-09  

---

## 1. Trigger Criteria for Rollback

Rollback is immediately triggered if any of the following occur:
1. `GET /health` returns HTTP 5xx or fails consecutively for > 30 seconds.
2. Order creation or Payment checkout links throw unhandled 500 errors.
3. Database corruption or D1 query lockups detected.
4. Custom domain SHA mismatch persists after post-deploy verification retries.

---

## 2. Immediate Rollback Steps

### Step 1: Cloudflare Pages Instant Rollback
Cloudflare Pages maintains immutable deployment history per commit:
```bash
# Option A: Promote previous deployment via Wrangler
npx wrangler pages deployment list --project-name=fnb-caffe-container
# Identify previous stable deployment ID and promote:
# Cloudflare Dashboard > Workers & Pages > fnb-caffe-container > Deployments > Rollback to this deployment

# Option B: Redeploy prior stable Git commit
git checkout HEAD~1
npm run build
npx wrangler pages deploy dist --project-name=fnb-caffe-container --branch=main
```

### Step 2: Cloudflare Worker Instant Rollback
```bash
cd worker
# Instant rollback to prior deployment version:
npx wrangler rollback --config wrangler.toml
cd ..
```

### Step 3: D1 Database Safeguard
All D1 migrations in this release (`20261009_01_audit_trail_canonical_contract.sql`, `20261009_02_notification_canonical_contract.sql`, `20261009_03_integration_boundary_contract.sql`) are **strictly additive** (`ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). They are non-destructive and backward-compatible with prior worker code versions.

---

## 3. Post-Rollback Verification
1. Verify `GET /health` returns HTTP 200.
2. Verify customer menu loads at `/` and checkout flow operates normally.
3. Notify engineering and log post-mortem in incident triage.
