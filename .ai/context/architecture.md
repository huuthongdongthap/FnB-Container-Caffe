---
date: 2026-09-11
version: 1.0
status: discovery snapshot
---
# ARCHITECTURE CONTEXT — what an agent needs to know to work safely

## Architecture laws (spec §2 — non-negotiable)
1. Domain owns business truth 2. UI owns presentation 3. Application owns use cases 4. API owns transport 5. DB owns persistence 6. Integration layer owns external systems 7. AI orchestrates but never redefines business truth 8. Specs define intended behavior 9. Tests/Evals prove behavior 10. One source of truth per concern. SPEC-DRIVEN > PROMPT-DRIVEN · REUSE > REINVENT · SIMPLE > CLEVER · VERIFIABLE > PLAUSIBLE · DONE = VERIFIED

## Current reality (2026-09-11 audit — full detail in docs/architecture/CURRENT_STATE.md)
- React 19 + Vite SPA (85 routes: 30 public/29 admin/21 stitch/5 mobile) → Hono Worker (91 route files, 18 domain trees, zod schemas) → D1 (31 tables) + KV (auth/rate-limit) + DO (OrderBroadcaster)
- JWT auth, 5 roles (customer/staff/waiter/manager/owner), KV session, rate-limited
- i18n vi/en (1833 keys), MD3 tokens (ADR-0006)
- Deployed: Pages `fnb-caffe-container` + Worker `aura-space-worker` (2026-09-11: FE 5b9e8842 / BE 92f52c22); cron */5
- Tests: FE 3249 + BE 1551 (all green at last deploy)

## Target shape (spec §8)
apps/{space,ops,hq} + packages/{ui,domain,application,api,db,auth,i18n,config,integrations} + .ai/ + tests/ — monorepo in this repo, old tree keeps running until each slice passes acceptance.

## Rules of engagement (what an agent may touch)
- **During Phases 0–1**: NO application code changes. Docs/artifacts only.
- **API law**: route handlers = VALIDATE → AUTHORIZE → CALL USE CASE → MAP RESULT. No business logic in handlers.
- **Business rules** never live in React components or hooks (currently violated — being extracted).
- **Migrations**: every D1 change needs down-script + rollback path (D1 point-in-time restore runbook exists).
- **Never delete behavior**: KEEP/MOVE/MERGE/REWRITE/ARCHIVE classification first (docs/architecture/REPO_MIGRATION.md matrix).
- **Tests**: move-then-fix in same commit; never weaken tests to pass (spec §29).

## Integrations (adapters only, never business truth)
ERPNext · Pretix · Mautic · Mixpost · Zalo · SpeedSMS · Resend · Stripe · NOWPayments · Telegram · Frigate · HomeAssistant · Cal-Booking · Xibo (docs-only)

## Key file pointers
- Contracts: worker/src/schemas/*.ts · API docs: POST /api/orders order_type contract
- Domain: worker/src/tree/* · Realtime: worker/src/do/OrderBroadcaster.ts
- Auth: worker/src/middleware/{auth,staff-auth}.ts + lib/jwt.ts
- Design tokens: src/components/md3 + docs/m3-token-mapping.md
- State (durable): .ai/state/ (create on first migration milestone)

## Verification protocol (spec §28)
READ AGENTS.md → read .ai/context → find spec → inspect implementation → inspect tests → identify deps → smallest safe change → implement → targeted tests → e2e/evals → diff → update state → report verification.
