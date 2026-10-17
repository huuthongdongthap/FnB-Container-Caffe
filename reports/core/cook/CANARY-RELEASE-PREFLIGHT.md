# AURA OS Controlled Canary Release Preflight Report

## 1. Executive Summary: Preflight Gate Cleared — Awaiting Operator Approval

All automated preflight checks, cryptographic verification, regression test suites, isolated restore tests, and Cloudflare Worker gradual-rollout capability validations have been completed. **Zero production mutations have been performed.**

---

## 2. Release SHA & Test Reconciliation

| Parameter | Value | Evidence |
| :--- | :--- | :--- |
| **Target Release SHA** | `a8190d5af9b374e40d7e7df833616be1f123b49f` (`a8190d5`) | `git rev-parse HEAD` |
| **Live Production Worker SHA** | `0d59c5461113cc4e8f091fee32a7ba2db48f59a5` (`0d59c546`) | `curl https://aura-space-worker.../api/version` |
| **Live Worker Active Version ID** | `33d9e23b-711c-4278-82d1-b8013fedc41a` (100% traffic) | `wrangler deployments status` |
| **Code Delta & Hardening** | - 5 canonical domain packages (`security`, `continuity`, `migration`, `observability`, `deployment`)<br>- Constant-time Web Crypto signature verification (`timingSafeEqual`)<br>- OWASP security headers middleware (`securityHeaders`)<br>- Production gating on test authentication bypass headers (`!isProd`) | Verified in git tree |
| **Test Evidence** | - Typecheck: 0 errors (`npm run typecheck`, `npm run typecheck:worker`)<br>- Lint: 0 errors (`npm run lint`)<br>- Vitest: 433 test files, 3,903 tests passed (100%)<br>- Build: Clean bundle compiled (`npm run build`) | Verified empirical execution |

---

## 3. Database Checkpoint & Recovery Verification

| Backup Metric | Verified Specification |
| :--- | :--- |
| **Remote Database** | `fnb-caffe-db` (`97ae7a5f-fc4d-460d-b019-8535332bd81f`) |
| **Checkpoint File** | `./checkpoint-pre-rollout.sql` (378,681 bytes, 2,035 lines) |
| **SHA-256 Checksum** | `96c5f3635e60c8bb108ce3a38d30dfb4a5f19b4828b96403d5a6099da565560f` |
| **Git Protection** | Active in `.gitignore` (`checkpoint*.sql`); untracked by Git |
| **Isolated Restore Test** | Restored to SQLite 3.51.0 instance (`/tmp/isolated-d1-restore-test.db`)<br>- `PRAGMA integrity_check`: `ok`<br>- `PRAGMA foreign_key_check`: 0 errors<br>- Table count: 79 tables (49 products, 159 orders, 10 categories) |
| **Recovery Strategy Warning** | **Never blindly import a full SQL dump into existing production D1**. A full dump contains `CREATE TABLE` and duplicate `INSERT` statements that will cause primary key collisions (`UNIQUE constraint failed`) and destroy in-flight orders. Use targeted `.down.sql` scripts for schema rollbacks; reserve the full dump exclusively for Disaster Recovery (DR) on empty databases. |

---

## 4. Production Bindings & Secrets Verification

| Binding Type | Binding Name | Target ID / Status |
| :--- | :--- | :--- |
| **D1 Database** | `AURA_DB` | `97ae7a5f-fc4d-460d-b019-8535332bd81f` (`fnb-caffe-db`) |
| **Workers KV** | `AUTH_KV` | `789e7cf1894e4d4c9e8f8cd51b2dbe16` |
| **Durable Object** | `ORDER_BROADCASTER` | `OrderBroadcaster` |
| **Secrets Verified** | 6 secrets active | `JWT_SECRET`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| **Environment Vars** | Fixed variables | `ENVIRONMENT=production`, `CORS_ORIGIN=https://auraspace.cafe`, `JWT_EXPIRY_SECONDS=604800`, `SLA_THRESHOLD_MINUTES=15` |

---

## 5. Canary / Gradual Rollout Architecture

Cloudflare Workers Versioning & Gradual Rollouts capability is confirmed active on the account (`wrangler versions`).

### Proposed Staged Rollout Execution:
```bash
# Phase 1: Upload New Worker Version (0% traffic, creates new Version ID)
npx wrangler versions upload --config worker/wrangler.toml --var GIT_COMMIT_SHA:a8190d5af9b374e40d7e7df833616be1f123b49f

# Phase 2: Canary Traffic Split (10% Canary, 90% Stable Baseline 33d9e23b)
npx wrangler versions deploy <NEW_VERSION_ID>@10% 33d9e23b-711c-4278-82d1-b8013fedc41a@90% --config worker/wrangler.toml

# Phase 3: Canary Monitoring Window (15 Minutes)
# - Monitor 5xx error rate < 0.05%
# - Monitor P95 latency < 350ms
# - Verify payment webhook signature verification

# Phase 4: Full Promotion (100% Traffic)
npx wrangler versions deploy <NEW_VERSION_ID>@100% --config worker/wrangler.toml
```

---

## 6. Rollback Triggers & Emergency Procedure

### Rollback Triggers:
1. **5xx Error Burst**: API error rate ≥ 1% continuously for 3 consecutive minutes.
2. **Signature Bypass**: Any webhook signature verification failure or bypass.
3. **P95 Latency Spike**: P95 response latency exceeds 800ms for > 3 minutes.
4. **Data Integrity Anomaly**: Any unhandled SQL constraint error or foreign key violation.

### Instant Emergency Rollback Command (< 30 Seconds):
```bash
npx wrangler versions deploy 33d9e23b-711c-4278-82d1-b8013fedc41a@100% --config worker/wrangler.toml
```
Restores 100% traffic instantly to stable version `33d9e23b-711c-4278-82d1-b8013fedc41a` (`0d59c546`) with zero downtime.
