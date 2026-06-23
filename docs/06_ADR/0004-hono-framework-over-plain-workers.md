# ADR 004: Use Hono Framework Over Plain Workers API

**Date:** 2026-03-10  
**Status:** Accepted  
**Decision Maker:** Backend Developer

## Context

We needed to build 40+ API endpoints with:
- Consistent middleware (CORS, auth, error handling)
- Clean routing structure
- Easy testing
- TypeScript support (optional)

Alternatives:
1. **Hono** (v4): Lightweight, Cloudflare-native, middleware support
2. **Plain Workers API**: No dependencies, but manual routing
3. **Fastly Compute@Edge**: Different platform, vendor lock-in
4. **Express on Workers (workers-http)**: Possible but less optimized

## Decision

Chose **Hono** because it's designed for Cloudflare Workers, has excellent middleware ecosystem, and is tiny (no bloat).

## Consequences

### Positive
- ✅ **Clean routing**: `app.get('/api/orders', handler)` — intuitive
- ✅ **Middleware chain**: Easy to add CORS, auth, logging
- ✅ **Built-in helpers**: `hono.validator`, `hono.multipart()`, `hono.zod`
- ✅ **TypeScript-ready** (though we use JS)
- ✅ **Small bundle**: Tree-shakable, minimal overhead
- ✅ **Compatibility**: Works with Cloudflare Workers features (KV, D1)

### Negative
- ⚠️ **Another dependency**: Must keep Hono version updated
- ⚠️ **Learning curve**: Team must learn Hono-specific APIs (though similar to Express)
- ⚠️ **Abstraction leak**: Some Workers features not wrapped by Hono (but most are)

### Risks
- **Framework abandonment**: Hono is actively maintained by Cloudflare, low risk
- **Version compatibility**: Hono v4 breaking changes — pinned version in `package.json`
- **Debugging**: Stack traces include Hono internals — but source maps help

## Examples

**Before (plain Workers):**
```javascript
addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/api/orders' && event.request.method === 'GET') {
    event.respondWith(handleGetOrders(event.request));
  }
  // ... 40 more routes
});
```

**After (Hono):**
```javascript
const app = new Hono();
app.get('/api/orders', requireAuth, listOrders);
app.post('/api/orders', requireAuth, createOrder);
// ... clean and organized
```

## Alternatives Considered (Rejected)

- **Plain Workers**: Too messy with 40+ routes; manual routing would be error-prone
- **Express with workers-http**: Additional layer, potential performance penalty
- **Koa**: Less Cloudflare-native, smaller ecosystem

## Related

- Worker entry point: `worker/src/index.js`
- Route files: `worker/src/routes/*.js`
- Middleware: `worker/src/middleware/*.js`
- Hono docs: https://hono.dev/
