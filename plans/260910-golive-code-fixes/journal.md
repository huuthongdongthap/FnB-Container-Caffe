# Journal — 260910 AURA CAFE Go-Live Code Fixes

Date: 2026-09-10
Branch: main
Commits: f013aea (feat, WIP checkout/promotions) → 772d909 (docs env trap) → d76b481 (cron fix attempt 1, FAILED) → 30c2fb7 (final cron fix + config cleanup)
Deployed: worker versions 6a8bece2 + bf9d1e89 · Pages a1ee24ba
Status: Resolved — go-live gates green

## What Happened

Four go-live blocking bugs found and fixed on the AURA CAFE deploy. All verified against live infrastructure, not assumptions.

### P0-1 — Frontend called http://localhost:8787 in prod

- Root cause: Vite env-file priority. `.env.local` (VITE_API_BASE=localhost) silently overrides `.env.production` even in `--mode production` builds. The trap: `.env.local` is meant for local dev overrides and wins the priority chain.
- Fix: `.env.production` carrying the public worker URL.
- Verified: deployed chunk `api-client-NZHaKZz5.js` contains 0 occurrences of `localhost`.

### P0-2 — Cron dead since 2026-07-01 (~70 days)

- Symptom: scheduled handler never fired. SLA checks, metrics pruning, ERPNext retry queue, Mautic sync — all silently dead for 70 days.
- First hypothesis (WRONG): named export `scheduled` + `export default app` should work; maybe switching to function-form export fixes it. Deployed as d76b481. Same error persisted. Hypothesis disproven by the runtime itself.
- True root cause: with `export default app` in `worker/src/index.ts`, workerd resolves fetch AND scheduled handlers from the DEFAULT export object only. Hono's `app` has `.fetch` but no `.scheduled` — the named `scheduled` export was invisible to workerd.
- Final fix (30c2fb7): `export default { fetch: (request, env, ctx) => app.fetch(request, env, ctx), scheduled }`, plus keep named `export { app }` (tests import it) and `export { OrderBroadcaster }` (Durable Object class).
- Verified: 9 consecutive cron `outcome:ok` on version 6a8bece2, 0 exceptions (pre-fix version 00a4f0ea had 3 exceptions).

### P1-3 — /api/version reported a 109-commits-stale SHA

- Root cause: hardcoded `GIT_COMMIT_SHA` in wrangler.toml `[vars]` takes precedence over the deploy script's `--var` flag.
- Fix: deleted the `[vars]` line; `--var` now wins.
- Verified: /api/version `shortSha 30c2fb76` == HEAD.

### P2-4 — Health check hit the wrong worker

- deploy-cloudflare.sh health-checked a stale worker URL.
- Fix: pointed at `aura-space-worker.sadec-marketing-hub.workers.dev`.

## Gates

- Full test suite: 355 files / 3228 tests, 100% pass (~48s). Report: `plans/reports/tester-260910-golive-final.md`
- Code review: PASS 4/4 criteria. Report: `plans/reports/reviewer-260910-golive-final.md`

## Lessons Learned

- **Vite env priority**: `.env.[mode].local` > `.env.[mode]` > `.env.local` > `.env`. `.env.local` SILENTLY overrides `.env.production` in production builds. Check for `.env.local` before shipping any Vite app.
- **workerd handler resolution**: when a default export exists, named handler exports are IGNORED. Ground truth is `wrangler versions view <id>` → Handlers list — it shows exactly what workerd sees (it listed the full Hono property list, not our named exports). Pairing Hono with cron triggers requires `export default { fetch, scheduled }`.
- **wrangler vars precedence**: `wrangler.toml [vars]` beats CLI `--var`. Never hardcode deploy-injected vars in config.
- **Root-cause discipline**: the first fix was deployed and STILL failed — only inspecting the Handlers list via `versions view` revealed the real cause. Verify the runtime contract; don't assume it. One failed deployed hypothesis is data, not a reason to guess again.
- **Dead crons don't alert**: ~70 days of silent cron failure across SLA checks, metrics pruning, ERPNext retry queue, Mautic sync. Cron triggers that stop don't error — they just stop. Monitor cron outcome events, not just deploy success.

## Out-of-Scope Follow-Ups (surfaced, not fixed)

- Old worker `aura-space-worker.agencyos-openclaw.workers.dev` still live, serving stale SHA d746f397 — retire route.
- 11 stale `agencyos-openclaw` refs, incl. `.env.example:18` MOMO_IPN_URL (payment webhook), `docs/deployment.md:4`, `README.md:63`, `use-offline-sync.ts:11` (runtime fallback).
- `apiVersionMiddleware` dead code (never mounted).
