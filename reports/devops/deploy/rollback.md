# Rollback Plan — 2026-09-11

## Frontend (Cloudflare Pages)
1. Dashboard → Cloudflare Pages → fnb-caffe-container → Deployments
2. Select previous deployment (prior to `5b9e8842`)
3. Click "Rollback to this deployment"
4. Verify: curl -s -o /dev/null -w "%{http_code}" https://fnb-caffe-container.pages.dev

## Backend (Cloudflare Worker)
1. `wrangler versions list` → identify previous Version ID
2. `wrangler versions deploy <previous-version-id>` or Dashboard → Workers → aura-space-worker → Deployments → Roll back
3. Verify: curl https://aura-space-worker.sadec-marketing-hub.workers.dev/health

## Current Versions (for quick rollback)
- FE: 5b9e8842 (active)
- BE: 92f52c22-b1b0-46c8-8d3a-7eb46cf59689 (active)

## D1 / KV / DO
- No schema migrations in this deploy — no DB rollback needed
- If data corruption suspected: D1 → Backups → Restore point-in-time
