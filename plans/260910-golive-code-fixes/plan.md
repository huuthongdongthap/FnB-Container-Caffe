# Plan: Go-Live Code Fixes — WIP Commit + 3 Production Bugs
**Date:** 2026-09-10 · **Mode:** `/cook all` interactive · **Branch:** main

## Context (Scout — verified findings)

Production deployed 2026-09-09 (worker 231def07, Pages 7ef36040). Deep scout found:

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| P0-1 | **Frontend calls `http://localhost:8787` in prod** — `.env.local` (VITE_API_BASE=localhost) overrides `.env.production` in `vite build --mode production` (Vite priority: `.env.[mode].local` > `.env.[mode]` > **`.env.local`** > `.env`). Deployed chunk `api-client-GWsT78AO.js` contains `var t="http://localhost:8787"`. | P0 | downloaded prod chunk `/tmp/prod-api-client.js` |
| P0-2 | **Cron dead since 2026-07-01** — `worker/src/index.ts:484` exports `scheduled` as object `{async fetch()}`; Workers requires function form `export async function scheduled(controller, env, ctx)`. Every cron trigger throws "Handler does not export a scheduled() function" → SLA checks, metrics pruning, ERPNext retry queue, Mautic sync all dead. | P0 | wrangler.toml:34 `crons = ["*/5 * * * *"]` + code shape |
| P1-3 | **`GIT_COMMIT_SHA = "d746f397"` hardcoded** in `worker/wrangler.toml:23` — wrangler.toml `[vars]` beats deploy script's `--var`, `/api/version` reports 109-commits-stale SHA. Cosmetic but breaks deploy verification. | P1 | deploy report 260910 |
| P2-4 | **Deploy script health-checks wrong worker URL** — `deploy-cloudflare.sh:102` uses `aura-space-worker.agencyos-openclaw.workers.dev` (stale); prod worker is `aura-space-worker.sadec-marketing-hub.workers.dev` (confirmed via CSP `dist/_headers` + live health checks). | P2 | deploy-cloudflare.sh:102 vs dist/_headers |

**Fix verified (local):** `.env.production` with `VITE_API_BASE=https://aura-space-worker.sadec-marketing-hub.workers.dev` → rebuild → chunk `api-client-NZHaKZz5.js` has correct URL. Test artifact deleted after verification; real fix happens in Phase B.

**WIP state:** 11 modified files (checkout/promotions feature: order-type selector delivery/takeaway/dine_in, VN localization, promotions API compat mapping, Telegram order-type labels, CORS_ORIGIN lock, .gitignore hardening) + 2 untracked plans dirs. Test artifact cleanup done.

**Already done (scout-verified, no code needed):**
- D1 campaign dates: AURA20 expires 2026-09-10 (today) ✓
- 4 secrets present on prod worker ✓
- CORS allowlist live on worker (regex includes auraspace.cafe + pages.dev) ✓
- PayOS webhook `/api/webhook/payos` → 200 on prod ✓

## Requirements (user-confirmed)

- **Scope:** All go-live CODE tasks (skip physical/operational)
- **WIP:** Review + commit checkout/promotions feature FIRST, separately
- **Acceptance:** Local gates (test suite + build) + prod verify (curl) after each phase

## Architecture (execution order)

```
Phase A: Commit WIP feature ─┬─ test gates → conventional commit
                             └─ (untracked plans/ NOT committed yet)
Phase B: P0-1 .env.production + P0-2 scheduled fix ─→ test+build → commit → deploy FE+BE
Phase C: P1-3 + P2-4 config cleanup ─→ commit → redeploy worker
Phase D: Prod verification (curl smoke: /, version.json, /api/health, /api/promotions, webhook)
```

## Related Code Files

**Phase A (commit WIP):** the 11 dirty files as-is (no new code)
**Phase B:**
- Create: `.env.production` (1 line, gitignored — verify: contains NO secrets, only public worker URL)
- Modify: `worker/src/index.ts` (scheduled object → function export, ~30 lines region 484-520)
**Phase C:**
- Modify: `worker/wrangler.toml` (delete line 23 stale SHA)
- Modify: `deploy-cloudflare.sh` (line 102 health URL → sadec-marketing-hub)
**Phase D:** no files (curl only)

## Implementation Steps

### Phase A — Commit WIP checkout/promotions feature
1. `npm test` (existing suite must pass on WIP state)
2. `npx tsc --noEmit` type gate
3. Commit 11 files: `feat: order-type selection (delivery/takeaway/dine-in) + VN localization for checkout & promotions`
4. NOT committed: `plans/` dirs (stay untracked), `.gitignore` + `worker/wrangler.toml` → INCLUDED (part of feature: CORS lock + secret-file ignore)

### Phase B — P0 fixes
1. Write `.env.production` (single var, public URL)
2. Edit `worker/src/index.ts:484`: `export const scheduled = {async fetch(...)...}` → `export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {...}` (same body)
3. Gates: `npm test` + `npx tsc --noEmit` (worker) + `npx vite build --mode production` → grep new chunk for `localhost:8787` MUST be absent, `sadec-marketing-hub` MUST be present
4. Commit: `fix: production API base URL override + restore cron handler export`
5. Deploy: `npx wrangler pages deploy dist` + `npx wrangler deploy --config worker/wrangler.toml` (from worker dir)

### Phase C — Config cleanup
1. Delete `GIT_COMMIT_SHA` line from `worker/wrangler.toml`
2. Fix `deploy-cloudflare.sh:102` health URL
3. Commit: `chore: remove stale hardcoded GIT_COMMIT_SHA; fix deploy health-check URL` — deploy worker again so `--var` takes effect
4. Verify `/api/version` returns current SHA

### Phase D — Production verification
1. `curl -s https://auraspace.cafe/version.json` → SHA matches HEAD
2. Download deployed api-client chunk → grep: no `localhost:8787`, has `sadec-marketing-hub`
3. `curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health` → `{"status":"ok"}`
4. `curl -s .../api/promotions` → AURA20 live with today's expiry
5. `curl -s .../api/version` → SHA matches HEAD (proves P1-3 fix)
6. Cron proof: `npx wrangler tail` OR check Workers dashboard scheduled events fire without export error (5-min wait)

## Todo List
- [x] A1: npm test green on WIP
- [x] A2: tsc --noEmit green
- [x] A3: WIP committed (feat 772d909... prior)
- [x] B1: .env.production created
- [x] B2: scheduled export fixed (root cause: `export default app` shadowed named scheduled export — fixed via handler-object default export, not object→function)
- [x] B3: 3 gates green (test/tsc/build+grep)
- [x] B4: committed (fix d76b481 + 30c2fb76)
- [x] B5: FE+BE deployed
- [x] C1: wrangler.toml SHA removed
- [x] C2: deploy script URL fixed
- [x] C3: committed (chore 30c2fb76) + worker redeployed (bf9d1e89)
- [x] D1-D5: prod curls green
- [x] D6: cron fires without export error — 9 consecutive outcome:ok on 6a8bece2

## Success Criteria
- Zero `localhost:8787` in any deployed asset
- `scheduled` is a function export; cron runs SLA/prune/ERPNext/Mautic without handler error
- `/api/version` == HEAD short SHA
- All existing tests pass; build green; prod smoke 200s

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| `.env.production` committed by accident | It contains ONLY the public worker URL (no secret) — but still verify `git check-ignore` before commit; add to .gitignore if tracked |
| scheduled refactor changes behavior | Body unchanged — only export shape; verified by wrangler deploy + tail |
| Pages redeploy wipes version.json | version.json generated by deploy script — run script's pages step, not raw wrangler, OR re-check version.json after |
| Redeploy overwrites WIP-safe HEAD | Phase A commits FIRST so deploys ship committed code only |

## Security Considerations
- `.env.production` content = public worker URL only (same value as CSP `dist/_headers` connect-src, world-visible anyway)
- `.env` (PayOS keys) NOT git-tracked (.gitignore:4) — verify stays untracked
- No secrets in any commit; CORS_ORIGIN locked to prod domains in Phase A

## Next Steps
- Review gate → user approval → Phase A

## Outcome (2026-09-10 — completed)

All phases A-D done. Deployed: worker versions 6a8bece2 + bf9d1e89, Pages a1ee24ba (SHA 30c2fb76).

### Root cause P0-2 (deeper than plan)
Plan hypothesis (object→function form) was WRONG — d76b481 deployed function-form scheduled export, still failed. True root cause: `export default app` (index.ts:467). When a default export exists, workerd resolves fetch/scheduled handlers from the default export object — Hono app has `.fetch` but no `.scheduled`, so named export `scheduled` was invisible. Proof: `wrangler versions view` Handlers list = exact Hono property list. Fix: `export default { fetch: (req, env, ctx) => app.fetch(req, env, ctx), scheduled }` + keep `export { app }` (tests) + `export { OrderBroadcaster }` (DO class).

### Verification evidence
- Cron: 3 exceptions on 00a4f0ea (pre-fix) → 9 consecutive outcome:ok on 6a8bece2 (post-fix), 0 exceptions (/tmp/cron-tail.jsonl)
- /api/version: shortSha 30c2fb76 == HEAD
- auraspace.cafe/version.json: 30c2fb76 == HEAD (fresh Pages deploy required)
- /api/health 200; /api/promotions AURA20 live; webhook 401 (rejects unsigned — correct)
- api-client-NZHaKZz5.js: 0 localhost occurrences
- Full suite: 355 files / 3228 tests 100% (tester report)
- Code review: PASS 4/4 criteria (reviewer report)

### Out-of-scope findings (surfaced, NOT fixed)
- Old worker aura-space-worker.agencyos-openclaw.workers.dev still live serving stale SHA d746f397 — retire route
- 11 stale agencyos-openclaw refs incl. .env.example:18 MOMO_IPN_URL (payment webhook), docs/deployment.md:4, README.md:63, use-offline-sync.ts:11 (runtime fallback)
- apiVersionMiddleware dead code (never mounted)
