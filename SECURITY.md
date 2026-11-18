# Security Posture — AURA CAFE

## Headers (Cloudflare Pages `_headers`)
- ✅ **CSP**: `default-src 'self'` + explicit CDN/fonts allowlist
- ✅ **HSTS**: 1-year preload
- ✅ **X-Frame-Options**: DENY
- ✅ **Cross-Origin isolation**: COEP/COOP/COPR

## Authentication
- ✅ PBKDF2-SHA256 (100k iterations) for password hashing
- ✅ Dual-mode JWT session (`httpOnly; Secure; SameSite` cookie + Bearer fallback with CSRF origin enforcement)
- ✅ Token denylist & user-wide sibling token revocation on logout/password change (KV TTL)
- ✅ Multi-tenant RBAC isolation (`owner`, `admin`, `manager`, `supervisor`, `staff`, `cashier`, `waiter`, `kitchen`, `shipper`)

## Rate Limiting
- ✅ Order creation: 5 orders/IP/10min (worker middleware)
- ✅ Login: 5 failed attempts/IP/5min (`loginRateLimit` wired onto `POST /api/auth/login`, fail-closed `503` on production KV read errors)
- ⚠️ API: no global rate limit (recommended via Cloudflare WAF rules)

## XSS & Injection Protection
- ⚠️ CSP `unsafe-inline` retained for Vite/Tailwind runtime bootstrap
- ✅ CSV formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`) neutralized across analytics & P&L exports
- ✅ All user input escaped via React / template literals (no raw `innerHTML`)

## Recommendations
1. **Remove `unsafe-inline` from CSP**: Migrate remaining bootstrap scripts to nonce/hash CSP
2. **Add global API rate limiter**: Configure 100 req/IP/min rule at Cloudflare WAF edge
3. **Enable Cloudflare WAF**: Bot management + DDoS protection on `auraspace.cafe` & `api.auraspace.cafe`
4. **Add security.txt**: `/.well-known/security.txt` with security contact
