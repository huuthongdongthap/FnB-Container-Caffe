# Go-Live Operator Execution Plan — AURA OS

**Plan Directory:** `plans/261016-go-live-operator-execution/plan.md`  
**Execution Date:** 2026-10-16  
**Status:** Ready for Production Operator Sign-Off  

---

## 1. Overview & Objective
Orchestrate the zero-downtime, safe production release of AURA OS to `auraspace.cafe` and Cloudflare Edge Worker.

---

## 2. Execution Phases

| Phase | Description | Status |
| :--- | :--- | :---: |
| **Phase 01: Pre-Flight Gate Verification** | Verify 100% test pass (4,017 tests), TypeScript (0 errors), ESLint (0 warnings), and fresh build bundle | Completed (Verified) |
| **Phase 02: D1 Database Snapshot** | Export pre-release logical snapshot via `npx wrangler d1 export` | Pending Operator |
| **Phase 03: Cloudflare Edge Rollout** | Deploy Worker & Cloudflare Pages shell with `aura-v3` Service Worker | Pending Operator |
| **Phase 04: Post-Deploy Smoke Verification** | Run live probes against health, version, auth, and Admin Terminal on WebKit/Chromium | Pending Operator |

---

## 3. Operator Action Checklist

- [x] All 441 test suites passing locally (`npm run test`)
- [x] TypeScript compiles cleanly (`npm run typecheck:all`)
- [x] Linter passes with zero warnings (`npm run lint --silent`)
- [x] Production bundle fresh and built in 3.82s (`npm run build`)
- [x] Deploy scripts verified safe (no auto-replay of historical D1 migrations)
- [x] Safari ITP dual auth (Bearer token in localStorage) implemented and tested
- [x] Admin i18n dictionaries and CSS variable sanitation verified
- [ ] Export pre-deploy D1 snapshot:
  ```bash
  npx wrangler d1 export fnb-caffe-db --remote --output=./checkpoint-pre-deploy.sql
  ```
- [ ] Run production deployment:
  ```bash
  bash deploy-cloudflare.sh
  ```
- [ ] Live smoke verification on `https://auraspace.cafe`:
  - `curl -fsS https://auraspace.cafe/api/health`
  - `curl -fsS https://auraspace.cafe/api/version`
  - Verify Safari desktop login at `https://auraspace.cafe/admin/login`

---

## 4. Rollback Runbook (3-Tier PITR)
- **Pages**: `npx wrangler pages rollback fnb-caffe-container --deployment-id=<ID>`
- **Worker**: `npx wrangler rollback --config worker/wrangler.toml`
- **D1 Database**: Cloudflare Time Travel PITR restore via Cloudflare dashboard or forward-fix migration.
