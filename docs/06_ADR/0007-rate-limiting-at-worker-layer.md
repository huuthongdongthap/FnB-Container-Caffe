# ADR 007: Rate Limiting at Worker Layer Using KV Counters

**Date:** 2026-03-15  
**Status:** Accepted  
**Decision Maker:** Security Engineer

## Context

We needed to prevent abuse of:
- Auth endpoints (brute force login attempts)
- Order creation (spam orders, denial of service)

Requirements:
- Limit: 20 auth attempts / 5 minutes per IP
- Limit: 5 orders / 10 minutes per IP
- No external dependencies (keep within Cloudflare free tier)
- Works across all Worker instances (distributed)

Alternatives:
1. **KV counters**: Increment key per IP, TTL-based expiry
2. **D1 rate limit table**: Store counts in database
3. **Cloudflare Rate Limiting product**: $5/mo add-on
4. **No rate limiting**: Accept abuse risk

## Decision

Chose **KV-based rate limiting** because:
- Free (within KV quota)
- Fast (<1ms read/write)
- Distributed (KV is global)
- TTL built-in

Implementation: `rateLimit(limit, windowMs, keyFn)` middleware.

## Consequences

### Positive
- ✅ **Cost**: Free within KV 1k reads/day (we use ~50/day)
- ✅ **Performance**: KV access is sub-millisecond
- ✅ **Simplicity**: Small middleware function, reusable
- ✅ **Flexibility**: Different limits per route easily configurable

### Negative
- ⚠️ **KV quota**: 1,000 reads/day on Free Tier — our current usage is low but could grow
  - Mitigation: Monitor usage, upgrade KV plan if needed ($5 for 10M ops/month)
- ⚠️ **Coarse granularity**: Only IP-based (not user-based if behind proxy)
- ⚠️ **Clock skew**: TTL relies on KV expiration accuracy (generally fine)

### Risks
- **KV limits exceeded**: Would cause rate limiting to fail open (allow all) or closed (block all) depending on implementation
  - Mitigation: Fail-safe: if KV error, allow request but log warning
- **IP spoofing**: If behind proxy, need to use `CF-Connecting-IP` header
- **Shared IPs** (coffee shop, office): Legitimate users may hit limits
  - Mitigation: Adjust limits or implement per-account limits in addition to IP

## Implementation

```javascript
// Key format: rate:auth:1.2.3.4
const key = `rate:${type}:${ip}`;
const current = await kv.get(key) || 0;
if (current >= limit) {
  return new Response('Too many requests', { status: 429 });
}
await kv.put(key, current + 1, { expirationTtl: windowMs });
```

## Alternatives Considered (Rejected)

- **D1 table**: Too slow (10ms query), costs D1 ops, overkill
- **Cloudflare Rate Limiting**: Costs $5/mo, but more features (geoblocking, etc.) — may adopt later if abuse increases
- **Token bucket algorithm in-memory**: Won't work across Workers instances

## Related

- Middleware: `worker/src/middleware/rate-limit.js`
- Config: Limits in `worker/src/config.js`
- Applied to: `auth.js`, `orders.js`
