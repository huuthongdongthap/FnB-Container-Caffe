# Deploy Report — Font Migration to Cloudflare Production

**Date:** 2026-09-10 (deploy 2026-09-09T21:25 UTC) · **Commit:** 7ef3604 · **Operator:** deploy skill pipeline

## Scope

Production deploy of clean HEAD (font token migration 50e2f29 + docs 7ef3604). WIP checkout/promotions feature (11 files) stashed pre-deploy, restored after.

## Pipeline steps

| Step | Command | Result |
|------|---------|--------|
| Pre-flight | git status + stash WIP | 11 files + plans/260910-go-live-master-phases/ stashed, clean HEAD |
| Tests | npm test (in script) | PASS |
| Build | vite build --mode production | PASS |
| Pages deploy | wrangler pages deploy → fnb-caffe-container, branch main | PASS |
| Worker deploy | wrangler deploy --var GIT_COMMIT_SHA | Version 231def07 (2026-09-09T21:25) |
| D1 migrations | wrangler d1 execute fnb-caffe-db (19 files) | All OK / already applied |
| Health check | /api/health | 200 `{"status":"ok"}` |

## Smoke tests (post-deploy)

| Target | Result |
|--------|--------|
| https://fnb-caffe-container.pages.dev/ | 200 (0.54s) |
| https://auraspace.cafe/ | 200 (0.31s) |
| https://auraspace.cafe/version.json | shortSha **7ef36040** = HEAD ✓ |
| https://fnb-caffe-container.pages.dev/version.json | shortSha **7ef36040** ✓ |
| Worker /api/health | 200, `{"status":"ok"}` |
| Worker deployment | 231def07-0ccb-45d5, 100% traffic, 2026-09-09T21:25Z (newest) ✓ |

## Rollback plan

Not needed — deploy green. If required: `npx wrangler deployments rollback` (worker), Pages → previous deployment in CF dashboard.

## Known issues (non-blocking)

1. **Worker /api/version reports stale SHA `d746f397`** — `worker/wrangler.toml:23` hardcodes `GIT_COMMIT_SHA = "d746f397"` (109 commits stale). Script passes `--var GIT_COMMIT_SHA:<head>` but wrangler.toml `[vars]` value takes precedence, so `/api/version` is cosmetic-only wrong; deployed code IS current HEAD. Fix: delete line 23 from wrangler.toml (script's `--var` then works), or update per-deploy. Cosmetic — no functional impact.
2. D1 migration re-runs emit benign "duplicate column name" — script treats as success (intended).

## Unresolved questions

1. Push 10 unpushed local commits to origin/main? (not requested; deferred)
