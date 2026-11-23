# Deploy Execution Log — Production `main` (`27a04144`)

- **Date:** `2026-11-23T08:37:47Z` – `2026-11-23T08:38:13Z`
- **Account:** `b69fee03bdd94234eea8e4114cfc36ab`
- **Deployed Commit:** `27a04144` (`27a041441fd41c73dcede0794be609021404ca1f`)
- **Command:** `PATH="$PWD/worker/node_modules/.bin:$PATH" bash deploy-cloudflare.sh --skip-tests` (strict git pre-flight active; tests already green on exact SHA in CI run `45137756849`)
- **Status:** `DEPLOYED_AND_VERIFIED`

## 1. Git Pre-Flight (`[0/5]`)
- `Branch: HEAD` (detached at `origin/main` `27a041441fd41c73dcede0794be609021404ca1f`)
- `origin/main is contained in HEAD`
- `HEAD matches origin/HEAD`

## 2. Remote D1 Migrations (`[2/5]`)
- Skipped via fail-closed default (`0` migrations changed between live baseline `37e9b80b` and `27a04144`; remote `fnb-caffe-db` schema parity verified read-only pre-deploy).

## 3. Cloudflare Pages Deployment (`fnb-caffe-container`)
- **Build:** `npx --no-install vite build --mode production` (`built in 2.99s`; main bundle `dist/assets/index-Bz78vSCj.js` `299.03 kB` / `94.29 kB` gzip)
- **Version Stamp:** `dist/version.json` written `27a04144 @ 2026-11-23T08:37:47Z`
- **Deployment ID:** `dc5dc3b5-9bb3-4deb-b709-be7dcd978d31`
- **Preview URL:** `https://dc5dc3b5.fnb-caffe-container.pages.dev`
- **Custom Domain:** `https://auraspace.cafe`

## 4. Cloudflare Worker Deployment (`aura-space-worker`)
- **Worker URL:** `https://aura-space-worker.sadec-marketing-hub.workers.dev`
- **Deployed Version ID:** `97385200-3bd6-474d-83ee-9965ab819070` (`100%` traffic)
- **Upload / Trigger Time:** `11.33s` upload, `4.59s` triggers (`schedule: */5 * * * *`)
- **Injected Var:** `GIT_COMMIT_SHA=27a041441fd41c73dcede0794be609021404ca1f`

## Unresolved Questions
- None.
