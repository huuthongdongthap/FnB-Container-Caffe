# Arch Audit 01 — Worker Backend (Hono / Cloudflare Workers)

**Goal:** check lại toàn bộ kiến trúc (--auto --parallel) | **Date:** 2026-09-07 | **Mode:** in-session sequential (4 parallel subagents hit provider 403 rate-lock; fallback executed directly)
**Scope:** worker/src (411 TS files, 93 route files, 16,882 route LOC), middleware, lib, DO, cron, migrations.

## Executive Summary

Solid middleware-first architecture: global error handler + correlation ID + metrics on all routes; JWT auth via requireAuth role gates; zod validation paired after every raw `c.req.json()`; SQL uses prepared statements with parameterized dynamic fragments. Tests: 151 files / 1,547 all passing (43s). ESLint 0 errors (415 warnings — unused imports). Main risks: dual migration trees (drift-prone), DO unbounded order growth, SSE polling DB cost, openapi-* route files 550–710 lines (fat controllers).

## Findings

| ID | Sev | file:line | Issue | Fix |
|---|---|---|---|---|
| W1 | P1 | `worker/src/do/OrderBroadcaster.ts:79` | `state.orders[orderId]` grows forever — no prune/evict; DO storage cost + memory unbounded over months of orders | Add TTL/seq-window prune (e.g. keep last 500 seq or 24h) in broadcast or cron alarm |
| W2 | P1 | `worker/db/migrations/` vs `worker/migrations/` | TWO migration trees: `db/migrations/` (23 dated files, applied by scripts/apply-migrations.sh) and `migrations/` (11 numbered 004–014, never referenced by any script) | Consolidate to one dir; delete or archive the orphan tree |
| W3 | P1 | `worker/src/routes/realtime-orders.ts:34` | `doNs.get(channelId)` — raw string id (DO ids should derive via idFromName hash); every distinct orderId = new DO instance = cost + no cross-order fan-out | Use `idFromName(channelId)`; consider single DO + channel routing |
| W4 | P1 | `worker/src/routes/kds-stream.ts` (3s poll) | SSE re-polls D1 every 3s per KDS client (120s lifetime) — DB cost scales with KDS screens, not orders; superseded by DO WS design already present | Migrate KDS snapshot onto OrderBroadcaster DO broadcast; keep SSE as fallback |
| W5 | P2 | `worker/src/routes/openapi-*.ts` (8 files 545–708 lines) | Fat controllers: zod route defs + handlers + SQL in one file; violates 200-line modularization rule; 6 files share identical dynamic-UPDATE builder pattern | Extract shared `buildUpdate(table, body)` helper to lib; split route-def/handler |
| W6 | P2 | `worker/src/index.ts` (513 lines) | Router file imports ~90 route modules + inline handlers + rate limiter defined inline (orderRateLimit) — mounting order correctness is hard to review | Extract inline handlers to routes/; split index into register* modules per domain |
| W7 | P2 | `worker/src/middleware/admin-auth.js` + `routes/auth-verify-fixed.ts` + `birthday.ts.bak` | Legacy .js middleware coexists with .ts duplicate; `birthday.ts.bak` + `auth-verify-fixed.ts` (name says hotfix) committed | Delete .bak; port admin-auth.js to .ts (or confirm unused); rename -fixed into auth-verify |
| W8 | P2 | `worker/src/routes/orders.ts` vs `orders-hono.ts` vs `orders-mobile.ts` vs `kds-mobile.ts` vs `mobile-orders.ts` | 5 order-related route modules with overlapping concerns; same for tables/tables-mobile | Consolidate order domain routes into one module with sub-routers |
| W9 | P3 | `worker/src/index.ts:170-178` | orderRateLimit: localhost bypass + KV count race (non-atomic get-then-put) — burst of concurrent posts from same IP can exceed 5 | Use single `put(count+1)` pattern or DO counter; document bypass |
| W10 | P3 | `worker/src/index.ts:337` `/api/erpnext/*` owner-only, good — but `tree/erpnext/sync.js` imported in cron.ts via `.js` path | Mixed TS/JS import chain (`sync.js`) — brittle under `moduleResolution: bundler` | Convert tree/erpnext/sync.js → sync.ts |
| W11 | P3 | `worker/tsconfig.json:5` `moduleResolution: "bundler"` + repo-local TS 4.9.5 | Local `tsc --noEmit` FAILS (TS6046) — worker typecheck never runs locally or CI (CI = eslint + vitest only) | Add typescript@^5 to worker devDeps; add `tsc --noEmit` CI step |
| W12 | P3 | wrangler.toml `GIT_COMMIT_SHA = "d746f397"` hardcoded | Vars drift from actual deploys (deploy.yml doesn't inject SHA) | CI deploy step: `sed`/env inject commit SHA |
| W13 | P3 | 415 ESLint warnings (no-unused-vars) | Import hygiene debt across routes/tree | One `--fix` pass + no-unused-vars off-to-on gradually |

## Layering Assessment

`index.ts → routes/* → lib/ + schemas/ + clients/ → D1/KV/DO` — respected almost everywhere.
Violations: routes import from other routes (`cron.ts` imports `mautic-bridge`, `tree/campaigns/cron-handler`, `tree/erpnext/sync.js` — routes→tree layering is ad-hoc); `admin-auth.js` middleware imports FROM routes/auth.js (inverted dependency, noted W7). No circular-import signals found in spot checks.

## Verdict — Top 5 Architectural Risks

1. **W2 dual migration trees** — schema drift already visible (schema.sql has locality fields; only db/migrations/20260826_02 does; `migrations/` 010–014 don't exist in applied tree) → future fresh-DB bootstrap may miss tables.
2. **W1+W3 DO design** — per-order DO ids + unbounded state = cost leak + no shared fan-out.
3. **W11 no typecheck gate** — 411 TS files ship with zero tsc verification (CI gap).
4. **W5/W6 fat files** — maintainability drag on the 8 openapi-* modules + 513-line index.
5. **W4 SSE poll cost** — KDS scaling cost on D1.

## Unresolved Questions

- Is `migrations/` (004–014) intentionally kept as archive of pre-dbmigrations era? (git shows they came from earlier D1 `migrations apply` flow)
- ~~auth-verify vs -fixed~~ RESOLVED: index imports `auth-verify.ts` (line 32); `-fixed.ts` is formatting-only duplicate (diff = indentation + type annotation) → safe delete.
- DO: intended one-DO-per-order or per-channel? Current get(channelId) implies per-order.
