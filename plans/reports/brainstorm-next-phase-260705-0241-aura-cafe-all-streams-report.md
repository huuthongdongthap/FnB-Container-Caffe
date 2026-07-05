# AURA CAFE — Next Phase: All Streams

**Date:** 2026-07-05 02:41
**Project:** FnB-Container-Caffe (AURA CAFE)
**Mode:** brainstorm → `/ck:plan --deep --parallel`
**Verdict:** Stitch screens are the real bottleneck. Everything else is closer to done than earlier plans assumed.

---

## Current State Assessment

| Layer | Status | Evidence |
|---|---|---|
| **26 Stitch components** | ✅ Integrated, quality passed | i18n, palette, a11y, tokens all fixed |
| **Fonts** | ✅ CDN via Google Fonts | `index.html` has Space Grotesk + Cormorant Garamond CDN links |
| **Code splitting** | ✅ Vendor chunks split | 804KB main, vendor-react/vendor-i18n/vendor-ui split |
| **API integration** | ✅ Real API endpoints | Stores use `API_BASE` from `@/lib/api-client`, real D1 calls |
| **Brand isolation** | ✅ Config-driven | `config/brand.json` + `config/brand.example.json` present |
| **Productization docs** | ✅ 6 bilingual files | Client setup guide, admin manual, deployment checklist, support process |
| **Tests** | ✅ 309 unit + 129 E2E | 40+ test files, all passing |
| **28 Stitch screens** | ❌ Not yet designed | 10 customer + 18 admin pages need Stitch designs |

---

## Workstream Breakdown

### Workstream A: Stitch Screens (28 pages)

**10 Customer Pages:**
`/order-failure` · `/promotions` · `/checkin` · `/contact` · `/loyalty-calculator` · `/track-order` · `/table-reservation` · `/tv-menu` · `/subscriptions` · `/brand`

**18 Admin Pages:**
Dashboard · Staff · Customers · Manage Menu · Promotions Manager · Subscriptions Manager · Sales Reports · Broadcasts · Campaigns Manager · Chat Inbox · Checkin Approve · Birthday Config · ERPNext Sync · Invoice History · Generate QR · Metrics · Reservations · Audit Log Viewer

**Design constraints:**
- Use existing Stitch token system (dark navy `#00142c` + bronze `#efbd8a` + chrome `#c6c6c7`)
- Fonts: Space Grotesk (body) + Cormorant Garamond (display)
- Follow existing Stitch component patterns (see `StitchCheckoutNew`, `StitchMenuNew` for reference)
- i18n: bilingual VN+EN (follow `locales/en.json`, `locales/vi.json` patterns)
- ARIA + keyboard accessibility

**Approach:** 5 parallel agents, each handling 5-6 screens. Agent per batch:
- Agent A: Customer 1-5 (order-failure, promotions, checkin, contact, loyalty-calc)
- Agent B: Customer 6-10 (track-order, table-res, tv-menu, subscriptions, brand)
- Agent C: Admin 1-6 (dashboard, staff, customers, menu-mgmt, promotions, subscriptions)
- Agent D: Admin 7-12 (sales-reports, broadcasts, campaigns, chat, checkin-approve, birthday-config)
- Agent E: Admin 13-18 (erpnext-sync, invoice-history, generate-qr, metrics, reservations, audit-logs)

Each agent: Stitch generate → download HTML → convert to React component → apply tokens → quality check.

### Workstream B: Productization CLI

**What exists:** 6 bilingual docs, `config/brand.json`, deploy scripts
**What's needed:** `aura-deploy` CLI tool

**Spec:**
- `aura-deploy init` — interactive wizard: cafe name, domain, CF account, logo, brand colors
- `aura-deploy deploy` — generate brand.json + env vars + CSS vars → deploy to CF
- `aura-deploy verify` — health check on deployed instance
- Tech: Node.js/TypeScript (CLI with Commander or bare `process.argv`), template engine (EJS or simple string substitution)

**Independent of Workstream A** — can build in parallel.

### Workstream C: E2E + Monitoring

**What exists:** 129 Playwright E2E tests
**What's needed:** E2E for 13+ new routes, SEO metadata, error boundaries

**Spec:**
- Playwright tests for: order flow, container pages, events v2, admin routes
- `<HelmetHead>` meta tags on all new pages
- Error boundaries for API failures
- `web-vitals` monitoring if not present

**Depends on:** Workstream A (screens must exist to test them)

### Workstream D: Productization First Client

**Prereqs:** Workstream B (CLI tool), Workstream A (screens done)
**Goal:** Land first paying client at 15-30M VND setup + 2-5M/month support

---

## Phase Plan (5 Phases, Maximal Parallelism)

```
Phase 1 ─── Stitch Batch A ───→ Convert A ───→ Quality A ──┐
 (parallel) ├── Stitch Batch B ───→ Convert B ───→ Quality B ──┤
            ├── Stitch Batch C ───→ Convert C ───→ Quality C ──┤── Phase 4: Verify
            ├── Stitch Batch D ───→ Convert D ───→ Quality D ──┤            + Build
            ├── Stitch Batch E ───→ Convert E ───→ Quality E ──┘            + Tests
            │
            └── Productization CLI (parallel, no dependency)
                    │
Phase 2 ─── E2E Tests ─── SEO ─── Monitoring (depends on Phase 1)
                    │
Phase 3 ─── aura-deploy deploy (depends on CLI + screens)
                    │
Phase 4 ─── Quality gate: build + 309 unit + 129 E2E + new E2E
                    │
Phase 5 ─── Deploy + Land first client
```

---

## Effort Estimates

| Stream | Est. Hours | Wall-Clock (5 agents) |
|--------|-----------|----------------------|
| Stitch screens (28) | ~14h | ~3-4h |
| Convert to components | ~8h | ~2h |
| Productization CLI | ~5h | ~5h |
| E2E + SEO + Monitoring | ~3h | ~2h |
| Quality + Deploy | ~2h | ~1h |
| **Total** | **~32h** | **~10-14h** |

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Stitch MCP rate-limited on 28 consecutive calls | Batch in 5 agents, each with 5-6 calls; if timeout, retry via `get_screen` polling |
| Design inconsistency across 5 agents | Reference `DESIGN.md` + existing Stitch components as source of truth per agent; run consistency check in Phase 4 |
| Productization CLI scope creep | Ship V1 with `init` + `deploy` only; add `verify` later |
| Client acquisition uncertainty | Docs are ready; dogfood deployment first before external prospecting |

---

## Unresolved Questions

- Prioritization within 28 screens: which 5-6 customer pages are highest business impact?
- Productization CLI: NPM global package vs local script?
- E2E: run on production or local dev server?

