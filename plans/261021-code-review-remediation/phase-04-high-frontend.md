# Phase 04: High Priority Frontend & Integration Fixes

**Priority:** HIGH  
**Estimated Effort:** 3-4 hours  
**Dependencies:** Phase 01 (strict mode), Phase 02 (SSE auth)  
**Owner:** Frontend-A, Frontend-B (parallel)

---

## Findings Addressed

| # | Finding | File | Line |
|---|---------|------|------|
| 10 | `useOrderStore` SSE/polling race condition | `src/hooks/stores/use-order-store.ts` | 88-113 |
| 11 | `apiFetch` auto-attaches Bearer + cookies — CSRF/XSS risk | `src/lib/api-client.ts` | 89-96 |
| 14 | Vite dev proxy hardcodes production worker URL | `vite.config.js` | 60 |

---

## Context Links

- Code Review: `../reports/code-review-architecture-20261021.md` (High Issues 10, 11, 14)

---

## Overview

Fix frontend race conditions, resolve dual auth transport vulnerability, and fix development environment pointing to production.

---

## Key Insights

- SSE `onerror` → `startPolling` → `stopPolling` clears interval, but SSE may reconnect internally → duplicate pollers
- `credentials: 'include'` sends cookies, but `apiFetch` also adds Bearer from localStorage — choose ONE
- Dev proxy hitting production API breaks offline dev and leaks traffic

---

## Requirements

### Functional
- [ ] SSE/polling: single active poller, use `AbortController` for fetch cancellation
- [x] Single auth transport: **Cookie for reads, Bearer for writes** (CSRF guard rejects cookie on mutating methods; apiFetch drops `credentials: 'include'`)
- [ ] Vite proxy: uses `VITE_API_BASE` env var, defaults to `http://localhost:8787`

### Non-Functional
- [ ] No duplicate network requests in dev tools
- [ ] Auth works in both dev and prod
- [ ] No XSS token exfiltration via localStorage

---

## Architecture

### SSE/Polling Race Fix
```ts
// src/hooks/stores/use-order-store.ts
interface OrderStore {
  // ... existing
  abortController: AbortController | null;
  isPolling: boolean;
  
  subscribeToOrder: (id: string) => {
    get().unsubscribeFromOrder();
    const controller = new AbortController();
    set({ abortController: controller });
    
    const es = new EventSource(url, { withCredentials: true });
    es.onerror = () => { 
      es.close(); 
      set({ eventSource: null }); 
      if (!controller.signal.aborted) get().startPolling(id); 
    };
  }
  
  startPolling: (id: string) => {
    const { isPolling, abortController } = get();
    if (isPolling) return;
    if (abortController?.signal.aborted) return;
    
    set({ isPolling: true });
    const controller = new AbortController();
    set({ abortController: controller });
    
    const intervalId = window.setInterval(async () => {
      if (controller.signal.aborted) { get().stopPolling(); return; }
      const { currentOrder } = get();
      if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) { get().stopPolling(); return; }
      await get().fetchOrder(id);
    }, POLL_INTERVAL);
    
    set({ pollIntervalId: intervalId });
  }
  
  stopPolling: () => {
    const { pollIntervalId, abortController } = get();
    if (pollIntervalId) clearInterval(pollIntervalId);
    abortController?.abort();
    set({ pollIntervalId: null, isPolling: false, abortController: null });
  }
}
```

### Single Auth Transport (Choose Bearer — Recommended)
```ts
// src/lib/api-client.ts:89-96
const token = typeof window !== 'undefined' ? localStorage.getItem('aura_auth_token') : null;
if (token && !headers['Authorization']) {
  headers['Authorization'] = `Bearer ${token}`;
}
// REMOVE: credentials: 'include' from fetch options
// Use: credentials: 'omit' (default for cross-origin)
```

### Vite Proxy Fix
```js
// vite.config.js
proxy: {
  '/api': {
    target: import.meta.env.VITE_API_BASE || 'http://localhost:8787',
    changeOrigin: true,
    secure: false,
  },
}
```

---

## Related Code Files

### Modify
- `src/hooks/stores/use-order-store.ts:88-113` — SSE/polling race fix
- `src/lib/api-client.ts:89-96` — single auth transport
- `vite.config.js:60` — dev proxy target

### Read
- `src/hooks/stores/use-order-store.ts` — full store implementation
- `src/lib/api-client.ts` — full api client
- `vite.config.js` — full config

---

## Implementation Steps

### Step 1: Fix SSE/Polling Race (1.5h) — Frontend-A
1. Read `src/hooks/stores/use-order-store.ts` fully
2. Add `AbortController` and `isPolling` flag to store state
3. Refactor `subscribeToOrder`, `startPolling`, `stopPolling`
4. Test: open dev tools Network tab, verify no duplicate polls on SSE reconnect

### Step 2: Choose Single Auth Transport (1h) — Frontend-B
1. Read `src/lib/api-client.ts` and `worker/src/middleware/auth.ts`
2. **Decision**: Use Bearer tokens (localStorage) — simpler, no CSRF
   - Remove `credentials: 'include'` from all fetch calls
   - Ensure `apiFetch` only adds Bearer, never reads cookies
   - Update `authEndpointsRouter` to return token in response body (not HttpOnly cookie)
3. OR: Use HttpOnly cookies — more secure but requires CSRF protection
   - Remove Bearer auto-attach from `apiFetch`
   - Keep `credentials: 'include'`
   - Add CSRF token middleware
4. Update login/register endpoints to match chosen transport

### Step 3: Fix Vite Dev Proxy (30min) — Frontend-A
1. Edit `vite.config.js:60`
2. Use `import.meta.env.VITE_API_BASE || 'http://localhost:8787'`
3. Add `.env.local` with `VITE_API_BASE=http://localhost:8787`
4. Test: `npm run dev` → API calls go to local wrangler dev

### Step 4: Verify & Test (1h)
1. Run `npm run typecheck` (frontend)
2. Run `npm run test:ci` — focus on store, api-client tests
3. Manual tests:
   - SSE connection → no duplicate polls on reconnect
   - Auth flow works (login → token stored → requests authenticated)
   - Dev server proxies to local worker
   - No cookies sent with requests (if Bearer chosen)

---

## Todo List

- [x] Add `AbortController` + `isPolling` to `useOrderStore` state
- [x] Refactor `subscribeToOrder` with abort signal
- [x] Refactor `startPolling` with abort signal + isPolling guard
- [x] Refactor `stopPolling` to abort controller
- [x] Choose auth transport: cookie reads / Bearer writes (user-approved "Both")
- [x] Update `apiFetch`: drop `credentials: 'include'`
- [x] Add CSRF guard: `cookieWriteBlockReason` in `requireAuth` + method-scoped skip in `optionalAuth`
- [x] Fix vite proxy: `loadEnv` (import.meta.env is undefined at config load)
- [x] Tests: 19 store tests + 22 middleware tests, all mutation-verified
- [x] Run typecheck — zero errors (`typecheck:all`)
- [ ] Run full `test:ci` — in progress
- [ ] Commit changes

---

## Success Criteria

- [ ] No duplicate polling intervals in dev tools Network tab
- [ ] SSE reconnect doesn't spawn multiple pollers
- [ ] Single auth transport: either Bearer-only or Cookie-only
- [ ] No localStorage token + cookie dual send
- [ ] Vite dev proxy targets local worker (localhost:8787)
- [ ] `npm run typecheck` passes
- [ ] `npm run test:ci` passes

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Auth transport change breaks login | High | High | Test thoroughly, update both client and server |
| AbortController not supported | Low | Low | All modern browsers support, polyfill if needed |
| Vite proxy breaks in CI | Low | Medium | CI uses different config, verify build works |

---

## Next Steps

After Phase 04 complete:
- Phase 05 (High - Architecture): API versioning, duplicate types, OpenAPI type gen
- Phase 06 (Medium): Payment abstraction, legacy storage, offline flush