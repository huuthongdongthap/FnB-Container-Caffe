# Post-Hard-Cut-Clean-Slate Meta-Plan

**Date:** 2026-07-02 | **Source:** /brainstorm next plan --deep --parallel
**Context:** Hard-cut-clean-slate completed. 768/770 tests, deployed, SHA verified.

---

## Current State

| Metric | Value |
|--------|-------|
| Tests | 768/770 pass (2 pre-existing pretix failures) |
| Worker routes | 34 (9 tested, 25 untested) |
| Frontend pages | 25 (4 tested) |
| TypeScript `:any` | 30+ files |
| Zod validation | Zero endpoints |
| Deploy | Direct-to-prod, no staging, no CI smoke tests |
| External blocks | ERPNext (needs credentials), Zalo ZNS (needs OA) |

---

## Meta-Plan: 4 Sub-Projects

```
┌─────────────────────────────────────────────────────────┐
│ A: Quality Foundations (6-10h)                          │
│ Zod + TypeScript strictness + pretix fix                │
│ └─▶ B: Deploy Pipeline Hardening (3-4h)                 │
│     Staging + CI smoke tests + D1 migration             │
│     └─▶ C: Test Coverage Blitz (15-25h)                 │
│         Route handler tests + frontend component tests  │
├─────────────────────────────────────────────────────────┤
│ D: External Dependencies (user actions, parallel)       │
│ ERPNext credentials + Zalo OA registration              │
└─────────────────────────────────────────────────────────┘
```

---

## Sub-Project A: Quality Gate Foundations

**Effort:** 6-10h | **Priority:** P0 (blocks B and C)

### Scope
1. **Zod validation on all API inputs** (4-6h)
   - `zod` v4.4.3 already installed (devDeps)
   - Target: every POST/PATCH handler validates body with Zod schema
   - Priority routes: orders, payments, auth, reservations, checkin, pretix, mixpost
   - Pattern: `const schema = z.object({...}); const body = schema.parse(await c.req.json());`

2. **TypeScript `:any` cleanup** (3-4h)
   - 30+ files with `:any` or `as any`
   - Worst offenders: categories.ts (5x `(c: any)`), products.ts (5x `(c: any)`), mixpost.ts (13x), pretix.ts (13x), mautic-bridge.ts (8x)
   - Fix: proper Hono `Context<{ Bindings: Env }>` types
   - No `:any` in production code (per CLAUDE.md quality gate)

3. **Fix 2 pretix test failures** (0.5h)
   - Root cause: mock fetch Response body consumed once in `pretix-client.ts`, test reads it again
   - Fix: `res.clone().text()` in error handler, or fix mock to allow re-read
   - Result: 770/770 green

### Acceptance Criteria
- All API inputs validated via Zod schemas
- Zero `:any` types in production route files
- 770/770 tests pass
- Build: 0 TypeScript errors

---

## Sub-Project B: Deploy Pipeline Hardening

**Effort:** 3-4h | **Priority:** P1 (depends on A)

### Scope
1. **CI smoke tests** (1h)
   - Add `npm test` + health check to `.github/workflows/deploy.yml`
   - Gate: deploy only if tests pass
   
2. **D1 migration automation** (1h)
   - Add `wrangler d1 migrations apply` step to deploy workflow
   - Ensure migrations directory is in sync

3. **Staging/preview environment** (1h)
   - Use Cloudflare Pages preview deployments (already built into Pages)
   - Document staging URL pattern

4. **Deploy health check** (0.5h)
   - Verify `/api/health` + `/api/version` after deploy
   - SHA mismatch → alert (don't silently fail)

### Acceptance Criteria
- CI pipeline runs tests before deploy
- D1 migrations applied automatically
- Health check verifies SHA after deploy
- Staging environment documented and accessible

---

## Sub-Project C: Test Coverage Blitz

**Effort:** 15-25h | **Priority:** P2 (depends on A)

### Scope
1. **Route handler tests** (10-15h)
   - 25 untested routes: categories, products, customers, checkin, referrals, reports, reservations, promotions, birthdays, admin-loyalty, subscriptions, zalo, webhooks, shifts, tables, version, cron
   - Pattern: mock D1 + test each HTTP method
   - Priority: customer-facing routes first (checkin, reservations, referrals, products)

2. **Frontend component tests** (5-10h)
   - Zero-coverage zones: events (3 components), tv-menu (3), admin (10 of 11)
   - Critical paths: checkout, payment, order tracking, loyalty
   - Use Vitest + React Testing Library (already set up)

### Acceptance Criteria
- All 34 routes have at least basic handler tests (happy + error paths)
- Frontend coverage ≥50% (from current ~15%)
- No regressions in existing test suite

---

## Sub-Project D: External Dependencies (User Actions)

**Effort:** Variable (external) | **Priority:** P3 (parallel, not blocking)

### Scope
1. **ERPNext credentials**
   - Acquire self-hosted ERPNext instance URL + API key
   - Unblocks Phase 08 E2E (70% code complete)
   - Contact: ERPNext hosting provider or self-host

2. **Zalo ZNS activation**
   - Complete Zalo OA business verification (3-7 day review)
   - Replace 4 placeholder template IDs with approved templates
   - Unblocks ZNS notification functionality (currently no-op)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Zod migration breaks existing API contracts | High | Strict schemas match current manual validation exactly |
| TypeScript strictness reveals hidden bugs | Medium | Per-file cleanup, not bulk. Test after each file |
| Frontend tests flaky in CI | Medium | Start with critical paths only. Use mock service worker |
| ERPNext instance unavailable indefinitely | Low | Phase 08 code preserved. Can be done later |
| Zalo OA rejected | Low | Re-submit with corrections. Template approval is standard |

---

## Success Metrics (End of Meta-Plan)

- 770/770 tests pass (0 failures)
- Zero `:any` types in production code
- Zod validation on all API inputs
- CI pipeline: test → build → deploy → health check → verify
- Route test coverage: 34/34 routes (from 9/34)
- Frontend test coverage: ≥50% (from ~15%)

---

## Build Order

```
Phase 1: Sub-project A (Quality foundations) → ship independently
Phase 2: Sub-project B (Pipeline hardening) → ship independently
Phase 3: Sub-project C (Test coverage) → ship incrementally
Phase 4: Sub-project D (External unblock) → when ready

Each phase is independently shippable and verifiable.
```

---

## Next Step

`/ck:plan` with Sub-project A scope (Quality foundations):
- Zod validation on all API inputs
- TypeScript `:any` cleanup
- Fix 2 pretix test failures

Recommended: `--tdd` flag (refactors existing behavior, needs contract lock-in).
