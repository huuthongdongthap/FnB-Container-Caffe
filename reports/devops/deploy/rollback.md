# Rollback Plan — Production Deploy `main` (`27a04144`)

- **Current Active Worker Version ID:** `97385200-3bd6-474d-83ee-9965ab819070` (`shortSha: 27a04144`, `100%` traffic)
- **Previous Baseline Worker Version ID:** `44babe91-1e5f-42fd-b3cb-a6590b0c74fb` (`shortSha: 37e9b80b`)
- **Current Active Pages Deployment ID:** `dc5dc3b5-9bb3-4deb-b709-be7dcd978d31` (`https://dc5dc3b5.fnb-caffe-container.pages.dev`)
- **Previous Baseline Pages Deployment ID:** `32a30b2e-f0f8-41f7-907e-1fe8f4b5608e` (`https://32a30b2e.fnb-caffe-container.pages.dev`, `shortSha: 37e9b80b`)

## 1. Worker Instant Rollback (< 60s)
```bash
cd worker && npx --no-install wrangler rollback 44babe91-1e5f-42fd-b3cb-a6590b0c74fb --message "Rollback from 27a04144 to 37e9b80b" --yes
```
Verify:
```bash
curl -sS https://aura-space-worker.sadec-marketing-hub.workers.dev/api/version
# Expect: shortSha == "37e9b80b"
```

## 2. Pages Rollback (< 60s)
- **Cloudflare Dashboard:** Pages → `fnb-caffe-container` → Deployments → `32a30b2e-f0f8-41f7-907e-1fe8f4b5608e` (`37e9b80`) → **Rollback to this deployment**.
- **CLI fallback:** checkout `37e9b80b0ce4b95605729f31c0e417585856ac67` in clean worktree and run `bash deploy-cloudflare.sh --pages-only --skip-tests --allow-diverged-branch`.
- Verify `curl -sS https://auraspace.cafe/version.json` reports `shortSha == "37e9b80b"`.

## 3. D1 Schema Impact
- **Zero D1 migrations were applied** in this deploy (`37e9b80b..27a04144` has no schema changes). Rolling back Worker and Pages requires no D1 changes.

## Unresolved Questions
- None.
