# ADR 005: JWT Stateless Authentication Over Server Sessions

**Date:** 2026-03-10  
**Status:** Accepted  
**Decision Maker:** Security Architect

## Context

We needed an authentication system that:
- Works with serverless Workers (no in-memory session store)
- Scales to thousands of concurrent users
- Supports mobile and web clients
- Is secure (tamper-proof tokens)
- Does not require Redis or database lookups on every request

Alternatives:
1. **JWT (JSON Web Tokens)**: Signed tokens, stateless, client stores
2. **Encrypted cookies**: Server sets cookie, verifies on each request
3. **Database sessions**: Store session in D1, look up on every request
4. **KV sessions**: Store session ID in KV, lookup per request

## Decision

Chose **JWT** signed with `JWT_SECRET` (HMAC SHA-256).

## Consequences

### Positive
- ✅ **Stateless**: No session store needed (KV or D1)
- ✅ **Scalable**: Any Worker instance can verify token without coordination
- ✅ **Fast**: No database lookup on each request (just crypto verify)
- ✅ **Standard**: JWT is widely supported, libraries available
- ✅ **Expiration**: Built-in `exp` claim for token expiry (7 days)
- ✅ **Refresh**: Can issue new tokens with refresh endpoint

### Negative
- ⚠️ **Revocation difficulty**: Cannot invalidate single token without maintaining blocklist
  - Mitigation: Short expiry (7 days), refresh rotation
- ⚠️ **Token size**: Larger than session ID (includes payload)
- ⚠️ **Client storage**: Must store in localStorage or cookie (XSS risk if localStorage)
  - Mitigation: Use `HttpOnly` cookies for web, secure storage for mobile
- ⚠️ **Payload size limits**: Cannot store large data in token (we store only `userId`, `role`, `exp`)

### Risks
- **JWT_SECRET leakage**: If secret compromised, all tokens forgeable
  - Mitigation: Store as Cloudflare secret, rotate every 6 months
- **XSS token theft**: If token in localStorage, XSS can steal
  - Mitigation: HttpOnly cookies preferred; CSP headers to prevent XSS
- **Token replay**: Stolen token can be reused until expiry
  - Mitigation: Short expiry, device fingerprinting (optional)

## Implementation

```javascript
// Login
const token = jwt.sign(
  { userId: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
);
// Send to client via Set-Cookie: HttpOnly; Secure; SameSite=Strict

// Middleware verify
function requireAuth(ctx, next) {
  const token = ctx.req.header('Authorization')?.split(' ')[1];
  if (!token) return ctx.json({ error: 'Unauthorized' }, 401);
  const payload = jwt.verify(token, JWT_SECRET);
  ctx.state.user = payload;
  return next();
}
```

## Alternatives Considered (Rejected)

- **Database sessions**: Would require D1 query on every request (slow, 10ms latency per query)
- **KV sessions**: Better than D1 but still KV read per request (cost + latency)
- **Encrypted cookies only**: No built-in expiry, harder to implement securely

## Related

- Auth routes: `worker/src/routes/auth.js`
- Auth middleware: `worker/src/middleware/auth.js`
- Token utilities: `worker/src/lib/jwt.js`
- See `CEO-HANDOVER.md` section 10 for JWT_SECRET management
