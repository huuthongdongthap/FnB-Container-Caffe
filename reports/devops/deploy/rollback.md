# Deployment Rollback Plan — AURA OS

## Rollback Policy: Zero-Downtime Instant Rollback

This runbook defines the sequential rollback procedure in case of any post-deployment anomalies or production health degradation.

**Current Live Deployment Fingerprint:**
- **Pages Production Deployment**: `50e54168` (`https://50e54168.fnb-caffe-container.pages.dev`)
- **Worker Production Version ID**: `62239ad0-a40e-4a33-8c44-b6a4fbfbfb4c`
- **Git Commit Short SHA**: `a8190d5a`
- **Service Worker Cache**: `aura-static-v4`

**Standby Baseline Rollback Targets:**
- **Previous Pages Deployment ID**: `58168b82` (`https://58168b82.fnb-caffe-container.pages.dev`)
- **Previous Worker Version ID**: `3fb52a02-b6a2-4d41-bfd8-0d14d8c009db`

---

## 1. Cloudflare Pages Frontend Rollback (< 60 seconds)

If the web UI displays rendering defects or client-side JavaScript crashes:

1. Retrieve recent production deployments:
   ```bash
   npx wrangler pages deployment list --project-name=fnb-caffe-container --environment=production
   ```
2. Rollback to previous deployment `58168b82` via Cloudflare REST API (or Cloudflare Dashboard -> `Workers & Pages` -> `fnb-caffe-container` -> `Deployments` -> `Rollback to this deployment`):
   ```bash
   curl -X POST \
     "https://api.cloudflare.com/client/v4/accounts/b69fee03bdd94234eea8e4114cfc36ab/pages/projects/fnb-caffe-container/deployments/58168b82/rollback" \
     -H "Authorization: Bearer ${CF_API_TOKEN}" \
     -H "Content-Type: application/json"
   ```
3. Or redeploy previous build artifact directly:
   ```bash
   npx wrangler pages deploy dist-backup/ --project-name=fnb-caffe-container --branch=main
   ```
4. Verify `version.json` on the custom domain:
   ```bash
   curl -s -i "https://auraspace.cafe/version.json"
   ```

---

## 2. Cloudflare Worker Edge Rollback (< 90 seconds)

If the API Worker returns unexpected 5xx responses or exceeds error rate thresholds:

1. Inspect recent Worker deployments:
   ```bash
   npx wrangler deployments list --config worker/wrangler.toml
   ```
2. Rollback Worker to previous Version `3fb52a02-b6a2-4d41-bfd8-0d14d8c009db`:
   ```bash
   npx wrangler rollback 3fb52a02-b6a2-4d41-bfd8-0d14d8c009db --config worker/wrangler.toml
   ```
3. Verify Worker health:
   ```bash
   curl -s "https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health"
   ```

---

## 3. Post-Rollback Smoke Verification

- [ ] `curl -s https://auraspace.cafe/version.json` returns expected rollback SHA.
- [ ] `curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health` returns `HTTP 200 OK`.
- [ ] Verify admin terminal renders properly without console errors.
