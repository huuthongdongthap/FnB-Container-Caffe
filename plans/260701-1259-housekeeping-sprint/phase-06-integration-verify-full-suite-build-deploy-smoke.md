---
phase: 6
title: "Integration Verify: Full Suite + Build + Deploy Smoke"
status: pending
priority: P1
dependencies: [1, 2, 3, 4, 5]
effort: 1h
---

# Phase 6: Integration Verify — Full Suite + Build + Deploy Smoke

## Overview

Final gate: run full test suite (worker + frontend), build both targets, verify no regressions. Deploy to Cloudflare Pages preview and smoke test.

## Requirements

- Functional: All tests pass. Both builds succeed. Deployed preview loads correctly.
- Non-functional: 0 TypeScript errors, 0 console.log in production code, 0 :any types added.

## Related Code Files

- All files modified in Phases 2-5
- `src/App.tsx` — verify new routes
- `worker/src/index.ts` — verify canonical worker
- All import paths updated in Phase 3 + 5

## Implementation Steps

### Gate 1: Full Test Suite

1. **Worker tests** — `cd worker && npx vitest run` — all must pass (87 + Phase 1 additions)
2. **Frontend tests** — `npx vitest run` — all 423+ must pass
3. **Test count comparison** — no decrease from baseline (510 combined)

### Gate 2: Build

4. **Frontend build** — `npm run build` — 0 errors
5. **Worker type check** — `cd worker && npx tsc --noEmit` — 0 errors
6. **Lint** — `npm run lint` — no new errors

### Gate 3: Code Quality

7. **Zero new console.log** — `grep -r "console\.log" src/ worker/src/ --include="*.ts" --include="*.tsx" --include="*.js" | grep -v __tests__ | grep -v logger`
8. **Zero new :any types** — `grep -r ": any" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__`
9. **Zero dead imports from deleted files** — `grep -r "file-allocation-registry\|use-track-order\|index\.js\|admin-auth\.js\|cors\.js\|audit-log\.js\|payment\.js" src/ worker/src/`

### Gate 4: Deploy Smoke

10. **Deploy to Cloudflare Pages preview** — `npx wrangler pages deploy dist --project-name=fnb-caffe-container --branch=main`
11. **Verify deployed site** — SPA routing works, new routes load (/about, /contact, /brand)
12. **Smoke test COD checkout** — complete order flow, verify no regressions

### Gate 5: Cleanup Verification

13. **Verify deleted files gone** — Confirm index.js, payment.js, audit-log.js, admin-auth.js, cors.js, use-track-order.ts, file-allocation-registry.ts are deleted
14. **Verify no stale references** — grep for deleted file names across entire repo

## Success Criteria

- [ ] `cd worker && npx vitest run` — 100% pass (92+ tests)
- [ ] `npx vitest run` — 423+ frontend tests pass
- [ ] `npm run build` — 0 errors
- [ ] `cd worker && npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — no new errors (49 pre-existing warnings acceptable)
- [ ] 0 new `console.log` in production code
- [ ] 0 new `:any` types in production code
- [ ] 0 dead imports from deleted files
- [ ] Deploy to Cloudflare Pages preview succeeds
- [ ] Deployed site loads: SPA routing works, new pages render
- [ ] COD checkout unaffected
- [ ] 7 deleted files confirmed gone

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Worker deploy breaks after JS deletion | Deploy frontend-only first. Worker changes are backward-compatible (TS was already mounted). |
| Import path changes break at runtime | Cloudflare Workers resolve .js → .ts correctly. Verified at build time. |
| Test count decrease from Phase 5 renames | Phase 5 only moves/renames — test imports updated in same commit. |
