# Security Posture — AURA CAFE

## Headers (Cloudflare Pages `_headers`)
- ✅ **CSP**: `default-src 'self'` + explicit CDN/fonts allowlist
- ✅ **HSTS**: 1-year preload
- ✅ **X-Frame-Options**: DENY
- ✅ **Cross-Origin isolation**: COEP/COOP/COPR

## Authentication
- ✅ PBKDF2-SHA256 (100k iterations) for password hashing
- ✅ JWT stateless tokens (7-day TTL)
- ✅ Token denylist on logout (KV TTL)
- ✅ Admin/staff role separation

## Rate Limiting
- ✅ Order creation: 5 orders/IP/10min (worker middleware)
- ⚠️ Login: 5 failed attempts/IP/5min (middleware exists, needs route wiring)
- ⚠️ API: no global rate limit (recommended for production)

## XSS Protection
- ⚠️ CSP `unsafe-inline` required for legacy inline scripts
- 🎯 Migrate inline `<script>` to external files → remove `unsafe-inline`
- ✅ All user input escaped via template literals (no innerHTML with raw input)

## Recommendations
1. **JWT → httpOnly cookie**: Move token from localStorage to httpOnly cookie (requires session handler + CSRF token)
2. **Remove `unsafe-inline` from CSP**: After externalizing all scripts
3. **Add global API rate limiter**: 100 req/IP/min for non-auth endpoints
4. **Enable Cloudflare WAF**: Bot management + DDoS protection
5. **Add security.txt**: `/.well-known/security.txt` with contact
