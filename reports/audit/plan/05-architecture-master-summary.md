# Architecture Audit Master Summary — FnB-Container-Caffe

**Goal:** check lại toàn bộ kiến trúc (--auto --parallel) | **Date:** 2026-09-07

**Execution:** 4 parallel audit subagents launched → all 4 hit provider 403 rate-lock; fallback: direct in-session sequential audit (each dimension scanned independently).

**Audit dimensions:**
| # | Dimension | Report | Status |
|---|-----------|--------|--------|
| 1 | Worker Backend | [arch-01-worker-backend.md](arch-01-worker-backend.md) | ✓ Complete |
| 2 | Frontend (React/Vite) | [arch-02-frontend.md](arch-02-frontend.md) | ✓ Complete |
| 3 | Data & Schema | [arch-03-data-schema.md](arch-03-data-schema.md) | ✓ Complete |
| 4 | Security + UI/UX | [arch-04-security-uiux.md](arch-04-security-uiux.md) | ✓ Complete |

---

## Codebase Inventory (verified at scan time)

| Dimension | Metric |
|-----------|--------|
| FE source files (non-test) | 1,013 TS/TSX files, ~75k LOC |
| FE test files | 341 files, 3,115 tests, all green (43.5s) |
| FE tsc --noEmit | CLEAN (zero errors) |
| Worker route files | 93 files, ~16.9k LOC |
| Worker test files | 151 files, 1,547 tests, all green (3.8s) |
| D1 migrations | 3 trees (42 total files) — legacy scripts/migrations (7), orphan worker/migrations (11), active worker/db/migrations (24) |
| ESLint | 0 errors, 415 warnings (no-unused-vars) |
| Security headers | OWASP-complete on Pages (_headers) |

---

## Critical Findings (P0 — Fix Before Next Deploy)

| ID | Dimension | Finding | Risk |
|----|-----------|---------|------|
| D1 | Data | `deploy-cloudflare.sh:61` points at `scripts/migrations/` (7 legacy odoo files) instead of `worker/db/migrations/` (24 files with users/checkins/tenant/locality) | New envs miss entire schema; prod cannot be reproduced |
| D2 | Data | `.github/workflows/deploy.yml` runs NO migration step at all | CI deploy: worker ships with zero schema updates |

## High-Severity Findings (P1 — Fix This Sprint)

| ID | Dimension | Finding | Risk |
|----|-----------|---------|------|
| S1 | Security | Login cookie `SameSite=None` + no CSRF token on cookie-auth paths | Cross-site state-changing requests possible |
| W1 | Worker | OrderBroadcaster DO unbounded order growth (no TTL/evict) | Memory/cost leak over months |
| W3 | Worker | `doNs.get(channelId)` raw string — every distinct orderId = new DO instance | Cost explosion under load |
| W4 | Worker | KDS SSE re-polls D1 every 3s per client | DB cost scales with KDS screens |
| D3 | Data | 3rd orphan migration tree `worker/migrations/` (11 files) coexists | Split-brain risk for contributors |
| D4 | Data | Users table defined in 2 migrations (02 + 04); 02 file was overwritten, losing its CREATE | Migration archaeology confusion |
| F1 | Frontend | 18 raw `fetch()` bypasses unified ApiClient (12 files) | Inconsistent auth/error handling |
| F3 | Frontend | 61 `<img>` without width/height | CLS on customer-facing pages |
| U1 | UI/UX | Same 61 images — no `loading="lazy"` | Unnecessary bandwidth |
| U3 | UI/UX | 0 `prefers-reduced-motion` usages repo-wide | Forced animations on sensitive users |
| S9 | Security | `.env.local` untracked + NOT in .gitignore | One `git add -f` = secret leak |

## Medium-Severity Findings (P2)

| ID | Dim | Summary |
|----|-----|---------|
| W5 | Worker | openapi-*.ts files 545–708 lines (fat controllers, 200-line rule violated) |
| W6 | Worker | index.ts 513 lines — inline rate limiter + 90 imports |
| W7 | Worker | Legacy .js files (admin-auth.js orphan, birthday.ts.bak, auth-verify-fixed.ts duplicate) |
| W8 | Worker | 5 order-related route modules with overlapping concerns |
| D5 | Data | apply-migrations.sh false idempotency claim (ALTER ADD COLUMN breaks on re-run) |
| D6 | Data | Dynamic UPDATE builder duplicated ×6 across openapi routes |
| D8 | Data | 53/93 route files lack direct test coverage (money paths: payments-nowpayments, webhooks e2e, openapi-payments untested) |
| D11 | Data | ERPNext retry queue unbounded (MAX_RETRIES const not enforced in SQL) |
| F4 | FE | Rustic rebrand incomplete — luxury remnants (EB Garamond serif, LuxuryTax strings) |
| F5 | FE | Root debris: 10+ one-off fix/debug scripts + backup files |
| F6 | FE | order-failure: legacy file (184 lines) orphaned (router uses stitch variant) |
| F7 | FE | Stitch/Locale PricingPage lazy-imported but UNROUTED (dead import) |
| S4 | Sec | Order rate-limit KV get-then-put race condition |
| S11 | Sec | CSP allows `unsafe-inline` + `unsafe-eval` |
| U4 | UI | Google Fonts CSS chain without preload |

## Low-Severity Findings (P3)

| ID | Dim | Summary |
|----|-----|---------|
| W9 | Worker | Localhost bypass in orderRateLimit |
| W10 | Worker | tree/erpnext/sync.js (mixed TS/JS import chain) |
| W11 | Worker | tsconfig `moduleResolution: "bundler"` + local TS 4.9.5 → tsc fails |
| W12 | Worker | `GIT_COMMIT_SHA` hardcoded in wrangler.toml vars |
| W13 | Worker | 415 ESLint no-unused-vars warnings |
| D7 | Data | users_legacy table retained forever (PII) |
| D9 | Data | seed.sql clean (menu-items only, no PII) ✓ |
| D10 | Data | Could add composite idx_orders_status_created |
| D12 | Data | Locality migration columns unused by code yet (intentional forward-migration) |
| F8 | FE | Inline `style={{}}` 837 usages (mostly dynamic, legit) |
| F9 | FE | `[locale]/` dir: only order routed; pricing orphan |
| F10 | FE | test-results/, coverage/, all-results.json committed? |
| F11 | FE | _dist_backup/, ~/ stray dirs at root |
| S5 | Sec | admin-auth.js confirmed orphan (0 importers) — safe delete |
| S10 | Sec | Cal webhook secret compare uses `!==` (non-constant-time; theoretical risk only) |

---

## Top 5 Architecture Risks — Ranked

| Rank | Risk | Dimension | Impact |
|------|------|-----------|--------|
| 1 | **Migration split-brain** (D1+D2+D3) | Data | Cannot reproduce prod schema; new envs broken; contributor confusion |
| 2 | **SameSite=None cookie** (S1) | Security | Cross-site state-changing POSTs on cookie-auth paths |
| 3 | **DO cost leak** (W1+W3) | Worker | Unbounded per-order DO instances + order state growth |
| 4 | **Image perf debt** (F3+U1+U2) | FE/UX | CLS + eager loading on revenue-critical pages |
| 5 | **Test gaps on money paths** (D8) | Data | payments-nowpayments, webhooks e2e untested at route level |

---

## Recommended Action Plan

### Immediate (pre-next-deploy)
1. **Fix D1+D2**: Point `deploy-cloudflare.sh:61` MIGRATIONS_DIR at `worker/db/migrations/`; add migration step to CI deploy.yml; archive `scripts/migrations/` and `worker/migrations/`
2. **Fix S9**: Add `.env.local` to .gitignore
3. **Delete confirmed orphans**: `admin-auth.js`, `auth-verify-fixed.ts`, `birthday.ts.bak`, legacy `order-failure.tsx`

### This sprint
4. **S1**: Change login cookie to `SameSite=Lax`; add CSRF protection or separate SSE token path
5. **W1+W3**: Add TTL/eviction to OrderBroadcaster; use `idFromName()` for DO ids
6. **F1**: Consolidate 18 raw fetch() into ApiClient
7. **U1+U2+U3**: Add img width/height, loading="lazy", prefers-reduced-motion

### Next sprint
8. **W5+W6+W8**: Modularize openapi route files; split index.ts; consolidate order routes
9. **D6**: Extract `buildSetClause()` helper
10. **D8**: Add route-level tests for payments-nowpayments, webhooks, cron, reports
11. **S11**: Move CSP to nonce-based; drop unsafe-inline/eval

---

## Reports Index

```
reports/audit/plan/
├── 00-summary.md                           # Prior rustic rebrand plan (2026-09-06)
├── 01-risk-rank.md                         # Rustic risk ranking
├── 02-select-audits.md                     # Rustic audit selection
├── 03-allocate-resources.md                # Rustic resource allocation
├── arch-01-worker-backend.md               # NEW — Worker backend architecture
├── arch-02-frontend.md                     # NEW — Frontend architecture
├── arch-03-data-schema.md                  # NEW — Data & schema
├── arch-04-security-uiux.md                # NEW — Security + UI/UX
└── 05-architecture-master-summary.md       # NEW — This file
```
