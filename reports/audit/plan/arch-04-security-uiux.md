# Arch Audit 04 — Security & UI/UX

**Goal:** check lại toàn bộ kiến trúc (--auto --parallel) | **Date:** 2026-09-07 | **Mode:** in-session (subagent 403 fallback)
**Scope:** worker auth/secret/headers, FE accessibility/touch/perf per ui-ux-pro-max priorities 1–3.

## Executive Summary

Security posture STRONG for an SMB app: OWASP headers complete on Pages (_headers incl. CSP+HSTS+COOP), HMAC-verified PayOS webhook + secret-gated cal webhook, JWT HS256 with constant-time-ish verify + KV denylist on logout, role-gated admin routes, parameterized SQL throughout (dynamic UPDATE fragments built from hardcoded `col = ?` strings only — values always bound). Zero secrets in src (grep sk-/AKIA/ghp_/xoxb = 0). UI/UX: aria-label coverage good (472), icon-only buttons clean; gaps: 61 imgs no dims (CLS), 0 lazy-loading, 0 prefers-reduced-motion, SameSite=None cookie w/o CSRF token.

## PART A — Security Findings

| ID | Sev | file:line | Issue | Fix |
|---|---|---|---|---|
| S1 | P1 | `worker/src/tree/auth/login.ts:79` `SameSite=None` + cookie auth (SSE fallback) | Cookie sent on ALL cross-site requests; combined with no CSRF token → state-changing POSTs from third-party origins possible on cookie-auth paths | SameSite=Lax + separate SSE token, or double-submit CSRF token |
| S2 | P2 | CORS `credentials: true` (index.ts:151) + origin allowlist regex | Allowlist present ✓ (pages.dev, auraspace.cafe, localhost) — fine; risk only if regex list grows carelessly | Keep allowlist under review; document adding origins |
| S3 | P2 | wrangler.toml `CORS_ORIGIN="*"` var — UNUSED by code (grep: only types/env.ts declares) | Dead config misleads auditors ("CORS open!") | Remove var or wire it into allowlist builder |
| S4 | P2 | rate-limit-login middleware exists but order-rate-limit inline (index.ts:170) KV get-then-put race | Non-atomic counter allows burst >5 concurrent posts | DO-based counter or KV put(count+1) single op |
| S5 | P2 | `middleware/admin-auth.js` (.js, legacy) imports verifyJWT from routes/auth.js — while .ts middleware/auth.ts imports from lib/jwt | Two parallel auth middleware files; .js version's role default ['owner','staff'] vs .ts flexible roles | Confirm .js unused (index imports .ts) then delete |
| S6 | P3 | JWT cookie `Secure; HttpOnly` ✓, expiry 7d, logout revokes via KV ✓ | None — verified good | — |
| S7 | P3 | `dangerouslySetInnerHTML` ×4: BaziExplanation (static ALLOWED/FORBIDDEN constants, hex-regex replace — safe, values hardcoded), Breadcrumbs/home (JSON-LD stringify — safe) | All 4 usages static-source → no XSS vector ✓ | Comment why safe at each site |
| S8 | P3 | SQL: all dynamic fragments (`updates.join`, `whereClause`) built from literal `col = ?` strings; user values bound via .bind() | Injection-safe pattern ✓ (openapi-inventory.ts:44-67 verified) | Keep as convention doc |
| S9 | P1 | `.env.local` untracked & NOT in .gitignore (contains only VITE_API_BASE dev URL — benign today) | One `git add -f .env.local` or future secret drop = leak | Add `.env*` glob to .gitignore (except .env.example) |
| S10 | P3 | Webhooks: PayOS HMAC-SHA256 ✓ (webhooks.ts:20-68), cal-booking secret compare uses `!==` (non-constant-time) | Timing attack theoretical (needs sub-μs network oracle — practically nil) | Use crypto.subtle timingSafeEqual-style compare if convenient |
| S11 | P2 | CSP allows `unsafe-inline` + `unsafe-eval` scripts (_headers:12 legacy GA block) | XSS blast-radius amplifier if any injection slips through | Move to nonce-based CSP; drop unsafe-eval |

## PART B — UI/UX Findings (ui-ux-pro-max priorities)

| ID | Sev | Rule | file:line | Issue | Fix |
|---|---|---|---|---|---|
| U1 | P1 | image-dimension (perf) | 61 `<img>` w/o width/height (stitch/gallery, our-story×3, luxury-cafe-1×3, subscriptions-new:127, loyalty-header:71, GenerateQR-qr-card:37) | CLS on image-heavy customer pages | Add width/height or aspect-ratio class |
| U2 | P1 | lazy-load-below-fold | 0 usages of loading="lazy" repo-wide | All images eager; menu/gallery bandwidth heavy | loading="lazy" below-fold |
| U3 | P1 | reduced-motion (a11y CRITICAL) | 0 prefers-reduced-motion usages | Animations forced on sensitive users | global.css @media disable |
| U4 | P2 | font-loading | index.html:15-16 Google Fonts CSS chain w/o preload | FOIT/CLS on slow nets (display=swap present ✓) | preload + font-display already swap; add preconnect |
| U5 | P2 | focus-states | — (not deep-scanned) | Spot check: components use Tailwind default rings; verify icon-only CTAs (menu filter buttons) keep visible focus | focus-visible ring audit |
| U6 | ✓ | touch-target-size | Spot-check navbar/menu buttons ≥44px | Passing ✓ | — |
| U7 | ✓ | aria-labels | 472 aria-labels; icon-only buttons 0 unlabelled (grep pattern) | Strong ✓ | — |
| U8 | ✓ | color-not-only | Error/success states pair icons w/ colors (BaziExplanation pattern) | ✓ | — |
| U9 | P2 | trunciine/gesture | KDS toolbar, mobile waiter UIs use native scroll | Verify no horizontal swipe hijack on menu | — |

## Top 5 Risks

1. **S1 SameSite=None cookie** — the only genuine attack surface found.
2. **S9 .env.local untracked-not-ignored** — one flag from leaking secrets.
3. **U1+U2 image perf debt** — CLS + eager loading on revenue pages.
4. **S11 CSP unsafe-inline/eval** — amplifies any future XSS.
5. **S4 rate-limit race** — abuse ceiling slightly porous.

## Unresolved Questions

- Does FE rely on cookie auth for anything besides SSE (kds-stream EventSource)? Determines S1 fix scope.
- ~~admin-auth.js orphan?~~ RESOLVED: zero importers found (grep across worker/src + root src) — `middleware/admin-auth.js` is dead code, safe delete.
- CSP `api.openrouter.ai` in legacy block (line 12 vs line 6 shows two CSP variants — which applies? `_headers` later rule wins for same path; verify intended single source of truth).
