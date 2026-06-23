---
date: 2025-06-19
domain: infrastructure
status: stable
priority: P1
---

# TASKS — INFRASTRUCTURE & DEPLOYMENT

## Epic: Cloudflare Deployment

### Story 1: Cloudflare Pages setup

**Acceptance Criteria:**
- [ ] Repository connected to Cloudflare Pages
- [ ] Build command: `npm run build`
- [ ] Build output directory: `dist/`
- [ ] Environment variables set (if needed)
- [ ] Automatic deployments on main branch push
- [ ] Custom domain configured: `fnb-caffe-container.pages.dev`

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 2: Workers & D1 bindings

**Acceptance Criteria:**
- [ ] Worker `aura-space-worker` deployed to same account
- [ ] D1 database `AURA_DB` created and bound to worker
- [ ] KV namespace `AUTH_KV` created and bound
- [ ] wrangler.toml configured with correct bindings
- [ ] Secrets set: `JWT_SECRET`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 3: CI/CD pipeline

**Acceptance Criteria:**
- [ ] GitHub Actions workflow runs on PR to main:
  - lint (ESLint)
  - test (Jest)
  - build (Vite)
- [ ] On merge to main: auto-deploy to Cloudflare Pages
- [ ] Build status badge in README
- [ ] Deploy preview URLs for PRs

**Priority:** P1  
**Status:** ✅ Completed

---

## Epic: Monitoring & Alerting

### Story 4: Health monitoring

**Acceptance Criteria:**
- [ ] `/api/health` endpoint returns `{status: "ok", ts: ...}`
- [ ] Cloudflare uptime monitor checks every 1 minute
- [ ] Alert (email/Telegram) sent if health check fails 3 times in a row
- [ ] Dashboard showing: requests/sec, error rate, latency (p95, p99)

**Priority:** P1  
**Status:** ✅ Completed (basic)

---

### Story 5: Error tracking

**Acceptance Criteria:**
- [ ] Global error handler logs to Cloudflare console
- [ ] Consider Sentry integration for stack traces (optional)
- [ ] Error rate alert: >1% errors over 5 minutes

**Priority:** P2  
**Status:** ⚠️ Basic logging only, no Sentry yet

---

### Story 6: Performance monitoring

**Acceptance Criteria:**
- [ ] Web Vitals tracked (LCP, FID, CLS) via analytics
- [ ] API response time p95 < 200ms (from Cloudflare Metrics)
- [ ] Lighthouse CI runs on PRs (score > 90)

**Priority:** P2  
**Status:** ❌ Not implemented

---

## Epic: Cost Optimization

### Story 7: Free tier limits monitoring

**Acceptance Criteria:**
- [ ] Track Workers requests/day (limit: 100k)
- [ ] Track D1 storage (limit: 5GB)
- [ ] Track KV reads (limit: 1k/day)
- [ ] Track bandwidth (limit: 10GB/day)
- [ ] Alert if >80% of any limit reached

**Priority:** P1  
**Status:** ✅ Completed (manual dashboard check)

---

### Story 8: Cost projection model

**Acceptance Criteria:**
- [ ] Spreadsheet model projecting costs at 1x, 10x, 100x current usage
- [ ] Break-even analysis: Free vs Paid plan
- [ ] Cost per order calculation
- [ ] Monthly report to owner

**Priority:** P2  
**Status:** ✅ Completed (see CEO-HANDOVER.md)

---

## Epic: Security Operations

### Story 9: Secrets management

**Acceptance Criteria:**
- [ ] All secrets stored in Cloudflare secrets (not in code or .env)
- [ ] Secrets rotation policy: JWT_SECRET every 6 months
- [ ] Access to secrets limited to owner/dev only
- [ ] `.env` in `.gitignore`
- [ ] No secrets in logs

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 10: Backup & Disaster Recovery

**Acceptance Criteria:**
- [ ] D1 automatic daily backups (Cloudflare provides)
- [ ] Manual backup script runs weekly: `npx wrangler d1 export`
- [ ] Backups stored in R2 or external S3
- [ ] Retention: 30 days
- [ ] Test restore procedure quarterly

**Priority:** P1  
**Status:** ✅ Completed (auto-backup, manual script ready)

---

### Story 11: Rollback procedure

**Acceptance Criteria:**
- [ ] Documented rollback steps in CEO-HANDOVER.md
- [ ] Previous deploy kept in Cloudflare (instant rollback available)
- [ ] Database migration rollback scripts (down migrations)

**Priority:** P1  
**Status:** ✅ Completed

---

## Future Tasks (Backlog)

### Task: Multi-environment setup

**Description:** Separate staging and production environments (staging.pages.dev).

**Effort:** 12h  
**Priority:** P2

---

### Task: Blue-green deployment

**Description:** Zero-downtime deployment using Cloudflare traffic splitting.

**Effort:** 8h  
**Priority:** P2

---

### Task: Automated security scanning

**Description:** Integrate OWASP ZAP or similar into CI pipeline.

**Effort:** 12h  
**Priority:** P1

---

### Task: Compliance audit trail

**Description:** Ensure all data changes are audited for compliance (GDPR, Vietnamese law).

**Effort:** 16h  
**Priority:** P2

---

*Related files:*
- `worker/wrangler.toml`
- `.github/workflows/` (CI/CD)
- `CEO-HANDOVER.md` (deployment procedures)
- `deployment.md` (deployment guide)
- `SECURITY.md` (security policies)
