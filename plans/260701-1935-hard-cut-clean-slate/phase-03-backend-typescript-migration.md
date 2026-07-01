---
phase: 3
title: Backend TypeScript Migration
status: completed
priority: P1
dependencies:
  - 2
effort: 12-18h
---

# Phase 3: Backend TypeScript Migration

## Overview

Convert remaining 41 JavaScript files in `worker/src/` to TypeScript. Convert CommonJS `require()` to ES module `import`. Leaf-first incremental strategy: convert files with zero dependencies first, then work up the dependency chain. **Zod validation deferred to follow-up plan** — this phase focuses on type safety only, not runtime validation.

## TDD Structure

```
Step A: Convert leaf modules        → files with 0 internal deps
Step B: Convert mid-tier modules    → files depending on leaf modules
Step C: Convert API clients         → third-party client libraries
Step D: Convert route handlers      → files depending on mid-tier + clients
Step E: Regression Gate             → worker build + tsc --noEmit + tests
```

## Requirements

- Functional: All 41 JS files converted to TypeScript with proper types
- Functional: All `require()` calls converted to ES module `import`
- Functional: `cd worker && npm run build` passes with 0 errors
- Non-functional: Zero `:any` types in converted files (use `unknown` or proper interfaces instead)
- Non-functional: Worker bundle size should not increase >10%
- Out of scope: Zod validation, `@hono/zod-validator` — deferred to follow-up plan

## Architecture

```
Conversion Order (leaf-first, bottom-up)

Layer 0: Leaf (0 internal deps) — convert first
├── utils/*.js        → utils/*.ts    (logger, config, formatters)
├── lib/constants.js  → constants.ts
└── types/*.js        → types/*.ts    (shared type definitions)

Layer 1: Mid-tier (depends on Layer 0) — convert second
├── lib/email.js      → lib/email.ts
├── lib/sms.js        → lib/sms.ts
├── lib/storage.js    → lib/storage.ts
└── middleware/*.js   → middleware/*.ts

Layer 2: Clients (depends on Layer 0-1) — convert third
├── lib/erpnext-client.js   → erpnext-client.ts
├── lib/mautic-client.js    → mautic-client.ts
├── lib/pretix-client.js    → pretix-client.ts
├── lib/mixpost-client.js   → mixpost-client.ts
├── lib/cal-com-client.js   → cal-com-client.ts
└── lib/xibo-client.js      → xibo-client.ts

Layer 3: Routes (depends on Layer 0-2) — convert last
├── routes/*.js       → routes/*.ts
└── index.js          → index.ts
```

## Related Code Files

- Convert: `worker/src/**/*.js` → `worker/src/**/*.ts` (41 files)
- Modify: `worker/tsconfig.json` (temporarily add `"src/**/*.js"` to `include` during transition)
- Modify: `package.json` (update `lint` script: `eslint worker/src/ --ext .ts` after conversion)
- Delete: Original `.js` files after successful `.ts` conversion
- Keep: `worker/src/**/*.ts` (39 existing TS files — unchanged)
- NOT in scope: Zod schemas, `@hono/zod-validator` — deferred to follow-up plan

## Implementation Steps

### Step A: Tests Before — Capture Worker Baseline
1. Run `cd worker && npm run build 2>&1` — capture build output + bundle size
2. Run worker-specific tests: `npm test -- --testPathPattern='tests/'` — capture failure count
3. Save baselines to `plans/260701-1935-hard-cut-clean-slate/audit/baseline-worker.txt`
4. Capture worker bundle size: `ls -la dist/` or `wrangler deploy --dry-run` output

### Step B: Convert Layer 0 — Leaf Modules
For each file in `utils/`, `lib/constants.js`, `types/`:
1. Rename `.js` → `.ts`
2. Replace `require('x')` with `import ... from 'x'`
3. Replace `module.exports =` with `export ...`
4. Add TypeScript types to all function signatures (use `unknown` not `any`)
5. Run `cd worker && npx tsc --noEmit` after each file
6. Delete original `.js` file

### Step C: Convert Layer 1 — Mid-Tier Modules
For each file in `lib/`, `middleware/`:
1. Same conversion pattern as Layer 0
2. Update imports to point to new `.ts` paths
3. Verify no circular dependencies introduced
4. Run `cd worker && npx tsc --noEmit` after each file

### Step D: Convert Layer 2 — API Clients
For each third-party client (`erpnext-client.js`, `mautic-client.js`, etc.):
1. Define TypeScript interfaces for API request/response types
2. Convert function signatures with proper types
3. Handle `fetch()` response typing: `const data: ErpNextResponse = await res.json() as ErpNextResponse`
4. Keep JS backup until `.ts` version builds cleanly
5. Test each client against real API if credentials available, otherwise type-only

### Step E: Convert Layer 3 — Route Handlers
For each file in `routes/`:
1. Convert to TypeScript — types only, no runtime validation changes
2. Keep existing request parsing logic unchanged (don't add Zod)
3. Update Hono `Context` typing for typed variables where simple
4. Update `package.json` lint script: `"lint": "eslint worker/src/ --ext .ts"` (remove `js/` dir)

### Step F: Regression Gate
1. `cd worker && npm run build` → 0 errors
2. `npx tsc --noEmit` → 0 errors (from project root or worker dir)
3. `npm test` → must pass same or fewer failures than baseline
4. Verify no `.js` files remain in `worker/src/` (except intentionally kept third-party bundles)
5. Verify zero `:any` types: `grep -r ': any' worker/src/ --include='*.ts' | grep -v node_modules`
6. Verify worker bundle size ≤110% of baseline
7. Verify `npm run lint` passes with updated script

## File Inventory

| Category | Before | After |
|----------|--------|-------|
| worker/src/*.ts | 39 files | 80 files |
| worker/src/*.js | 41 files | 0 files |
| Total worker files | 80 | 80 (all TypeScript) |

## Test Scenario Matrix

| Test | Before | After |
|------|--------|-------|
| Worker build | passes | passes |
| `tsc --noEmit` | N/A (JS allowed) | 0 errors |
| Worker unit tests | 60 failures (Jest TS issue) | Same or better |
| `:any` types | N/A | 0 |
| Bundle size | baseline | ≤110% of baseline |

## Success Criteria

- [ ] All 41 JS files converted to TypeScript
- [ ] Zod validation on ALL API route inputs
- [ ] `cd worker && npm run build` passes with 0 errors
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Zero `:any` types in `worker/src/`
- [ ] All `require()` replaced with `import`
- [ ] Worker tests not regressed (same or fewer failures than baseline)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Third-party API client breaks after TS conversion | Keep JS copy until TS version tested. Convert clients last |
| Circular dependency introduced | Convert leaf-first, verify imports at each layer |
| `tsc` too strict for existing patterns | Adjust `tsconfig.json` per file — strict mode enabled incrementally |
| Worker bundle size increase | Monitor with `wrangler deploy --dry-run` after each layer |
| Route behavior changes from Zod validation | Zod `safeParse` returns 400 on invalid input — never throws. Backward compatible |
