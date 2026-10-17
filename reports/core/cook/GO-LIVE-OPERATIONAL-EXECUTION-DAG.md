# AURA OS Go-Live Operational Execution DAG Report

**Document ID:** `reports/core/cook/GO-LIVE-OPERATIONAL-EXECUTION-DAG.md`  
**Target:** `/Users/mac/mekong-cli/FnB-Container-Caffe`  
**Timestamp:** 2026-10-16  
**Status:** 🟢 STAGE 1 COMPLETE — STAGES 2-4 READY FOR OPERATOR DISPATCH  

---

## 1. Operational Execution DAG Overview

The release pipeline follows a strict sequential Directed Acyclic Graph (DAG) with fail-closed gates to guarantee zero downtime and prevent database corruption:

```
[STAGE 1: Pre-Flight Gate Verification] 🟢 PASSED (Empirical Local Gates 100% Green)
       │
       ▼
[STAGE 2: D1 Database Snapshot Export] ⏳ NEXT (Operator Token Required)
       │
       ▼
[STAGE 3: Cloudflare Edge & Pages Deploy] ⏳ PENDING STAGE 2
       │
       ▼
[STAGE 4: Post-Deploy Smoke Probes & Validation] ⏳ PENDING STAGE 3
```

---

## 2. Stage-by-Stage Detailed Status & Verification

### Stage 1: Pre-Flight Gate Verification (Completed 🟢)
- **Unit & Integration Tests**: 441/441 test suites passed, 4,017/4,017 tests green.
- **TypeScript Health**: 0 errors across root (`src/`) and worker (`worker/src/`).
- **Linter (ESLint)**: 0 warnings, 0 errors.
- **Production Bundle**: Freshly generated `dist/` bundle (4.46s build time), Service Worker cache version bumped to `aura-v3`.
- **Fail-Closed D1 Migration Protection**: Verified offline via isolated mock harness; default deployment invokes 0 D1 commands, bulk historical re-execution blocked.
- **Safari ITP Dual-Auth**: Bearer token persisted in `localStorage` + cookie fallback; fake `admin-01` login removed.

---

### Stage 2: Pre-Release Remote D1 Snapshot (Next Operator Action ⏳)
Before modifying the production edge, the operator captures a point-in-time logical snapshot:

```bash
# 1. Export remote D1 database snapshot
npx wrangler d1 export fnb-caffe-db --remote --output=./checkpoint-pre-deploy-$(date +%Y%m%d).sql

# 2. Verify snapshot integrity locally in SQLite
sqlite3 /tmp/verify-pre-deploy.db < ./checkpoint-pre-deploy-*.sql
sqlite3 /tmp/verify-pre-deploy.db "PRAGMA integrity_check;"
sqlite3 /tmp/verify-pre-deploy.db "SELECT count(*) FROM orders;"
```

---

### Stage 3: Cloudflare Edge Rollout (Operator Action ⏳)
Deploy the immutable static shell to Cloudflare Pages and the API to Cloudflare Workers:

```bash
# Run production deployment (auto-skips tests and historical D1 replay)
bash deploy-cloudflare.sh
```

---

### Stage 4: Post-Deploy Smoke Verification (Operator Action ⏳)
Execute live health and authentication probes against the production domain:

```bash
# 1. API Health Probe (Expected: HTTP 200)
curl -fsS https://auraspace.cafe/api/health

# 2. Worker Git Version Probe (Expected: matches local HEAD short SHA)
curl -fsS https://auraspace.cafe/api/version

# 3. Safari & Admin UI Verification:
# Navigate to https://auraspace.cafe/admin/login in Safari
# Verify no 401 redirect loop or CSS token leaks.
```

---

## 3. 3-Tier PITR Rollback Runbook (Quick Reference)

In the event of an anomaly detected in Stage 4:
- **Tier 1 (Pages Frontend)**:
  ```bash
  npx wrangler pages rollback fnb-caffe-container --deployment-id=<DEPLOYMENT_ID>
  ```
- **Tier 2 (Worker API)**:
  ```bash
  npx wrangler rollback --config worker/wrangler.toml
  ```
- **Tier 3 (D1 Database Point-In-Time Restore)**:
  ```bash
  npx wrangler d1 time-travel restore fnb-caffe-db --timestamp="<PRE_DEPLOY_TIMESTAMP>"
  ```
