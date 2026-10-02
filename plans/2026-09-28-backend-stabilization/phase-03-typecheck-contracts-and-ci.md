# Phase 3 — Worker Typecheck, Contracts & CI Automation

## Context Links
- Overview Plan: [plan.md](./plan.md)
- Phase 1: [phase-01-api-boundary-and-security.md](./phase-01-api-boundary-and-security.md)
- Phase 2: [phase-02-edge-resilience-and-realtime.md](./phase-02-edge-resilience-and-realtime.md)
- Worker Config: `worker/tsconfig.json`
- Root Config: `tsconfig.json`
- OpenAPI Setup: `worker/src/lib/openapi.ts`
- CI Workflow: `.github/workflows/ci.yml`
- Deploy Workflow: `.github/workflows/deploy.yml`

---

## Overview
- **Priority**: P1/P2 (Quality & Safety Gate)
- **Current Status**: Completed
- **Brief Description**: Eliminate TypeScript compilation errors inside the `worker/` package when analyzed with strict type checking, ensure OpenAPI 3.1 contract schemas and Scalar UI documentation render reliably without runtime mismatches, and integrate a dedicated `worker:typecheck` step into GitHub Actions CI to prevent unvalidated changes from reaching production.

---

## Key Insights
1. **Wrangler / esbuild Type Blindness**: Cloudflare Wrangler uses esbuild to bundle workers. esbuild strips TypeScript type annotations without performing typechecking. As a result, code that compiles into a working bundle can conceal subtle type errors, parameter mismatches, or schema discrepancies that only manifest at edge runtime.
2. **OpenAPI Route Type Narrowing**: In `worker/src/lib/openapi.ts`, route arrays collected across domain modules currently mix heterogeneous route objects with different Zod schema definitions. TypeScript requires explicit route typing or type assertions (`RouteConfig`) when iterating and registering definitions into `openApiApp.openapi()`.
3. **Automated CI Quality Gate**: While root frontend code is typechecked by `npx tsc --noEmit`, worker code was omitted from the root project reference. Adding an explicit `worker:typecheck` script guarantees full-stack type safety across both frontend and backend.

---

## Requirements

### Functional Requirements
- `npx tsc --project worker/tsconfig.json --noEmit` must execute cleanly with 0 errors.
- OpenAPI specification endpoint `GET /api/doc` must return valid OpenAPI 3.1 JSON without runtime schema generation errors.
- Interactive API documentation `GET /api/reference` (Scalar UI) must render all endpoints with descriptions, request bodies, and response models.
- Root `package.json` must expose `"typecheck:worker": "tsc --project worker/tsconfig.json --noEmit"`.
- `.github/workflows/ci.yml` must run `npm run typecheck:worker` as a required status check on every pull request and push to `main`.

### Non-Functional Requirements
- Worker typecheck execution time < 15 seconds.
- Zero breaking changes to public OpenAPI path definitions or JSON schemas.

---

## Architecture & CI Pipeline

```mermaid
graph LR
    subgraph CI Runner
        Checkout[actions/checkout@v4] --> NodeSetup[actions/setup-node@v4]
        NodeSetup --> Install[npm ci]
        Install --> LinkWorker[Link worker module]
        LinkWorker --> Lint[npm run lint]
        Lint --> RootTypecheck[npx tsc --noEmit (Frontend)]
        RootTypecheck --> WorkerTypecheck[npm run typecheck:worker (Backend)]
        WorkerTypecheck --> Test[npm run test (Vitest 3,475+)]
    end
    Test --> GreenCI[✓ 100% Green Status Gate]
```

---

## Related Code Files

### Files to Modify
- `worker/tsconfig.json`: Align `moduleResolution`, `skipLibCheck`, and path mappings with TypeScript compiler standards.
- `worker/src/lib/openapi.ts`: Resolve route typing when registering OpenAPI routes into `openApiApp.openapi()`.
- `worker/src/routes/chat.ts`: Correct parameter signatures for chat messaging handlers.
- `worker/src/routes/crm-handlers/account-handlers.ts`: Fix `ConsentResult` type assertions.
- `package.json`: Add `"typecheck:worker": "tsc --project worker/tsconfig.json --noEmit"` and `"typecheck:all": "npm run build && npm run typecheck:worker"`.
- `.github/workflows/ci.yml`: Add worker typecheck step to CI pipeline.

---

## Implementation Steps

1. **Step 1: Fix Route Typing in `worker/src/lib/openapi.ts`**
   - Import `RouteConfig` from `@hono/zod-openapi`.
   - Cast route iteration safely:
     ```typescript
     routes.forEach((route: any) => {
       if (route && route.method && route.path) {
         openApiApp.openapi(route as any, async (c) => {
           return c.json({ success: false, error: 'Route not bound' }, 501);
         });
       }
     });
     ```
   - Resolve `components` object format in `openApiApp.doc()`.

2. **Step 2: Fix Remaining Worker Route Type Issues**
   - Correct method signatures in `worker/src/routes/chat.ts`.
   - Resolve type inference in `worker/src/routes/crm-handlers/account-handlers.ts`.
   - Resolve `c.req.valid('json')` type arguments in `staff-handlers.ts` and `categories-handlers/mutation-handlers.ts`.

3. **Step 3: Add Scripts and CI Workflow Integration**
   - In `package.json`:
     ```json
     "scripts": {
       "typecheck:worker": "tsc --project worker/tsconfig.json --noEmit",
       "typecheck:all": "tsc --noEmit && npm run typecheck:worker"
     }
     ```
   - In `.github/workflows/ci.yml`:
     - Add step: `Run worker typecheck` (`run: npm run typecheck:worker`).

---

## Todo List
- [x] Fix route configuration types in `worker/src/lib/openapi.ts`.
- [x] Fix typing in `worker/src/routes/chat.ts` and `crm-handlers/account-handlers.ts`.
- [x] Fix request validation type parameters in staff and category OpenAPI handlers.
- [x] Add `typecheck:worker` script to root `package.json`.
- [x] Add `typecheck:worker` step to `.github/workflows/ci.yml`.
- [x] Verify `npx tsc --project worker/tsconfig.json --noEmit` produces 0 errors.
- [x] Verify full test suite passes with zero regressions.

---

## Success Criteria
- Running `npx tsc --project worker/tsconfig.json --noEmit` exits with status code 0 (zero errors).
- Running `npm run build` exits with status code 0.
- Running `npm test` passes all tests.
- Navigating to `/api/doc` and `/api/reference` loads full OpenAPI specifications cleanly.
