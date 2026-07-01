---
phase: 2
title: "Worker Consolidation: Resolve Divergences + Delete JS Shims"
status: pending
priority: P1
dependencies: [1]
effort: 3h
---

# Phase 2: Worker Consolidation — Resolve Divergences + Delete JS Shims

## Overview

Resolve all 7 behavioral divergences between index.ts and index.js. After resolution, index.ts is the complete canonical worker entry point. Delete index.js. Phase 1 tests must all pass before starting.

## Requirements

- Functional: All 7 divergences resolved. index.ts handles all routes identically to what index.js did. No behavior change to any endpoint.
- Non-functional: Zero TypeScript errors. Phase 1 tests continue passing.

## Architecture

```
BEFORE:                          AFTER:
index.ts (TS, incomplete)        index.ts (TS, canonical, complete)
index.js (JS, diverged)          index.js → DELETED
```

## The 7 Divergences to Resolve

### D1: Contact dispatcher (HIGH — behavioral bug in TS)
- **Problem:** `index.ts` passes `c.req.raw` directly without stripping `/api/contact` prefix. `index.js` strips prefix before passing.
- **Fix:** Align TS with JS: strip prefix. `contactRouter.fetch(new Request(c.req.raw.url.replace('/api/contact', ''), c.req.raw), c.env, c.executionCtx)`

### D2: Reviews dispatcher (MEDIUM)
- **Problem:** `index.ts` omits `c.executionCtx` from router.fetch call. `index.js` includes it.
- **Fix:** Add `c.executionCtx` to TS: `reviewsRouter.fetch(new Request(...), c.env, c.executionCtx)`

### D3: Error handler (MEDIUM — different response shapes)
- **Problem:** TS imports `errorHandler` from middleware. JS has inline handler with `{ success: false, error, detail }` shape.
- **Fix:** Verify error-handler.ts returns consistent shape. If it doesn't, make it return `{ success: false, error, detail }`.

### D4: Logger source (LOW)
- **Problem:** TS imports from `./middleware/logger`, JS from `./utils/logger.js`.
- **Fix:** Verify they're the same implementation. If not, use middleware/logger as canonical, update if needed.

### D5: changePassword source (LOW)
- **Problem:** TS imports from unified `./routes/auth`, JS from separate `./routes/change-password.js`.
- **Fix:** Verify auth.ts exports changePassword. Already confirmed — no action needed. JS separate file is vestigial.

### D6: Payment router path (LOW — naming only)
- **Problem:** TS uses `./routes/payments`, JS uses `./routes/payment.js`. Both mount at `/api/payment`.
- **Fix:** `./routes/payments.ts` is canonical. No action needed in index.ts.

### D7: Order create execCtx (LOW)
- **Problem:** TS passes `c.executionCtx` to createOrder, JS doesn't.
- **Fix:** Passing it is correct (used for waitUntil). Keep TS version. JS was missing it.

## Related Code Files

- Modify: `worker/src/index.ts` — apply all 7 fixes
- Delete: `worker/src/index.js` — after verification
- Modify: `worker/src/middleware/error-handler.ts` — verify response shape
- Read: `worker/src/middleware/logger.ts`, `worker/src/utils/logger.js` — compare

## Implementation Steps

1. **Read error-handler.ts** — verify response shape, fix if needed
2. **Compare logger implementations** — confirm middleware/logger.ts is correct
3. **Apply D1-D7 fixes to index.ts** — one commit per divergence group
4. **Run Phase 1 tests** — all must pass
5. **Run full worker test suite** — 87+ tests
6. **Build worker** — `npx tsc --noEmit` 0 errors
7. **Delete index.js** — `git rm worker/src/index.js`
8. **Verify worker still builds** — confirm no .js imports broke

## Success Criteria

- [ ] D1: Contact dispatcher strips prefix + passes execCtx
- [ ] D2: Reviews dispatcher passes execCtx
- [ ] D3: Error handler returns consistent { success, error, detail }
- [ ] D4: Logger import unified to middleware/logger
- [ ] D5-D7: Verified no action needed (already correct in TS)
- [ ] `worker/src/index.js` deleted
- [ ] All worker tests pass
- [ ] `cd worker && npx tsc --noEmit` — 0 errors
- [ ] Phase 1 tests pass (written before this phase)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Contact prefix strip breaks contactRouter | Phase 1 test catches this — test passes before, must pass after |
| Error handler shape changes break API clients | Check all frontend apiFetch error handlers for `error` field usage |
| index.js imported by something unexpected | `grep -r "index\.js" worker/src/ --include="*.js"` before delete |
